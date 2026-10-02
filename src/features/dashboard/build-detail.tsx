import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Bell, CheckCircle2, Download, FileSignature, Github, Info, Loader2, Octagon, RotateCcw, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, Field, Kpi, PageHeader, Sev } from "@/components/primitives";
import { Empty, Loading, Modal, StatusBadge, Table, Tabs, Textarea, useRun } from "@/components/helpers";
import { can, useBuild, useTenant } from "@/lib/data";
import { createGithubIssue, notifyBuildTeam, overrideBuild, runProtectedBuild } from "@/lib/server/api";
import { download, fmtTime, timeAgo } from "@/lib/utils";

type Tab = "timeline" | "findings" | "components" | "egress" | "forensic" | "evidence";

export function BuildDetailPage() {
  const { buildId } = useParams({ from: "/dashboard/builds/$buildId" });
  const { data: tenant } = useTenant();
  const { data, isLoading } = useBuild(buildId);
  const run = useRun();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("timeline");
  const [override, setOverride] = useState(false);
  const [note, setNote] = useState("");
  const [approve, setApprove] = useState(true);
  if (isLoading || !tenant) return <Loading />;
  if (!data) return <Empty title="Build not found" action={<Link to="/dashboard/builds"><Button variant="secondary">Back to builds</Button></Link>} />;
  const { build: b, findings, quarantine, components, sbom } = data;
  const perms = tenant.me.permissions;
  const evidence = can(perms, "evidence.export");
  const hostsObj = Array.isArray(b.hosts) ? {} : (b.hosts as { contacted?: Array<{ host: string; count: number; allowed: boolean; note: string }>; flagged?: Array<{ host: string; package: string; reason: string; denied: boolean }> });
  const contacted = hostsObj.contacted ?? [];
  const flagged = hostsObj.flagged ?? [];
  const packages = b.forensic?.packages ?? [];
  const retry = async () => {
    const r = await run(() => runProtectedBuild({ data: { project_id: b.project_id } }));
    if (r && !r.ok) toast.error(r.error);
    if (r?.ok) void nav({ to: "/dashboard/builds/$buildId", params: { buildId: r.id } });
  };
  const sum = b.summary ?? {};
  return (
    <>
      <Link to="/dashboard/builds" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-dim hover:text-ink"><ArrowLeft className="size-3.5" />Builds</Link>
      <PageHeader
        eyebrow={`Build #${b.id}`}
        title={b.project}
        subtitle={`${b.branch}@${b.commit} · ${b.trigger}${b.requested_by ? ` by ${b.requested_by}` : ""} · ${fmtTime(b.created_at)} · policy ${b.policy_mode ?? "—"} · ${b.analysis_mode} analysis`}
        actions={
          <>
            <StatusBadge status={b.status} />
            {can(perms, "builds.run") && b.status !== "running" && <Button variant="secondary" onClick={retry}><RotateCcw className="size-4" />Re-run</Button>}
            {b.status === "blocked" && can(perms, "quarantine.decide") && <Button variant="danger" onClick={() => setOverride(true)}><ShieldOff className="size-4" />Override</Button>}
          </>
        }
      />
      {b.status === "running" && (
        <div className="mb-5 flex items-center gap-3 rounded-md border border-info/30 bg-info/8 p-4 text-sm"><Loader2 className="size-4 animate-spin text-info" />Scan in progress — resolving dependency graph, querying vulnerability data and analysing install scripts. This page updates live.</div>
      )}
      {b.status === "failed" && b.error && <div className="mb-5 rounded-md border border-danger/30 bg-danger/8 p-4 text-sm text-danger"><b>Scan failed:</b> {b.error}</div>}
      {b.status === "blocked" && <div className="mb-5 flex gap-3 rounded-md border border-danger/30 bg-danger/8 p-4 text-sm"><Octagon className="size-5 shrink-0 text-danger" /><div><div className="font-semibold text-danger">Build blocked by policy</div><div className="text-muted">The dependency graph violated enforcement rules. Nothing was installed or executed. Review the findings, then approve the packages or override with a recorded justification.</div></div></div>}
      {b.status === "overridden" && <div className="mb-5 rounded-md border border-warn/30 bg-warn/8 p-4 text-sm text-warn">Block overridden by {b.override_by}. The override is recorded in the audit log.</div>}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Components" value={sum.components ?? components.length} />
        <Kpi label="Findings" value={b.findings} tone={b.findings ? "warn" : "success"} />
        <Kpi label="Quarantined" value={quarantine.length} tone={quarantine.length ? "danger" : "ink"} />
        <Kpi label="Duration" value={b.duration || "—"} />
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[["timeline", "Timeline"], ["findings", `Findings (${findings.length})`], ["components", `Components (${components.length})`], ["egress", "Egress"], ["forensic", "Forensics"], ["evidence", "Evidence"]]} />

      {tab === "timeline" && (
        <Card className="p-5">
          {b.events.length === 0 ? <Empty title="No events recorded yet" /> : (
            <ol className="relative space-y-4 border-l border-line pl-6">
              {b.events.map((e, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[31px] grid size-5 place-items-center rounded-full border bg-elev ${e.kind === "block" ? "border-danger text-danger" : e.kind === "warn" ? "border-warn text-warn" : e.kind === "ok" ? "border-success text-success" : "border-line text-dim"}`}>
                    {e.kind === "block" ? <Octagon className="size-3" /> : e.kind === "warn" ? <AlertTriangle className="size-3" /> : e.kind === "ok" ? <CheckCircle2 className="size-3" /> : <Info className="size-3" />}
                  </span>
                  <div className="flex items-baseline justify-between gap-3"><div className="text-sm font-semibold">{e.title}</div><div className="font-mono text-2xs text-dim">+{(e.t / 1000).toFixed(1)}s</div></div>
                  <div className="text-sm text-muted">{e.body}</div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      {tab === "findings" && (
        <Card>
          {findings.length === 0 ? <Empty title="No findings" body="This build produced no policy findings." /> : (
            <Table heads={["Severity", "Finding", "Rule", "Package", "Status"]}>
              {findings.map((f) => (
                <tr key={f.id} className="border-t border-line align-top">
                  <td className="px-3.5 py-3"><Sev level={f.severity} /></td>
                  <td className="px-3.5 py-3"><div className="font-medium">{f.title}</div>{f.description && <div className="mt-0.5 max-w-xl text-xs text-muted">{f.description}</div>}</td>
                  <td className="px-3.5 py-3 font-mono text-xs">{f.rule}</td>
                  <td className="px-3.5 py-3 font-mono text-xs text-muted">{f.package ?? "—"}</td>
                  <td className="px-3.5 py-3"><Badge kind={f.status === "open" ? "warn" : "success"}>{f.status}</Badge></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === "components" && (
        <Card>
          {components.length === 0 ? <Empty title="No components recorded" body="Component inventory appears once the dependency graph is resolved." /> : (
            <Table heads={["Component", "Version", "License", "Scope", "SAP", "Status"]}>
              {components.map((c) => (
                <tr key={c.name + c.version} className="border-t border-line">
                  <td className="px-3.5 py-2.5 font-mono text-xs font-semibold">{c.name}</td>
                  <td className="px-3.5 py-2.5 font-mono text-xs text-muted">{c.version}</td>
                  <td className="px-3.5 py-2.5 text-xs text-muted">{c.license ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-xs text-muted">{c.direct ? "direct" : "transitive"}</td>
                  <td className="px-3.5 py-2.5">{c.sap && <Badge kind="navy">SAP</Badge>}</td>
                  <td className="px-3.5 py-2.5"><Badge kind={c.status === "block" ? "block" : c.status === "warn" ? "warn" : "success"}>{c.status}</Badge></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === "egress" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="border-b border-line px-5 py-3.5 text-sm font-semibold">Hosts referenced</div>
            {contacted.length === 0 ? <Empty title="No hosts recorded" /> : (
              <Table heads={["Host", "Refs", "Policy"]} min={420}>
                {contacted.map((h) => <tr key={h.host} className="border-t border-line"><td className="px-3.5 py-2.5 font-mono text-xs">{h.host}<div className="font-sans text-2xs text-dim">{h.note}</div></td><td className="px-3.5 py-2.5 tabular-nums">{h.count}</td><td className="px-3.5 py-2.5"><Badge kind={h.allowed ? "success" : "block"}>{h.allowed ? "allowed" : "denied"}</Badge></td></tr>)}
              </Table>
            )}
          </Card>
          <Card>
            <div className="border-b border-line px-5 py-3.5 text-sm font-semibold">Flagged egress</div>
            {flagged.length === 0 ? <Empty title="Nothing flagged" body="No install script referenced a denied or unrecognised host." /> : (
              <ul className="divide-y divide-line">{flagged.map((h, i) => <li key={i} className="px-5 py-3 text-sm"><div className="font-mono text-xs font-semibold text-danger">{h.host}</div><div className="text-xs text-muted">{h.package} — {h.reason}</div></li>)}</ul>
            )}
          </Card>
        </div>
      )}

      {tab === "forensic" && (
        <div className="space-y-4">
          {packages.length === 0 && !b.forensic?.sample && <Card><Empty title="No install-script forensics" body="None of the packages in this build ran lifecycle scripts that needed inspection." /></Card>}
          {packages.map((p) => (
            <Card key={p.name + p.version} className="p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="font-mono text-sm font-semibold">{p.name}@{p.version}</div><Badge kind={p.risk >= 70 ? "block" : p.risk >= 40 ? "warn" : "success"}>risk {p.risk}</Badge></div>
              {p.note && <p className="mb-2 text-xs text-dim">{p.note}</p>}
              {Object.entries(p.scripts).map(([k, v]) => <div key={k} className="mb-1 font-mono text-xs"><span className="text-dim">{k}:</span> {v}</div>)}
              {p.excerpt && <pre className="mt-3 max-h-64 overflow-auto rounded-sm border border-line bg-paper-2 p-3 font-mono text-xs leading-5 whitespace-pre-wrap">{p.excerpt}</pre>}
              {p.indicators.length > 0 && <ul className="mt-3 space-y-1.5">{p.indicators.map((i) => <li key={i.id} className="flex flex-wrap items-center gap-2 text-xs"><Sev level={i.severity} /><span className="font-semibold">{i.label}</span><span className="font-mono text-dim">{i.evidence}</span></li>)}</ul>}
            </Card>
          ))}
          {b.forensic?.sample && (
            <Card className="p-5">
              <div className="mb-2 text-sm font-semibold">Recorded script (sample incident)</div>
              <pre className="max-h-72 overflow-auto rounded-sm border border-line bg-paper-2 p-3 font-mono text-xs leading-5 whitespace-pre-wrap">{b.forensic.sample.script}</pre>
              <ul className="mt-3 space-y-1 text-sm text-muted">{b.forensic.sample.containment.map(([k, v]) => <li key={k}><b className="text-ink">{k}</b> — {v}</li>)}</ul>
            </Card>
          )}
        </div>
      )}

      {tab === "evidence" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileSignature className="size-4" />Signed artefacts</div>
            {sbom ? (
              <dl className="mb-4 space-y-1.5 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-dim">SBOM</dt><dd className="font-mono">{sbom.id} · {sbom.components} components</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-dim">Signature</dt><dd>{sbom.signed ? <Badge kind="success">signed</Badge> : <Badge kind="muted">unsigned (sample)</Badge>}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-dim">Digest</dt><dd className="max-w-[60%] truncate font-mono" title={sbom.digest}>{sbom.digest}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-dim">Key ID</dt><dd className="font-mono">{sbom.key_id ?? "—"}</dd></div>
              </dl>
            ) : <p className="mb-4 text-sm text-muted">No SBOM yet for this build.</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={!evidence || !sbom} onClick={() => download(`/api/v1/builds/${b.id}/sbom.cdx.json`)}><Download className="size-4" />SBOM (CycloneDX)</Button>
              <Button variant="secondary" disabled={!evidence || !sbom} onClick={() => download(`/api/v1/builds/${b.id}/provenance.json`)}><Download className="size-4" />Provenance</Button>
              <Button disabled={!evidence || b.status === "running"} onClick={() => download(`/api/v1/builds/${b.id}/evidence.zip`)}><Download className="size-4" />Evidence bundle (.zip)</Button>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-3 text-sm font-semibold">Respond</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={!can(perms, "builds.run")} onClick={() => run(() => notifyBuildTeam({ data: { id: b.id } }), "Team notified")}><Bell className="size-4" />Notify team</Button>
              <Button variant="secondary" disabled={!can(perms, "builds.run")} onClick={() => run(() => createGithubIssue({ data: { id: b.id } }), (r: any) => (r?.url ? `Issue created: ${r.url}` : "Issue created"))}><Github className="size-4" />Open GitHub issue</Button>
            </div>
            <p className="mt-3 text-xs text-dim">Notifications go to the channels configured under Integrations. GitHub issues require a token with Issues: write on the project repository.</p>
            <p className="mt-2 text-xs text-dim">Finished {timeAgo(b.finished_at)} · worker {b.worker}</p>
          </Card>
        </div>
      )}

      {override && (
        <Modal title={`Override block · build #${b.id}`} onClose={() => setOverride(false)}>
          <p className="mb-4 text-sm text-muted">Overriding releases this build despite policy violations. The justification, your identity and the time are written to the immutable audit log.</p>
          <Field label="Justification (required)"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Reviewed script; internal mirror host, ticket SEC-1234" /></Field>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} />Also approve the quarantined packages from this build</label>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOverride(false)}>Cancel</Button>
            <Button variant="danger" disabled={note.trim().length < 5} onClick={async () => { await run(() => overrideBuild({ data: { id: b.id, note: note.trim(), approvePackages: approve } }), "Build overridden and logged"); setOverride(false); }}>Override block</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
