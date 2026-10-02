import { deleteCookie, getCookie, getRequestHeader, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { hashPassword, randomToken, sha256, verifyPassword } from "./crypto.server";

export type Role = "admin" | "operator" | "reviewer" | "auditor";
export type Permission =
  | "builds.run" | "projects.manage" | "workers.manage" | "quarantine.decide" | "findings.update"
  | "policy.edit" | "allowlist.edit" | "integrations.manage" | "settings.manage" | "users.manage"
  | "tokens.manage" | "evidence.export";

const ALL: Permission[] = ["builds.run", "projects.manage", "workers.manage", "quarantine.decide", "findings.update", "policy.edit", "allowlist.edit", "integrations.manage", "settings.manage", "users.manage", "tokens.manage", "evidence.export"];
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL,
  operator: ["builds.run", "projects.manage", "workers.manage", "findings.update", "evidence.export"],
  reviewer: ["builds.run", "quarantine.decide", "findings.update", "allowlist.edit", "evidence.export"],
  auditor: ["evidence.export"],
};

export type SessionUser = { id: string; email: string; name: string; role: Role; mustChangePassword: boolean };

const COOKIE = "bb_session";
const TTL_MS = 7 * 24 * 3600 * 1000;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function secureCookie(): boolean {
  const proto = getRequestHeader("x-forwarded-proto");
  return proto ? proto.split(",")[0]!.trim() === "https" : process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
}

export async function createSession(userId: string): Promise<void> {
  const sql = await getSql();
  const token = randomToken(32);
  const expires = new Date(Date.now() + TTL_MS);
  await sql`insert into sessions (id, user_id, expires_at, ip, user_agent) values (${sha256(token)}, ${userId}, ${expires.toISOString()}, ${clientIp()}, ${(getRequestHeader("user-agent") ?? "").slice(0, 200)})`;
  setCookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secureCookie(), path: "/", maxAge: TTL_MS / 1000 });
  await sql`delete from sessions where expires_at < now()`;
}

export async function destroySession(): Promise<void> {
  const token = getCookie(COOKIE);
  if (token) {
    const sql = await getSql();
    await sql`delete from sessions where id = ${sha256(token)}`;
  }
  deleteCookie(COOKIE, { path: "/" });
}

export function clientIp(): string {
  const fwd = getRequestHeader("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  try {
    return getRequestIP() ?? "";
  } catch {
    return "";
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;
  const sql = await getSql();
  const rows = await sql<{ id: string; email: string; name: string; role: Role; must_change_password: boolean }>`
    select u.id, u.email, u.name, u.role, u.must_change_password
    from sessions s join users u on u.id = s.user_id
    where s.id = ${sha256(token)} and s.expires_at > now() and u.active`;
  const r = rows[0];
  return r ? { id: r.id, email: r.email, name: r.name, role: r.role, mustChangePassword: r.must_change_password } : null;
}

export async function requireUser(perm?: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Not signed in");
  if (perm && !ROLE_PERMISSIONS[user.role].includes(perm)) throw new HttpError(403, `Your role (${user.role}) cannot perform this action`);
  return user;
}

/* ---- login throttling (per process) ---- */
const attempts = new Map<string, { n: number; first: number }>();
function throttle(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (a && now - a.first > 15 * 60_000) attempts.delete(key);
  const cur = attempts.get(key);
  if (cur && cur.n >= 8) throw new HttpError(429, "Too many attempts. Try again in a few minutes.");
}
function fail(key: string) {
  const cur = attempts.get(key);
  attempts.set(key, cur ? { n: cur.n + 1, first: cur.first } : { n: 1, first: Date.now() });
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const key = `${clientIp()}|${email.toLowerCase()}`;
  throttle(key);
  const sql = await getSql();
  const rows = await sql<{ id: string; password_hash: string; active: boolean }>`select id, password_hash, active from users where lower(email) = ${email.toLowerCase()}`;
  const u = rows[0];
  const ok = u ? await verifyPassword(password, u.password_hash) : await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  if (!u || !ok || !u.active) {
    fail(key);
    throw new HttpError(401, "Invalid email or password");
  }
  attempts.delete(key);
  await sql`update users set last_login_at = now() where id = ${u.id}`;
  await createSession(u.id);
  const user = await getCurrentUserById(u.id);
  return user;
}

async function getCurrentUserById(id: string): Promise<SessionUser> {
  const sql = await getSql();
  const r = (await sql<{ id: string; email: string; name: string; role: Role; must_change_password: boolean }>`select id, email, name, role, must_change_password from users where id = ${id}`)[0]!;
  return { id: r.id, email: r.email, name: r.name, role: r.role, mustChangePassword: r.must_change_password };
}

export function validatePassword(pw: string) {
  if (pw.length < 10) throw new HttpError(400, "Password must be at least 10 characters");
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw new HttpError(400, "Password must contain letters and numbers");
}

export async function createUser(input: { email: string; name: string; role: Role; password: string; mustChange?: boolean }): Promise<string> {
  validatePassword(input.password);
  const sql = await getSql();
  const exists = await sql`select 1 from users where lower(email) = ${input.email.toLowerCase()}`;
  if (exists.length) throw new HttpError(409, "An account with this email already exists");
  const id = crypto.randomUUID();
  await sql`insert into users (id, email, name, role, password_hash, must_change_password) values (${id}, ${input.email.trim()}, ${input.name.trim()}, ${input.role}, ${await hashPassword(input.password)}, ${input.mustChange ?? false})`;
  return id;
}

/** First-run bootstrap: ADMIN_EMAIL + ADMIN_PASSWORD env creates the owner account if no users exist. */
let bootstrapped = false;
export async function bootstrapAdmin(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const sql = await getSql();
  const n = (await sql<{ c: number }>`select count(*)::int as c from users`)[0]!.c;
  if (n > 0) return;
  try {
    await createUser({ email, name: process.env.ADMIN_NAME?.trim() || "Security Admin", role: "admin", password });
    await sql`insert into audit_events (actor, action, target, detail) values ('system', 'user.bootstrap', ${email}, 'owner account created from environment')`;
    console.log(`[auth] owner account created for ${email}`);
  } catch (e) {
    console.error("[auth] ADMIN bootstrap failed:", (e as Error).message);
  }
}


/** Create a session without request-scoped helpers (used by SSO callback); returns the Set-Cookie value. */
export async function issueSessionCookie(userId: string, req: Request): Promise<string> {
  const sql = await getSql();
  const token = randomToken(32);
  const expires = new Date(Date.now() + TTL_MS);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim();
  await sql`insert into sessions (id, user_id, expires_at, ip, user_agent) values (${sha256(token)}, ${userId}, ${expires.toISOString()}, ${ip}, ${(req.headers.get("user-agent") ?? "").slice(0, 200)})`;
  const proto = (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")).split(",")[0]!.trim();
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_MS / 1000}${proto === "https" ? "; Secure" : ""}`;
}
