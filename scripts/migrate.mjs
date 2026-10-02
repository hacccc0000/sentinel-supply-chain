#!/usr/bin/env node
/**
 * Database migrator (node-postgres). Applies pending files from /migrations to
 * DATABASE_URL, each in one transaction, recorded in `_migrations`.
 * Safe to run on every container start: guarded by a Postgres advisory lock so
 * concurrent instances serialise, and it retries while the database is waking up.
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sslFor(url) {
  const m = /[?&]sslmode=([^&]+)/.exec(url);
  const mode = m?.[1] ?? "";
  if (!mode || mode === "disable") return undefined;
  if (mode === "verify-full" || process.env.PGSSL_VERIFY === "true") return { rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

export async function migrate(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    console.log("[migrate] DATABASE_URL not set — skipping (local PGLite migrates itself).");
    return;
  }
  const entries = await readdir(migrationsDir);
  const clean = databaseUrl.replace(/[?&]sslmode=[^&]+/, "").replace(/\?$/, "");
  const pool = new pg.Pool({ connectionString: clean, max: 1, ssl: sslFor(databaseUrl), connectionTimeoutMillis: 15000 });
  let client;
  for (let i = 1; ; i++) {
    try {
      client = await pool.connect();
      break;
    } catch (e) {
      if (i >= 12) throw e;
      console.log(`[migrate] database not ready (${e.code || e.message}); retry ${i}/12`);
      await sleep(5000);
    }
  }
  try {
    await client.query("SELECT pg_advisory_lock(727274)");
    await client.query("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name);
    let count = 0;
    for (const { name } of pendingMigrations(entries, applied)) {
      const text = await readFile(join(migrationsDir, name), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${name}`);
        try { await client.query("ROLLBACK"); } catch { /* connection died */ }
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
  } finally {
    try { await client.query("SELECT pg_advisory_unlock(727274)"); } catch { /* ignore */ }
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate().catch((err) => {
    console.error("[migrate] failed:", err?.message || err);
    for (const k of ["code", "detail", "hint", "position", "where"]) if (err?.[k] != null) console.error(`[migrate]   ${k}: ${err[k]}`);
    process.exit(1);
  });
}
