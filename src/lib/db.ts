import { pendingMigrations } from "../../scripts/migration-plan.mjs";

/**
 * Server-only SQL access.
 *  - Production / Azure: node-postgres against DATABASE_URL (Azure Database for PostgreSQL).
 *  - Local dev without DATABASE_URL: embedded PGLite (never allowed when NODE_ENV=production).
 * Schema comes from /migrations/*.sql (applied at container start by scripts/migrate.mjs,
 * and automatically on PGLite).
 */
export type DbSource = "postgres" | "pglite";

const rawUrl = typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
const databaseUrl = rawUrl && rawUrl.trim() ? rawUrl.trim() : undefined;
export const dbSource: DbSource = databaseUrl ? "postgres" : "pglite";

export interface Sql {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Run `fn` inside a transaction (BEGIN/COMMIT, ROLLBACK on throw). */
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
}

const g = globalThis as typeof globalThis & {
  __bbSql?: Promise<Sql>;
  __bbPglite?: Promise<import("@electric-sql/pglite").PGlite>;
  __bbPool?: import("pg").Pool;
};

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_NUMERIC = 1700;
const identity = (v: string) => v;

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;

function toSql(run: Run, transaction: Sql["transaction"]): Sql {
  const sql = (async <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] as string;
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) => run<T>(text, params);
  sql.transaction = transaction;
  return sql;
}

/** Azure PG requires TLS. `sslmode=require` => encrypted; `verify-full`/PGSSL_VERIFY=true => verified. */
function poolConfig(url: string) {
  const u = new URL(url);
  const mode = u.searchParams.get("sslmode");
  u.searchParams.delete("sslmode");
  let ssl: false | { rejectUnauthorized: boolean } = false;
  if (mode && mode !== "disable") {
    const verify = mode === "verify-full" || mode === "verify-ca" || process.env.PGSSL_VERIFY === "true";
    ssl = { rejectUnauthorized: verify };
  }
  return {
    connectionString: u.toString(),
    ssl,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
  };
}

function createPgSql(): Promise<Sql> {
  g.__bbSql ??= (async () => {
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_NUMERIC, Number);
    const pool = new Pool(poolConfig(databaseUrl as string));
    pool.on("error", (e) => console.error("[db] idle client error", e.message));
    g.__bbPool = pool;
    const make = (q: { query: (t: string, p: unknown[]) => Promise<{ rows: unknown[] }> }, inTx: boolean): Sql => {
      const tx: Sql["transaction"] = async (fn) => {
        if (inTx) return fn(make(q, true));
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const out = await fn(make(client as never, true));
          await client.query("COMMIT");
          return out;
        } catch (e) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw e;
        } finally {
          client.release();
        }
      };
      return toSql(async <T>(text: string, params: unknown[]) => (await q.query(text, params)).rows as T[], tx);
    };
    return make(pool as never, false);
  })().catch((e) => {
    g.__bbSql = undefined;
    throw e;
  });
  return g.__bbSql;
}

async function createPgliteSql(): Promise<Sql> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_EMBEDDED_DB !== "1") {
    throw new Error("DATABASE_URL is not set. Refusing to start on the embedded dev database in production.");
  }
  g.__bbPglite ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.PGLITE_DIR; // optional persistence for local dev
    const pg = new PGlite(dir || undefined, {
      parsers: { [OID_INT8]: Number, [OID_DATE]: identity, [OID_NUMERIC]: Number },
    });
    await pg.waitReady;
    await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
    const migrations = import.meta.glob("/migrations/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const done = (await pg.query<{ name: string }>("select name from _migrations")).rows.map((r) => r.name);
    for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
      await pg.transaction(async (tx) => {
        await tx.exec(migrations[path] as string);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }
    return pg;
  })().catch((e) => {
    g.__bbPglite = undefined;
    throw e;
  });
  const pg = await g.__bbPglite;
  const make = (q: { query: <T>(t: string, p?: unknown[]) => Promise<{ rows: T[] }> }, inTx: boolean): Sql =>
    toSql(
      async <T>(text: string, params: unknown[]) => (await q.query<T>(text, params)).rows,
      async (fn) => {
        if (inTx) return fn(make(q, true));
        return pg.transaction(async (t) => fn(make(t as never, true)));
      },
    );
  return make(pg as never, false);
}

/** Shared SQL client. Memoised; failed init is retried on the next call. */
export function getSql(): Promise<Sql> {
  if (typeof window !== "undefined") throw new Error("@/lib/db is server-only");
  g.__bbSql ??= (dbSource === "postgres" ? createPgSql() : createPgliteSql()).catch((e) => {
    g.__bbSql = undefined;
    throw e;
  });
  return g.__bbSql;
}

export async function closeDb(): Promise<void> {
  await g.__bbPool?.end().catch(() => undefined);
}
