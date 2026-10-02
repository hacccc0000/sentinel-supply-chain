import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/sso/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sso = await import("@/lib/server/sso.server");
        if (!sso.ssoConfigured()) return new Response("SSO is not configured", { status: 404 });
        const r = sso.newAuthRequest();
        const url = await sso.authorizeUrl(r);
        const secure = (request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "")).startsWith("https") ? "; Secure" : "";
        const headers = new Headers({ location: url });
        headers.append("set-cookie", `bb_sso=${r.state}.${r.nonce}.${r.verifier}; Path=/api/auth/sso; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
