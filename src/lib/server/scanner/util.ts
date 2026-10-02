export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active -= 1;
    queue.shift()?.();
  };
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((r) => queue.push(r));
    active += 1;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

export class HostLedger {
  private m = new Map<string, number>();
  hit(url: string) {
    try {
      const u = new URL(url);
      const k = `${u.hostname}:${u.port || (u.protocol === "https:" ? 443 : 80)}`;
      this.m.set(k, (this.m.get(k) ?? 0) + 1);
    } catch {
      /* ignore */
    }
  }
  list() {
    return [...this.m.entries()].map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count);
  }
}

/** fetch with timeout + retry; records the destination host. */
export function makeFetcher(ledger: HostLedger, base: Fetcher = (u, i) => fetch(u, i), timeoutMs = 20_000): Fetcher {
  return async (url, init = {}) => {
    ledger.hit(url);
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await base(url, {
          ...init,
          signal: ctl.signal,
          headers: { "user-agent": "BuildBouncer-Scanner/1.0 (+https://buildbouncer.io)", ...(init.headers as Record<string, string> | undefined) },
        });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        return res;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("network error");
  };
}

export function levenshtein(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = tmp;
    }
  }
  return prev[b.length]!;
}

/** Glob match supporting `*` (e.g. `@sap/*`). */
export function globMatch(pattern: string, value: string): boolean {
  const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "i");
  return re.test(value);
}

const REDACTIONS: RegExp[] = [
  /npm_[A-Za-z0-9]{36}/g,
  /gh[pousr]_[A-Za-z0-9]{36,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /(\/\/[^\s:]+\/:_authToken=)[^\s'"]+/g,
  /(Bearer\s+)[A-Za-z0-9._-]{16,}/g,
  /(password|secret|token|apikey|api_key)(["']?\s*[:=]\s*["'])[^"'\s]{6,}/gi,
];
/** SEC-03: strip secret-shaped strings before anything is persisted. */
export function redact(text: string): string {
  let out = text;
  for (const re of REDACTIONS) out = out.replace(re, (m, g1, g2) => (g1 ? `${g1}${g2 ?? ""}[REDACTED]` : "[REDACTED]"));
  return out;
}

export const SAP_SCOPES = ["@sap/", "@sap-cloud-sdk/", "@cap-js/", "@sapui5/", "@openui5/", "@ui5/", "@sap-ux/"];
export const isSapScoped = (name: string) => SAP_SCOPES.some((s) => name.startsWith(s));

export function purl(name: string, version: string): string {
  const enc = name.startsWith("@") ? `%40${name.slice(1)}` : name;
  return `pkg:npm/${enc}@${version}`;
}

export const POPULAR = [
  "express","lodash","react","react-dom","axios","moment","chalk","commander","debug","async","request","bluebird","underscore","uuid","body-parser","cors","dotenv","jsonwebtoken","mongoose","mysql","pg","redis","socket.io","webpack","babel-core","typescript","eslint","prettier","jest","mocha","chai","sinon","passport","passport-saml","helmet","morgan","winston","pino","bcrypt","bcryptjs","cookie-parser","cross-env","nodemon","rimraf","mkdirp","glob","minimist","yargs","semver","tslib","rxjs","vue","angular","jquery","bootstrap","next","nuxt","puppeteer","cheerio","node-fetch","got","superagent","ws","xml2js","fast-xml-parser","sax","ioredis","knex","sequelize","typeorm","prisma","graphql","apollo-server","swagger-ui-express","multer","compression","dayjs","date-fns","ramda","immutable","zod","joi","ajv","yaml","js-yaml","fs-extra","execa","ora","inquirer","colors","core-js","regenerator-runtime","@sap/cds","@sap/cds-dk","@sap/xssec","@sap/xsenv","@sap/hdi","@sap/hana-client","@sap/audit-logging","@sap/approuter","@sap-cloud-sdk/http-client","@sap-cloud-sdk/connectivity","@sap-cloud-sdk/odata-v4","@cap-js/sqlite","@cap-js/hana","@cap-js/postgres","@sap/ux-ui5-tooling","@ui5/cli","@ui5/fs",
];
