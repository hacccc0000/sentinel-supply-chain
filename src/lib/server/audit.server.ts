import type { Sql } from "@/lib/db";
import type { SessionUser } from "./auth.server";

export async function audit(sql: Sql, actor: SessionUser | string, action: string, target: string, detail = "", ip = ""): Promise<void> {
  const name = typeof actor === "string" ? actor : `${actor.name} <${actor.email}>`;
  const id = typeof actor === "string" ? null : actor.id;
  await sql`insert into audit_events (actor, actor_id, action, target, detail, ip) values (${name}, ${id}, ${action}, ${target.slice(0, 300)}, ${detail.slice(0, 600)}, ${ip})`;
}
