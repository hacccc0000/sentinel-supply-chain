import { Rocket } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, PageHeader } from "@/components/primitives";
import { Loading, Modal, Table, useRun } from "@/components/helpers";
import { can, useTenant } from "@/lib/data";
import { RULE_ENGINE } from "@/lib/integrations";
import { publishPolicy, setEnforcement, toggleRule } from "@/lib/server/api";
import type { Enforcement } from "@/lib/types";
import { fmtTime } from "@/lib/utils";

const MODES: Array<[Enforcement, string, string]> = [
  ["audit", "Audit", "Record findings only. Builds always pass."],
  ["warn", "Warn", "Builds pass with warnings and notify the team."],
  ["block", "Block", "Critical and high findings block the build."],
];

export function PolicyPage() {
  const { data } = useTenant();
  const run = useRun();
  const [publish, setPublish] = useState(false);
  const [note, setNote] = useState("");
  const [cat, setCat] = useState("all");
  if (!data) return <Loading />;
  const edit = can(data.me.permissions, "policy.edit");
  const cats = ["all", ...Array.from(new Set(data.rules.map((r) => r.category)))];
  const rules = data.rules.filter((r) => cat === "all" || r.category === cat);
  const last = data.policyVersions[0];
  return (
    <>
      <PageHeader eyebrow="Policy" title="Policy builder" subtitle={`Active policy v${data.policyVersion}. Changes apply to the next build; publish to snapshot a signed version.`} actions={edit && <Button disabled={!data.policyDirty} onClick={() => setPublish(true)}><Rocket className="size-4" />{data.policyDirty ? "Publish changes" : "Published"}</Button>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {MODES.map(([m, l, d]) => (
          <button key={m} type="button" disabled={!edit} onClick={() => run(() => setEnforcement({ data: { mode: m } }), `Enforcement set to ${m}`)} className={`rounded-md border p-4 text-left transition-colors ${data.mode === m ? "border-navy bg-navy/5" : "border-line bg-elev hover:bg-paper-2"} disabled:cursor-not-allowed`} aria-pressed={data.mode === m}>
            <div className="mb-1 flex items-center justify-between text-sm font-semibold">{l}{data.mode === m && <Badge kind="navy">active</Badge>}</div>
            <div className="text-xs text-muted">{d}</div>
          </button>
        ))}
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          {cats.map((c) => <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-sm px-3 py-1.5 text-xs font-semibold ${cat === c ? "bg-navy/10 text-ink" : "text-dim"}`}>{c}</button>)}
          <span className="ml-auto text-xs text-dim">{data.rules.filter((r) => r.enabled).length}/{data.rules.length} enabled</span>
        </div>
        <Table heads={["Rule", "Description", "Engine", "Enabled"]} min={760}>
          {rules.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="px-3.5 py-3 font-mono text-xs font-semibold">{r.id}<div className="font-sans text-xs font-normal text-muted">{r.label}</div></td>
              <td className="max-w-lg px-3.5 py-3 text-xs text-muted">{r.description}</td>
              <td className="px-3.5 py-3">{RULE_ENGINE[r.id] === "runtime" ? <Badge kind="muted" className="">runtime agent · roadmap</Badge> : <Badge kind="success">static scan · live</Badge>}</td>
              <td className="px-3.5 py-3">
                <button type="button" role="switch" aria-checked={r.enabled} aria-label={`Toggle ${r.id}`} disabled={!edit} onClick={() => run(() => toggleRule({ data: { id: r.id, enabled: !r.enabled } }))} className={`relative h-6 w-11 rounded-full border transition-colors disabled:opacity-50 ${r.enabled ? "border-navy bg-navy" : "border-line bg-paper-2"}`}>
                  <span className={`absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-all ${r.enabled ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card className="mt-4">
        <div className="border-b border-line px-5 py-3.5 text-sm font-semibold">Version history</div>
        <ul className="divide-y divide-line">
          {data.policyVersions.map((v, i) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div><span className="font-mono font-semibold">v{v.version}</span> {i === 0 && <Badge kind="navy">current</Badge>} <span className="ml-2 text-xs text-muted">{v.note || "—"}</span></div>
              <div className="text-xs text-dim">{v.mode} · {v.rules.filter((r) => r.enabled).length} rules · {v.published_by} · {fmtTime(v.created_at)}</div>
            </li>
          ))}
        </ul>
      </Card>
      {publish && (
        <Modal title="Publish policy" onClose={() => setPublish(false)}>
          <p className="mb-3 text-sm text-muted">Creates a new policy version from the current rules and enforcement mode{last ? ` (previous: v${last.version})` : ""}. The version is stamped on every subsequent build and evidence bundle.</p>
          <Input placeholder="Change note (e.g. enable egress deny list)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setPublish(false)}>Cancel</Button><Button onClick={async () => { const r = await run(() => publishPolicy({ data: { note } }), "Policy published"); if (r) { setPublish(false); setNote(""); } }}>Publish</Button></div>
        </Modal>
      )}
    </>
  );
}
