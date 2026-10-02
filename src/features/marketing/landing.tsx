import { Link } from "@tanstack/react-router";
import {
  Ban,
  Calendar,
  Check,
  FileSignature,
  Globe2,
  History,
  KeyRound,
  LayoutDashboard,
  Network,
  PackageX,
  Play,
  SatelliteDish,
  ScrollText,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MarketingFooter, MarketingNav } from "@/components/marketing-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HERO_CONSOLE } from "@/lib/catalog";
import { cn } from "@/lib/utils";

function tone(c: string) {
  return c === "ok" ? "text-success" : c === "warn" ? "text-warn" : c === "block" ? "text-danger" : c === "ink" ? "text-ink" : "text-dim";
}

export function LandingPage() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 8), 1400);
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
              <span className="font-mono">Closed beta</span> · SAP CAP / BTP / Fiori
            </div>
            <h1 className="text-[42px] leading-[0.98] font-light tracking-[-0.04em] text-ink sm:text-6xl">
              SAP-grade
              <br />
              <span className="text-navy">supply-chain security</span>
              <br />
              <span className="font-extralight text-dim">for every npm install.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted">
              BuildBouncer is a developer-security platform for SAP CAP, BTP and Fiori teams. We move your npm installs and JavaScript builds into{" "}
              <strong className="text-ink">private, customer-owned workers</strong> — so malicious packages, lifecycle scripts and exfiltration attempts get caught{" "}
              <em className="text-ink">before</em> they reach your SAP systems.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              <Link to="/demo">
                <Button size="lg">
                  <Calendar className="size-4" />
                  Book a 30-min security review
                </Button>
              </Link>
              <Link to="/dashboard/builds/$buildId" params={{ buildId: "47128" }}>
                <Button variant="secondary" size="lg">
                  <Play className="size-4" />
                  Watch a build get blocked
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-col gap-2 text-xs text-dim sm:flex-row sm:gap-7">
              {["No source leaves your network", "30-min installation", "SOC 2 evidence ready"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="size-3 text-navy" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-line bg-elev">
            <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5">
              <span className="size-2 rounded-full bg-danger" />
              <span className="size-2 rounded-full bg-warn" />
              <span className="size-2 rounded-full bg-success" />
              <span className="ml-2 font-mono text-2xs text-dim">BuildBouncer · illustrative replay</span>
              <span className="ml-auto text-2xs text-brand-red">recording</span>
            </div>
            <div className="min-h-[360px] p-4 font-mono text-xs leading-7">
              {HERO_CONSOLE.slice(0, step + 5).map((l, i) => (
                <div key={i} className={tone(l.c)}>
                  {l.t || "\u00A0"}
                </div>
              ))}
              <span className="bb-caret" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-elev py-11">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
          <div className="mb-6 text-center text-2xs font-bold tracking-[0.16em] text-dim uppercase">Built for SAP build environments</div>
          <div className="flex flex-wrap justify-between gap-x-8 gap-y-3 font-mono text-sm font-medium text-muted">
            {["SAP CAP (Node.js)", "SAP BTP Extension", "Fiori / UI5", "SAP Cloud SDK", "@sap/cds", "BTP Build Service", "SAP MTA Builder"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line py-20">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
          <div className="mb-12 max-w-3xl">
            <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-navy uppercase">The problem</div>
            <h2 className="text-4xl font-light tracking-tight">Your SAP build server is the softest part of your SAP estate.</h2>
            <p className="mt-5 text-base leading-relaxed text-muted">
              SAP runs on hardened infrastructure. Your <code className="rounded-sm bg-paper-2 px-1.5 py-0.5 font-mono text-sm text-ink">npm install</code> does not. Every CAP extension you ship pulls hundreds of packages, runs arbitrary lifecycle scripts, and reaches the open internet — usually from a CI runner with credentials to your SAP tenant.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              { ic: Ban, t: "Lifecycle scripts run with no review", b: "Postinstall hooks execute as build user with full env access. One typosquatted dep is enough." },
              { ic: SatelliteDish, t: "Builds reach the internet by default", b: "Default-allow egress means a malicious package can phone home before anyone notices." },
              { ic: KeyRound, t: "SAP credentials sit in CI variables", b: "BTP service keys, SAP Cloud SDK tokens — all readable by anything the build runs." },
              { ic: History, t: "No forensic trail when something runs", b: "When a build silently exfiltrates, you find out from your SOC, not your CI." },
              { ic: ScrollText, t: "Compliance demands evidence", b: "SOC 2 CC8.1, ISO 27001 A.8.28 and NIST SSDF all require you to attest what ran during build." },
              { ic: Ban, t: "Existing SCAs scan, they don't stop", b: "Knowing a CVE exists after the build doesn't help if the lifecycle script already executed." },
            ].map((c) => (
              <div key={c.t} className="rounded-md border border-line bg-elev p-6">
                <c.ic className="mb-3.5 size-5 text-danger" />
                <h3 className="mb-2 text-base font-semibold">{c.t}</h3>
                <p className="text-sm leading-relaxed text-muted">{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-elev py-20">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 lg:grid-cols-2 lg:px-9">
          <div>
            <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-navy uppercase">The architecture</div>
            <h2 className="text-4xl font-light tracking-tight">
              Hosted control plane.
              <br />
              <span className="text-navy">Private workers.</span>
            </h2>
            <p className="mt-5 mb-6 text-[15px] leading-relaxed text-muted">
              BuildBouncer is a split architecture. We host the policy editor, dashboards, and your evidence index. Dependency graphs are resolved and statically analysed by the <strong className="text-ink">scanner</strong>; install scripts are inspected, never executed. Private <em className="text-ink">workers</em> report heartbeat from your own infrastructure.
            </p>
            <div className="flex flex-col gap-3">
              {[
                [ShieldCheck, "Source code stays in your network. Always."],
                [KeyRound, "Build secrets never leave your vault."],
                [FileSignature, "Workers boot from a signed image you can audit."],
                [Globe2, "One control plane, many workers — multi-region by design."],
              ].map(([Ic, t]) => (
                <div key={String(t)} className="flex gap-3 text-sm">
                  <Ic className="mt-0.5 size-4 shrink-0 text-navy" />
                  <span>{t as string}</span>
                </div>
              ))}
            </div>
            <Link to="/architecture" className="mt-7 inline-block">
              <Button variant="secondary">
                Full architecture deep-dive
              </Button>
            </Link>
          </div>
          <ArchMini />
        </div>
      </section>

      <section className="border-b border-line py-20">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
          <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-navy uppercase">What's in the platform</div>
          <h2 className="mb-12 max-w-2xl text-4xl font-light tracking-tight">Five surfaces, one boundary: your worker.</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              { ic: PackageX, t: "Package Firewall", b: "Quarantine new packages, new maintainers, and version bumps. Approve once, allowlist forever.", l: "Open quarantine", to: "/dashboard/quarantine" },
              { ic: ScrollText, t: "Lifecycle Sandbox", b: "Install hooks are unpacked and statically analysed for credential reads, network egress and obfuscation — never executed.", l: "View lifecycle policy", to: "/dashboard/policy" },
              { ic: Network, t: "Egress Control", b: "Default-deny outbound from every build. Allowlist registries, vaults, and SAP service endpoints.", l: "Egress allowlist", to: "/dashboard/policy" },
              { ic: FileSignature, t: "Signed SBOM + SLSA", b: "Every build produces a CycloneDX SBOM and SLSA Level 3 provenance — signed by your worker key.", l: "Browse SBOMs", to: "/dashboard/sbom" },
              { ic: ShieldCheck, t: "Compliance evidence", b: "Pre-mapped to SOC 2, ISO 27001, NIST SSDF and OWASP SCVS. Export packets per audit.", l: "Compliance packets", to: "/dashboard/compliance" },
              { ic: ServerCog, t: "Private workers", b: "Register private workers that report heartbeat from your own infrastructure.", l: "Install a worker", to: "/dashboard/workers/install" },
            ].map((c) => (
              <div key={c.t} className="rounded-md border border-line bg-elev p-6">
                <c.ic className="mb-4 size-5 text-navy" />
                <h3 className="mb-2 text-[17px] font-semibold">{c.t}</h3>
                <p className="mb-4 text-sm leading-relaxed text-muted">{c.b}</p>
                <Link to={c.to} className="text-xs font-semibold hover:text-navy">
                  {c.l} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-elev py-20">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 lg:grid-cols-2 lg:px-9">
          <div>
            <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-danger uppercase">Live incident</div>
            <h2 className="text-4xl font-light tracking-tight">See exactly what we stopped at 14:04:58.</h2>
            <p className="mt-5 mb-6 text-[15px] leading-relaxed text-muted">
              A typosquat of <code className="font-mono text-ink">@sap/helper-utils</code> was pulled into a BTP build. Postinstall tried to read <code className="font-mono text-ink">.npmrc</code> and POST it to a Cloudflare-fronted host. The build was blocked before anything executed and a signed evidence packet was sealed.
            </p>
            <Link to="/dashboard/builds/$buildId" params={{ buildId: "47128" }}>
              <Button size="lg">Open the live build detail</Button>
            </Link>
          </div>
          <div className="rounded-md border border-danger/30 bg-danger/5 p-7">
            <div className="mb-4 flex items-center justify-between">
              <Badge kind="block">BLOCKED · CRITICAL</Badge>
              <span className="font-mono text-2xs text-dim">build #47128</span>
            </div>
            <div className="font-mono text-lg">sap-helper-utils@1.2.8</div>
            <div className="mb-6 text-xs text-dim">BTP Order Extension · main</div>
            {[
              ["Lifecycle script attempted", ".npmrc read + outbound POST"],
              ["Worker action", "killed pid · rootfs reset"],
              ["Time to halt", "1.4s after postinstall start"],
              ["Bytes exfiltrated", "0 B"],
              ["Evidence packet", "sealed, signed, in customer Vault"],
            ].map((r, i) => (
              <div key={r[0]} className={cn("grid grid-cols-[auto_1fr] gap-3 py-2", i && "border-t border-line")}>
                <span className="min-w-[150px] text-2xs font-bold tracking-wide text-dim uppercase">{r[0]}</span>
                <span className={cn("text-xs", i === 3 ? "font-mono font-bold text-success" : "text-ink")}>{r[1]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-elev py-20 text-center">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
          <h2 className="text-5xl font-light tracking-tight">One install. Zero source egress.</h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted">
            Book a 30-minute security review with an SAP-side engineer. Bring a sample CAP repo and we'll show the block live.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            <Link to="/demo">
              <Button size="lg">
                <Calendar className="size-4" />
                Book a security review
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="secondary" size="lg">
                <LayoutDashboard className="size-4" />
                Tour the dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}

function ArchMini() {
  return (
    <div className="relative h-[420px] rounded-lg border border-line bg-elev p-5 sm:h-[460px]">
      <div className="absolute inset-x-4 top-[118px] bottom-4 rounded-lg border border-dashed border-navy/40">
        <div className="absolute -top-2.5 left-4 bg-elev px-2 text-2xs font-bold tracking-wider text-navy uppercase">Customer network</div>
      </div>
      <div className="absolute inset-x-8 top-5 rounded-md border border-info/40 bg-info/5 p-3.5">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
          Hosted control plane
          <span className="ml-auto font-mono text-2xs text-dim">control.buildbouncer.io</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge kind="info">policy editor</Badge>
          <Badge kind="info">dashboards</Badge>
          <Badge kind="info">evidence index</Badge>
          <Badge kind="info">audit log</Badge>
        </div>
      </div>
      <div className="absolute top-[148px] left-8 w-[200px] rounded-md border border-navy/50 bg-navy/5 p-3.5">
        <div className="mb-1 text-xs font-semibold">Private worker</div>
        <div className="font-mono text-2xs text-dim">azure-prod-east-us-2</div>
        <div className="text-2xs text-muted">static analysis</div>
      </div>
      <div className="absolute top-[148px] right-8 w-[170px] rounded-md border border-line bg-paper p-3.5">
        <div className="mb-2 text-2xs font-bold tracking-wider text-dim uppercase">Per build</div>
        {["npm install", "lifecycle sandbox", "egress firewall", "SBOM sign"].map((t) => (
          <div key={t} className="font-mono text-2xs">· {t}</div>
        ))}
      </div>
      <div className="absolute right-8 bottom-8 left-8 grid grid-cols-3 gap-2">
        {[
          ["Vault", "secrets"],
          ["Source", "git"],
          ["Mirror", "registry"],
        ].map(([t, s]) => (
          <div key={t} className="rounded-sm border border-line bg-paper p-2.5 text-center">
            <div className="text-2xs font-semibold">{t}</div>
            <div className="text-2xs text-dim">{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
