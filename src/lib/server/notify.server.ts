import { createHmac } from "node:crypto";
import type { Sql } from "@/lib/db";
import { decryptSecret } from "./crypto.server";

export function publicUrl(): string {
  return (process.env.PUBLIC_URL || (process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : "http://localhost:8080")).replace(/\/$/, "");
}

export async function integrationSecret(sql: Sql, id: string): Promise<string | undefined> {
  const r = (await sql<{ secret_enc: string | null }>`select secret_enc from integrations where id = ${id}`)[0];
  if (!r?.secret_enc) return undefined;
  try {
    return await decryptSecret(r.secret_enc);
  } catch {
    return undefined;
  }
}

export type Notice = { title: string; body: string; link?: string; severity?: "info" | "warn" | "critical" | "success" };

export async function postWebhook(kind: "slack" | "teams" | "webhook", url: string, n: Notice, secret?: string): Promise<{ ok: boolean; status: number; detail: string }> {
  const link = n.link ? `${publicUrl()}${n.link}` : undefined;
  let body: unknown;
  if (kind === "slack") body = { text: `*${n.title}*\n${n.body}${link ? `\n<${link}|Open in BuildBouncer>` : ""}` };
  else if (kind === "teams") body = { "@type": "MessageCard", "@context": "https://schema.org/extensions", summary: n.title, title: n.title, text: `${n.body}${link ? `\n\n[Open in BuildBouncer](${link})` : ""}` };
  else body = { event: "buildbouncer.notification", title: n.title, body: n.body, severity: n.severity ?? "info", url: link, at: new Date().toISOString() };
  const text = JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (kind === "webhook" && secret) headers["x-buildbouncer-signature"] = `sha256=${createHmac("sha256", secret).update(text).digest("hex")}`;
  try {
    const res = await fetch(url, { method: "POST", headers, body: text, signal: AbortSignal.timeout(10_000) });
    return { ok: res.ok, status: res.status, detail: res.ok ? "delivered" : (await res.text()).slice(0, 160) };
  } catch (e) {
    return { ok: false, status: 0, detail: (e as Error).message };
  }
}

/** In-app notification + fan-out to every connected outbound integration. */
export async function notifyTeam(sql: Sql, n: Notice): Promise<{ delivered: string[] }> {
  await sql`insert into notifications (kind, title, body, link, severity) values ('event', ${n.title}, ${n.body}, ${n.link ?? null}, ${n.severity ?? "info"})`;
  const delivered: string[] = [];
  const t = (await sql<{ notify_slack: boolean }>`select notify_slack from tenant_settings where id = 'default'`)[0];
  const rows = await sql<{ id: string; config: { url?: string } }>`select id, config from integrations where connected = true and id in ('slack','teams','webhook')`;
  for (const r of rows) {
    if (r.id === "slack" && t && !t.notify_slack) continue;
    const url = await integrationSecret(sql, r.id);
    if (!url) continue;
    const res = await postWebhook(r.id as "slack", url, n);
    if (res.ok) delivered.push(r.id);
  }
  return { delivered };
}
