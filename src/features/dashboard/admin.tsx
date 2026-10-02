import { KeyRound, Plus, RotateCcw, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Field, PageHeader } from "@/components/primitives";
import { Confirm, CopyBox, Empty, Loading, Modal, Select, Table, Tabs, useRun } from "@/components/helpers";
import { PasswordModal } from "@/components/shell";
import { can, useTenant } from "@/lib/data";
import { INTEGRATION_DEFS } from "@/lib/integrations";
import { clearSampleData, createApiToken, createMember, disconnectIntegration, revokeApiToken, saveIntegration, saveSettings, testIntegration, updateMember } from "@/lib/server/api";
import type { Role } from "@/lib/types";
import { fmtTime, timeAgo } from "@/lib/utils";

const ROLES: Array<[Role, string]> = [
  ["admin", "Full control, users, tokens, integrations"],
  ["operator", "Projects, builds, workers, findings, evidence"],
  ["reviewer", "Quarantine decisions, allowlists, builds, findings"],
  ["auditor", "Read-only plus evidence export"],
];

export function IdentityPage() {
  const { data } = useTenant();
  const run = useRun();
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ name: "", email: "", role: "operator" as Role });
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  if (!data) return <Loading />;
  const manage = can(data.me.permissions, "users.manage");
  const create = async () => {
    const r = await run(() => createMember({ data: f }), "Member created");
    if (r) { setSecret({ email: f.email, password: r.password }); setAdd(false); setF({ name: "", email: "", role: "operator" }); }
  };
  return (
    <>
      <PageHeader eyebrow="Admin" title="Identity & access" subtitle="Role-based access control. Every user signs in with their own credentials; actions are attributed in the audit log." actions={manage && <Button onClick={() => setAdd(true)}><UserPlus className="size-4" />Add member</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{ROLES.map(([r, d]) => <Card key={r} className="p-4"><div className="mb-1 text-sm font-semibold capitalize">{r}</div><div className="text-xs text-muted">{d}</div></Card>)}</div>
      <Card>
        <Table heads={["Member", "Role", "Status", "Last sign-in", ""]} min={760}>
          {data.users.map((u) => (
            <tr key={u.id} className="border-t border-line">
              <td className="px-3.5 py-3"><div className="font-semibold">{u.name}{u.id === data.me.id && <Badge kind="navy" className="ml-2">you</Badge>}</div><div className="text-xs text-dim">{u.email}</div></td>
              <td className="px-3.5 py-3">{manage && u.id !== data.me.id ? <Select value={u.role} aria-label={`Role for ${u.email}`} onChange={(e) => run(() => updateMember({ data: { id: u.id, role: e.target.value as Role } }), "Role updated")}>{ROLES.map(([r]) => <option key={r}>{r}</option>)}</Select> : <Badge kind="muted">{u.role}</Badge>}</td>
              <td className="px-3.5 py-3"><Badge kind={u.active ? "success" : "block"}>{u.active ? "active" : "disabled"}</Badge></td>
              <td className="px-3.5 py-3 text-xs text-dim">{u.last_login_at ? timeAgo(u.last_login_at) : "never"}</td>
              <td className="px-3.5 py-3"><div className="flex justify-end gap-1.5">{manage && u.id !== data.me.id && <><Button size="sm" variant="secondary" onClick={async () => { const r = await run(() => updateMember({ data: { id: u.id, resetPassword: true } }), "Password reset"); if (r?.password) setSecret({ email: u.email, password: r.password }); }}><RotateCcw className="size-3.5" />Reset password</Button><Button size="sm" variant={u.active ? "danger" : "secondary"} onClick={() => run(() => updateMember({ data: { id: u.id, active: !u.active } }), u.active ? "Member disabled" : "Member enabled")}>{u.active ? "Disable" : "Enable"}</Button></>}</div></td>
            </tr>
          ))}
        </Table>
      </Card>
      {add && (
        <Modal title="Add member" onClose={() => setAdd(false)}>
          <div className="grid gap-4">
            <Field label="Full name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Work email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Role"><Select className="w-full" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{ROLES.map(([r]) => <option key={r}>{r}</option>)}</Select></Field>
          </div>
          <p className="mt-3 text-xs text-dim">A temporary password is generated and shown once. The member must change it at first sign-in.</p>
          <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setAdd(false)}>Cancel</Button><Button disabled={f.name.trim().length < 2 || !f.email.includes("@")} onClick={create}>Create member</Button></div>
        </Modal>
      )}
      {secret && (
        <Modal title="Temporary password" onClose={() => setSecret(null)}>
          <p className="mb-3 text-sm text-muted">Share this with <b>{secret.email}</b> over a secure channel. It is shown only once.</p>
          <CopyBox text={secret.password} label="Password" />
          <div className="mt-5 flex justify-end"><Button onClick={() => setSecret(null)}>Done</Button></div>
        </Modal>
      )}
    </>
  );
}

function Snippets({ token }: { token: string }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const t = token || "$BUILDBOUNCER_TOKEN";
  const gh = `- name: BuildBouncer gate\n  run: |\n    RES=$(curl -fsS -X POST ${origin}/api/v1/scans \\\n      -H "Authorization: Bearer ${t}" -H "Content-Type: application/json" \\\n      -d '{"project":"<project-id>","commit":"'"$GITHUB_SHA"'","wait":true}')\n    echo "$RES"\n    echo "$RES" | grep -q '"verdict":"blocked"' && exit 1 || exit 0`;
  const gl = `buildbouncer:\n  stage: test\n  script:\n    - |\n      RES=$(curl -fsS -X POST ${origin}/api/v1/scans -H "Authorization: Bearer ${t}" -H "Content-Type: application/json" -d "{\\"project\\":\\"<project-id>\\",\\"commit\\":\\"$CI_COMMIT_SHA\\",\\"wait\\":true}")\n      echo "$RES"; echo "$RES" | grep -q '"verdict":"blocked"' && exit 1 || true`;
  const [k, setK] = useState<"github" | "gitlab">("github");
  return (<><Tabs<"github" | "gitlab"> value={k} onChange={setK} tabs={[["github", "GitHub Actions"], ["gitlab", "GitLab CI / Jenkins / Azure DevOps"]]} /><CopyBox text={k === "github" ? gh : gl} label="Snippet" /></>);
}

export function IntegrationsPage() {
  const { data } = useTenant();
  const run = useRun();
  const [tab, setTab] = useState<"apps" | "ci">("apps");
  const [edit, setEdit] = useState<string | null>(null);
  const [val, setVal] = useState("");
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [revoke, setRevoke] = useState<string | null>(null);
  if (!data) return <Loading />;
  const manage = can(data.me.permissions, "integrations.manage");
  const tokens = can(data.me.permissions, "tokens.manage");
  const test = async (id: string) => {
    const r = await run(() => testIntegration({ data: { id } }));
    if (r) (r.ok ? toast.success : toast.error)(r.detail);
  };
  return (
    <>
      <PageHeader eyebrow="Admin" title="Integrations" subtitle="Credentials are encrypted at rest (AES-256-GCM) and never returned to the browser." />
      <Tabs value={tab} onChange={setTab} tabs={[["apps", "Connections"], ["ci", "CI/CD & API tokens"]]} />
      {tab === "apps" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.integrations.map((i) => {
            const d = INTEGRATION_DEFS[i.id];
            const kind = d?.kind ?? "soon";
            return (
              <Card key={i.id} className="flex flex-col p-4">
                <div className="mb-1 flex items-center justify-between"><div className="font-semibold">{i.name}</div>{kind === "soon" ? <Badge kind="muted">roadmap</Badge> : kind === "ci" ? <Badge kind="navy">via API</Badge> : <Badge kind={i.connected ? "success" : "muted"}>{i.connected ? "connected" : "not connected"}</Badge>}</div>
                <p className="mb-3 flex-1 text-xs text-muted">{d?.help ?? i.note}</p>
                {kind === "secret" && manage && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => { setVal(""); setEdit(i.id); }}>{i.connected ? "Replace" : "Connect"}</Button>
                    {i.connected && <><Button size="sm" variant="secondary" onClick={() => test(i.id)}>Test</Button><Button size="sm" variant="danger" onClick={() => run(() => disconnectIntegration({ data: { id: i.id } }), "Disconnected")}>Disconnect</Button></>}
                  </div>
                )}
                {kind === "ci" && <Button size="sm" variant="secondary" onClick={() => setTab("ci")}>Get snippet</Button>}
              </Card>
            );
          })}
        </div>
      )}
      {tab === "ci" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold">Gate your pipeline</h2>
            <p className="mb-3 text-xs text-muted">Call the scan API from CI. A blocked verdict fails the step. Find project ids on the Projects page.</p>
            <Snippets token={fresh ?? ""} />
          </Card>
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">API tokens</h2></div>
            {tokens && <div className="mb-4 flex gap-2"><Input placeholder="Token name, e.g. github-actions" value={name} onChange={(e) => setName(e.target.value)} aria-label="Token name" /><Button disabled={name.trim().length < 2} onClick={async () => { const r = await run(() => createApiToken({ data: { name: name.trim() } }), "Token created"); if (r) { setFresh(r.token); setName(""); } }}><Plus className="size-4" />Create</Button></div>}
            {fresh && <div className="mb-4"><p className="mb-1 text-xs text-warn">Copy now — shown only once.</p><CopyBox text={fresh} label="Token" /></div>}
            {data.tokens.length === 0 ? <Empty title="No tokens" body="Create a token to call the API from CI." /> : (
              <ul className="divide-y divide-line">{data.tokens.map((t) => <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><div className="min-w-0"><div className="flex items-center gap-2 font-medium"><KeyRound className="size-3.5 text-dim" />{t.name}{t.revoked && <Badge kind="block">revoked</Badge>}</div><div className="font-mono text-2xs text-dim">{t.prefix}… · {t.created_by} · last used {t.last_used_at ? timeAgo(t.last_used_at) : "never"}</div></div>{tokens && !t.revoked && <Button size="sm" variant="danger" aria-label={`Revoke ${t.name}`} onClick={() => setRevoke(t.id)}><Trash2 className="size-3.5" /></Button>}</li>)}</ul>
            )}
          </Card>
        </div>
      )}
      {edit && (() => { const d = INTEGRATION_DEFS[edit]!; return (
        <Modal title={`Connect ${data.integrations.find((x) => x.id === edit)?.name}`} onClose={() => setEdit(null)}>
          <Field label={d.label ?? "Secret"} hint={d.help}><Input type="password" autoComplete="off" value={val} onChange={(e) => setVal(e.target.value)} placeholder={d.placeholder} /></Field>
          <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!val.trim()} onClick={async () => { const r = await run(() => saveIntegration({ data: { id: edit, secret: val } }), "Saved and encrypted"); if (r) setEdit(null); }}>Save</Button></div>
        </Modal>); })()}
      {revoke && <Confirm danger title="Revoke token" confirmLabel="Revoke" body="Pipelines using this token will start failing immediately." onConfirm={async () => void (await run(() => revokeApiToken({ data: { id: revoke } }), "Token revoked"))} onClose={() => setRevoke(null)} />}
    </>
  );
}

export function SettingsPage() {
  const { data } = useTenant();
  const run = useRun();
  const [f, setF] = useState<{ tenant_name: string; region: string; notify_slack: boolean; notify_email: boolean } | null>(null);
  const [pw, setPw] = useState(false);
  const [clear, setClear] = useState(false);
  if (!data) return <Loading />;
  const t = f ?? { tenant_name: data.tenant.tenant_name, region: data.tenant.region, notify_slack: data.tenant.notify_slack, notify_email: data.tenant.notify_email };
  const manage = can(data.me.permissions, "settings.manage");
  return (
    <>
      <PageHeader eyebrow="Admin" title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Organisation</h2>
          <div className="grid gap-4">
            <Field label="Organisation name"><Input disabled={!manage} value={t.tenant_name} onChange={(e) => setF({ ...t, tenant_name: e.target.value })} /></Field>
            <Field label="Data region"><Input disabled={!manage} value={t.region} onChange={(e) => setF({ ...t, region: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!manage} checked={t.notify_slack} onChange={(e) => setF({ ...t, notify_slack: e.target.checked })} />Send build alerts to connected chat / webhooks</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!manage} checked={t.notify_email} onChange={(e) => setF({ ...t, notify_email: e.target.checked })} />Show in-app notifications for blocked builds</label>
            {manage && <Button disabled={!f} onClick={async () => { const r = await run(() => saveSettings({ data: t }), "Settings saved"); if (r) setF(null); }}>Save changes</Button>}
          </div>
          <dl className="mt-5 space-y-1 border-t border-line pt-4 text-xs"><div className="flex justify-between"><dt className="text-dim">Signing key</dt><dd className="font-mono">{data.tenant.signing_key_id}</dd></div><div className="flex justify-between"><dt className="text-dim">Policy version</dt><dd className="font-mono">v{data.policyVersion}</dd></div></dl>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Your account</h2>
            <div className="mb-3 text-sm"><b>{data.me.name}</b><div className="text-xs text-dim">{data.me.email} · {data.me.role}</div></div>
            <Button variant="secondary" onClick={() => setPw(true)}><KeyRound className="size-4" />Change password</Button>
          </Card>
          {manage && (
            <Card className="p-5">
              <h2 className="mb-1 text-sm font-semibold">Sample data</h2>
              <p className="mb-3 text-xs text-muted">{data.sampleCount > 0 ? `${data.sampleCount} illustrative records (NorthBank incident walkthrough) are loaded so the workspace is not empty. Remove them before using it for real.` : "No sample data is loaded."}</p>
              <Button variant="danger" disabled={data.sampleCount === 0} onClick={() => setClear(true)}>Remove sample data</Button>
            </Card>
          )}
        </div>
      </div>
      {pw && <PasswordModal onClose={() => setPw(false)} />}
      {clear && <Confirm danger title="Remove sample data" confirmLabel="Remove" body="Deletes all sample projects, builds, findings, SBOMs and quarantine items. Your own data is not touched." onConfirm={async () => void (await run(() => clearSampleData(), "Sample data removed"))} onClose={() => setClear(false)} />}
    </>
  );
}
