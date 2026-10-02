import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/builds/$id/$artifact")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticate, download, fail, actorOf } = await import("@/lib/server/rest.server");
        const { getSql } = await import("@/lib/db");
        const { buildEvidenceZip } = await import("@/lib/server/evidence.server");
        const { audit } = await import("@/lib/server/audit.server");
        const who = await authenticate(request, "evidence.export");
        if (who instanceof Response) return who;
        const sql = await getSql();
        const a = params.artifact;
        if (a === "evidence.zip") {
          const z = await buildEvidenceZip(params.id, actorOf(who));
          if (!z) return fail(404, "Build not found");
          await audit(sql, who.kind === "user" ? who.user : actorOf(who), "evidence.download", params.id, "evidence packet");
          return download(z.data, z.name, "application/zip");
        }
        if (a === "sbom.cdx.json") {
          const r = (await sql<{ doc: unknown }>`select d.doc from sbom_docs d join sboms s on s.id = d.id where s.build = ${params.id} order by s.created_at desc limit 1`)[0];
          if (!r) return fail(404, "No SBOM document stored for this build (sample record or build did not complete)");
          return download(JSON.stringify(r.doc, null, 2), `sbom-${params.id}.cdx.json`, "application/vnd.cyclonedx+json");
        }
        if (a === "provenance.json") {
          const r = (await sql<{ forensic: { provenance?: unknown } | null }>`select forensic from builds where id = ${params.id}`)[0];
          if (!r?.forensic?.provenance) return fail(404, "No provenance for this build");
          return download(JSON.stringify(r.forensic.provenance, null, 2), `provenance-${params.id}.intoto.json`, "application/json");
        }
        return fail(404, "Unknown artifact");
      },
    },
  },
});
