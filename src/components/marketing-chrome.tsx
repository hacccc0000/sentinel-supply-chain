import { Link } from "@tanstack/react-router";
import { Calendar, Menu, X } from "lucide-react";
import { useState } from "react";
import { LogoLink } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { to: "/architecture", label: "Architecture" },
  { to: "/policies", label: "Policies" },
  { to: "/sap-coverage", label: "SAP coverage" },
  { to: "/compliance", label: "Compliance" },
  { to: "/docs", label: "Docs" },
  { to: "/demo", label: "Contact" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-[var(--bb-nav)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-5 py-3.5 lg:px-9">
        <LogoLink />
        <div className="hidden items-center gap-6 text-sm text-muted lg:flex">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <Link to="/login">
            <Button variant="secondary" size="sm">
              Sign in
            </Button>
          </Link>
          <Link to="/demo">
            <Button size="sm">
              <Calendar className="size-3.5" />
              Book a review
            </Button>
          </Link>
        </div>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-sm border border-line lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-line px-5 py-4 lg:hidden">
          <div className="flex flex-col gap-3 text-sm">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="py-1 text-muted hover:text-ink">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-wrap gap-2">
              <ThemeToggle />
              <Link to="/login" onClick={() => setOpen(false)}>
                <Button variant="secondary" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/signup" onClick={() => setOpen(false)}>
                <Button size="sm">Get started</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

const footCols: { title: string; items: { to: string; label: string }[] }[] = [
  { title: "Product", items: [{ to: "/architecture", label: "Architecture" }, { to: "/policies", label: "Policies" }, { to: "/sap-coverage", label: "SAP coverage" }, { to: "/compliance", label: "Compliance" }] },
  { title: "Resources", items: [{ to: "/docs", label: "Documentation" }, { to: "/login", label: "Sign in" }, { to: "/signup", label: "Create account" }] },
  { title: "Company", items: [{ to: "/demo", label: "Contact us" }, { to: "/demo", label: "Book a review" }] },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-elev">
      <div className="h-[3px] w-full bg-gradient-to-r from-brand-red via-brand-red/40 to-transparent" aria-hidden />
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:px-9">
        <div>
          <LogoLink />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">Static supply-chain analysis for SAP npm builds. Scan before you build, quarantine what looks wrong, and keep signed evidence for every release.</p>
        </div>
        {footCols.map((c) => (
          <div key={c.title}>
            <h3 className="mb-4 text-2xs font-bold tracking-[0.16em] text-ink uppercase">{c.title}</h3>
            <ul className="space-y-2.5 text-sm">
              {c.items.map((l) => (
                <li key={l.label}><Link to={l.to} className="text-muted transition hover:text-ink">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-5 text-xs text-dim lg:px-9">
          <span>© 2026 BuildBouncer</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" aria-hidden />Hosted on Microsoft Azure</span>
          <span className={cn("lg:ml-auto")}>Evidence supports your audits; it is not a certification.</span>
        </div>
      </div>
    </footer>
  );
}
