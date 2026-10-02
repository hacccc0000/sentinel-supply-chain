import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Mark({ className, stroke = "currentColor" }: { className?: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 64 72" fill="none" className={cn("shrink-0", className)} aria-hidden>
      <path
        d="M32 4.5 56 14.2v22.2c0 13.6-11.2 24-24 28.6C19.2 60.4 8 50 8 36.4V14.2Z"
        stroke={stroke}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M32 22.5 46.5 30.2 32 37.9 17.5 30.2Z" stroke={stroke} strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M17.5 30.2v14.2L32 52.1V37.9Z" stroke={stroke} strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M46.5 30.2v14.2L32 52.1V37.9Z" stroke={stroke} strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M41.2 33.4 46.5 36.2 41.2 44.6Z" fill="#E30613" />
    </svg>
  );
}

export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-[15px]";
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <Mark className={size === "lg" ? "h-8 w-7" : "h-6 w-5"} stroke="var(--bb-navy-deep)" />
      <span className={text}>
        <span className="text-navy-deep">Build</span>
        <span className="text-brand-red">Bouncer</span>
      </span>
    </span>
  );
}

export function LogoLink({ to = "/", size = "md" }: { to?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <Link to={to} className="inline-flex items-center">
      <Wordmark size={size} />
    </Link>
  );
}
