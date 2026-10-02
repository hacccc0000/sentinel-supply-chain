import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { requestDemo } from "@/lib/server/api";
import { errMsg } from "@/lib/utils";
import { MarketingFooter, MarketingNav } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
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
          ["Package rules", "Minimum package age, new-maintainer detection, typosquat-like names, @sap/* scope checks, deny list."],
          ["Install scripts", "Install hooks are statically analysed for credential-file reads, shell pipes, obfuscation and network references."],
          ["Egress", "Hosts referenced by install scripts are checked against allow and deny lists (metadata IPs, .onion, paste sites and more)."],
          ["Vulnerabilities", "OSV advisories with computed CVSS: critical and high block in block mode; others warn."],
          ["Secrets", "Secret-shaped values are redacted from logs and evidence (SEC-03)."],
          ["SBOM", "CycloneDX 1.5 SBOM + in-toto provenance on every build, signed with Azure Key Vault (RS256) or the platform HMAC key."],
        ].map(([t, b]) => (
          <div key={t} className="rounded-md border border-line bg-elev p-6"><h2 className="mb-2 font-semibold">{t}</h2><p className="text-sm text-muted">{b}</p></div>
        ))}
      </div>
      <p className="mt-6 text-xs text-dim">Rules that need a runtime agent (isolation and runtime secret brokering) are listed in the policy builder and marked roadmap.</p>
      <Link to="/login" className="mt-6 inline-block"><Button>Open the policy builder</Button></Link>
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
    <Shell kicker="Docs" title="Register a project. Gate your pipeline. Export evidence.">
      <ol className="grid gap-3">
        {[
          ["1. Create a workspace", "Sign up; the first user becomes administrator. Add teammates under Identity."],
          ["2. Register a project", "Point at a GitHub repo (add a token under Integrations for private repos) or paste package.json / package-lock.json."],
          ["3. Run a build", "Run a protected build from the dashboard and review the timeline, findings and components."],
          ["4. Gate CI", "Create an API token, then POST /api/v1/scans from GitHub Actions, GitLab, Jenkins or Azure Pipelines. A blocked verdict fails the step."],
          ["4b. Private workers (optional)", "Register a worker, run the worker Docker image in your network, and assign projects to it. Source is fetched and scanned locally."],
          ["5. Review quarantine", "Approve, reject or permanently block held packages; decisions are audit-logged."],
          ["6. Export evidence", "Download the signed SBOM, provenance and an evidence bundle per build, and compliance reports per framework."],
        ].map(([t, b]) => (
          <li key={t} className="rounded-md border border-line bg-elev p-5"><div className="font-semibold">{t}</div><p className="mt-1 text-sm text-muted">{b}</p></li>
        ))}
      </ol>
      <pre className="mt-6 overflow-x-auto rounded-md border border-line bg-paper-2 p-4 font-mono text-xs leading-6">{`curl -X POST $URL/api/v1/scans \\
  -H "Authorization: Bearer $BB_TOKEN" -H "Content-Type: application/json" \\
  -d '{"project":"<project-id>","commit":"$GIT_SHA","wait":true}'`}</pre>
    </Shell>
  );
}

export function CustomersPage() {
  return (
    <Shell kicker="Who it is for" title="Built for SAP security and platform teams.">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Platform engineering", "Gate every CAP / BTP / Fiori pipeline with a single API call."],
          ["Application security", "Review quarantined packages and own the policy and allow/deny lists."],
          ["Audit & compliance", "Pull signed SBOMs, evidence bundles and control-mapping reports on demand."],
        ].map(([t, b]) => (
          <div key={t} className="rounded-md border border-line bg-elev p-6"><div className="mb-2 font-semibold">{t}</div><p className="text-sm text-muted">{b}</p></div>
        ))}
      </div>
      <Link to="/signup" className="mt-8 inline-block"><Button>Create your workspace</Button></Link>
    </Shell>
  );
}

export function DemoPage() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ company: "", contact: "", landscape: "SAP CAP on BTP", note: "" });
  return (
    <Shell kicker="Book a review" title="Tell us about your SAP landscape.">
      {sent ? (
        <div className="max-w-lg rounded-md border border-success/30 bg-success/8 p-6">
          <h2 className="mb-2 font-semibold">Request received</h2>
          <p className="text-sm text-muted">Your request is stored and our team has been notified. You can also create a workspace now and scan a project yourself.</p>
          <div className="mt-4 flex gap-2"><Link to="/signup"><Button>Create your workspace</Button></Link></div>
        </div>
      ) : (
        <form className="max-w-lg space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await requestDemo({ data: { ...f, note: f.note || undefined } }); setSent(true); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); } }}>
          <label className="block text-sm font-semibold">Company<Input className="mt-1.5" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} required minLength={2} /></label>
          <label className="block text-sm font-semibold">Work email<Input type="email" className="mt-1.5" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} required /></label>
          <label className="block text-sm font-semibold">SAP landscape
            <select value={f.landscape} onChange={(e) => setF({ ...f, landscape: e.target.value })} className="mt-1.5 h-10 w-full rounded-sm border border-line bg-elev px-3 text-sm">
              {["SAP CAP on BTP", "Fiori / UI5", "HANA Cloud apps", "Mixed BTP + on-prem", "Other"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Anything we should know? (optional)<textarea className="mt-1.5 w-full rounded-sm border border-line bg-elev px-3 py-2 text-sm" rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          <p className="text-xs text-dim">We store your company, email and landscape to follow up on this request.</p>
          <Button type="submit" disabled={busy}>Request a review</Button>
        </form>
      )}
    </Shell>
  );
}
