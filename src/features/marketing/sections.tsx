import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export const Eyebrow = ({ children }: { children: ReactNode }) => <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-navy uppercase">{children}</div>;

export function Section({ eyebrow, title, intro, children, tint }: { eyebrow?: string; title: string; intro?: string; children: ReactNode; tint?: boolean }) {
  return (
    <section className={`border-b border-line py-16 lg:py-20 ${tint ? "bg-elev" : ""}`}>
      <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
        <div className="mb-10 max-w-3xl">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2 className="text-3xl font-light tracking-tight sm:text-4xl">{title}</h2>
          {intro && <p className="mt-4 text-base leading-relaxed text-muted">{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function StatsStrip({ stats }: { stats: [string, string][] }) {
  return (
    <section className="border-b border-line bg-elev">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-px px-5 py-2 sm:grid-cols-4 lg:px-9">
        {stats.map(([n, l]) => (
          <div key={l} className="px-2 py-6 text-center">
            <div className="font-mono text-3xl font-light tracking-tight text-navy">{n}</div>
            <div className="mt-1 text-xs text-muted">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BeforeAfter({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="grid grid-cols-[1fr_1fr_1fr] bg-elev text-2xs font-bold tracking-wider text-dim uppercase">
        <div className="px-4 py-3">Concern</div>
        <div className="px-4 py-3">Without a gate</div>
        <div className="px-4 py-3 text-navy">With BuildBouncer</div>
      </div>
      {rows.map(([a, b, c]) => (
        <div key={a} className="grid grid-cols-1 border-t border-line text-sm sm:grid-cols-[1fr_1fr_1fr]">
          <div className="px-4 py-3.5 font-semibold">{a}</div>
          <div className="flex gap-2 px-4 py-3.5 text-muted"><Minus className="mt-0.5 size-4 shrink-0 text-danger" />{b}</div>
          <div className="flex gap-2 px-4 py-3.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{c}</div>
        </div>
      ))}
    </div>
  );
}

export function CardGrid({ items, cols = 3 }: { items: { t: string; b: string; tag?: string }[]; cols?: 2 | 3 | 4 }) {
  const c = cols === 2 ? "md:grid-cols-2" : cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";
  return (
    <div className={`grid gap-3 ${c}`}>
      {items.map((i) => (
        <div key={i.t} className="rounded-md border border-line bg-elev p-6 transition hover:border-navy/40">
          {i.tag && <div className="mb-2 font-mono text-2xs tracking-wider text-brand-red uppercase">{i.tag}</div>}
          <h3 className="mb-2 text-base font-semibold">{i.t}</h3>
          <p className="text-sm leading-relaxed text-muted">{i.b}</p>
        </div>
      ))}
    </div>
  );
}

export function Faq({ items }: { items: [string, string][] }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-line rounded-md border border-line bg-elev">
      {items.map(([q, a]) => (
        <details key={q} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
            {q}
            <ChevronDown className="size-4 shrink-0 text-dim transition group-open:rotate-180" />
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}

export function CtaBand({ title, body }: { title: string; body: string }) {
  return (
    <section className="border-b border-line py-16 text-center">
      <h2 className="mx-auto max-w-2xl text-3xl font-light tracking-tight sm:text-4xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-lg text-muted">{body}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link to="/signup"><Button size="lg">Create your workspace</Button></Link>
        <Link to="/demo"><Button variant="secondary" size="lg">Book a review</Button></Link>
      </div>
    </section>
  );
}

export const GENERAL_FAQ: [string, string][] = [
  ["Does BuildBouncer run my code or install packages?", "No. It analyses package metadata, lockfiles and the install-script text inside package tarballs. It never executes package code. A runtime sandbox that observes scripts as they run is on the roadmap and is not part of today's product."],
  ["What leaves my environment?", "Package names and versions go to the npm registry and OSV.dev for metadata and advisories. Source code is not uploaded. With a private worker, the repository is fetched and scanned inside your own network and only the result is uploaded."],
  ["How is the SBOM signed?", "Every build produces a CycloneDX 1.5 SBOM and an in-toto provenance statement. They are signed with the platform HMAC-SHA256 key, or with an Azure Key Vault RS256 key when Key Vault is enabled. You can verify a signature inside the app."],
  ["Can it fail my CI pipeline?", "Yes. Create an API token, start a scan with POST /api/v1/scans, then poll the build. The step exits non-zero unless the verdict is passed or warned. Snippets for GitHub Actions and GitLab are in the dashboard under Integrations."],
  ["Who can do what?", "Four roles: admin (everything), operator (run builds, manage projects and workers), reviewer (decide quarantine, edit allow-lists) and auditor (read and export evidence). Every action is written to an audit log."],
  ["Is this a certification?", "No. BuildBouncer produces time-stamped, signed evidence that supports your audits. Your organisation remains responsible for its own SOC 2, ISO 27001 or DORA compliance."],
  ["Where is it hosted?", "As a single container on Azure App Service backed by Azure Database for PostgreSQL, so your data stays in the Azure tenant you deploy it to."],
];
