import { Link } from "@tanstack/react-router";
import { Ban, Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, Field, PageHeader, Sev } from "@/components/primitives";
import { Empty, Loading, Modal, Select, Table, Tabs, Textarea, useRun } from "@/components/helpers";
import { can, useTenant } from "@/lib/data";
import { bulkDecide, decideQuarantine } from "@/lib/server/api";
import type { Decision, QuarantineRow } from "@/lib/types";
import { fmtTime, timeAgo } from "@/lib/utils";

const verb: Record<Decision, string> = { approve: "approved", reject: "rejected", block: "permanently blocked" };

function Detail({ q, canDecide, onClose }: { q: QuarantineRow; canDecide: boolean; onClose: () => void }) {
  const run = useRun();
  const [note, setNote] = useState("");
  const decide = async (d: Decision) => {
    const r = await run(() => decideQuarantine({ data: { id: q.id, decision: d, note: note.trim() || undefined } }), `${q.name}@${q.version} ${verb[d]}`);
    if (r) onClose();
  };
  const a = q.analysis;
  return (
    <Modal wide title={`${q.name}@${q.version}`} onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge kind={q.risk >= 70 ? "block" : q.risk >= 40 ? "warn" : "success"}>risk {q.risk}/100</Badge>
        {q.lifecycle && <Badge kind="warn">install script</Badge>}
        {q.decision ? <Badge kind={q.decision === "approve" ? "success" : "block"}>{q.decision}d by {q.decided_by}</Badge> : <Badge kind="info">pending review</Badge>}
      </div>
      <p className="mb-4 text-sm text-muted">{q.reason}</p>
      <dl className="mb-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        {[["Project", q.project], ["Maintainer", q.maintainer], ["Package age", q.age], ["Scanner", q.scanner]].map(([k, v]) => <div key={k}><dt className="text-dim">{k}</dt><dd className="font-semibold">{v || "—"}</dd></div>)}
      </dl>
      {q.risk_factors.length > 0 && <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted">{q.risk_factors.map((r) => <li key={r}>{r}</li>)}</ul>}
      {q.scripts && Object.entries(q.scripts).map(([k, v]) => <div key={k} className="mb-1 font-mono text-xs"><span className="text-dim">{k}:</span> {v}</div>)}
      {a?.excerpt && <pre className="mt-3 max-h-56 overflow-auto rounded-sm border border-line bg-paper-2 p-3 font-mono text-xs leading-5 whitespace-pre-wrap">{a.excerpt}</pre>}
      {a && a.indicators.length > 0 && <ul className="mt-3 space-y-1.5">{a.indicators.map((i) => <li key={i.id} className="flex flex-wrap items-center gap-2 text-xs"><Sev level={i.severity} /><b>{i.label}</b><span className="font-mono text-dim">{i.evidence}</span></li>)}</ul>}
      {a?.note && <p className="mt-3 text-xs text-dim">{a.note}</p>}
      {q.note && <p className="mt-3 rounded-sm bg-paper-2 p-3 text-xs"><b>Decision note:</b> {q.note} <span className="text-dim">({fmtTime(q.decided_at)})</span></p>}
      {q.build_id && <Link to="/dashboard/builds/$buildId" params={{ buildId: q.build_id }} className="mt-3 inline-block text-xs font-semibold text-navy hover:underline">Open build #{q.build_id} →</Link>}
      {canDecide && (
        <div className="mt-5 border-t border-line pt-4">
          <Field label="Decision note (kept in the audit log)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is this safe / unsafe?" /></Field>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => decide("reject")}><X className="size-4" />Reject</Button>
            <Button variant="danger" onClick={() => decide("block")}><Ban className="size-4" />Block permanently</Button>
            <Button onClick={() => decide("approve")}><Check className="size-4" />Approve</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function QuarantinePage() {
  const { data } = useTenant();
  const run = useRun();
  const [tab, setTab] = useState<"pending" | "decided">("pending");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<QuarantineRow | null>(null);
  const [sort, setSort] = useState("risk");
  const rows = useMemo(() => {
    const r = (data?.quarantine ?? []).filter((q) => (tab === "pending" ? !q.decision : !!q.decision));
    return [...r].sort((a, b) => (sort === "risk" ? b.risk - a.risk : b.created_at.localeCompare(a.created_at)));
  }, [data, tab, sort]);
  if (!data) return <Loading />;
  const canDecide = can(data.me.permissions, "quarantine.decide");
  const pending = data.quarantine.filter((q) => !q.decision).length;
  const bulk = async (d: Decision) => { await run(() => bulkDecide({ data: { ids: [...sel], decision: d } }), `${sel.size} package(s) ${verb[d]}`); setSel(new Set()); };
  return (
    <>
      <PageHeader eyebrow="Pipeline" title="Quarantine" subtitle="Packages held by policy. Every decision is signed to the audit log; blocked packages join the permanent deny list." actions={<Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="risk">Sort: risk</option><option value="new">Sort: newest</option></Select>} />
      <Tabs value={tab} onChange={(t) => { setTab(t); setSel(new Set()); }} tabs={[["pending", `Pending (${pending})`], ["decided", `Decided (${data.quarantine.length - pending})`]]} />
      {canDecide && sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper-2 p-3 text-sm"><b>{sel.size} selected</b>
          <Button size="sm" onClick={() => bulk("approve")}>Approve</Button><Button size="sm" variant="secondary" onClick={() => bulk("reject")}>Reject</Button><Button size="sm" variant="danger" onClick={() => bulk("block")}>Block</Button>
        </div>
      )}
      <Card>
        {rows.length === 0 ? <Empty title={tab === "pending" ? "Nothing awaiting review" : "No decisions yet"} body={tab === "pending" ? "Suspicious packages found during builds appear here for a human decision." : undefined} /> : (
          <Table heads={[tab === "pending" && canDecide ? "" : "", "Package", "Project", "Risk", "Reason", tab === "pending" ? "Seen" : "Decision"]} min={900}>
            {rows.map((q) => (
              <tr key={q.id} className="cursor-pointer border-t border-line hover:bg-paper-2" onClick={() => setOpen(q)}>
                <td className="w-8 px-3.5 py-3" onClick={(e) => e.stopPropagation()}>{tab === "pending" && canDecide && <input type="checkbox" aria-label={`Select ${q.name}`} checked={sel.has(q.id)} onChange={(e) => setSel((s) => { const n = new Set(s); e.target.checked ? n.add(q.id) : n.delete(q.id); return n; })} />}</td>
                <td className="px-3.5 py-3 font-mono text-xs font-semibold">{q.name}@{q.version}</td>
                <td className="px-3.5 py-3 text-xs text-muted">{q.project}</td>
                <td className="px-3.5 py-3"><Badge kind={q.risk >= 70 ? "block" : q.risk >= 40 ? "warn" : "success"}>{q.risk}</Badge></td>
                <td className="max-w-md px-3.5 py-3 text-xs text-muted"><span className="line-clamp-2">{q.reason}</span></td>
                <td className="px-3.5 py-3 text-xs">{tab === "pending" ? <span className="text-dim">{timeAgo(q.created_at)}</span> : <Badge kind={q.decision === "approve" ? "success" : "block"}>{q.decision}</Badge>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {open && <Detail q={open} canDecide={canDecide && !open.decision} onClose={() => setOpen(null)} />}
    </>
  );
}
