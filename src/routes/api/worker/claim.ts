import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/worker/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { json, fail } = await import("@/lib/server/rest.server");
        const { workerFromRequest } = await import("@/lib/server/worker-auth.server");
        const { claimJob } = await import("@/lib/server/runner.server");
        const w = await workerFromRequest(request);
        if (!w) return fail(401, "Valid worker token required");
        const job = await claimJob(w.id);
        return json({ ok: true, worker: w.name, job });
      },
    },
  },
});
