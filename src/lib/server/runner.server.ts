import { createHash } from "node:crypto";
import { getSql, type Sql } from "@/lib/db";
import { audit } from "./audit.server";
import { signDocument } from "./crypto.server";
import { integrationSecret, notifyTeam } from "./notify.server";
import { runScan, type PolicyContext, type ScanEvent, type ScanResult } from "./scanner/engine";
import { buildProvenance } from "./scanner/sbom";

export const BUILTIN_WORKER = "control-plane-scanner";
const queue: string[] = [];
let active = 0;
const MAX_PARALLEL = Number(process.env.SCAN_CONCURRENCY ?? 2);
const BUILD_TIMEOUT_MS = 8 * 60_000;

type ProjectRow = { id: string; name: string; type: string; repo: string; branch: string; manifest: string | null; lockfile: string | null; worker_id?: string | null };

export async function loadPolicy(sql: Sql): Promise<PolicyContext> {
  const rules = await sql<{ id: string; enabled: boolean }>`select id, enabled from policy_rules`;
  const st = (await sql<{ enforcement_mode: "audit" | "warn" | "block"; version: string }>`select enforcement_mode, version from policy_settings where id = 'default'`)[0];
  const al = await sql<{ kind: string; value: string; note: string }>`select kind, value, note from allowlist_entries`;
  const q = await sql<{ name: string; version: string; decision: string; analysis: { scriptHash?: string } | null }>`select name, version, decision, analysis from quarantine_items where decision is not null`;
  const approvals = new Map<string, { scriptHash?: string }>();
  const denyPk: string[] = [];
  for (const i of q) {
    if (i.decision === "approve") approvals.set(`${i.name}@${i.version}`, { scriptHash: i.analysis?.scriptHash });
    else if (i.decision === "block") denyPk.push(i.name);
    else if (i.decision === "reject") denyPk.push(`${i.name}@${i.version}`);
  }
  const gh = (await integrationSecret(sql, "github")) ?? process.env.GITHUB_TOKEN;
  return {
    mode: st?.enforcement_mode ?? "block",
    version: st?.version ?? "1.0",
    enabled: new Set(rules.filter((r) => r.enabled).map((r) => r.id)),
    allow: {
      packages: al.filter((a) => a.kind === "package").map((a) => a.value),
      egress: al.filter((a) => a.kind === "egress").map((a) => a.value),
      maintainers: al.filter((a) => a.kind === "maintainer").map((a) => a.value),
    },
    deny: { packages: [...al.filter((a) => a.kind === "deny").map((a) => a.value), ...denyPk], egress: al.filter((a) => a.kind === "egress-deny").map((a) => a.value) },
    approvals,
    githubToken: gh,
  };
}

const fmtDuration = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

export async function enqueueBuild(opts: { projectId: string; trigger: string; requestedBy: string; branch?: string; manifest?: string; lockfile?: string; commit?: string }): Promise<{ id: string } | { error: string }> {
  const sql = await getSql();
  const p = (await sql<ProjectRow>`select id, name, type, repo, branch, manifest, lockfile, worker_id from projects where id = ${opts.projectId}`)[0];
  if (!p) return { error: "Project not found" };
  const pw = p.worker_id ? (await sql<{ id: string; name: string }>`select id, name from workers where id = ${p.worker_id} and not builtin`)[0] : undefined;
  const running = await sql`select 1 from builds where project_id = ${p.id} and status = 'running' and created_at > now() - interval '10 minutes'`;
  if (running.length) return { error: "A build for this project is already running" };
  const id = String((await sql<{ n: number }>`select nextval('build_seq')::int as n`)[0]!.n);
  const pol = (await sql<{ enforcement_mode: string; version: string }>`select enforcement_mode, version from policy_settings where id = 'default'`)[0];
  await sql`insert into builds (id, status, project_id, project, commit, branch, author, worker, duration, findings, started_ago, trigger, requested_by, policy_mode, policy_version, events, analysis_mode)
    values (${id}, 'running', ${p.id}, ${p.name}, ${opts.commit ?? "pending"}, ${opts.branch ?? p.branch}, ${opts.requestedBy}, ${pw ? pw.name : BUILTIN_WORKER}, '—', 0, '', ${opts.trigger}, ${opts.requestedBy}, ${pol?.enforcement_mode ?? "block"}, ${pol?.version ?? "1.0"}, '[]'::jsonb, 'static')`;
  if (opts.manifest) {
    // CI-supplied manifest applies to this build only (never overwrites project settings)
    await sql`update builds set summary = ${JSON.stringify({ manifest: opts.manifest, lockfile: opts.lockfile ?? null })}::jsonb where id = ${id}`;
  }
  if (pw) {
    await sql`update builds set assigned_worker = ${pw.id}, events = ${JSON.stringify([{ t: 0, kind: "info", title: "Queued for private worker", body: `Waiting for worker ${pw.name} to claim this build. Source is fetched and analysed inside your network.` }])}::jsonb where id = ${id}`;
    return { id };
  }
  queue.push(id);
  void pump();
  return { id };
}

async function pump() {
  while (active < MAX_PARALLEL && queue.length) {
    const id = queue.shift()!;
    active += 1;
    void execute(id).finally(() => {
      active -= 1;
      void pump();
    });
  }
}

async function execute(buildId: string) {
  const sql = await getSql();
  const b = (await sql<{ project_id: string; branch: string; requested_by: string; summary: { manifest?: string; lockfile?: string | null } }>`select project_id, branch, requested_by, summary from builds where id = ${buildId}`)[0];
  if (!b) return;
  const p = (await sql<ProjectRow>`select id, name, type, repo, branch, manifest, lockfile from projects where id = ${b.project_id}`)[0];
  if (!p) return;
  const started = Date.now();
  let lastWrite = 0;
  const persistEvents = async (events: ScanEvent[]) => {
    if (Date.now() - lastWrite < 400) return;
    lastWrite = Date.now();
    await sql`update builds set events = ${JSON.stringify(events)}::jsonb where id = ${buildId}`;
  };
  try {
    const policy = await loadPolicy(sql);
    const project = { ...p, branch: b.branch || p.branch, manifest: b.summary?.manifest ?? p.manifest, lockfile: b.summary?.lockfile ?? p.lockfile };
    const result = await Promise.race([
      runScan(project, policy, buildId, BUILTIN_WORKER, { onEvent: persistEvents }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Scan exceeded the 8 minute limit")), BUILD_TIMEOUT_MS)),
    ]);
    await persistResult(sql, buildId, p, project.branch, result, Date.now() - started, policy);
    const warnWorthy = result.status !== "passed";
    await notifyTeam(sql, {
      title: `Build #${buildId} ${result.status.toUpperCase()} — ${p.name}`,
      body: `${result.findings.length} findings, ${result.quarantine.length} packages quarantined (${result.summary.components} components scanned).`,
      link: `/dashboard/builds/${buildId}`,
      severity: result.status === "blocked" ? "critical" : warnWorthy ? "warn" : "success",
    }).catch(() => undefined);
  } catch (e) {
    const msg = (e as Error).message || "Scan failed";
    const cur = (await sql<{ events: ScanEvent[] }>`select events from builds where id = ${buildId}`)[0]?.events ?? [];
    cur.push({ t: Date.now() - started, kind: "block", title: "Scan failed", body: msg });
    await sql`update builds set status = 'failed', error = ${msg}, events = ${JSON.stringify(cur)}::jsonb, duration = ${fmtDuration(Date.now() - started)}, finished_at = now() where id = ${buildId}`;
    await sql`update projects set last_build = ${buildId} where id = ${p.id}`;
    await audit(sql, "scanner", "build.failed", buildId, msg);
    await notifyTeam(sql, { title: `Build #${buildId} failed — ${p.name}`, body: msg, link: `/dashboard/builds/${buildId}`, severity: "warn" }).catch(() => undefined);
  }
}

export async function persistResult(sql: Sql, buildId: string, p: ProjectRow, branch: string, r: ScanResult, ms: number, policy: { version: string; mode: string }, workerName: string = BUILTIN_WORKER, workerId: string = "builtin") {
  const finished = new Date();
  const startedOn = new Date(finished.getTime() - ms).toISOString();
  const signed = await signDocument(r.sbom);
  const provenance = buildProvenance({ project: { name: p.name, repo: p.repo, branch }, commit: r.commit, buildId, worker: workerName, startedOn, finishedOn: finished.toISOString(), policyVersion: policy.version, mode: policy.mode, sbomDigest: signed.digest });
  const provSigned = await signDocument(provenance);
  const sbomId = `sbom_${buildId}`;
  await sql.transaction(async (tx) => {
    await tx`update builds set status = ${r.status}, commit = ${r.commit.slice(0, 12)}, duration = ${fmtDuration(ms)}, findings = ${r.findings.filter((f) => f.severity !== "info").length},
      events = ${JSON.stringify(r.events)}::jsonb, hosts = ${JSON.stringify({ contacted: r.hosts, flagged: r.flaggedHosts })}::jsonb, forensic = ${JSON.stringify({ ...r.forensic, provenance: { statement: provenance, signature: provSigned.signature, keyId: provSigned.keyId } })}::jsonb,
      summary = ${JSON.stringify({ ...r.summary, source: r.source, sbomId })}::jsonb, finished_at = now(), policy_mode = ${policy.mode}, policy_version = ${policy.version} where id = ${buildId}`;
    let n = 0;
    for (const f of r.findings) {
      n += 1;
      await tx`insert into findings (id, build_id, severity, title, rule, status, project, project_id, package, description)
        values (${`VB-${f.rule}-${buildId}-${n}`}, ${buildId}, ${f.severity}, ${f.title.slice(0, 300)}, ${f.rule}, 'open', ${p.name}, ${p.id}, ${f.package ?? null}, ${f.description})`;
    }
    for (const q of r.quarantine) {
      const dup = await tx<{ id: number; decision: string | null }>`select id, decision from quarantine_items where name = ${q.name} and version = ${q.version} and project_id = ${p.id} order by id desc limit 1`;
      if (dup[0]?.decision) continue;
      if (dup[0]) {
        await tx`update quarantine_items set build_id = ${buildId}, risk = ${q.risk}, reason = ${q.reason}, scanner = ${q.scanner}, risk_factors = ${JSON.stringify(q.factors)}::jsonb, scripts = ${JSON.stringify(q.scripts)}::jsonb, analysis = ${JSON.stringify(q.analysis)}::jsonb, created_at = now() where id = ${dup[0].id}`;
      } else {
        await tx`insert into quarantine_items (name, version, project, at, lifecycle, maintainer, scanner, risk, age, reason, decision, build_id, project_id, risk_factors, scripts, analysis, weekly_downloads)
          values (${q.name}, ${q.version}, ${p.name}, '', ${q.lifecycle}, ${q.maintainer}, ${q.scanner}, ${q.risk}, ${q.age}, ${q.reason}, null, ${buildId}, ${p.id}, ${JSON.stringify(q.factors)}::jsonb, ${JSON.stringify(q.scripts)}::jsonb, ${JSON.stringify(q.analysis)}::jsonb, ${q.weeklyDownloads ?? null})`;
      }
    }
    await tx`insert into sboms (id, project, build, time_ago, components, sap, status, signed, digest, signature, key_id, project_id)
      values (${sbomId}, ${p.name}, ${buildId}, '', ${r.components.length}, ${r.components.filter((c) => c.sap).length}, 'signed', true, ${signed.digest}, ${signed.signature}, ${signed.keyId}, ${p.id})
      on conflict (id) do update set components = excluded.components, digest = excluded.digest, signature = excluded.signature, created_at = now()`;
    await tx`insert into sbom_docs (id, doc) values (${sbomId}, ${JSON.stringify(r.sbom)}::jsonb) on conflict (id) do update set doc = excluded.doc`;
    await tx`update projects set last_build = ${buildId} where id = ${p.id}`;
    await tx`update workers set builds = builds + 1 where id = ${workerId}`;
    await audit(tx, "scanner", `build.${r.status}`, buildId, `${p.name} · ${r.findings.length} findings · ${r.summary.components} components`);
  });
}

/** Process start: register the built-in worker, heartbeat it, fail builds orphaned by a restart. */
let started = false;
export async function startPlatform(): Promise<void> {
  if (started) return;
  started = true;
  const sql = await getSql();
  const region = process.env.REGION_LABEL || process.env.REGION_NAME || "Azure App Service";
  await sql`insert into workers (id, name, env, region, status, version, heartbeat_s, projects, isolation, builds, queue, builtin, sample, last_heartbeat_at)
    values ('builtin', ${BUILTIN_WORKER}, 'Control plane', ${region}, 'online', '1.0.0', 0, 0, 'static analysis', 0, 0, true, false, now())
    on conflict (id) do update set last_heartbeat_at = now(), region = excluded.region, version = excluded.version`;
  await sql`update builds set status = 'failed', error = 'Interrupted by a server restart', finished_at = now() where status = 'running' and assigned_worker is null and created_at < now() - interval '2 minutes'`;
  await sql`update builds set status = 'failed', error = 'No private worker claimed this build within 15 minutes', finished_at = now() where status = 'running' and assigned_worker is not null and created_at < now() - interval '15 minutes'`;
  const beat = () => void sql`update workers set last_heartbeat_at = now(), queue = ${queue.length} where id = 'builtin'`.catch(() => undefined);
  const t = setInterval(beat, 15_000);
  t.unref?.();
  console.log("[platform] control-plane scanner online");
}

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");


/* ───────── private worker protocol ───────── */
export async function claimJob(workerId: string) {
  const sql = await getSql();
  const j = (await sql<{ id: string; project_id: string; branch: string; summary: { manifest?: string; lockfile?: string | null } }>`
    update builds set claimed_at = now(), events = events || ${JSON.stringify([{ t: 0, kind: "ok", title: "Claimed by private worker", body: "Worker accepted the build and is scanning inside its own network." }])}::jsonb
    where id = (select id from builds where assigned_worker = ${workerId} and status = 'running' and claimed_at is null order by created_at limit 1 for update skip locked)
    returning id, project_id, branch, summary`)[0];
  if (!j) return null;
  const p = (await sql<ProjectRow>`select id, name, type, repo, branch, manifest, lockfile from projects where id = ${j.project_id}`)[0];
  if (!p) return null;
  const pol = await loadPolicy(sql);
  return {
    buildId: j.id,
    project: { ...p, branch: j.branch || p.branch, manifest: j.summary?.manifest ?? p.manifest, lockfile: j.summary?.lockfile ?? p.lockfile },
    policy: {
      mode: pol.mode, version: pol.version, enabled: [...pol.enabled], allow: pol.allow, deny: pol.deny,
      approvals: [...pol.approvals.entries()],
    },
  };
}

export async function submitResult(workerId: string, buildId: string, body: { result?: ScanResult; error?: string; durationMs?: number }) {
  const sql = await getSql();
  const w = (await sql<{ name: string }>`select name from workers where id = ${workerId}`)[0];
  const b = (await sql<{ project_id: string; branch: string }>`select project_id, branch from builds where id = ${buildId} and assigned_worker = ${workerId} and status = 'running'`)[0];
  if (!w || !b) throw new Error("Build is not assigned to this worker or already finished");
  const p = (await sql<ProjectRow>`select id, name, type, repo, branch, manifest, lockfile from projects where id = ${b.project_id}`)[0]!;
  const ms = Math.max(0, Math.min(Number(body.durationMs) || 0, 3_600_000));
  if (body.error || !body.result) {
    const msg = String(body.error ?? "Worker reported failure").slice(0, 500);
    await sql`update builds set status = 'failed', error = ${msg}, duration = ${fmtDuration(ms)}, finished_at = now() where id = ${buildId}`;
    await sql`update projects set last_build = ${buildId} where id = ${p.id}`;
    await audit(sql, `worker:${w.name}`, "build.failed", buildId, msg);
    return;
  }
  const r = body.result;
  if (!r.sbom || !Array.isArray(r.components) || !Array.isArray(r.findings) || !["blocked", "warned", "passed"].includes(r.status)) throw new Error("Malformed result");
  const pol = (await sql<{ enforcement_mode: string; version: string }>`select enforcement_mode, version from policy_settings where id = 'default'`)[0]!;
  await persistResult(sql, buildId, p, b.branch, r, ms, { version: pol.version, mode: pol.enforcement_mode }, w.name, workerId);
  await notifyTeam(sql, {
    title: `Build #${buildId} ${r.status.toUpperCase()} — ${p.name}`,
    body: `${r.findings.length} findings, ${r.quarantine.length} packages quarantined (${r.summary.components} components scanned on ${w.name}).`,
    link: `/dashboard/builds/${buildId}`,
    severity: r.status === "blocked" ? "critical" : r.status !== "passed" ? "warn" : "success",
  }).catch(() => undefined);
}
