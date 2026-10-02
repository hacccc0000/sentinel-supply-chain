import { getSql } from "@/lib/db";
import { sha256 } from "./crypto.server";

export async function workerFromRequest(request: Request): Promise<{ id: string; name: string } | null> {
  const m = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(bbw_[A-Za-z0-9_-]+)$/);
  if (!m) return null;
  const sql = await getSql();
  const r = await sql<{ id: string; name: string }>`update workers set last_heartbeat_at = now() where token_hash = ${sha256(m[1]!)} returning id, name`;
  return r[0] ?? null;
}
