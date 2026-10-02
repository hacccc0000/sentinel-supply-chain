import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import type { Bootstrap, BuildDetail, Role } from "@/lib/types";
import { complianceScore } from "@/lib/compliance";
import { INTEGRATION_DEFS } from "@/lib/integrations";

/* All server-only code is imported lazily so it never reaches the client bundle. */
const srv = async () => ({
  auth: await import("./auth.server"),
  crypto: await import("./crypto.server"),
  audit: (await import("./audit.server")).audit,
  runner: await import("./runner.server"),
  notify: await import("./notify.server"),
});
const iso = (c: string) => `to_json(${c})#>>'{}'`;

async function boot() {
  const s = await srv();
  await s.auth.bootstrapAdmin();
  await s.runner.startPlatform();
  return s;
}

/* ───────────── session ───────────── */
export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const s = await boot();
  const u = await s.auth.getCurrentUser();
  const signupOpen = (process.env.ALLOW_SIGNUP ?? "true") !== "false";
  const sql = await getSql();
  const n = (await sql<{ c: number }>`select count(*)::int as c from users`)[0]!.c;
  return {
    user: u ? { ...u, permissions: s.auth.ROLE_PERMISSIONS[u.role] as string[] } : null,
    signupOpen,
    needsSetup: n === 0,
    signupCodeRequired: !!process.env.SIGNUP_CODE,
  };
});

export const loginFn = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const s = await boot();
    const u = await s.auth.login(data.email, data.password);
    const sql = await getSql();
    await s.audit(sql, u, "auth.login", u.email);
    return { ok: true as const };
  });

export const signupFn = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(2).max(80), email: z.string().email().max(200), password: z.string().min(10).max(200), code: z.string().max(100).optional() }))
  .handler(async ({ data }) => {
    const s = await boot();
    const sql = await getSql();
    const n = (await sql<{ c: number }>`select count(*)::int as c from users`)[0]!.c;
    if (n > 0) {
      if ((process.env.ALLOW_SIGNUP ?? "true") === "false") throw new Error("Sign-up is disabled. Ask an administrator to create your account.");
      if (process.env.SIGNUP_CODE && data.code !== process.env.SIGNUP_CODE) throw new Error("Invalid invitation code");
    }
    const role: Role = n === 0 ? "admin" : (["admin", "operator", "reviewer", "auditor"].includes(process.env.SIGNUP_ROLE ?? "") ? (process.env.SIGNUP_ROLE as Role) : "operator");
    const id = await s.auth.createUser({ email: data.email, name: data.name, role, password: data.password });
    await s.auth.createSession(id);
    await s.audit(sql, `${data.name} <${data.email}>`, "user.signup", data.email, `role=${role}`);
    return { ok: true as const, role };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const s = await srv();
  await s.auth.destroySession();
  return { ok: true as const };
});

export const changePassword = createServerFn({ method: "POST" })
  .validator(z.object({ current: z.string().min(1), next: z.string().min(10).max(200) }))
  .handler(async ({ data }) => {
    const s = await srv();
    const u = await s.auth.requireUser();
    const sql = await getSql();
    const row = (await sql<{ password_hash: string }>`select password_hash from users where id = ${u.id}`)[0]!;
    if (!(await s.crypto.verifyPassword(data.current, row.password_hash))) throw new Error("Current password is incorrect");
    s.auth.validatePassword(data.next);
    await sql`update users set password_hash = ${await s.crypto.hashPassword(data.next)}, must_change_password = false where id = ${u.id}`;
    await s.audit(sql, u, "auth.password_change", u.email);
    return { ok: true as const };
  });

/* ───────────── read model ───────────── */
export const bootstrap = createServerFn({ method: "GET" }).handler(async (): Promise<Bootstrap> => {
  const s = await boot();
  const me = await s.auth.requireUser();
  const sql = await getSql();
  const [workers, projects, builds, quarantine, rules, setting, versions, allowlist, findings, audit, sboms, integrations, users, tokens, notifications, tenant, counts] = await Promise.all([
    sql`select id, name, env, region,
        case when sample then status when last_heartbeat_at is null then 'offline' when now() - last_heartbeat_at < interval '45 seconds' then 'online' when now() - last_heartbeat_at < interval '5 minutes' then 'degraded' else 'offline' end as status,
        version, case when sample then heartbeat_s else coalesce(extract(epoch from now() - last_heartbeat_at)::int, 0) end as heartbeat_s,
        case when builtin then (select count(*)::int from projects) else projects end as projects, isolation, builds, queue, sample, builtin
        from workers order by builtin desc, name`,
    sql`select id, name, type, repo, branch, policy, owner, last_build, (manifest is not null and manifest <> '') as has_manifest, sample from projects order by name`,
    sql.query(`select id, status, project_id, project, commit, branch, author, worker, duration, findings, ${iso("created_at")} as created_at, ${iso("finished_at")} as finished_at, trigger, requested_by, override_by, analysis_mode, policy_mode, error, sample from builds order by created_at desc limit 200`),
    sql.query(`select id, name, version, project, project_id, build_id, ${iso("created_at")} as created_at, lifecycle, maintainer, scanner, risk, age, reason, decision, decided_by, ${iso("decided_at")} as decided_at, note, risk_factors, scripts, analysis, weekly_downloads, sample from quarantine_items order by (decision is null) desc, risk desc, id desc limit 300`),
    sql`select id, category, label, description, enabled, sort_order from policy_rules order by category, sort_order`,
    sql`select enforcement_mode, version from policy_settings where id = 'default'`,
    sql.query(`select id, version, mode, published_by, note, ${iso("created_at")} as created_at, rules from policy_versions order by id desc limit 12`),
    sql`select id, kind, value, note, created_by, sample from allowlist_entries order by kind, id`,
    sql.query(`select id, build_id, severity, title, rule, status, project, project_id, package, description, note, updated_by, ${iso("created_at")} as created_at, sample from findings order by created_at desc, id limit 600`),
    sql.query(`select id, actor, action, target, detail, ${iso("created_at")} as created_at, ip from audit_events order by id desc limit 300`),
    sql.query(`select id, project, build, ${iso("created_at")} as created_at, components, sap, status, signed, digest, key_id, sample from sboms order by created_at desc limit 200`),
    sql.query(`select id, name, category, connected, note, config, (secret_enc is not null) as has_secret, ${iso("updated_at")} as updated_at from integrations order by category, name`),
    sql.query(`select id, email, name, role, active, ${iso("created_at")} as created_at, ${iso("last_login_at")} as last_login_at from users order by created_at`),
    me.role === "admin" ? sql.query(`select id, name, prefix, scope, created_by, ${iso("created_at")} as created_at, ${iso("last_used_at")} as last_used_at, revoked from api_tokens order by created_at desc`) : Promise.resolve([]),
    sql.query(`select id, title, body, link, severity, read, ${iso("created_at")} as created_at from notifications order by id desc limit 25`),
    sql`select tenant_name, region, notify_slack, notify_email from tenant_settings where id = 'default'`,
    sql`select (select count(*)::int from builds where sample) + (select count(*)::int from projects where sample) + (select count(*)::int from workers where sample) as sample_count,
        (select count(*)::int from builds where status = 'running') as running,
        (select coalesce(sum(components),0)::int from sboms where id in (select distinct on (project_id) id from sboms where project_id is not null order by project_id, created_at desc)) as comps,
        (select coalesce(sum(sap),0)::int from sboms where id in (select distinct on (project_id) id from sboms where project_id is not null order by project_id, created_at desc)) as sap_comps,
        (select count(*)::int from builds where created_at > now() - interval '24 hours') as builds_today,
        (select count(*)::int from builds where created_at > now() - interval '24 hours' and status = 'blocked') as blocked_24h,
        (select count(*)::int from builds where created_at > now() - interval '24 hours' and status in ('passed','warned','overridden')) as ok_24h,
        (select count(*)::int from findings where status = 'open' and severity = 'critical') as crit_open,
        (select count(*)::int from findings where rule like 'EGR%' ) as egr,
        (select count(*)::int from sboms where signed) as signed,
        (select count(*)::int from builds where status in ('passed','warned','blocked','overridden')) as done_builds,
        (select count(*)::int from audit_events) as audit_n`,
  ]);
  const series = await sql<{ day: string; passed: number; blocked: number; warned: number }>`
    select to_char(d, 'YYYY-MM-DD') as day,
      coalesce((select count(*)::int from builds b where b.created_at::date = d and b.status in ('passed','overridden')), 0) as passed,
      coalesce((select count(*)::int from builds b where b.created_at::date = d and b.status = 'blocked'), 0) as blocked,
      coalesce((select count(*)::int from builds b where b.created_at::date = d and b.status = 'warned'), 0) as warned
    from generate_series(current_date - 13, current_date, interval '1 day') as d`;
  const c = counts[0] as Record<string, number>;
  const enabled = new Set((rules as Array<{ id: string; enabled: boolean }>).filter((r) => r.enabled).map((r) => r.id));
  const mode = ((setting[0] as { enforcement_mode?: string } | undefined)?.enforcement_mode ?? "block") as Bootstrap["mode"];
  const policyVersion = (setting[0] as { version?: string } | undefined)?.version ?? "1.0";
  const last = (versions as Array<{ rules: Array<{ id: string; enabled: boolean }>; mode: string; version: string }>)[0];
  const snap = new Map((last?.rules ?? []).map((r) => [r.id, r.enabled]));
  const policyDirty = !last || last.mode !== mode || (rules as Array<{ id: string; enabled: boolean }>).some((r) => snap.get(r.id) !== r.enabled);
  const sk = await s.crypto.signingKey();
  const done = c.ok_24h! + c.blocked_24h!;
  return {
    me: { ...me, permissions: s.auth.ROLE_PERMISSIONS[me.role] as string[] },
    tenant: { ...(tenant[0] as { tenant_name: string; region: string; notify_slack: boolean; notify_email: boolean }), signing_key_id: sk.keyId },
    workers: workers as Bootstrap["workers"], projects: projects as Bootstrap["projects"], builds: builds as unknown as Bootstrap["builds"],
    quarantine: quarantine as unknown as Bootstrap["quarantine"], rules: rules as Bootstrap["rules"], mode, policyVersion,
    policyVersions: versions as unknown as Bootstrap["policyVersions"], policyDirty, allowlist: allowlist as Bootstrap["allowlist"],
    findings: findings as unknown as Bootstrap["findings"], audit: audit as unknown as Bootstrap["audit"], sboms: sboms as unknown as Bootstrap["sboms"],
    integrations: integrations as unknown as Bootstrap["integrations"], users: users as unknown as Bootstrap["users"], tokens: tokens as unknown as Bootstrap["tokens"],
    notifications: notifications as unknown as Bootstrap["notifications"], unread: (notifications as Array<{ read: boolean }>).filter((n) => !n.read).length,
    sampleCount: c.sample_count!, running: c.running!,
    stats: {
      buildsToday: c.builds_today!, passRate: done ? Math.round((c.ok_24h! / done) * 100) : null, blocked24h: c.blocked_24h!, series,
      components: c.comps!, sapComponents: c.sap_comps!, signedSboms: c.signed!, egressViolations: c.egr!, criticalOpen: c.crit_open!,
      pendingQuarantine: (quarantine as Array<{ decision: string | null }>).filter((q) => !q.decision).length,
      complianceScore: complianceScore({ enabled, signedSbom: c.signed! > 0, builds: c.done_builds! > 0, audit: c.audit_n! > 0, mode }),
      online: (workers as Array<{ status: string }>).filter((w) => w.status === "online").length,
    },
  };
});

export const getBuild = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1).max(20) }))
  .handler(async ({ data }): Promise<BuildDetail | null> => {
    const s = await srv();
    await s.auth.requireUser();
    const sql = await getSql();
    const b = (await sql.query(`select id, status, project_id, project, commit, branch, author, worker, duration, findings, ${iso("created_at")} as created_at, ${iso("finished_at")} as finished_at, trigger, requested_by, override_by, analysis_mode, policy_mode, error, sample, events, summary, hosts, forensic from builds where id = $1`, [data.id]))[0];
    if (!b) return null;
    const findings = await sql.query(`select id, build_id, severity, title, rule, status, project, project_id, package, description, note, updated_by, ${iso("created_at")} as created_at, sample from findings where build_id = $1 order by case severity when 'critical' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end, id`, [data.id]);
    const quarantine = await sql.query(`select id, name, version, project, project_id, build_id, ${iso("created_at")} as created_at, lifecycle, maintainer, scanner, risk, age, reason, decision, decided_by, ${iso("decided_at")} as decided_at, note, risk_factors, scripts, analysis, weekly_downloads, sample from quarantine_items where build_id = $1 order by risk desc`, [data.id]);
    const sb = (await sql<{ id: string; signed: boolean; digest: string; key_id: string | null; components: number }>`select id, signed, digest, key_id, components from sboms where build = ${data.id} order by created_at desc limit 1`)[0] ?? null;
    let components: BuildDetail["components"] = [];
    if (sb) {
      const doc = (await sql<{ doc: { components?: Array<{ name: string; version: string; licenses?: Array<{ license: { id?: string; name?: string } }>; properties?: Array<{ name: string; value: string }> }> } }>`select doc from sbom_docs where id = ${sb.id}`)[0]?.doc;
      components = (doc?.components ?? []).map((c) => {
        const p = (k: string) => c.properties?.find((x) => x.name === k)?.value;
        return { name: c.name, version: c.version, license: c.licenses?.[0]?.license.id ?? c.licenses?.[0]?.license.name ?? null, sap: p("bb:sap") === "true", status: (p("bb:status") as "ok" | "warn" | "block") ?? "ok", direct: p("bb:direct") === "true", lifecycle: p("bb:lifecycle") === "true" };
      });
    }
    return { build: b as unknown as BuildDetail["build"], findings: findings as unknown as BuildDetail["findings"], quarantine: quarantine as unknown as BuildDetail["quarantine"], components, sbom: sb };
  });

/* ───────────── projects & builds ───────────── */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const projectInput = z.object({
  name: z.string().min(2).max(80),
  type: z.string().min(2).max(40),
  repo: z.string().min(3).max(200),
  branch: z.string().min(1).max(100).default("main"),
  manifest: z.string().max(2_000_000).optional(),
  lockfile: z.string().max(12_000_000).optional(),
});

export const addProject = createServerFn({ method: "POST" }).validator(projectInput).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("projects.manage");
  const sql = await getSql();
  const id = slug(data.name) || `p-${Date.now()}`;
  if ((await sql`select 1 from projects where id = ${id}`).length) throw new Error("A project with this name already exists");
  if (data.manifest?.trim()) {
    try {
      JSON.parse(data.manifest);
    } catch {
      throw new Error("The pasted package.json is not valid JSON");
    }
  }
  const pol = (await sql<{ version: string }>`select version from policy_settings where id = 'default'`)[0];
  await sql`insert into projects (id, name, type, repo, branch, policy, owner, last_build, manifest, lockfile, created_by) values (${id}, ${data.name}, ${data.type}, ${data.repo.trim()}, ${data.branch}, ${`Strict Prod SAP CAP v${pol?.version ?? ""}`}, ${u.name}, null, ${data.manifest?.trim() || null}, ${data.lockfile?.trim() || null}, ${u.email})`;
  await s.audit(sql, u, "project.register", data.name, data.repo);
  return { ok: true as const, id };
});

export const updateProject = createServerFn({ method: "POST" }).validator(projectInput.extend({ id: z.string() })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("projects.manage");
  const sql = await getSql();
  await sql`update projects set name = ${data.name}, type = ${data.type}, repo = ${data.repo.trim()}, branch = ${data.branch}, manifest = ${data.manifest?.trim() || null}, lockfile = ${data.lockfile?.trim() || null} where id = ${data.id}`;
  await s.audit(sql, u, "project.update", data.name, data.repo);
  return { ok: true as const };
});

export const deleteProject = createServerFn({ method: "POST" }).validator(z.object({ id: z.string() })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("projects.manage");
  const sql = await getSql();
  const p = (await sql<{ name: string }>`select name from projects where id = ${data.id}`)[0];
  if (!p) throw new Error("Project not found");
  await sql`delete from projects where id = ${data.id}`;
  await s.audit(sql, u, "project.delete", p.name, "builds and findings are retained as history");
  return { ok: true as const };
});

export const getProjectManifest = createServerFn({ method: "GET" }).validator(z.object({ id: z.string() })).handler(async ({ data }) => {
  const s = await srv();
  await s.auth.requireUser();
  const sql = await getSql();
  const r = (await sql<{ manifest: string | null; lockfile: string | null; branch: string }>`select manifest, lockfile, branch from projects where id = ${data.id}`)[0];
  return { manifest: r?.manifest ?? "", lockfile: r?.lockfile ? "(lockfile saved)" : "", branch: r?.branch ?? "main" };
});

export const runProtectedBuild = createServerFn({ method: "POST" }).validator(z.object({ project_id: z.string() })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("builds.run");
  const r = await s.runner.enqueueBuild({ projectId: data.project_id, trigger: "manual", requestedBy: u.email });
  if ("error" in r) return { ok: false as const, error: r.error };
  const sql = await getSql();
  await s.audit(sql, u, "build.dispatch", r.id, data.project_id);
  return { ok: true as const, id: r.id };
});

export const overrideBuild = createServerFn({ method: "POST" }).validator(z.object({ id: z.string(), note: z.string().min(5).max(400), approvePackages: z.boolean().default(false) })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("quarantine.decide");
  const sql = await getSql();
  const b = (await sql<{ status: string }>`select status from builds where id = ${data.id}`)[0];
  if (!b) throw new Error("Build not found");
  if (b.status !== "blocked") throw new Error("Only blocked builds can be overridden");
  await sql.transaction(async (tx) => {
    await tx`update builds set status = 'overridden', override_by = ${u.email} where id = ${data.id}`;
    if (data.approvePackages) await tx`update quarantine_items set decision = 'approve', decided_by = ${u.email}, decided_at = now(), note = ${`Override on build #${data.id}: ${data.note}`} where build_id = ${data.id} and decision is null`;
    await s.audit(tx, u, "build.override", data.id, data.note);
  });
  await s.notify.notifyTeam(sql, { title: `Override approved on build #${data.id}`, body: `${u.name}: ${data.note}`, link: `/dashboard/builds/${data.id}`, severity: "warn" }).catch(() => undefined);
  return { ok: true as const };
});

export const notifyBuildTeam = createServerFn({ method: "POST" }).validator(z.object({ id: z.string() })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("builds.run");
  const sql = await getSql();
  const b = (await sql<{ project: string; status: string; findings: number }>`select project, status, findings from builds where id = ${data.id}`)[0];
  if (!b) throw new Error("Build not found");
  const r = await s.notify.notifyTeam(sql, { title: `Build #${data.id} (${b.status}) — ${b.project}`, body: `${b.findings} findings. Shared by ${u.name}.`, link: `/dashboard/builds/${data.id}`, severity: b.status === "blocked" ? "critical" : "info" });
  await s.audit(sql, u, "build.notify", data.id, r.delivered.join(",") || "in-app only");
  return { ok: true as const, delivered: r.delivered };
});

export const createGithubIssue = createServerFn({ method: "POST" }).validator(z.object({ id: z.string() })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("builds.run");
  const sql = await getSql();
  const token = (await s.notify.integrationSecret(sql, "github")) ?? process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Connect GitHub under Integrations (token with Issues: write) to file issues.");
  const b = (await sql<{ project_id: string; project: string; status: string }>`select project_id, project, status from builds where id = ${data.id}`)[0];
  if (!b) throw new Error("Build not found");
  const p = (await sql<{ repo: string }>`select repo from projects where id = ${b.project_id}`)[0];
  const m = p?.repo.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) throw new Error("Project repository is not a GitHub repository");
  const f = await sql<{ severity: string; rule: string; title: string; description: string | null }>`select severity, rule, title, description from findings where build_id = ${data.id} and severity in ('critical','high','medium') order by case severity when 'critical' then 0 when 'high' then 1 else 2 end limit 25`;
  const body = `BuildBouncer build **#${data.id}** (${b.status}) found issues in the dependency tree of \`${p!.repo}\`.\n\n${f.map((x) => `- **${x.severity.toUpperCase()}** \`${x.rule}\` — ${x.title}${x.description ? `\n  - ${x.description}` : ""}`).join("\n")}\n\nOpen build: ${s.notify.publicUrl()}/dashboard/builds/${data.id}`;
  const res = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}/issues`, { method: "POST", headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "BuildBouncer" }, body: JSON.stringify({ title: `[BuildBouncer] Build #${data.id} ${b.status}: ${f.length} findings need attention`, body }) });
  if (!res.ok) throw new Error(`GitHub refused the request (HTTP ${res.status}). The token needs Issues: write on ${p!.repo}.`);
  const issue = (await res.json()) as { html_url: string };
  await s.audit(sql, u, "build.issue", data.id, issue.html_url);
  return { ok: true as const, url: issue.html_url };
});

/* ───────────── quarantine ───────────── */
const decisionInput = z.object({ id: z.number(), decision: z.enum(["approve", "reject", "block"]), note: z.string().max(400).optional() });
async function decide(s: Awaited<ReturnType<typeof srv>>, u: import("./auth.server").SessionUser, d: { id: number; decision: "approve" | "reject" | "block"; note?: string }) {
  const sql = await getSql();
  const q = (await sql<{ name: string; version: string }>`select name, version from quarantine_items where id = ${d.id}`)[0];
  if (!q) throw new Error("Quarantine item not found");
  await sql.transaction(async (tx) => {
    await tx`update quarantine_items set decision = ${d.decision}, decided_by = ${u.email}, decided_at = now(), note = ${d.note ?? null} where id = ${d.id}`;
    if (d.decision === "block") await tx`insert into allowlist_entries (kind, value, note, created_by) values ('deny', ${q.name}, ${`Permanent block (quarantine #${d.id})`}, ${u.email}) on conflict (kind, value) do nothing`;
    await s.audit(tx, u, `quarantine.${d.decision}`, `${q.name}@${q.version}`, d.note ?? "signed decision");
  });
  return `${q.name}@${q.version}`;
}
export const decideQuarantine = createServerFn({ method: "POST" }).validator(decisionInput).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("quarantine.decide");
  return { ok: true as const, pkg: await decide(s, u, data) };
});
export const bulkDecide = createServerFn({ method: "POST" }).validator(z.object({ ids: z.array(z.number()).min(1).max(100), decision: z.enum(["approve", "reject", "block"]) })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("quarantine.decide");
  const sql = await getSql();
  let n = 0;
  for (const id of data.ids) {
    const open = await sql`select 1 from quarantine_items where id = ${id} and decision is null`;
    if (open.length) {
      await decide(s, u, { id, decision: data.decision, note: "bulk decision" });
      n += 1;
    }
  }
  return { ok: true as const, count: n };
});

/* ───────────── policy ───────────── */
export const toggleRule = createServerFn({ method: "POST" }).validator(z.object({ id: z.string(), enabled: z.boolean() })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("policy.edit");
  const sql = await getSql();
  await sql`update policy_rules set enabled = ${data.enabled} where id = ${data.id}`;
  await s.audit(sql, u, "policy.toggle", data.id, data.enabled ? "enabled" : "disabled");
  return { ok: true as const };
});
export const setEnforcement = createServerFn({ method: "POST" }).validator(z.object({ mode: z.enum(["audit", "warn", "block"]) })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("policy.edit");
  const sql = await getSql();
  await sql`update policy_settings set enforcement_mode = ${data.mode}, updated_at = now(), updated_by = ${u.email} where id = 'default'`;
  await s.audit(sql, u, "policy.enforcement", "Strict Prod SAP CAP", data.mode);
  return { ok: true as const };
});
export const publishPolicy = createServerFn({ method: "POST" }).validator(z.object({ note: z.string().max(300).default("") })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("policy.edit");
  const sql = await getSql();
  const cur = (await sql<{ version: string; enforcement_mode: string }>`select version, enforcement_mode from policy_settings where id = 'default'`)[0]!;
  const [maj, min] = cur.version.split(".").map((x) => parseInt(x, 10) || 0);
  const next = `${maj}.${(min ?? 0) + 1}`;
  const rules = await sql<{ id: string; enabled: boolean }>`select id, enabled from policy_rules order by id`;
  await sql.transaction(async (tx) => {
    await tx`update policy_settings set version = ${next} where id = 'default'`;
    await tx`insert into policy_versions (version, mode, rules, published_by, note) values (${next}, ${cur.enforcement_mode}, ${JSON.stringify(rules)}::jsonb, ${u.email}, ${data.note})`;
    await tx`update projects set policy = ${`Strict Prod SAP CAP v${next}`} where not sample`;
    await s.audit(tx, u, "policy.publish", `v${next}`, data.note || "published");
  });
  return { ok: true as const, version: next };
});

/* ───────────── allowlist / findings ───────────── */
export const addAllowlist = createServerFn({ method: "POST" })
  .validator(z.object({ kind: z.enum(["package", "maintainer", "egress", "deny", "egress-deny"]), value: z.string().min(1).max(200), note: z.string().max(200).optional() }))
  .handler(async ({ data }) => {
    const s = await srv();
    const u = await s.auth.requireUser("allowlist.edit");
    const sql = await getSql();
    const value = data.value.trim();
    const dup = await sql`select 1 from allowlist_entries where kind = ${data.kind} and value = ${value}`;
    if (dup.length) throw new Error("That entry already exists");
    await sql`insert into allowlist_entries (kind, value, note, created_by) values (${data.kind}, ${value}, ${data.note ?? ""}, ${u.email})`;
    await s.audit(sql, u, "allowlist.add", value, data.kind);
    return { ok: true as const };
  });
export const removeAllowlist = createServerFn({ method: "POST" }).validator(z.object({ id: z.number() })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("allowlist.edit");
  const sql = await getSql();
  const r = (await sql<{ value: string; kind: string }>`delete from allowlist_entries where id = ${data.id} returning value, kind`)[0];
  await s.audit(sql, u, "allowlist.remove", r?.value ?? String(data.id), r?.kind ?? "");
  return { ok: true as const };
});
export const updateFinding = createServerFn({ method: "POST" }).validator(z.object({ id: z.string(), status: z.enum(["acked", "resolved", "open"]), note: z.string().max(400).optional() })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("findings.update");
  const sql = await getSql();
  await sql`update findings set status = ${data.status}, note = ${data.note ?? null}, updated_by = ${u.email}, updated_at = now() where id = ${data.id}`;
  await s.audit(sql, u, `finding.${data.status}`, data.id, data.note ?? "");
  return { ok: true as const };
});

/* ───────────── SBOM ───────────── */
export const verifySbom = createServerFn({ method: "POST" }).validator(z.object({ id: z.string() })).handler(async ({ data }) => {
  const s = await srv();
  await s.auth.requireUser();
  const sql = await getSql();
  const r = (await sql<{ signature: string | null }>`select signature from sboms where id = ${data.id}`)[0];
  const d = (await sql<{ doc: unknown }>`select doc from sbom_docs where id = ${data.id}`)[0];
  if (!r?.signature || !d) return { ok: false as const, reason: "This record has no stored document or signature (sample data)." };
  const valid = await s.crypto.verifyDocument(d.doc, r.signature);
  return { ok: true as const, valid, keyId: (await s.crypto.signingKey()).keyId };
});

/* ───────────── workers ───────────── */
export const registerWorker = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"), env: z.string().max(60), region: z.string().min(2).max(40), isolation: z.string().max(40) }))
  .handler(async ({ data }) => {
    const s = await srv();
    const u = await s.auth.requireUser("workers.manage");
    const sql = await getSql();
    if ((await sql`select 1 from workers where name = ${data.name}`).length) throw new Error("A worker with this name already exists");
    const id = `w_${Date.now().toString(36)}`;
    const token = `bbw_${s.crypto.randomToken(24)}`;
    await sql`insert into workers (id, name, env, region, status, version, heartbeat_s, projects, isolation, builds, queue, token_hash, created_by, sample, builtin)
      values (${id}, ${data.name}, ${data.env}, ${data.region}, 'offline', '0.0.0', 0, 0, ${data.isolation}, 0, 0, ${s.crypto.sha256(token)}, ${u.email}, false, false)`;
    await s.audit(sql, u, "worker.register", data.name, data.env);
    return { ok: true as const, id, token };
  });
export const deleteWorker = createServerFn({ method: "POST" }).validator(z.object({ id: z.string() })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("workers.manage");
  const sql = await getSql();
  const w = (await sql<{ name: string; builtin: boolean }>`select name, builtin from workers where id = ${data.id}`)[0];
  if (!w) throw new Error("Worker not found");
  if (w.builtin) throw new Error("The built-in scanner cannot be removed");
  await sql`delete from workers where id = ${data.id}`;
  await s.audit(sql, u, "worker.remove", w.name);
  return { ok: true as const };
});

/* ───────────── integrations ───────────── */
export const saveIntegration = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), secret: z.string().max(2000).optional(), note: z.string().max(200).optional() }))
  .handler(async ({ data }) => {
    const s = await srv();
    const u = await s.auth.requireUser("integrations.manage");
    const def = INTEGRATION_DEFS[data.id];
    if (!def || def.kind !== "secret") throw new Error("This integration is not configurable");
    if (!data.secret?.trim()) throw new Error("Enter the value to save");
    if (data.id !== "github" && !/^https:\/\//.test(data.secret.trim())) throw new Error("Webhook URLs must start with https://");
    const sql = await getSql();
    await sql`update integrations set secret_enc = ${await s.crypto.encryptSecret(data.secret.trim())}, connected = true, note = ${data.note ?? "configured"}, updated_at = now(), updated_by = ${u.email} where id = ${data.id}`;
    await s.audit(sql, u, "integration.connect", data.id);
    return { ok: true as const };
  });
export const disconnectIntegration = createServerFn({ method: "POST" }).validator(z.object({ id: z.string() })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("integrations.manage");
  const sql = await getSql();
  await sql`update integrations set connected = false, secret_enc = null, updated_at = now() where id = ${data.id}`;
  await s.audit(sql, u, "integration.disconnect", data.id);
  return { ok: true as const };
});
export const testIntegration = createServerFn({ method: "POST" }).validator(z.object({ id: z.string() })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("integrations.manage");
  const sql = await getSql();
  const secret = await s.notify.integrationSecret(sql, data.id);
  if (!secret) return { ok: false as const, detail: "Not configured" };
  if (data.id === "github") {
    const res = await fetch("https://api.github.com/user", { headers: { authorization: `Bearer ${secret}`, "user-agent": "BuildBouncer" } }).catch(() => null);
    if (!res) return { ok: false as const, detail: "Could not reach api.github.com" };
    if (!res.ok) return { ok: false as const, detail: `GitHub rejected the token (HTTP ${res.status})` };
    const j = (await res.json()) as { login?: string };
    await s.audit(sql, u, "integration.test", "github", j.login ?? "");
    return { ok: true as const, detail: `Authenticated as ${j.login ?? "token owner"}` };
  }
  const r = await s.notify.postWebhook(data.id as "slack", secret, { title: "BuildBouncer test notification", body: `Sent by ${u.name}. Your integration is working.`, link: "/dashboard", severity: "info" });
  await s.audit(sql, u, "integration.test", data.id, r.detail);
  return { ok: r.ok, detail: r.ok ? "Test message delivered" : `Delivery failed: ${r.detail}` };
});

/* ───────────── settings, users, tokens, notifications ───────────── */
export const saveSettings = createServerFn({ method: "POST" })
  .validator(z.object({ tenant_name: z.string().min(2).max(80), region: z.string().min(2).max(40), notify_slack: z.boolean(), notify_email: z.boolean() }))
  .handler(async ({ data }) => {
    const s = await srv();
    const u = await s.auth.requireUser("settings.manage");
    const sql = await getSql();
    await sql`update tenant_settings set tenant_name = ${data.tenant_name}, region = ${data.region}, notify_slack = ${data.notify_slack}, notify_email = ${data.notify_email} where id = 'default'`;
    await s.audit(sql, u, "settings.update", data.tenant_name, data.region);
    return { ok: true as const };
  });

export const clearSampleData = createServerFn({ method: "POST" }).handler(async () => {
  const s = await srv();
  const u = await s.auth.requireUser("settings.manage");
  const sql = await getSql();
  await sql.transaction(async (tx) => {
    await tx`delete from sbom_docs where id in (select id from sboms where sample)`;
    await tx`delete from sboms where sample`;
    await tx`delete from findings where sample`;
    await tx`delete from quarantine_items where sample`;
    await tx`delete from builds where sample`;
    await tx`delete from workers where sample`;
    await tx`delete from projects where sample`;
    await tx`delete from audit_events where sample`;
    await tx`delete from allowlist_entries where sample and kind <> 'egress'`;
    await s.audit(tx, u, "settings.clear_sample", "NorthBank sample workspace", "sample records removed");
  });
  return { ok: true as const };
});

export const createMember = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(2).max(80), email: z.string().email(), role: z.enum(["admin", "operator", "reviewer", "auditor"]) }))
  .handler(async ({ data }) => {
    const s = await srv();
    const u = await s.auth.requireUser("users.manage");
    const temp = `Bb-${s.crypto.randomToken(9)}9`;
    await s.auth.createUser({ ...data, password: temp, mustChange: true });
    const sql = await getSql();
    await s.audit(sql, u, "user.create", data.email, `role=${data.role}`);
    return { ok: true as const, password: temp };
  });
export const updateMember = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), role: z.enum(["admin", "operator", "reviewer", "auditor"]).optional(), active: z.boolean().optional(), resetPassword: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const s = await srv();
    const u = await s.auth.requireUser("users.manage");
    const sql = await getSql();
    const t = (await sql<{ email: string; role: string; active: boolean }>`select email, role, active from users where id = ${data.id}`)[0];
    if (!t) throw new Error("User not found");
    if (t.role === "admin" && ((data.role && data.role !== "admin") || data.active === false)) {
      const admins = (await sql<{ c: number }>`select count(*)::int as c from users where role = 'admin' and active`)[0]!.c;
      if (admins <= 1) throw new Error("You cannot demote or deactivate the last administrator");
    }
    if (data.role) await sql`update users set role = ${data.role} where id = ${data.id}`;
    if (data.active !== undefined) {
      await sql`update users set active = ${data.active} where id = ${data.id}`;
      if (!data.active) await sql`delete from sessions where user_id = ${data.id}`;
    }
    let password: string | undefined;
    if (data.resetPassword) {
      password = `Bb-${s.crypto.randomToken(9)}9`;
      await sql`update users set password_hash = ${await s.crypto.hashPassword(password)}, must_change_password = true where id = ${data.id}`;
      await sql`delete from sessions where user_id = ${data.id}`;
    }
    await s.audit(sql, u, "user.update", t.email, JSON.stringify({ role: data.role, active: data.active, reset: data.resetPassword }));
    return { ok: true as const, password };
  });

export const createApiToken = createServerFn({ method: "POST" }).validator(z.object({ name: z.string().min(2).max(60) })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("tokens.manage");
  const sql = await getSql();
  const token = `bb_${s.crypto.randomToken(30)}`;
  await sql`insert into api_tokens (id, name, token_hash, prefix, created_by) values (${crypto.randomUUID()}, ${data.name}, ${s.crypto.sha256(token)}, ${token.slice(0, 10)}, ${u.email})`;
  await s.audit(sql, u, "token.create", data.name);
  return { ok: true as const, token };
});
export const revokeApiToken = createServerFn({ method: "POST" }).validator(z.object({ id: z.string() })).handler(async ({ data }) => {
  const s = await srv();
  const u = await s.auth.requireUser("tokens.manage");
  const sql = await getSql();
  await sql`update api_tokens set revoked = true where id = ${data.id}`;
  await s.audit(sql, u, "token.revoke", data.id);
  return { ok: true as const };
});
export const markNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const s = await srv();
  await s.auth.requireUser();
  const sql = await getSql();
  await sql`update notifications set read = true where not read`;
  return { ok: true as const };
});
