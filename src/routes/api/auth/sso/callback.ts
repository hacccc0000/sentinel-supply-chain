import { createFileRoute } from "@tanstack/react-router";

const back = (msg: string) => new Response(null, { status: 302, headers: { location: `/login?sso_error=${encodeURIComponent(msg.slice(0, 160))}` } });

export const Route = createFileRoute("/api/auth/sso/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sso = await import("@/lib/server/sso.server");
        if (!sso.ssoConfigured()) return back("SSO is not configured");
        const url = new URL(request.url);
        const cookie = /(?:^|;\s*)bb_sso=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1];
        const [state, nonce, verifier] = (cookie ?? "").split(".");
        if (url.searchParams.get("error")) return back(url.searchParams.get("error_description") ?? "Sign-in was cancelled");
        if (!cookie || !state || state !== url.searchParams.get("state") || !url.searchParams.get("code")) return back("Sign-in session expired — try again");
        try {
          const who = await sso.exchange(url.searchParams.get("code")!, verifier!, nonce!);
          const { getSql } = await import("@/lib/db");
          const { issueSessionCookie } = await import("@/lib/server/auth.server");
          const { hashPassword, randomToken } = await import("@/lib/server/crypto.server");
          const { audit } = await import("@/lib/server/audit.server");
          const sql = await getSql();
          let u = (await sql<{ id: string; active: boolean }>`select id, active from users where lower(email) = ${who.email}`)[0];
          if (!u) {
            const n = (await sql<{ c: number }>`select count(*)::int as c from users`)[0]!.c;
            const role = n === 0 ? "admin" : ["admin", "operator", "reviewer", "auditor"].includes(process.env.SSO_DEFAULT_ROLE ?? "") ? process.env.SSO_DEFAULT_ROLE! : "reviewer";
            const id = crypto.randomUUID();
            await sql`insert into users (id, email, name, role, password_hash, must_change_password, sso_subject) values (${id}, ${who.email}, ${who.name}, ${role}, ${await hashPassword(`Sso-${randomToken(18)}9`)}, false, ${who.email})`;
            await audit(sql, who.email, "user.sso_provision", who.email, `role=${role}`);
            u = { id, active: true };
          }
          if (!u.active) return back("This account is disabled");
          await sql`update users set last_login_at = now() where id = ${u.id}`;
          await audit(sql, who.email, "auth.sso_login", who.email);
          const headers = new Headers({ location: "/dashboard" });
          headers.append("set-cookie", await issueSessionCookie(u.id, request));
          headers.append("set-cookie", "bb_sso=; Path=/api/auth/sso; Max-Age=0");
          return new Response(null, { status: 302, headers });
        } catch (e) {
          return back((e as Error).message);
        }
      },
    },
  },
});
