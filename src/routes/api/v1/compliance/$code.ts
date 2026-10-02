import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/compliance/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticate, download, fail } = await import("@/lib/server/rest.server");
        const { complianceReport } = await import("@/lib/server/evidence.server");
        const { getSql } = await import("@/lib/db");
        const { audit } = await import("@/lib/server/audit.server");
        const who = await authenticate(request, "evidence.export");
        if (who instanceof Response) return who;
        const rep = await complianceReport(params.code.replace(/\.json$/, ""), who.kind === "user" ? who.user.email : "api");
        if (!rep) return fail(404, "Unknown framework");
        if (who.kind === "user") await audit(await getSql(), who.user, "export.compliance", rep.framework);
        return download(JSON.stringify(rep, null, 2), `compliance-${params.code.replace(/\.json$/, "")}.json`, "application/json");
      },
    },
  },
});
