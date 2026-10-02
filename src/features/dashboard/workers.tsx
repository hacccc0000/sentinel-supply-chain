import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpCircle, CircleCheck, Plus, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Field, Kpi, PageHeader } from "@/components/primitives";
import { Confirm, Empty, Loading, Select, Table, CopyBox, useRun } from "@/components/helpers";
import { can, useTenant } from "@/lib/data";
import { deleteWorker, registerWorker } from "@/lib/server/api";
import type { WorkerRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function WorkersPage() {
  const { data } = useTenant();
  const run = useRun();
  const [filter, setFilter] = useState("all");
  const [del, setDel] = useState<WorkerRow | null>(null);
  if (!data) return <Loading />;
  const workers = data.workers;
  const manage = can(data.me.permissions, "workers.manage");
  const filtered = filter === "all" ? workers : workers.filter((w) => w.status === filter);
  return (
    <>
      <PageHeader eyebrow="Pipeline" title="Workers" subtitle="Scan runtimes. The built-in control-plane scanner is always available; register private workers to report heartbeat from your own infrastructure." actions={manage && <Link to="/dashboard/workers/install"><Button><Plus className="size-4" />Register worker</Button></Link>} />
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Online" value={`${workers.filter((w) => w.status === "online").length} / ${workers.length}`} icon={<CircleCheck className="size-3.5" />} tone="success" />
        <Kpi label="Degraded" value={workers.filter((w) => w.status === "degraded").length} icon={<AlertTriangle className="size-3.5" />} tone="warn" />
        <Kpi label="Update available" value={workers.filter((w) => w.status === "update").length} icon={<ArrowUpCircle className="size-3.5" />} />
        <Kpi label="Offline" value={workers.filter((w) => w.status === "offline").length} icon={<XCircle className="size-3.5" />} tone="danger" />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          {["all", "online", "degraded", "update", "offline"].map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-sm px-3 py-1.5 text-xs font-semibold capitalize", filter === f ? "bg-navy/10 text-ink" : "text-dim")}>{f}</button>)}
          <span className="ml-auto text-xs text-dim">{filtered.length} workers</span>
        </div>
        {filtered.length === 0 ? <Empty title="No workers" /> : (
          <Table heads={["Worker", "Environment", "Region", "Status", "Version", "Heartbeat", "Builds", "Isolation", ""]} min={900}>
            {filtered.map((w) => (
              <tr key={w.id} className="border-t border-line">
                <td className="px-3.5 py-3 font-mono text-xs font-semibold">{w.name}{w.builtin && <Badge kind="navy" className="ml-2">built-in</Badge>}{w.sample && <Badge kind="muted" className="ml-2">sample</Badge>}</td>
                <td className="px-3.5 py-3 text-xs">{w.env}</td>
                <td className="px-3.5 py-3 text-xs">{w.region}</td>
                <td className="px-3.5 py-3"><Badge kind={w.status === "online" ? "success" : w.status === "degraded" ? "warn" : w.status === "update" ? "info" : "block"}>{w.status}</Badge></td>
                <td className="px-3.5 py-3 font-mono text-xs">{w.version}</td>
                <td className={cn("px-3.5 py-3 font-mono text-xs", w.status === "offline" && "text-danger")}>{w.status === "offline" && w.heartbeat_s === 0 ? "never" : `${w.heartbeat_s}s ago`}</td>
                <td className="px-3.5 py-3 tabular-nums">{w.builds}</td>
                <td className="px-3.5 py-3 text-xs">{w.isolation}</td>
                <td className="px-3.5 py-3 text-right">{manage && !w.builtin && <Button size="sm" variant="danger" aria-label={`Remove ${w.name}`} onClick={() => setDel(w)}><Trash2 className="size-3.5" /></Button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {del && <Confirm danger title="Remove worker" confirmLabel="Remove" body={<>Remove <b>{del.name}</b>? Its token stops working immediately.</>} onConfirm={async () => void (await run(() => deleteWorker({ data: { id: del.id } }), "Worker removed"))} onClose={() => setDel(null)} />}
    </>
  );
}

export function InstallWizardPage() {
  const { data } = useTenant();
  const run = useRun();
  const [f, setF] = useState({ name: "", env: "production", region: "eu-central-1", isolation: "container" });
  const [token, setToken] = useState<string | null>(null);
  if (!data) return <Loading />;
  if (!can(data.me.permissions, "workers.manage")) return <Empty title="Your role cannot register workers" />;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const submit = async () => {
    const r = await run(() => registerWorker({ data: f }), "Worker registered");
    if (r) setToken(r.token);
  };
  const hb = `curl -fsS -X POST ${origin}/api/worker/heartbeat \\\n  -H "Authorization: Bearer ${token ?? "<WORKER_TOKEN>"}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"version":"1.0.0","queue":0}'`;
  return (
    <>
      <PageHeader eyebrow="Workers" title="Register a worker" subtitle="Registers a private runner and issues a one-time token. The worker reports heartbeat to the control plane; its status is derived from heartbeat age." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="grid gap-4">
            <Field label="Worker name" hint="lowercase letters, numbers, hyphens"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value.toLowerCase() })} placeholder="sap-prod-eu-01" disabled={!!token} /></Field>
            <Field label="Environment"><Input value={f.env} onChange={(e) => setF({ ...f, env: e.target.value })} disabled={!!token} /></Field>
            <Field label="Region"><Input value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} disabled={!!token} /></Field>
            <Field label="Isolation"><Select className="w-full" value={f.isolation} onChange={(e) => setF({ ...f, isolation: e.target.value })} disabled={!!token}><option>container</option><option>microvm</option><option>vm</option></Select></Field>
            {!token && <Button disabled={f.name.length < 3} onClick={submit}>Register worker & issue token</Button>}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Connect</h2>
          {token ? (
            <>
              <p className="mb-2 text-xs text-warn">Copy this token now — it is shown only once.</p>
              <CopyBox text={token} label="Token" />
              <p className="mt-4 mb-2 text-xs text-muted">Send a heartbeat every 15 seconds (cron, sidecar or systemd timer):</p>
              <CopyBox text={hb} label="Command" />
              <Link to="/dashboard/workers" className="mt-4 inline-block text-xs font-semibold text-navy hover:underline">Back to workers →</Link>
            </>
          ) : <p className="text-sm text-muted">After registering, you will receive a one-time <code className="font-mono">bbw_</code> token and the heartbeat command. Heartbeat is the only thing a worker reports today; scans themselves run on the built-in scanner.</p>}
        </Card>
      </div>
    </>
  );
}
