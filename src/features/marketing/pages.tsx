import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MarketingFooter, MarketingNav } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SAP_COVERAGE } from "@/lib/catalog";
import { FRAMEWORKS } from "@/lib/compliance";
import { Badge } from "@/components/ui/badge";

function Shell({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <main className="bg-paper">
      <MarketingNav />
      <section className="border-b border-line py-14">
        <div className="mx-auto max-w-[1100px] px-5 lg:px-9">
          <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-navy uppercase">{kicker}</div>
          <h1 className="max-w-3xl text-4xl font-light tracking-tight">{title}</h1>
        </div>
      </section>
      <section className="py-12">
        <div className="mx-auto max-w-[1100px] px-5 lg:px-9">{children}</div>
      </section>
      <MarketingFooter />
    </main>
  );
}

export function PoliciesPage() {
  return (
    <Shell kicker="Policies" title="Opinionated defaults for SAP CAP production.">
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["Package firewall", "Maintainer pins, 14-day age floor, typosquat distance, approved @sap/* scopes."],
          ["Lifecycle sandbox", "Default-deny install scripts, hash pins, secret-shaped read denial, no network."],
          ["Egress", "Default-deny. Registries, vaults, SAP endpoints only. Geo and metadata denylist."],
          ["Vulns", "Block CVSS ≥ 9. Warn 7–8.9. SLA clocks for remaining findings."],
          ["Secrets", "Broker injection only. Stage-scoped. Hourly rotation. Log redaction."],
          ["SBOM", "CycloneDX 1.5 SBOM + in-toto provenance on every build, HMAC-signed."],
        ].map(([t, b]) => (
          <div key={t} className="rounded-md border border-line bg-elev p-6">
            <h2 className="mb-2 font-semibold">{t}</h2>
            <p className="text-sm text-muted">{b}</p>
          </div>
        ))}
      </div>
      <Link to="/dashboard/policy" className="mt-8 inline-block">
        <Button>Open the policy builder</Button>
      </Link>
    </Shell>
  );
}

export function SapCoveragePage() {
  return (
    <Shell kicker="SAP coverage" title="Every surface your CAP / BTP / Fiori teams actually build.">
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-elev text-2xs font-bold tracking-wider text-dim uppercase">
            <tr>{["Surface", "Runtime", "Status", "Notes"].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {SAP_COVERAGE.map((r) => (
              <tr key={r[0]} className="border-t border-line">
                <td className="px-3 py-3 font-medium">{r[0]}</td>
                <td className="px-3 py-3 font-mono text-xs text-dim">{r[1]}</td>
                <td className="px-3 py-3"><Badge kind={r[2] === "Live" ? "success" : "warn"}>{r[2]}</Badge></td>
                <td className="px-3 py-3 text-xs text-dim">{r[6]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

export function ComplianceMarketingPage() {
  return (
    <Shell kicker="Compliance" title="Evidence packets, not transferred certifications.">
      <p className="mb-8 max-w-2xl text-muted">Customer organizations remain responsible for their own certifications. BuildBouncer provides exportable, time-stamped evidence for auditors reviewing your SAP build pipelines.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {FRAMEWORKS.map((f) => (
          <div key={f.code} className="rounded-md border border-line bg-elev p-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xs font-bold tracking-wider text-navy uppercase">{f.code}</span>
              <Badge kind="navy">{f.controls.length} mapped controls</Badge>
            </div>
            <h2 className="mb-1 font-semibold">{f.title}</h2>
            <p className="text-sm text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function DocsPage() {
  return (
    <Shell kicker="Docs" title="Install a worker. Attach a CAP repo. Enforce policy.">
      <ol className="grid gap-3">
        {[
          ["1. Install a private worker", "Use the built-in scanner out of the box, or register private workers that report heartbeat from your own infrastructure."],
          ["2. Register SAP projects", "Point at your CAP, BTP extension or Fiori repository (or paste a package.json) and choose an enforcement mode."],
          ["3. Wire CI", "Call the scan API from GitHub Actions, GitLab, Jenkins or Azure Pipelines with an API token. A blocked verdict fails the step."],
          ["4. Review quarantine", "New packages and maintainer changes wait for a signed decision before they ever execute."],
          ["5. Export evidence", "CycloneDX SBOM, in-toto provenance and signed evidence bundles per build, plus compliance mapping reports."],
        ].map(([t, b]) => (
          <li key={t} className="rounded-md border border-line bg-elev p-5">
            <div className="font-semibold">{t}</div>
            <p className="mt-1 text-sm text-muted">{b}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex gap-2">
        <Link to="/dashboard/workers/install"><Button>Install wizard</Button></Link>
        <Link to="/dashboard/projects"><Button variant="secondary">Register a project</Button></Link>
      </div>
    </Shell>
  );
}

export function CustomersPage() {
  return (
    <Shell kicker="Customers" title="Built with SAP security teams, not generic AppSec.">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Global bank", "CAP extensions on BTP, 14 private workers, Strict Prod policy."],
          ["Industrial manufacturer", "Fiori launchpads + HANA APIs, on-prem Kubernetes in two DCs."],
          ["Pharma", "Air-gapped workers, customer-held KMS, DORA evidence packets."],
        ].map(([t, b]) => (
          <div key={t} className="rounded-md border border-line bg-elev p-6">
            <div className="mb-2 font-semibold">{t}</div>
            <p className="text-sm text-muted">{b}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function DemoPage() {
  const [sent, setSent] = useState(false);
  const [company, setCompany] = useState("");
  const [landscape, setLandscape] = useState("SAP CAP on BTP");
  return (
    <Shell kicker="Book a review" title="Bring a CAP repo. We'll block a bad package live.">
      {sent ? (
        <div className="max-w-lg rounded-md border border-success/30 bg-success/8 p-6">
          <h2 className="mb-2 font-semibold">Request recorded</h2>
          <p className="text-sm text-muted">We'll schedule a 30-minute review against your SAP landscape. Meanwhile, tour the live NorthBank tenant or register your own project in the dashboard.</p>
          <div className="mt-4 flex gap-2">
            <Link to="/dashboard"><Button>Open dashboard</Button></Link>
            <Link to="/dashboard/projects"><Button variant="secondary">Register a project</Button></Link>
          </div>
        </div>
      ) : (
        <form
          className="max-w-lg space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!company.trim()) return;
            setSent(true);
            toast.success("Review requested for " + company);
          }}
        >
          <label className="block text-sm font-semibold">
            Company
            <Input className="mt-1.5" value={company} onChange={(e) => setCompany(e.target.value)} required placeholder="NorthBank Industries" />
          </label>
          <label className="block text-sm font-semibold">
            SAP landscape
            <select
              value={landscape}
              onChange={(e) => setLandscape(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-sm border border-line bg-elev px-3 text-sm"
            >
              {["SAP CAP on BTP", "Fiori / UI5", "CAP Java / Maven", "HANA Cloud apps", "Mixed BTP + on-prem"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <p className="text-xs text-dim">We only store company and landscape for the live demo — no personal contact details in this tenant.</p>
          <Button type="submit">Request 30-min review</Button>
        </form>
      )}
    </Shell>
  );
}
