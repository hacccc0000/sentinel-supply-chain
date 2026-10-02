import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/worker/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { json, fail } = await import("@/lib/server/rest.server");
        const { getSql } = await import("@/lib/db");
        const { sha256 } = await import("@/lib/server/crypto.server");
        const m = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(bbw_[A-Za-z0-9_-]+)$/);
        if (!m) return fail(401, "Worker token required");
        const sql = await getSql();
        let body: { version?: string; queue?: number; meta?: Record<string, unknown> } = {};
        try {
          body = await request.json();
        } catch {
          /* empty body is fine */
        }
        const r = await sql<{ id: string; name: string }>`update workers set last_heartbeat_at = now(), version = ${String(body.version ?? "1.0.0").slice(0, 20)}, queue = ${Math.max(0, Math.min(Number(body.queue) || 0, 10000))}, meta = ${JSON.stringify(body.meta ?? {})}::jsonb where token_hash = ${sha256(m[1]!)} returning id, name`;
        if (!r[0]) return fail(401, "Unknown worker token");
        return json({ ok: true, worker: r[0].name, intervalSeconds: 15 });
      },
    },
  },
});
