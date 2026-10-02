import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { requestDemo } from "@/lib/server/api";
import { errMsg } from "@/lib/utils";
import { CardGrid, CtaBand, Faq, GENERAL_FAQ, Section } from "@/features/marketing/sections";
import { MarketingFooter, MarketingNav } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
import { SAP_COVERAGE } from "@/lib/catalog";
import { FRAMEWORKS } from "@/lib/compliance";
import { Badge } from "@/components/ui/badge";

function Shell({ title, kicker, children, extra, cta = true }: { title: string; kicker: string; children: React.ReactNode; extra?: React.ReactNode; cta?: boolean }) {
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
      {extra}
      {cta && <CtaBand title="See it on your own dependency tree." body="Create a workspace, paste a package.json or point at a repository, and review the verdict in minutes." />}
      <MarketingFooter />
    </main>
  );
}

export function PoliciesPage() {
  return (
    <Shell kicker="Policies" title="Opinionated defaults for SAP CAP production." extra={<>
      <Section eyebrow="Enforcement" title="Three modes, set per project." tint>
        <CardGrid items={[
          { tag: "Audit", t: "Observe only", b: "Every finding is recorded and evidenced. Nothing is blocked. Use it to baseline a new project." },
          { tag: "Warn", t: "Flag and continue", b: "Violations raise warnings and notifications; the verdict is warned and the pipeline continues." },
          { tag: "Block", t: "Stop the build", b: "Critical and high vulnerabilities, deny-listed packages and dangerous install scripts block the build and quarantine the package." },
        ]} />
      </Section>
      <Section eyebrow="Lifecycle" title="Policies are versioned, not edited in place.">
        <CardGrid cols={2} items={[
          { t: "Draft, review, publish", b: "Edit rules in the policy builder, review the change, then publish a new version. Previous versions stay on record." },
          { t: "Allow and deny lists", b: "Reviewers can allow-list a package or version with a justification, or permanently block it. Both actions are attributed in the audit log." },
        ]} />
      </Section>
      <Section eyebrow="Questions" title="About policies." tint><Faq items={GENERAL_FAQ.slice(0, 2).concat(GENERAL_FAQ.slice(4, 5))} /></Section>
    </>}>
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
    <Shell kicker="SAP coverage" title="Every surface your CAP / BTP / Fiori teams actually build." extra={<>
      <Section eyebrow="What we look for" title="Checks that matter in SAP dependency trees." tint>
        <CardGrid cols={2} items={[
          { t: "@sap/* scope integrity", b: "Packages in the @sap scope are checked for unexpected maintainers and lookalike names outside the scope." },
          { t: "CAP and MTA toolchains", b: "Build-time packages such as CDS tooling and MTA build helpers are scanned like any other dependency, including their install scripts." },
          { t: "UI5 and Fiori tooling", b: "Front-end tooling pulls deep trees. Lockfile v1, v2 and v3 are parsed so the exact versions are evaluated." },
          { t: "Deploy-time credentials", b: "Install hooks that read .npmrc, cloud tokens or environment secrets are flagged because BTP pipelines hold those credentials." },
        ]} />
      </Section>
      <Section eyebrow="Questions" title="About SAP projects."><Faq items={GENERAL_FAQ.slice(0, 4)} /></Section>
    </>}>
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
    <Shell kicker="Compliance" title="Evidence packets, not transferred certifications." extra={<>
      <Section eyebrow="Evidence packet" title="What an auditor receives for each build." tint>
        <CardGrid cols={4} items={[
          { t: "CycloneDX SBOM", b: "Every resolved component with versions and hashes where available." },
          { t: "Provenance", b: "An in-toto statement describing what was analysed, when and by which scanner." },
          { t: "Signature", b: "HMAC-SHA256 or Azure Key Vault RS256 signature you can verify in the app." },
          { t: "Decision log", b: "Who approved, rejected or blocked what, with notes and timestamps." },
        ]} />
      </Section>
      <Section eyebrow="Mapping" title="How control coverage is computed.">
        <CardGrid cols={2} items={[
          { t: "Rules map to controls", b: "Each policy rule is mapped to controls in the frameworks above. Coverage is computed live from the rules you have enabled." },
          { t: "Exports", b: "Download per-framework reports as JSON, plus findings, quarantine and audit-log CSVs and a ZIP of SBOMs." },
        ]} />
      </Section>
      <Section eyebrow="Questions" title="About compliance." tint><Faq items={GENERAL_FAQ.slice(4, 7)} /></Section>
    </>}>
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
    <Shell kicker="Docs" title="Register a project. Gate your pipeline. Export evidence." extra={<>
      <Section eyebrow="REST API" title="Endpoints." tint>
        <div className="overflow-x-auto rounded-md border border-line bg-paper">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-elev text-2xs font-bold tracking-wider text-dim uppercase"><tr>{["Method", "Path", "Purpose"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {[
                ["POST", "/api/v1/scans", "Start a scan by project or repo. Optionally send package_json and package_lock."],
                ["GET", "/api/v1/builds/:id?wait=120", "Poll a build. Returns status, blocked, severity counts and the dashboard URL."],
                ["GET", "/api/v1/builds/:id/sbom.cdx.json", "Signed CycloneDX SBOM for the build."],
                ["GET", "/api/v1/builds/:id/provenance.json", "in-toto provenance statement."],
                ["GET", "/api/v1/builds/:id/evidence.zip", "Evidence packet for auditors."],
                ["GET", "/api/v1/compliance/:framework", "Control-mapped compliance report."],
                ["GET", "/api/v1/export/findings.csv", "Also audit.csv, quarantine.csv and sboms.zip."],
                ["GET", "/api/health", "Liveness and database check."],
              ].map(([m, pth, d]) => (
                <tr key={pth} className="border-t border-line"><td className="px-4 py-3 font-mono text-xs text-navy">{m}</td><td className="px-4 py-3 font-mono text-xs">{pth}</td><td className="px-4 py-3 text-muted">{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-dim">Authenticate with <code className="font-mono">Authorization: Bearer bb_…</code>. Tokens are created under Integrations and shown once.</p>
      </Section>
      <Section eyebrow="Private worker" title="Scan inside your own network.">
        <pre className="overflow-x-auto rounded-md border border-line bg-paper-2 p-4 font-mono text-xs leading-6">{`docker run -d --restart unless-stopped \
  -e BB_URL=https://<your-app>.azurewebsites.net \
  -e BB_WORKER_TOKEN=bbw_… \
  ghcr.io/hacccc0000/sentinel-supply-chain-worker:latest`}</pre>
        <p className="mt-4 max-w-2xl text-sm text-muted">Register the worker under Workers to get its token, then choose it in a project&apos;s &quot;Run scans on&quot; setting. The worker claims jobs, fetches and scans locally, and uploads only the result.</p>
      </Section>
      <Section eyebrow="Roles" title="Permissions at a glance." tint>
        <CardGrid cols={4} items={[
          { tag: "Admin", t: "Everything", b: "Users, integrations, API tokens, policy and settings." },
          { tag: "Operator", t: "Run and manage", b: "Run builds, manage projects and workers, update findings." },
          { tag: "Reviewer", t: "Decide", b: "Approve or reject quarantine, edit allow-lists, run builds." },
          { tag: "Auditor", t: "Read and export", b: "Download evidence and reports. No changes." },
        ]} />
      </Section>
      <Section eyebrow="Questions" title="Troubleshooting."><Faq items={GENERAL_FAQ.slice(2, 5)} /></Section>
    </>}>
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
  -d '{"project":"<project-id>","commit":"$GIT_SHA"}'
# then poll until finished (status: passed | warned | blocked | failed)
curl -H "Authorization: Bearer $BB_TOKEN" "$URL/api/v1/builds/<id>?wait=120"`}</pre>
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
    <Shell kicker="Contact us" title="Tell us about your SAP landscape.">
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
