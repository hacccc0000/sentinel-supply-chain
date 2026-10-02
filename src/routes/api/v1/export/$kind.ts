import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/export/$kind")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticate, download, fail } = await import("@/lib/server/rest.server");
        const { getSql } = await import("@/lib/db");
        const { toCsv } = await import("@/lib/server/evidence.server");
        const { zipSync, strToU8 } = await import("fflate");
        const { audit } = await import("@/lib/server/audit.server");
        const who = await authenticate(request, "evidence.export");
        if (who instanceof Response) return who;
        const sql = await getSql();
        const stamp = new Date().toISOString().slice(0, 10);
        if (who.kind === "user") await audit(sql, who.user, "export", params.kind);
        if (params.kind === "audit.csv") {
          const rows = await sql`select id, to_json(created_at)#>>'{}' as time, actor, action, target, detail, ip from audit_events order by id desc limit 50000`;
          return download(toCsv(rows, ["id", "time", "actor", "action", "target", "detail", "ip"]), `audit-log-${stamp}.csv`, "text/csv; charset=utf-8");
        }
        if (params.kind === "findings.csv") {
          const rows = await sql`select id, build_id, severity, rule, status, project, package, title, description, note, updated_by from findings order by created_at desc`;
          return download(toCsv(rows, ["id", "build_id", "severity", "rule", "status", "project", "package", "title", "description", "note", "updated_by"]), `findings-${stamp}.csv`, "text/csv; charset=utf-8");
        }
        if (params.kind === "quarantine.csv") {
          const rows = await sql`select id, name, version, project, risk, scanner, maintainer, lifecycle, decision, decided_by, reason, note from quarantine_items order by id desc`;
          return download(toCsv(rows, ["id", "name", "version", "project", "risk", "scanner", "maintainer", "lifecycle", "decision", "decided_by", "reason", "note"]), `quarantine-${stamp}.csv`, "text/csv; charset=utf-8");
        }
        if (params.kind === "sboms.zip") {
          const docs = await sql<{ build: string; project: string; doc: unknown }>`select s.build, s.project, d.doc from sbom_docs d join sboms s on s.id = d.id order by s.created_at desc limit 500`;
          if (!docs.length) return fail(404, "No SBOM documents available yet — run a build first");
          const files = Object.fromEntries(docs.map((d) => [`${d.project.replace(/[^\w.-]+/g, "_")}-build-${d.build}.cdx.json`, strToU8(JSON.stringify(d.doc, null, 2))]));
          return download(zipSync(files), `sboms-${stamp}.zip`, "application/zip");
        }
        return fail(404, "Unknown export");
      },
    },
  },
});
