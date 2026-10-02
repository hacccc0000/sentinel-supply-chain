import { Link, useNavigate } from "@tanstack/react-router";
import { AlertOctagon, Download, FolderGit2, Package, Play, ShieldCheck, Timer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, Kpi, PageHeader, Sev } from "@/components/primitives";
import { Empty, Loading, StatusBadge, useRun } from "@/components/helpers";
import { can, useTenant } from "@/lib/data";
import { runProtectedBuild } from "@/lib/server/api";
import { download, timeAgo } from "@/lib/utils";

export function OverviewPage() {
  const { data } = useTenant();
  const run = useRun();
  const nav = useNavigate();
  if (!data) return <Loading />;
  const { stats, builds, projects, findings, me } = data;
  const latestBlocked = builds.find((b) => b.status === "blocked");
  const open = findings.filter((f) => f.status === "open");
  const series = stats.series.map((s) => ({ ...s, day: s.day.slice(5) }));
  const canRun = can(me.permissions, "builds.run");
  const startFirst = async () => {
    const p = projects[0];
    if (!p) return nav({ to: "/dashboard/projects" });
    const r = await run(() => runProtectedBuild({ data: { project_id: p.id } }));
    if (r?.ok) void nav({ to: "/dashboard/builds/$buildId", params: { buildId: r.id } });
  };
  return (
    <>
      <PageHeader
        eyebrow={data.tenant.tenant_name}
        title="Supply-chain overview"
        subtitle="Every build is statically analysed against your policy before dependencies are trusted. Signed SBOM and provenance are produced per build."
        actions={
          <>
            {can(me.permissions, "evidence.export") && <Button variant="secondary" onClick={() => download("/api/v1/export/audit.csv")}><Download className="size-4" />Export audit</Button>}
            {canRun && <Button onClick={startFirst}><Play className="size-4" />Run protected build</Button>}
          </>
        }
      />
      {latestBlocked && (
        <Link to="/dashboard/builds/$buildId" params={{ buildId: latestBlocked.id }} className="mb-6 flex items-start gap-3 rounded-md border border-danger/30 bg-danger/8 p-4 hover:bg-danger/12">
          <AlertOctagon className="mt-0.5 size-5 shrink-0 text-danger" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-danger">Build #{latestBlocked.id} blocked · {latestBlocked.project}</div>
            <div className="text-sm text-muted">{latestBlocked.findings} finding(s) violated policy before the build could proceed. {timeAgo(latestBlocked.created_at)} · Open the investigation →</div>
          </div>
        </Link>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Builds today" value={stats.buildsToday} icon={<Timer className="size-3.5" />} />
        <Kpi label="Pass rate (24h)" value={stats.passRate === null ? "—" : `${stats.passRate}%`} tone={stats.passRate !== null && stats.passRate < 70 ? "warn" : "success"} icon={<ShieldCheck className="size-3.5" />} />
        <Kpi label="Blocked (24h)" value={stats.blocked24h} tone={stats.blocked24h ? "danger" : "ink"} icon={<AlertOctagon className="size-3.5" />} />
        <Kpi label="Pending quarantine" value={stats.pendingQuarantine} tone={stats.pendingQuarantine ? "warn" : "ink"} icon={<Package className="size-3.5" />} />
        <Kpi label="Components tracked" value={stats.components} icon={<Package className="size-3.5" />} />
        <Kpi label="SAP components" value={stats.sapComponents} />
        <Kpi label="Critical open" value={stats.criticalOpen} tone={stats.criticalOpen ? "danger" : "success"} />
        <Kpi label="Compliance coverage" value={`${stats.complianceScore}%`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Builds · last 14 days</h2><span className="text-2xs text-dim">passed / warned / blocked</span></div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ left: -20, right: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--bb-line)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "var(--bb-paper-2)" }} contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid var(--bb-line)", background: "var(--bb-elev)" }} />
                <Bar dataKey="passed" stackId="a" fill="var(--bb-success)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="warned" stackId="a" fill="var(--bb-warn)" />
                <Bar dataKey="blocked" stackId="a" fill="var(--bb-danger)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Open findings</h2>
          {open.length === 0 ? <Empty title="No open findings" body="Findings appear here after a build is scanned." /> : (
            <ul className="space-y-3">
              {open.slice(0, 6).map((f) => (
                <li key={f.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2"><Sev level={f.severity} /><span className="font-mono text-2xs text-dim">{f.rule}</span></div>
                  <Link to="/dashboard/builds/$buildId" params={{ buildId: f.build_id }} className="line-clamp-2 hover:underline">{f.title}</Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/dashboard/findings" className="mt-4 block text-xs font-semibold text-navy hover:underline">All findings →</Link>
        </Card>
      </div>
      <Card className="mt-4">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 className="text-sm font-semibold">Recent builds</h2><Link to="/dashboard/builds" className="text-xs font-semibold text-navy hover:underline">View all →</Link></div>
        {builds.length === 0 ? (
          <Empty title="No builds yet" body="Register a project and run your first protected build." action={<Link to="/dashboard/projects"><Button><FolderGit2 className="size-4" />Register project</Button></Link>} />
        ) : (
          <ul className="divide-y divide-line">
            {builds.slice(0, 7).map((b) => (
              <li key={b.id}>
                <Link to="/dashboard/builds/$buildId" params={{ buildId: b.id }} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-paper-2">
                  <span className="w-16 font-mono text-xs text-dim">#{b.id}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{b.project}<span className="ml-2 font-mono text-xs font-normal text-dim">{b.branch}@{b.commit}</span></span>
                  <span className="hidden text-xs text-dim sm:block">{timeAgo(b.created_at)}</span>
                  <StatusBadge status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
