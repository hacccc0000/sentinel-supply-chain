import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          await sql`select 1`;
          return new Response(JSON.stringify({ status: "ok", db: "up", time: new Date().toISOString() }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
        } catch (e) {
          return new Response(JSON.stringify({ status: "degraded", db: "down", error: (e as Error).message }), { status: 503, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
