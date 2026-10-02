import { useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Lock, PackageSearch, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/primitives";
import { loginFn, signupFn } from "@/lib/server/api";
import { useSession } from "@/lib/data";
import { errMsg } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ name: "", email: "", password: "", code: "" });
  const first = session?.needsSetup;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      if (mode === "login") await loginFn({ data: { email: f.email, password: f.password } });
      else await signupFn({ data: { name: f.name, email: f.email, password: f.password, code: f.code || undefined } });
      await qc.invalidateQueries();
      toast.success(mode === "login" ? "Welcome back" : "Workspace ready");
      await nav({ to: "/dashboard" });
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#06182c] p-12 text-white lg:flex">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
        <div className="relative rounded-md bg-white px-4 py-3 self-start">
          <img src="/logo-lockup.png" alt="BuildBouncer" className="h-9 w-auto" />
        </div>
        <div className="relative max-w-lg">
          <div className="mb-3 text-2xs font-bold tracking-[0.18em] text-[#ff6b73] uppercase">SAP supply-chain security</div>
          <h2 className="mb-5 text-4xl leading-[1.12] font-light tracking-tight">Stop malicious packages before they reach your SAP landscape.</h2>
          <div className="space-y-3.5 text-[15px] text-white/75">
            {[
              [PackageSearch, "Package firewall with typosquat, maintainer-change and age checks"],
              [Lock, "Install-script analysis — credential reads, exfiltration, obfuscation"],
              [FileSignature, "Signed CycloneDX SBOMs and provenance for every build"],
              [ShieldCheck, "Policy you control: audit, warn or block — with a full audit trail"],
            ].map(([Icon, t], i) => {
              const I = Icon as typeof Lock;
              return (
                <div key={i} className="flex gap-3"><I className="mt-0.5 size-4 shrink-0 text-[#ff6b73]" />{t as string}</div>
              );
            })}
          </div>
        </div>
        <div className="relative text-xs text-white/45">© BuildBouncer · Evidence for your compliance programmes — not a certification.</div>
      </div>
      <div className="flex items-center justify-center bg-paper px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-sm">
          <Link to="/" className="mb-8 block lg:hidden"><img src="/logo-lockup.png" alt="BuildBouncer" className="h-8 w-auto rounded-sm bg-white" /></Link>
          <h1 className="mb-1 text-2xl font-medium tracking-tight">{mode === "login" ? "Sign in to BuildBouncer" : first ? "Create the owner account" : "Create your account"}</h1>
          <p className="mb-6 text-sm text-muted">{mode === "login" ? "Use the account for your security workspace." : first ? "You are the first user — you will be the workspace administrator." : "Join your team's security workspace."}</p>
          <div className="space-y-4">
            {mode === "signup" && <Field label="Full name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} autoComplete="name" placeholder="Priya Sharma" /></Field>}
            <Field label="Work email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="email" placeholder="you@company.com" /></Field>
            <Field label="Password" hint={mode === "signup" ? "At least 10 characters, with letters and numbers." : undefined}>
              <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={mode === "signup" ? 10 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </Field>
            {mode === "signup" && session?.signupCodeRequired && !first && <Field label="Invitation code"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required /></Field>}
          </div>
          {err && <div role="alert" className="mt-4 rounded-sm border border-danger/30 bg-danger/8 px-3 py-2 text-sm text-danger">{err}</div>}
          <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}{mode === "login" ? "Sign in" : "Create account"}
          </Button>
          <p className="mt-5 text-center text-sm text-muted">
            {mode === "login" ? (
              session?.signupOpen !== false ? <>New here? <Link to="/signup" className="font-semibold text-navy underline-offset-4 hover:underline">Create an account</Link></> : "Ask your administrator for access."
            ) : (
              <>Already have an account? <Link to="/login" className="font-semibold text-navy underline-offset-4 hover:underline">Sign in</Link></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
