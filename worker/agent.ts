/**
 * BuildBouncer private worker agent.
 * Runs inside YOUR network: polls the control plane for builds assigned to this worker,
 * fetches the manifest/lockfile and package metadata locally, performs the full static
 * scan, and returns only the result (findings, SBOM, events) — repository contents are
 * never uploaded.
 *
 *   BB_URL=https://your-app.azurewebsites.net BB_WORKER_TOKEN=bbw_… [GITHUB_TOKEN=…] node agent
 */
import { runScan, type PolicyContext } from "../src/lib/server/scanner/engine";

const URL_ = (process.env.BB_URL ?? "").replace(/\/$/, "");
const TOKEN = process.env.BB_WORKER_TOKEN ?? "";
const POLL_MS = Number(process.env.BB_POLL_SECONDS ?? 5) * 1000;
if (!URL_ || !TOKEN) {
  console.error("BB_URL and BB_WORKER_TOKEN are required");
  process.exit(1);
}
const headers = { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(path: string, body: unknown) {
  const res = await fetch(`${URL_}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<any>;
}

async function handle(job: any) {
  const started = Date.now();
  console.log(`[agent] build #${job.buildId} · ${job.project.name}`);
  try {
    const policy: PolicyContext = {
      mode: job.policy.mode, version: job.policy.version, enabled: new Set(job.policy.enabled), allow: job.policy.allow, deny: job.policy.deny,
      approvals: new Map(job.policy.approvals), githubToken: process.env.GITHUB_TOKEN,
    };
    const result = await runScan(job.project, policy, job.buildId, "private-worker", {});
    await api("/api/worker/result", { buildId: job.buildId, result, durationMs: Date.now() - started });
    console.log(`[agent] build #${job.buildId} → ${result.status} (${result.findings.length} findings)`);
  } catch (e) {
    console.error(`[agent] build #${job.buildId} failed:`, (e as Error).message);
    await api("/api/worker/result", { buildId: job.buildId, error: (e as Error).message, durationMs: Date.now() - started }).catch(() => undefined);
  }
}

console.log(`[agent] connecting to ${URL_}`);
for (;;) {
  try {
    const r = await api("/api/worker/claim", {});
    if (r.job) {
      await handle(r.job);
      continue;
    }
  } catch (e) {
    console.error("[agent]", (e as Error).message);
  }
  await sleep(POLL_MS);
}
