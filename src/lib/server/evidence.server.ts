import { zipSync, strToU8 } from "fflate";
import { getSql } from "@/lib/db";
import { FRAMEWORKS, evaluateFramework } from "@/lib/compliance";
import { canonical, sha256, signDocument } from "./crypto.server";

export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula-injection guard
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows: Array<Record<string, unknown>>, cols: string[]) => [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";

export async function buildEvidenceZip(buildId: string, requestedBy: string): Promise<{ name: string; data: Uint8Array } | null> {
  const sql = await getSql();
  const b = (await sql<Record<string, any>>`select * from builds where id = ${buildId}`)[0];
  if (!b) return null;
  const findings = await sql`select id, severity, title, rule, status, package, description, note, updated_by from findings where build_id = ${buildId} order by id`;
  const quarantine = await sql`select name, version, risk, reason, decision, decided_by, decided_at, note, risk_factors, analysis from quarantine_items where build_id = ${buildId}`;
  const sbomRow = (await sql<{ id: string; signature: string | null; key_id: string | null; digest: string }>`select id, signature, key_id, digest from sboms where build = ${buildId} order by created_at desc limit 1`)[0];
  const sbomDoc = sbomRow ? (await sql<{ doc: unknown }>`select doc from sbom_docs where id = ${sbomRow.id}`)[0]?.doc : undefined;
  const rules = await sql`select id, category, label, enabled from policy_rules order by id`;
  const audit = await sql`select actor, action, target, detail, created_at from audit_events where target = ${buildId} or detail like ${`%${buildId}%`} order by id`;
  const files: Record<string, string> = {
    "scan-log.jsonl": ((b.events as unknown[]) ?? []).map((e) => JSON.stringify(e)).join("\n") + "\n",
    "findings.json": JSON.stringify(findings, null, 2),
    "quarantine-decisions.json": JSON.stringify(quarantine, null, 2),
    "lifecycle-analysis.json": JSON.stringify(b.forensic?.packages ?? [], null, 2),
    "egress-log.json": JSON.stringify(b.hosts ?? {}, null, 2),
    "policy-snapshot.json": JSON.stringify({ version: b.policy_version, enforcement: b.policy_mode, rules }, null, 2),
    "decisions-audit.json": JSON.stringify(audit, null, 2),
  };
  if (sbomDoc) files["sbom.cdx.json"] = JSON.stringify(sbomDoc, null, 2);
  if (b.forensic?.provenance) files["provenance.intoto.json"] = JSON.stringify(b.forensic.provenance, null, 2);
  const manifest = {
    schema: "buildbouncer.evidence/v1",
    build: { id: b.id, project: b.project, status: b.status, commit: b.commit, branch: b.branch, started: b.created_at, finished: b.finished_at, worker: b.worker, analysis: b.analysis_mode, override_by: b.override_by },
    generatedAt: new Date().toISOString(), requestedBy,
    sbom: sbomRow ? { id: sbomRow.id, digestSha256: sbomRow.digest, keyId: sbomRow.key_id, signatureHmacSha256: sbomRow.signature } : null,
    files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, { sha256: sha256(v), bytes: Buffer.byteLength(v) }])),
    notes: b.analysis_mode === "static" ? "Static analysis: package code was not executed. Signatures are HMAC-SHA256 with the platform signing key." : "Sample record bundled with the product demo.",
  };
  const sig = await signDocument(manifest);
  files["manifest.json"] = JSON.stringify({ ...manifest, signature: { alg: "HMAC-SHA256", keyId: sig.keyId, value: sig.signature } }, null, 2);
  files["README.txt"] = `BuildBouncer evidence packet for build #${b.id} (${b.project}).\nVerify: each file's SHA-256 is listed in manifest.json; the manifest is signed with the tenant signing key (id ${sig.keyId}).\nBuildBouncer provides evidence for your compliance programmes; it is not a certification.\n`;
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), { level: 6 });
  return { name: `buildbouncer-evidence-${b.id}.zip`, data: zip };
}

export async function complianceReport(code: string, who: string) {
  const fw = FRAMEWORKS.find((f) => f.code.toLowerCase().replace(/[^a-z0-9]+/g, "-") === code);
  if (!fw) return null;
  const sql = await getSql();
  const rules = await sql<{ id: string; enabled: boolean }>`select id, enabled from policy_rules`;
  const st = (await sql<{ enforcement_mode: string; version: string }>`select enforcement_mode, version from policy_settings where id = 'default'`)[0]!;
  const n = (await sql<{ signed: number; done: number; audit: number; last: string | null }>`select (select count(*)::int from sboms where signed) as signed, (select count(*)::int from builds where status in ('passed','warned','blocked','overridden')) as done, (select count(*)::int from audit_events) as audit, (select to_json(max(created_at))#>>'{}' from builds) as last`)[0]!;
  const ev = evaluateFramework(fw, { enabled: new Set(rules.filter((r) => r.enabled).map((r) => r.id)), signedSbom: n.signed > 0, builds: n.done > 0, audit: n.audit > 0, mode: st.enforcement_mode });
  const body = {
    framework: fw.code, title: fw.title, generatedAt: new Date().toISOString(), generatedBy: who,
    policy: { version: st.version, enforcement: st.enforcement_mode }, evidence: { signedSboms: n.signed, completedBuilds: n.done, auditEvents: n.audit, lastBuild: n.last },
    coverage: { met: ev.met, total: ev.total, percent: ev.pct },
    controls: ev.states.map((s) => ({ id: s.control.id, title: s.control.title, status: s.status, mappedRules: s.control.rules, gaps: s.missing })),
    disclaimer: "BuildBouncer provides supporting evidence only. Certification and attestations remain the responsibility of your organisation and its auditors.",
  };
  const sig = await signDocument(body);
  return { ...body, signature: { alg: "HMAC-SHA256", keyId: sig.keyId, value: sig.signature } };
}
export { canonical };
