import { Link } from "@tanstack/react-router";
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
          ["SBOM", "CycloneDX 1.5 SBOM + in-toto provenance on every build, HMAC-signed."],
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
  return (
    <Shell kicker="Get started" title="Create a workspace and scan a real project.">
      <p className="mb-6 max-w-lg text-sm text-muted">Sign up, paste a package.json or point at a repository, and run your first protected build.</p>
      <div className="flex gap-2"><Link to="/signup"><Button>Create your workspace</Button></Link><Link to="/login"><Button variant="secondary">Sign in</Button></Link></div>
    </Shell>
  );
}
