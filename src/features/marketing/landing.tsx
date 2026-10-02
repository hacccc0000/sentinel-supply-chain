import { Link } from "@tanstack/react-router";
import { Check, FileSignature, KeyRound, LogIn, PackageX, Play, ScrollText, ShieldCheck, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { MarketingFooter, MarketingNav } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
import { HERO_CONSOLE } from "@/lib/catalog";

const tone = (c: string) => (c === "ok" ? "text-success" : c === "warn" ? "text-warn" : c === "block" ? "text-danger" : c === "ink" ? "text-ink" : "text-dim");

export function LandingPage() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 6), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <main className="bg-paper text-ink">
      <MarketingNav />
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-9 lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-elev px-3 py-1.5 text-2xs text-muted">
              <span className="size-1.5 rounded-full bg-success shadow-[0_0_6px_var(--bb-success)]" />
              <span className="font-mono">Early access</span> · SAP CAP / BTP / Fiori
            </div>
            <h1 className="text-[42px] leading-[0.98] font-light tracking-[-0.04em] text-ink sm:text-6xl">
              Stop bad packages
              <br />
              <span className="text-navy">before your SAP build</span>
              <br />
              <span className="font-extralight text-dim">ever runs them.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted">
              BuildBouncer reads your <code className="font-mono text-ink">package.json</code> and lockfile, resolves the full dependency graph, checks every package against vulnerability data and install-script heuristics, and <strong className="text-ink">blocks the build</strong> when policy is violated — with signed SBOM and evidence for your auditors.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              <Link to="/signup"><Button size="lg"><LogIn className="size-4" />Create your workspace</Button></Link>
              <Link to="/login"><Button variant="secondary" size="lg"><Play className="size-4" />Sign in</Button></Link>
            </div>
            <div className="mt-8 flex flex-col gap-2 text-xs text-dim sm:flex-row sm:gap-7">
              {["Scripts are analysed, never executed", "Source code is not copied", "CI gate via REST API"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><Check className="size-3 text-navy" />{t}</span>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-md border border-line bg-elev">
            <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5">
              <span className="size-2 rounded-full bg-danger" /><span className="size-2 rounded-full bg-warn" /><span className="size-2 rounded-full bg-success" />
              <span className="ml-2 font-mono text-2xs text-dim">BuildBouncer · illustrative replay</span>
            </div>
            <div className="min-h-[300px] p-4 font-mono text-xs leading-7">
              {HERO_CONSOLE.slice(0, step + 5).map((l, i) => (<div key={i} className={tone(l.c)}>{l.t}</div>))}
              <span className="bb-caret" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line py-20">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
          <div className="mb-12 max-w-3xl">
            <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-navy uppercase">The problem</div>
            <h2 className="text-4xl font-light tracking-tight">Your SAP build pulls hundreds of packages you never reviewed.</h2>
            <p className="mt-5 text-base leading-relaxed text-muted">Every CAP or Fiori project resolves a deep npm tree. Install scripts run with the build user's environment, and one typosquat or hijacked maintainer is enough. BuildBouncer puts a decision point in front of that.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { ic: PackageX, t: "Suspicious packages", b: "Brand-new versions, new maintainers and typosquat-like names are held for human review." },
              { ic: KeyRound, t: "Install-script abuse", b: "Tarballs are unpacked and install hooks analysed for credential reads (.npmrc, tokens), network egress and obfuscation." },
              { ic: ScrollText, t: "Audit evidence", b: "Every decision is attributed and logged. Each build yields a signed SBOM, provenance and an evidence bundle." },
            ].map((c) => (
              <div key={c.t} className="rounded-md border border-line bg-elev p-6"><c.ic className="mb-3.5 size-5 text-danger" /><h3 className="mb-2 text-base font-semibold">{c.t}</h3><p className="text-sm leading-relaxed text-muted">{c.b}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-elev py-20">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
          <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-navy uppercase">How it works</div>
          <h2 className="mb-10 text-4xl font-light tracking-tight">Six checks, one verdict.</h2>
          <ol className="grid gap-3 md:grid-cols-3">
            {[
              ["1 · Fetch", "Manifest and lockfile from your GitHub repo, or pasted directly."],
              ["2 · Resolve", "Lockfile v1/v2/v3 or registry resolution builds the full dependency graph."],
              ["3 · Enrich", "Publish age, maintainer changes and OSV advisories (CVSS) per package."],
              ["4 · Analyse", "Install scripts statically inspected: credential paths, egress hosts, shell pipes, obfuscation."],
              ["5 · Decide", "Policy rules and your enforcement mode (audit / warn / block) produce the verdict."],
              ["6 · Prove", "Signed CycloneDX SBOM, in-toto provenance and evidence bundle; alerts to Slack/Teams/webhook."],
            ].map(([t, b]) => (<li key={t} className="rounded-md border border-line bg-paper p-5"><div className="mb-1.5 font-semibold">{t}</div><p className="text-sm text-muted">{b}</p></li>))}
          </ol>
        </div>
      </section>

      <section className="border-b border-line py-20">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
          <h2 className="mb-10 text-4xl font-light tracking-tight">What is in the product today</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              { ic: ShieldCheck, t: "Policy engine", b: "29 rules across packages, lifecycle scripts, vulnerabilities, egress and SBOM. Version history and publish.", to: "/policies" },
              { ic: PackageX, t: "Quarantine workflow", b: "Approve, reject or permanently block — with notes, bulk actions and an audit trail.", to: "/dashboard/quarantine" },
              { ic: FileSignature, t: "Signed SBOM & provenance", b: "CycloneDX 1.5 and in-toto statements, HMAC-SHA256 signed and verifiable in the app.", to: "/dashboard/sbom" },
              { ic: Workflow, t: "CI/CD gate", b: "POST /api/v1/scans with an API token; fail the pipeline on a blocked verdict.", to: "/docs" },
              { ic: ScrollText, t: "Compliance mapping", b: "Controls from SOC 2, ISO 27001, NIST SSDF, DORA and more mapped to rules; coverage computed live.", to: "/compliance" },
              { ic: KeyRound, t: "Access control", b: "Admin, operator, reviewer and auditor roles; sign-in, sessions and an immutable audit log.", to: "/dashboard/identity" },
            ].map((c) => (
              <div key={c.t} className="rounded-md border border-line bg-elev p-6"><c.ic className="mb-3.5 size-5 text-navy" /><h3 className="mb-2 text-base font-semibold">{c.t}</h3><p className="mb-3 text-sm text-muted">{c.b}</p><Link to={c.to} className="text-xs font-semibold text-navy hover:underline">Open →</Link></div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-sm text-dim">On the roadmap: a runtime sandbox agent that observes install scripts as they execute, Java/Maven support, KMS-backed signing keys, and BTP / Jira / Vault integrations.</p>
        </div>
      </section>

      <section className="bg-elev py-20 text-center">
        <h2 className="text-4xl font-light tracking-tight">Scan your first SAP project in minutes.</h2>
        <p className="mx-auto mt-4 max-w-lg text-muted">Create a workspace, paste a package.json or point at a repository, and see the verdict.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2"><Link to="/signup"><Button size="lg">Create your workspace</Button></Link><Link to="/architecture"><Button variant="secondary" size="lg">How it is built</Button></Link></div>
      </section>
      <MarketingFooter />
    </main>
  );
}
