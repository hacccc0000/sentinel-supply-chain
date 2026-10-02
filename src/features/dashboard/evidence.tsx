import { BadgeCheck, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, PageHeader } from "@/components/primitives";
import { Empty, Loading, Select, Table, useRun } from "@/components/helpers";
import { Link } from "@tanstack/react-router";
import { can, useTenant } from "@/lib/data";
import { evaluateFramework, FRAMEWORKS } from "@/lib/compliance";
import { verifySbom } from "@/lib/server/api";
import { download, fmtTime, timeAgo } from "@/lib/utils";

export function SbomPage() {
  const { data } = useTenant();
  const run = useRun();
  if (!data) return <Loading />;
  const ev = can(data.me.permissions, "evidence.export");
  const verify = async (id: string) => {
    const r = await run(() => verifySbom({ data: { id } }));
    if (!r) return;
    if (!r.ok) toast.message(r.reason);
    else if (r.valid) toast.success(`Signature valid · key ${r.keyId}`);
    else toast.error("Signature INVALID — document was modified or signed with a different key");
  };
  return (
    <>
      <PageHeader eyebrow="Evidence" title="SBOM & provenance" subtitle={`CycloneDX 1.5 SBOMs and in-toto provenance, signed with HMAC-SHA256 (key ${data.tenant.signing_key_id}). Verify any document against the platform key.`} actions={ev && <Button variant="secondary" onClick={() => download("/api/v1/export/sboms.zip")}><Download className="size-4" />Download all (.zip)</Button>} />
      <Card>
        {data.sboms.length === 0 ? <Empty title="No SBOMs yet" body="An SBOM is generated and signed for every completed build." /> : (
          <Table heads={["SBOM", "Project", "Build", "Components", "SAP", "Signature", "Created", ""]} min={980}>
            {data.sboms.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-3.5 py-3 font-mono text-xs font-semibold">{s.id}{s.sample && <Badge kind="muted" className="ml-2">sample</Badge>}</td>
                <td className="px-3.5 py-3 text-sm">{s.project}</td>
                <td className="px-3.5 py-3 font-mono text-xs"><Link to="/dashboard/builds/$buildId" params={{ buildId: s.build }} className="text-navy hover:underline">#{s.build}</Link></td>
                <td className="px-3.5 py-3 tabular-nums">{s.components}</td>
                <td className="px-3.5 py-3 tabular-nums">{s.sap}</td>
                <td className="px-3.5 py-3">{s.signed ? <Badge kind="success">signed</Badge> : <Badge kind="muted">unsigned</Badge>}<div className="mt-1 max-w-[180px] truncate font-mono text-2xs text-dim" title={s.digest}>{s.digest}</div></td>
                <td className="px-3.5 py-3 text-xs text-dim">{timeAgo(s.created_at)}</td>
                <td className="px-3.5 py-3"><div className="flex justify-end gap-1.5"><Button size="sm" variant="secondary" disabled={!s.signed} onClick={() => verify(s.id)}><BadgeCheck className="size-3.5" />Verify</Button>{ev && <Button size="sm" variant="secondary" disabled={s.sample} onClick={() => download(`/api/v1/builds/${s.build}/sbom.cdx.json`)}><Download className="size-3.5" />SBOM</Button>}{ev && <Button size="sm" variant="secondary" disabled={s.sample} onClick={() => download(`/api/v1/builds/${s.build}/provenance.json`)}>Provenance</Button>}</div></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

export function CompliancePage() {
  const { data } = useTenant();
  const [open, setOpen] = useState<string | null>(null);
  const posture = useMemo(() => data && ({ enabled: new Set(data.rules.filter((r) => r.enabled).map((r) => r.id)), signedSbom: data.stats.signedSboms > 0, builds: data.builds.some((b) => ["passed", "warned", "blocked", "overridden"].includes(b.status)), audit: data.audit.length > 0, mode: data.mode }), [data]);
  if (!data || !posture) return <Loading />;
  const ev = can(data.me.permissions, "evidence.export");
  return (
    <>
      <PageHeader eyebrow="Evidence" title="Compliance" subtitle="Control coverage is computed live from your enabled rules, enforcement mode and the evidence collected. This is supporting evidence, not a certification." />
      <div className="grid gap-4 lg:grid-cols-2">
        {FRAMEWORKS.map((fw) => {
          const r = evaluateFramework(fw, posture);
          const slug = fw.code.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          return (
            <Card key={fw.code} className="p-5">
              <div className="mb-1 flex items-center justify-between"><h2 className="text-base font-semibold">{fw.code}</h2><Badge kind={r.pct === 100 ? "success" : r.pct >= 60 ? "warn" : "block"}>{r.pct}% · {r.met}/{r.total}</Badge></div>
              <p className="mb-3 text-xs text-muted">{fw.body}</p>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-paper-2"><div className="h-full bg-success transition-all" style={{ width: `${r.pct}%` }} /></div>
              {open === fw.code && (
                <ul className="mb-3 space-y-2">
                  {r.states.map((s) => (
                    <li key={s.control.id} className="rounded-sm border border-line p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2"><b>{s.control.id} · {s.control.title}</b><Badge kind={s.status === "met" ? "success" : s.status === "partial" ? "warn" : "block"}>{s.status}</Badge></div>
                      <div className="mt-1 font-mono text-2xs text-dim">{s.control.rules.join(", ")}</div>
                      {s.missing.map((m) => <div key={m} className="mt-1 text-warn">• {m}</div>)}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setOpen(open === fw.code ? null : fw.code)}>{open === fw.code ? "Hide controls" : "Preview mapping"}</Button>{ev && <Button size="sm" onClick={() => download(`/api/v1/compliance/${slug}`)}><Download className="size-3.5" />Export report</Button>}</div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export function AuditPage() {
  const { data } = useTenant();
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const actions = useMemo(() => Array.from(new Set((data?.audit ?? []).map((a) => a.action.split(".")[0]!))), [data]);
  const rows = useMemo(() => (data?.audit ?? []).filter((a) => (action === "all" || a.action.startsWith(action)) && (!q || `${a.actor} ${a.action} ${a.target} ${a.detail}`.toLowerCase().includes(q.toLowerCase()))), [data, q, action]);
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader eyebrow="Evidence" title="Audit log" subtitle="Append-only record of every decision, override, policy change and export." actions={can(data.me.permissions, "evidence.export") && <Button variant="secondary" onClick={() => download("/api/v1/export/audit.csv")}><Download className="size-4" />Export CSV</Button>} />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <div className="relative max-w-xs flex-1"><Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-dim" /><Input className="pl-8" placeholder="Search actor, action, target…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audit log" /></div>
          <Select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Category"><option value="all">All categories</option>{actions.map((a) => <option key={a}>{a}</option>)}</Select>
        </div>
        {rows.length === 0 ? <Empty title="No audit events match" /> : (
          <Table heads={["Time", "Actor", "Action", "Target", "Detail", "IP"]} min={900}>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-line align-top">
                <td className="px-3.5 py-2.5 text-xs whitespace-nowrap text-dim" title={a.created_at}>{fmtTime(a.created_at)}</td>
                <td className="px-3.5 py-2.5 text-xs">{a.actor}</td>
                <td className="px-3.5 py-2.5 font-mono text-xs font-semibold">{a.action}</td>
                <td className="px-3.5 py-2.5 font-mono text-xs text-muted">{a.target}</td>
                <td className="max-w-sm px-3.5 py-2.5 text-xs text-muted"><span className="line-clamp-2">{a.detail}</span></td>
                <td className="px-3.5 py-2.5 font-mono text-2xs text-dim">{a.ip ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
