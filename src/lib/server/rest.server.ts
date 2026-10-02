import { getSql } from "@/lib/db";
import { getCurrentUser, ROLE_PERMISSIONS, type Permission, type SessionUser } from "./auth.server";
import { sha256 } from "./crypto.server";

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
export const fail = (status: number, message: string) => json({ error: message }, status);

export type Principal = { kind: "token"; name: string } | { kind: "user"; user: SessionUser };

export async function authenticate(request: Request, perm?: Permission): Promise<Principal | Response> {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(bb_[A-Za-z0-9_-]+)$/);
  if (m) {
    const sql = await getSql();
    const r = (await sql<{ id: string; name: string }>`select id, name from api_tokens where token_hash = ${sha256(m[1]!)} and not revoked`)[0];
    if (!r) return fail(401, "Invalid or revoked API token");
    void sql`update api_tokens set last_used_at = now() where id = ${r.id}`.catch(() => undefined);
    return { kind: "token", name: r.name };
  }
  const user = await getCurrentUser();
  if (!user) return fail(401, "Authentication required");
  if (perm && !ROLE_PERMISSIONS[user.role].includes(perm)) return fail(403, "Forbidden");
  return { kind: "user", user };
}
export const actorOf = (p: Principal) => (p.kind === "token" ? `api-token:${p.name}` : p.user.email);

export function download(data: string | Uint8Array, name: string, type: string) {
  return new Response(data as BodyInit, { headers: { "content-type": type, "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" } });
}
