import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSql } from "@/lib/db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const N = 16384, R = 8, P = 1;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const dk = await scrypt(password, salt, 32, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${dk.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const dk = await scrypt(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return dk.length === expected.length && timingSafeEqual(dk, expected);
}

export const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Platform secret: env var wins; otherwise generated once and kept in app_secrets. */
const cache = new Map<string, string>();
export async function platformSecret(name: "session_secret" | "signing_key", envName: string): Promise<string> {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  const hit = cache.get(name);
  if (hit) return hit;
  const sql = await getSql();
  const gen = randomBytes(48).toString("base64url");
  await sql`insert into app_secrets (name, value) values (${name}, ${gen}) on conflict (name) do nothing`;
  const rows = await sql<{ value: string }>`select value from app_secrets where name = ${name}`;
  const v = rows[0]!.value;
  cache.set(name, v);
  return v;
}

async function aesKey(): Promise<Buffer> {
  return createHash("sha256").update(await platformSecret("session_secret", "SESSION_SECRET")).update("bb-secrets-v1").digest();
}

export async function encryptSecret(plain: string): Promise<string> {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", await aesKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}

export async function decryptSecret(blob: string): Promise<string> {
  const [v, iv, tag, data] = blob.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("bad secret blob");
  const d = createDecipheriv("aes-256-gcm", await aesKey(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

/** Canonical JSON (sorted keys) so signatures are stable. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function signingKey(): Promise<{ key: string; keyId: string }> {
  const key = await platformSecret("signing_key", "SIGNING_KEY");
  return { key, keyId: sha256(key).slice(0, 12) };
}

/* ───── Azure Key Vault signing (enabled when AZURE_KEYVAULT_URL + AZURE_KEYVAULT_KEY are set) ───── */
const akvEnabled = () => !!(process.env.AZURE_KEYVAULT_URL && process.env.AZURE_KEYVAULT_KEY);
let akvToken: { v: string; exp: number } | null = null;
async function akvAccessToken(): Promise<string> {
  if (akvToken && akvToken.exp > Date.now() + 60_000) return akvToken.v;
  const ep = process.env.IDENTITY_ENDPOINT;
  const hdr = process.env.IDENTITY_HEADER;
  if (!ep || !hdr) throw new Error("Key Vault signing needs an Azure managed identity (IDENTITY_ENDPOINT not set)");
  const clientId = process.env.AZURE_CLIENT_ID ? `&client_id=${encodeURIComponent(process.env.AZURE_CLIENT_ID)}` : "";
  const res = await fetch(`${ep}?resource=${encodeURIComponent("https://vault.azure.net")}&api-version=2019-08-01${clientId}`, { headers: { "X-IDENTITY-HEADER": hdr } });
  if (!res.ok) throw new Error(`Managed identity token request failed (HTTP ${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_on: string };
  akvToken = { v: j.access_token, exp: Number(j.expires_on) * 1000 };
  return akvToken.v;
}
async function akvCall(op: "sign" | "verify", body: Record<string, string>): Promise<any> {
  const base = process.env.AZURE_KEYVAULT_URL!.replace(/\/$/, "");
  const res = await fetch(`${base}/keys/${process.env.AZURE_KEYVAULT_KEY}/${op}?api-version=7.4`, { method: "POST", headers: { authorization: `Bearer ${await akvAccessToken()}`, "content-type": "application/json" }, body: JSON.stringify({ alg: "RS256", ...body }) });
  if (!res.ok) throw new Error(`Key Vault ${op} failed (HTTP ${res.status})`);
  return res.json();
}
const keyVaultId = () => `akv:${process.env.AZURE_KEYVAULT_URL!.replace(/^https:\/\//, "").split(".")[0]}/${process.env.AZURE_KEYVAULT_KEY}`;

export function signerInfo(): { mode: "azure-key-vault" | "platform-hmac"; label: string } {
  return akvEnabled() ? { mode: "azure-key-vault", label: keyVaultId() } : { mode: "platform-hmac", label: "platform HMAC key" };
}

export async function signDocument(doc: unknown): Promise<{ signature: string; keyId: string; digest: string }> {
  const body = canonical(doc);
  const digest = sha256(body);
  if (akvEnabled()) {
    const r = await akvCall("sign", { value: Buffer.from(digest, "hex").toString("base64url") });
    return { signature: `akv-rs256:${r.value}`, keyId: keyVaultId(), digest };
  }
  const { key, keyId } = await signingKey();
  return { signature: createHmac("sha256", key).update(body).digest("hex"), keyId, digest };
}
export async function verifyDocument(doc: unknown, signature: string): Promise<boolean> {
  if (signature.startsWith("akv-rs256:")) {
    if (!akvEnabled()) return false;
    const r = await akvCall("verify", { digest: Buffer.from(sha256(canonical(doc)), "hex").toString("base64url"), value: signature.slice(10) });
    return r.value === true;
  }
  const { key } = await signingKey();
  const expected = createHmac("sha256", key).update(canonical(doc)).digest();
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
