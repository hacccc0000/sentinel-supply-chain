import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/scans")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticate, actorOf, json, fail } = await import("@/lib/server/rest.server");
        const { getSql } = await import("@/lib/db");
        const { enqueueBuild, startPlatform } = await import("@/lib/server/runner.server");
        const { audit } = await import("@/lib/server/audit.server");
        const { publicUrl } = await import("@/lib/server/notify.server");
        const who = await authenticate(request, "builds.run");
        if (who instanceof Response) return who;
        let body: { project?: string; repo?: string; branch?: string; commit?: string; package_json?: string | object; package_lock?: string | object };
        try {
          body = await request.json();
        } catch {
          return fail(400, "Body must be JSON");
        }
        await startPlatform();
        const sql = await getSql();
        let projectId: string | undefined;
        if (body.project) {
          projectId = (await sql<{ id: string }>`select id from projects where id = ${body.project} or lower(name) = lower(${body.project}) or lower(repo) = lower(${body.project}) limit 1`)[0]?.id;
        } else if (body.repo) {
          projectId = (await sql<{ id: string }>`select id from projects where lower(repo) = lower(${body.repo}) limit 1`)[0]?.id;
          if (!projectId) {
            const name = body.repo.split("/").pop() ?? body.repo;
            projectId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
            await sql`insert into projects (id, name, type, repo, branch, policy, owner, created_by) values (${projectId}, ${name}, 'SAP CAP', ${body.repo}, ${body.branch ?? "main"}, 'Strict Prod SAP CAP', 'ci', ${actorOf(who)}) on conflict (id) do nothing`;
          }
        }
        if (!projectId) return fail(404, "Unknown project. Pass `project` (id/name/repo) or `repo` (owner/name).");
        const asText = (v: unknown) => (v === undefined ? undefined : typeof v === "string" ? v : JSON.stringify(v));
        const r = await enqueueBuild({ projectId, trigger: "ci", requestedBy: actorOf(who), branch: body.branch, commit: body.commit?.slice(0, 12), manifest: asText(body.package_json), lockfile: asText(body.package_lock) });
        if ("error" in r) return fail(409, r.error);
        await audit(sql, actorOf(who), "build.dispatch", r.id, "via CI API");
        return json({ id: r.id, status: "running", url: `${publicUrl()}/dashboard/builds/${r.id}`, poll: `${publicUrl()}/api/v1/builds/${r.id}?wait=60` }, 202);
      },
    },
  },
});
