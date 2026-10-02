import { createHash, createPublicKey, createVerify, randomBytes } from "node:crypto";

export const ssoConfigured = () => !!(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET);
const issuer = () => process.env.OIDC_ISSUER!.replace(/\/$/, "");

type Disco = { authorization_endpoint: string; token_endpoint: string; jwks_uri: string; issuer: string };
let disco: { d: Disco; at: number } | null = null;
export async function discovery(): Promise<Disco> {
  if (disco && Date.now() - disco.at < 3_600_000) return disco.d;
  const res = await fetch(`${issuer()}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed (HTTP ${res.status})`);
  const d = (await res.json()) as Disco;
  disco = { d, at: Date.now() };
  return d;
}

export const redirectUri = () => `${(process.env.PUBLIC_URL || (process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : "http://localhost:8080")).replace(/\/$/, "")}/api/auth/sso/callback`;
const b64u = (b: Buffer) => b.toString("base64url");

export function newAuthRequest() {
  const state = b64u(randomBytes(16));
  const nonce = b64u(randomBytes(16));
  const verifier = b64u(randomBytes(32));
  const challenge = b64u(createHash("sha256").update(verifier).digest());
  return { state, nonce, verifier, challenge };
}

export async function authorizeUrl(r: ReturnType<typeof newAuthRequest>): Promise<string> {
  const d = await discovery();
  const u = new URL(d.authorization_endpoint);
  u.search = new URLSearchParams({ client_id: process.env.OIDC_CLIENT_ID!, response_type: "code", redirect_uri: redirectUri(), scope: "openid profile email", state: r.state, nonce: r.nonce, code_challenge: r.challenge, code_challenge_method: "S256", response_mode: "query" }).toString();
  return u.toString();
}

export async function exchange(code: string, verifier: string, nonce: string): Promise<{ email: string; name: string }> {
  const d = await discovery();
  const res = await fetch(d.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), client_id: process.env.OIDC_CLIENT_ID!, client_secret: process.env.OIDC_CLIENT_SECRET!, code_verifier: verifier }) });
  if (!res.ok) throw new Error(`Token exchange failed (HTTP ${res.status})`);
  const tok = (await res.json()) as { id_token?: string };
  if (!tok.id_token) throw new Error("No id_token returned");
  const [h, p, sig] = tok.id_token.split(".");
  if (!h || !p || !sig) throw new Error("Malformed id_token");
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const claims = JSON.parse(Buffer.from(p, "base64url").toString()) as Record<string, any>;
  const jwks = (await (await fetch(d.jwks_uri)).json()) as { keys: Array<Record<string, any>> };
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk || header.alg !== "RS256") throw new Error("Unsupported or unknown signing key");
  const ok = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(createPublicKey({ key: jwk as never, format: "jwk" }), Buffer.from(sig, "base64url"));
  if (!ok) throw new Error("id_token signature invalid");
  const iss = String(claims.iss ?? "");
  const expectedIss = d.issuer.includes("{tenantid}") ? d.issuer.replace("{tenantid}", String(claims.tid ?? "")) : d.issuer;
  if (iss !== expectedIss) throw new Error("id_token issuer mismatch");
  if (claims.aud !== process.env.OIDC_CLIENT_ID) throw new Error("id_token audience mismatch");
  if (Number(claims.exp) * 1000 < Date.now()) throw new Error("id_token expired");
  if (claims.nonce !== nonce) throw new Error("nonce mismatch");
  const email = String(claims.email || claims.preferred_username || "").toLowerCase();
  if (!email.includes("@")) throw new Error("The identity provider did not return an email address");
  const allowed = (process.env.OIDC_ALLOWED_DOMAINS ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(email.split("@")[1]!)) throw new Error("Your email domain is not allowed for this workspace");
  return { email, name: String(claims.name || email.split("@")[0]) };
}
