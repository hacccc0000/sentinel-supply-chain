import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/builds/$id/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticate, json, fail } = await import("@/lib/server/rest.server");
        const { getSql } = await import("@/lib/db");
        const { publicUrl } = await import("@/lib/server/notify.server");
        const who = await authenticate(request);
        if (who instanceof Response) return who;
        const sql = await getSql();
        const wait = Math.min(Number(new URL(request.url).searchParams.get("wait") ?? 0) || 0, 120);
        const deadline = Date.now() + wait * 1000;
        for (;;) {
          const b = (await sql<{ id: string; status: string; project: string; commit: string; findings: number; duration: string; error: string | null; summary: Record<string, unknown> }>`select id, status, project, commit, findings, duration, error, summary from builds where id = ${params.id}`)[0];
          if (!b) return fail(404, "Build not found");
          if (b.status !== "running" || Date.now() >= deadline) {
            const sev = await sql<{ severity: string; c: number }>`select severity, count(*)::int as c from findings where build_id = ${b.id} group by severity`;
            return json({ id: b.id, status: b.status, blocked: b.status === "blocked", project: b.project, commit: b.commit, findings: b.findings, duration: b.duration, error: b.error, severity: Object.fromEntries(sev.map((s) => [s.severity, s.c])), components: b.summary?.components ?? null, url: `${publicUrl()}/dashboard/builds/${b.id}` });
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
      },
    },
  },
});
