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

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-elev py-10">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-5 text-xs text-dim lg:px-9">
        <LogoLink size="sm" />
        <span>© 2026 BuildBouncer</span>
        <span>Static supply-chain analysis for SAP npm builds.</span>
        <span className={cn("ml-auto")}>Evidence supports your audits; it is not a certification.</span>
      </div>
    </footer>
  );
}
