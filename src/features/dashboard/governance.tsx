import { Download, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, PageHeader, Sev } from "@/components/primitives";
import { Empty, Loading, Modal, Select, Table, Tabs, Textarea, useRun } from "@/components/helpers";
import { Link } from "@tanstack/react-router";
import { can, useTenant } from "@/lib/data";
import { addAllowlist, removeAllowlist, updateFinding } from "@/lib/server/api";
import type { AllowlistRow, FindingRow } from "@/lib/types";
import { download, timeAgo } from "@/lib/utils";

const KINDS: Array<[AllowlistRow["kind"], string, string]> = [
  ["package", "Allowed packages", "name or name@version — never quarantined"],
  ["maintainer", "Trusted maintainers", "npm username or email"],
  ["egress", "Allowed egress", "host, e.g. registry.npmjs.org or *.sap.com"],
  ["deny", "Denied packages", "name — always blocked"],
  ["egress-deny", "Denied egress", "host pattern, e.g. *.onion or pastebin.com"],
];

export function AllowlistPage() {
  const { data } = useTenant();
  const run = useRun();
  const [kind, setKind] = useState<AllowlistRow["kind"]>("package");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  if (!data) return <Loading />;
  const edit = can(data.me.permissions, "allowlist.edit");
  const rows = data.allowlist.filter((a) => a.kind === kind);
  const def = KINDS.find((k) => k[0] === kind)!;
  const add = async () => {
    const r = await run(() => addAllowlist({ data: { kind, value: value.trim(), note: note.trim() || undefined } }), "Entry added");
    if (r) { setValue(""); setNote(""); }
  };
  return (
    <>
      <PageHeader eyebrow="Policy" title="Allow & deny lists" subtitle="Explicit trust decisions. Deny entries always win. Every change is audit-logged." />
      <Tabs<AllowlistRow["kind"]> value={kind} onChange={setKind} tabs={KINDS.map(([k, l]) => [k, `${l} (${data.allowlist.filter((a) => a.kind === k).length})`])} />
      {edit && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Input className="max-w-sm" placeholder={def[2]} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && value.trim() && void add()} aria-label="Value" />
          <Input className="max-w-xs" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
          <Button disabled={!value.trim()} onClick={add}><Plus className="size-4" />Add</Button>
        </div>
      )}
      <Card>
        {rows.length === 0 ? <Empty title="No entries" body={`${def[1]}: ${def[2]}.`} /> : (
          <Table heads={["Value", "Note", "Added by", ""]} min={640}>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-line">
                <td className="px-3.5 py-3 font-mono text-xs font-semibold">{a.value}{a.sample && <Badge kind="muted" className="ml-2">sample</Badge>}</td>
                <td className="px-3.5 py-3 text-xs text-muted">{a.note}</td>
                <td className="px-3.5 py-3 text-xs text-dim">{a.created_by ?? "system"}</td>
                <td className="px-3.5 py-3 text-right">{edit && <Button size="sm" variant="danger" aria-label={`Remove ${a.value}`} onClick={() => run(() => removeAllowlist({ data: { id: a.id } }), "Entry removed")}><Trash2 className="size-3.5" /></Button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

export function FindingsPage() {
  const { data } = useTenant();
  const run = useRun();
  const [sev, setSev] = useState("all");
  const [st, setSt] = useState("open");
  const [q, setQ] = useState("");
  const [act, setAct] = useState<{ f: FindingRow; status: "acked" | "resolved" | "open" } | null>(null);
  const [note, setNote] = useState("");
  const rows = useMemo(() => (data?.findings ?? []).filter((f) => (sev === "all" || f.severity === sev) && (st === "all" || f.status === st) && (!q || `${f.title} ${f.rule} ${f.project} ${f.package}`.toLowerCase().includes(q.toLowerCase()))), [data, sev, st, q]);
  if (!data) return <Loading />;
  const edit = can(data.me.permissions, "findings.update");
  return (
    <>
      <PageHeader eyebrow="Policy" title="Findings" subtitle="Policy violations and vulnerabilities discovered during builds." actions={can(data.me.permissions, "evidence.export") && <Button variant="secondary" onClick={() => download("/api/v1/export/findings.csv")}><Download className="size-4" />Export CSV</Button>} />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <Input className="max-w-xs" placeholder="Search findings…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search findings" />
          <Select value={sev} onChange={(e) => setSev(e.target.value)} aria-label="Severity"><option value="all">All severities</option>{["critical", "high", "medium", "low", "info"].map((s) => <option key={s}>{s}</option>)}</Select>
          <Select value={st} onChange={(e) => setSt(e.target.value)} aria-label="Status"><option value="all">All statuses</option>{["open", "acked", "resolved"].map((s) => <option key={s}>{s}</option>)}</Select>
        </div>
        {rows.length === 0 ? <Empty title="No findings match" body="Findings appear here after builds are scanned." /> : (
          <Table heads={["Severity", "Finding", "Rule", "Project", "Build", "Status", ""]} min={980}>
            {rows.map((f) => (
              <tr key={f.id} className="border-t border-line align-top">
                <td className="px-3.5 py-3"><Sev level={f.severity} /></td>
                <td className="px-3.5 py-3"><div className="max-w-md font-medium">{f.title}</div>{f.note && <div className="text-xs text-dim">“{f.note}” — {f.updated_by}</div>}</td>
                <td className="px-3.5 py-3 font-mono text-xs">{f.rule}</td>
                <td className="px-3.5 py-3 text-xs text-muted">{f.project}</td>
                <td className="px-3.5 py-3 font-mono text-xs"><Link to="/dashboard/builds/$buildId" params={{ buildId: f.build_id }} className="text-navy hover:underline">#{f.build_id}</Link></td>
                <td className="px-3.5 py-3"><Badge kind={f.status === "open" ? "warn" : "success"}>{f.status}</Badge><div className="mt-1 text-2xs text-dim">{timeAgo(f.created_at)}</div></td>
                <td className="px-3.5 py-3"><div className="flex justify-end gap-1.5">{edit && f.status === "open" && <><Button size="sm" variant="secondary" onClick={() => { setNote(""); setAct({ f, status: "acked" }); }}>Acknowledge</Button><Button size="sm" onClick={() => { setNote(""); setAct({ f, status: "resolved" }); }}>Resolve</Button></>}{edit && f.status !== "open" && <Button size="sm" variant="secondary" onClick={() => run(() => updateFinding({ data: { id: f.id, status: "open" } }), "Finding reopened")}>Reopen</Button>}</div></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {act && (
        <Modal title={`${act.status === "acked" ? "Acknowledge" : "Resolve"} finding`} onClose={() => setAct(null)}>
          <p className="mb-3 text-sm text-muted">{act.f.title}</p>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (kept in the audit log)" />
          <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setAct(null)}>Cancel</Button><Button onClick={async () => { const r = await run(() => updateFinding({ data: { id: act.f.id, status: act.status, note: note.trim() || undefined } }), "Finding updated"); if (r) setAct(null); }}>Save</Button></div>
        </Modal>
      )}
    </>
  );
}
