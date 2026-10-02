import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/worker/result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { json, fail } = await import("@/lib/server/rest.server");
        const { workerFromRequest } = await import("@/lib/server/worker-auth.server");
        const { submitResult } = await import("@/lib/server/runner.server");
        const w = await workerFromRequest(request);
        if (!w) return fail(401, "Valid worker token required");
        let body: { buildId?: string; result?: unknown; error?: string; durationMs?: number };
        try {
          body = await request.json();
        } catch {
          return fail(400, "Invalid JSON");
        }
        if (!body.buildId) return fail(400, "buildId required");
        try {
          await submitResult(w.id, String(body.buildId), body as never);
        } catch (e) {
          return fail(409, (e as Error).message);
        }
        return json({ ok: true });
      },
    },
  },
});
