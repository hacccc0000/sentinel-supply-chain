import { Link, useNavigate } from "@tanstack/react-router";
import { FolderGit2, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, Field, PageHeader } from "@/components/primitives";
import { Confirm, Empty, Loading, Modal, Select, Table, Textarea, useRun } from "@/components/helpers";
import { can, useTenant } from "@/lib/data";
import { addProject, deleteProject, getProjectManifest, runProtectedBuild, updateProject } from "@/lib/server/api";
import type { ProjectRow } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

const TYPES = ["SAP CAP (Node.js)", "Node.js service", "SAP Fiori / UI5", "Node.js library", "Other npm project"];

function ProjectForm({ edit, onClose }: { edit?: ProjectRow; onClose: () => void }) {
  const run = useRun();
  const [f, setF] = useState({ name: edit?.name ?? "", type: edit?.type ?? TYPES[0]!, repo: edit?.repo ?? "", branch: edit?.branch ?? "main", manifest: "", lockfile: "" });
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!edit);
  if (edit && !loaded) {
    void getProjectManifest({ data: { id: edit.id } }).then((m) => { setF((x) => ({ ...x, manifest: m.manifest })); setLoaded(true); });
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => {
    setBusy(true);
    const r = await run(() => (edit ? updateProject({ data: { ...f, id: edit.id } }) : addProject({ data: f })), edit ? "Project updated" : "Project registered");
    setBusy(false);
    if (r) onClose();
  };
  return (
    <Modal title={edit ? `Edit ${edit.name}` : "Register project"} onClose={onClose} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project name"><Input value={f.name} onChange={set("name")} placeholder="payments-service" /></Field>
        <Field label="Type"><Select className="w-full" value={f.type} onChange={set("type")}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Repository" hint="owner/repo or full GitHub URL. Private repos need a GitHub token under Integrations."><Input value={f.repo} onChange={set("repo")} placeholder="my-org/payments-service" /></Field>
        <Field label="Branch"><Input value={f.branch} onChange={set("branch")} /></Field>
      </div>
      <div className="mt-4 grid gap-4">
        <Field label="package.json (optional)" hint="Paste to scan without repository access. Leave empty to fetch from the repository."><Textarea rows={6} value={f.manifest} onChange={set("manifest")} placeholder='{ "name": "app", "dependencies": { … } }' /></Field>
        <Field label="package-lock.json (optional)" hint="Pasting a lockfile gives an exact, reproducible dependency graph."><Textarea rows={4} value={f.lockfile} onChange={set("lockfile")} placeholder="{ lockfileVersion: 3 … }" /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={busy || f.name.trim().length < 2 || f.repo.trim().length < 3} onClick={submit}>{edit ? "Save changes" : "Register project"}</Button>
      </div>
    </Modal>
  );
}

export function ProjectsPage() {
  const { data } = useTenant();
  const run = useRun();
  const nav = useNavigate();
  const [form, setForm] = useState<ProjectRow | "new" | null>(null);
  const [del, setDel] = useState<ProjectRow | null>(null);
  if (!data) return <Loading />;
  const manage = can(data.me.permissions, "projects.manage");
  const canRun = can(data.me.permissions, "builds.run");
  const go = async (p: ProjectRow) => {
    const r = await run(() => runProtectedBuild({ data: { project_id: p.id } }));
    if (r && !r.ok) toast.error(r.error);
    if (r?.ok) void nav({ to: "/dashboard/builds/$buildId", params: { buildId: r.id } });
  };
  return (
    <>
      <PageHeader eyebrow="Pipeline" title="Projects" subtitle="Repositories protected by BuildBouncer. Each is scanned against the active policy on every build." actions={manage && <Button onClick={() => setForm("new")}><Plus className="size-4" />Register project</Button>} />
      <Card>
        {data.projects.length === 0 ? (
          <Empty title="No projects registered" body="Register a repository (or paste a package.json) and run your first protected build." action={manage && <Button onClick={() => setForm("new")}><FolderGit2 className="size-4" />Register project</Button>} />
        ) : (
          <Table heads={["Project", "Type", "Repository", "Policy", "Last build", ""]} min={900}>
            {data.projects.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-3.5 py-3 font-semibold">{p.name}{p.sample && <Badge kind="muted" className="ml-2">sample</Badge>}</td>
                <td className="px-3.5 py-3 text-xs text-muted">{p.type}</td>
                <td className="px-3.5 py-3 font-mono text-xs text-muted">{p.repo}<span className="text-dim"> · {p.branch}</span>{p.has_manifest && <Badge kind="navy" className="ml-2">pasted manifest</Badge>}</td>
                <td className="px-3.5 py-3 text-xs text-muted">{p.policy}</td>
                <td className="px-3.5 py-3 text-xs">{p.last_build ? <Link to="/dashboard/builds/$buildId" params={{ buildId: p.last_build }} className="font-mono text-navy hover:underline">#{p.last_build}</Link> : <span className="text-dim">never</span>}</td>
                <td className="px-3.5 py-3"><div className="flex justify-end gap-1.5">
                  {canRun && <Button size="sm" onClick={() => go(p)}><Play className="size-3.5" />Run</Button>}
                  {manage && <Button size="sm" variant="secondary" aria-label={`Edit ${p.name}`} onClick={() => setForm(p)}><Pencil className="size-3.5" /></Button>}
                  {manage && <Button size="sm" variant="danger" aria-label={`Delete ${p.name}`} onClick={() => setDel(p)}><Trash2 className="size-3.5" /></Button>}
                </div></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {form && <ProjectForm edit={form === "new" ? undefined : form} onClose={() => setForm(null)} />}
      {del && <Confirm danger title="Delete project" confirmLabel="Delete" body={<>Remove <b>{del.name}</b>? Builds, findings and evidence are retained as history.</>} onConfirm={async () => void (await run(() => deleteProject({ data: { id: del.id } }), "Project deleted"))} onClose={() => setDel(null)} />}
    </>
  );
}
