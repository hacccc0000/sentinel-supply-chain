import { Link } from "@tanstack/react-router";
import { MarketingFooter, MarketingNav } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";

const stages = [
  ["Source", "GitHub raw/API fetch of package.json and lockfile, or a pasted manifest. Repository code is not cloned."],
  ["Resolve", "Lockfile v1/v2/v3 parsing; without a lockfile, a semver-aware registry resolution of the full tree."],
  ["Enrich", "npm registry packuments (publish time, maintainers) and OSV.dev advisories with computed CVSS."],
  ["Analyse", "Tarballs of packages with install hooks are unpacked in memory and statically inspected. Nothing is executed."],
  ["Decide", "Policy rules + enforcement mode. Critical/high findings block in block mode; quarantine holds suspicious packages."],
  ["Seal", "CycloneDX SBOM and in-toto provenance signed with HMAC-SHA256; evidence zip assembled; alerts dispatched."],
];

export function ArchitecturePage() {
  return (
    <main className="bg-paper text-ink">
      <MarketingNav />
      <section className="border-b border-line py-16">
        <div className="mx-auto max-w-[1100px] px-5 lg:px-9">
          <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-navy uppercase">Architecture</div>
          <h1 className="max-w-3xl text-4xl font-light tracking-tight">A control plane and a static analysis pipeline.</h1>
          <p className="mt-5 max-w-2xl text-muted">One container (TanStack Start / Node) on Azure App Service with PostgreSQL. The built-in scanner runs the pipeline below inside the control plane; private workers can register and report heartbeat.</p>
        </div>
      </section>
      <section className="border-b border-line py-14">
        <div className="mx-auto grid max-w-[1100px] gap-3 px-5 md:grid-cols-3 lg:px-9">
          {stages.map(([t, b], i) => (
            <div key={t} className="rounded-md border border-line bg-elev p-5"><div className="mb-1 font-mono text-2xs text-dim">0{i + 1}</div><div className="mb-1.5 font-semibold">{t}</div><p className="text-sm text-muted">{b}</p></div>
          ))}
        </div>
      </section>
      <section className="border-b border-line bg-elev py-14">
        <div className="mx-auto grid max-w-[1100px] gap-6 px-5 md:grid-cols-2 lg:px-9">
          <div className="rounded-md border border-line bg-paper p-6">
            <h2 className="mb-3 font-semibold">What leaves the platform</h2>
            <ul className="space-y-2 text-sm text-muted"><li>• Package names and versions → npm registry and OSV.dev for metadata and advisories.</li><li>• Repository requests → GitHub (only for the manifest and lockfile).</li><li>• Alerts → only to the Slack, Teams or webhook URLs you configure.</li></ul>
          </div>
          <div className="rounded-md border border-line bg-paper p-6">
            <h2 className="mb-3 font-semibold">How data is protected</h2>
            <ul className="space-y-2 text-sm text-muted"><li>• Passwords hashed with scrypt; sessions in HTTP-only cookies.</li><li>• Integration credentials encrypted at rest with AES-256-GCM.</li><li>• Secrets in logs and evidence are redacted (rule SEC-03).</li><li>• Every privileged action is written to the audit log.</li></ul>
          </div>
        </div>
      </section>
      <section className="py-14">
        <div className="mx-auto max-w-[1100px] px-5 lg:px-9">
          <h2 className="mb-3 text-2xl font-light">Not built yet</h2>
          <p className="max-w-2xl text-sm text-muted">A runtime sandbox that observes install scripts as they execute, customer-hosted workers that run scans, Kubernetes packaging, KMS/HSM-backed signing keys and SSO are on the roadmap. The UI marks these as roadmap wherever they appear.</p>
          <div className="mt-7 flex gap-2"><Link to="/signup"><Button>Create your workspace</Button></Link><Link to="/docs"><Button variant="secondary">Read the docs</Button></Link></div>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
