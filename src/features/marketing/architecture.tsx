import { Link } from "@tanstack/react-router";
import { Check, Cloud, Container, FileLock, Globe2, LayoutDashboard, Minus, Server } from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/marketing-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SAP_COVERAGE } from "@/lib/catalog";

export function ArchitecturePage() {
  return (
    <main className="bg-paper">
      <MarketingNav />
      <section className="border-b border-line py-16">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
          <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-navy uppercase">Architecture</div>
          <h1 className="max-w-4xl text-4xl font-light tracking-tight sm:text-5xl">
            Hosted control plane. <span className="text-navy">Customer-owned workers.</span> No source in the middle.
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted">
            BuildBouncer is intentionally split. Policy authoring, dashboards, evidence index — we host. The parts that touch your source, secrets, and SAP credentials run in workers you operate, inside your own network.
          </p>
        </div>
      </section>

      <section className="border-b border-line bg-elev py-16">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
          <div className="relative hidden min-h-[520px] rounded-xl border border-line bg-paper p-8 lg:block">
            <div className="absolute inset-x-8 top-6 rounded-lg border border-info/40 bg-info/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                BuildBouncer control plane
                <Badge kind="info">SaaS · multi-tenant</Badge>
                <span className="ml-auto font-mono text-2xs text-dim">control.buildbouncer.io · TLS</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {["Policy editor", "Dashboards", "Evidence index", "Identity / RBAC", "Audit log"].map((t) => (
                  <div key={t} className="rounded-sm border border-line bg-paper px-3 py-2.5 text-xs">
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute top-[168px] right-8 left-8 h-px bg-[repeating-linear-gradient(90deg,var(--bb-navy)_0_8px,transparent_8px_14px)] opacity-50" />
            <div className="absolute top-[158px] left-12 bg-paper px-2 text-2xs font-bold tracking-wider text-navy uppercase">↓ customer network boundary ↓</div>
            <div className="absolute inset-x-8 top-[188px] bottom-6 rounded-lg border border-navy/50 bg-navy/5 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold">
                Private worker · customer-owned
                <Badge kind="success">single-tenant</Badge>
                <span className="ml-auto font-mono text-2xs text-dim">k8s.internal / buildbouncer ns</span>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {[
                  ["Package firewall", "Quarantine + scoring"],
                  ["Lifecycle sandbox", "Static analysis · never executed"],
                  ["Egress firewall", "Default-deny outbound"],
                  ["SBOM signer", "CycloneDX + in-toto"],
                  ["Secret broker", "Bound to vault"],
                  ["Build runtime", "rootless · ephemeral"],
                ].map(([t, b]) => (
                  <div key={t} className="rounded-sm border border-line bg-paper p-3">
                    <div className="text-xs font-semibold">{t}</div>
                    <div className="text-2xs text-dim">{b}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 border-t border-navy/20 pt-3">
                {[
                  ["Source", "from your VCS only"],
                  ["Package mirror", "internal registry"],
                  ["Vault", "secrets brokered in"],
                  ["Evidence store", "customer bucket"],
                ].map(([t, s]) => (
                  <div key={t} className="rounded-sm bg-paper px-3 py-2">
                    <div className="text-xs">{t}</div>
                    <div className="text-2xs text-dim">{s}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Control plane", "Multi-tenant SaaS. Policy editor, dashboards, evidence index."],
              ["Worker", "Scan runtime. Built-in scanner today; private workers report heartbeat from your infrastructure."],
              ["Boundary", "Only dependency metadata is sent to public registries. Source code is not copied."],
              ["Customer-held keys", "SBOM signing, evidence sealing, secrets brokering — KMS keys you own."],
            ].map(([t, b]) => (
              <div key={t} className="rounded-md border border-line bg-paper p-5">
                <div className="mb-3 h-6 w-1.5 rounded-sm bg-navy" />
                <div className="mb-1.5 text-sm font-semibold">{t}</div>
                <div className="text-xs leading-relaxed text-muted">{b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line py-16">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
          <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-navy uppercase">What crosses the boundary</div>
          <h2 className="mb-10 max-w-2xl text-4xl font-light tracking-tight">We are precise about what leaves your worker.</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-md border border-line bg-elev p-7">
              <div className="mb-4 flex items-center gap-2 font-semibold">What leaves the worker</div>
              {[
                ["Build outcome", "pass / fail / blocked + reason code"],
                ["Policy decisions", "rule IDs and rule versions that fired"],
                ["SBOM digest", "sha256 of the SBOM, not the SBOM itself"],
                ["Worker heartbeat", "version, queue depth, uptime"],
                ["Evidence index", "manifest filenames + hashes only"],
              ].map((r) => (
                <div key={r[0]} className="grid grid-cols-[140px_1fr] gap-3 border-t border-line py-2.5 text-xs">
                  <span className="font-semibold text-dim">{r[0]}</span>
                  <span className="text-muted">{r[1]}</span>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-line bg-elev p-7">
              <div className="mb-4 flex items-center gap-2 font-semibold">What never leaves</div>
              {[
                ["Source code", "git contents stay in your VCS"],
                ["Build artifacts", "compiled bundles stay on your worker"],
                ["The SBOM itself", "stored encrypted in your bucket"],
                ["Secrets / credentials", "brokered from your vault per-build"],
                ["Customer data", "we never see it; the worker doesn't store it"],
                ["Console logs", "redacted on-worker, then signed locally"],
              ].map((r) => (
                <div key={r[0]} className="grid grid-cols-[140px_1fr] gap-3 border-t border-line py-2.5 text-xs">
                  <span className="font-semibold text-danger">{r[0]}</span>
                  <span className="text-muted">{r[1]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-elev py-16">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
          <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-navy uppercase">Worker deployment</div>
          <h2 className="mb-10 text-4xl font-light tracking-tight">Six install paths. One worker contract.</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              { ic: Cloud, t: "Azure AKS", b: "Private worker packaging is on the roadmap.", time: "roadmap" },
              { ic: Cloud, t: "AWS EKS", b: "Private worker packaging is on the roadmap.", time: "roadmap" },
              { ic: Cloud, t: "Google GKE", b: "Private worker packaging is on the roadmap.", time: "roadmap" },
              { ic: Server, t: "On-prem Kubernetes", b: "Air-gapped bundle is on the roadmap.", time: "roadmap" },
              { ic: Container, t: "Docker / VM", b: "Single-host install for staging or sandbox.", time: "6 min" },
              { ic: Globe2, t: "Edge / custom", b: "Bare binary with manual reconcile loop and audit log.", time: "—" },
            ].map((c) => (
              <div key={c.t} className="rounded-md border border-line bg-paper p-5">
                <c.ic className="mb-3 size-5 text-navy" />
                <div className="mb-1.5 font-semibold">{c.t}</div>
                <p className="mb-3 text-sm text-muted">{c.b}</p>
                <div className="flex justify-between text-2xs">
                  <span className="text-dim">typical install</span>
                  <span className="font-mono font-semibold text-navy">{c.time}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/dashboard/workers/install">
              <Button>Try the install wizard</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-line py-16">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-9">
          <div className="mb-3 text-2xs font-bold tracking-[0.16em] text-navy uppercase">SAP coverage</div>
          <h2 className="mb-10 text-4xl font-light tracking-tight">Built around SAP's actual build surfaces.</h2>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-elev text-2xs font-bold tracking-wider text-dim uppercase">
                <tr>
                  {["Build surface", "Runtime", "Coverage", "SBOM", "Lifecycle", "Egress", "Notes"].map((h) => (
                    <th key={h} className="px-3.5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAP_COVERAGE.map((r) => (
                  <tr key={r[0]} className="border-t border-line">
                    <td className="px-3.5 py-3 font-medium">{r[0]}</td>
                    <td className="px-3.5 py-3 font-mono text-xs text-dim">{r[1]}</td>
                    <td className="px-3.5 py-3"><Badge kind={r[2] === "Live" ? "success" : "warn"}>{r[2]}</Badge></td>
                    <td className="px-3.5 py-3">{r[3] ? <Check className="size-3.5 text-success" /> : <Minus className="size-3.5 text-dim" />}</td>
                    <td className="px-3.5 py-3">{r[4] ? <Check className="size-3.5 text-success" /> : <Minus className="size-3.5 text-dim" />}</td>
                    <td className="px-3.5 py-3">{r[5] ? <Check className="size-3.5 text-success" /> : <Minus className="size-3.5 text-dim" />}</td>
                    <td className="px-3.5 py-3 text-xs text-dim">{r[6]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-elev py-16 text-center">
        <h2 className="text-4xl font-light tracking-tight">Want to read the threat model?</h2>
        <p className="mx-auto mt-4 max-w-lg text-muted">We share our internal threat model, key rotation plan, and runtime sandbox details with prospective customers under NDA.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Link to="/demo"><Button><FileLock className="size-4" />Request threat model</Button></Link>
          <Link to="/dashboard"><Button variant="secondary"><LayoutDashboard className="size-4" />Tour the dashboard</Button></Link>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
