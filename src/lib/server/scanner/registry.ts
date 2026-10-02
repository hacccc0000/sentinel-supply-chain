import semver from "semver";
import { createLimiter, isSapScoped, type Fetcher } from "./util";

export type Component = {
  name: string;
  version: string;
  direct: boolean;
  dev: boolean;
  hasInstallScript: boolean;
  deprecated?: string;
  license?: string;
  integrity?: string;
  resolved?: string;
  sap: boolean;
  // tier 2
  publishedAt?: string;
  createdAt?: string;
  maintainers?: string[];
  newMaintainers?: string[];
  scripts?: Record<string, string>;
  tarball?: string;
  repository?: string;
  detailed?: boolean;
};

export type Manifest = {
  packageJson: { name?: string; version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; optionalDependencies?: Record<string, string>; scripts?: Record<string, string> };
  lockfile?: { lockfileVersion?: number; packages?: Record<string, LockPkg>; dependencies?: Record<string, LockV1> };
  commit: string;
  source: string;
};
type LockPkg = { version?: string; dev?: boolean; optional?: boolean; hasInstallScript?: boolean; deprecated?: string; license?: string | { type: string }; integrity?: string; resolved?: string; link?: boolean; dependencies?: Record<string, string> };
type LockV1 = { version: string; dev?: boolean; integrity?: string; resolved?: string; requires?: Record<string, string>; dependencies?: Record<string, LockV1> };

export const REGISTRY = "https://registry.npmjs.org";
const enc = (name: string) => encodeURIComponent(name).replace(/^%40/, "@");

export function parseRepo(repo: string): { owner: string; name: string } | null {
  const m = repo.trim().replace(/\.git$/, "").match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+)\/?$/);
  return m ? { owner: m[1]!, name: m[2]! } : null;
}

export async function loadManifest(
  project: { repo: string; branch: string; manifest: string | null; lockfile: string | null },
  fetcher: Fetcher,
  githubToken?: string,
): Promise<Manifest> {
  if (project.manifest?.trim()) {
    let pj;
    try {
      pj = JSON.parse(project.manifest);
    } catch {
      throw new Error("The pasted package.json is not valid JSON");
    }
    let lock;
    if (project.lockfile?.trim()) {
      try {
        lock = JSON.parse(project.lockfile);
      } catch {
        throw new Error("The pasted package-lock.json is not valid JSON");
      }
    }
    return { packageJson: pj, lockfile: lock, commit: "manual", source: "pasted manifest" };
  }
  const r = parseRepo(project.repo);
  if (!r) throw new Error(`"${project.repo}" is not a GitHub repository (expected owner/name)`);
  const headers: Record<string, string> = githubToken ? { authorization: `Bearer ${githubToken}`, "x-github-api-version": "2022-11-28" } : {};
  const get = async (path: string): Promise<string | null> => {
    const url = githubToken
      ? `https://api.github.com/repos/${r.owner}/${r.name}/contents/${path}?ref=${encodeURIComponent(project.branch)}`
      : `https://raw.githubusercontent.com/${r.owner}/${r.name}/${encodeURIComponent(project.branch)}/${path}`;
    const res = await fetcher(url, { headers: githubToken ? { ...headers, accept: "application/vnd.github.raw+json" } : {} });
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) throw new Error(`GitHub denied access to ${r.owner}/${r.name} (HTTP ${res.status}). For private repositories add a GitHub token under Integrations.`);
    if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status} for ${path}`);
    return res.text();
  };
  const pjText = await get("package.json");
  if (!pjText) throw new Error(`No package.json found at the root of ${r.owner}/${r.name}@${project.branch}. Check the repo/branch, or paste a manifest in the project settings.`);
  let pj;
  try {
    pj = JSON.parse(pjText);
  } catch {
    throw new Error("package.json in the repository is not valid JSON");
  }
  let lock;
  const lockText = await get("package-lock.json").catch(() => null);
  if (lockText) {
    try {
      lock = JSON.parse(lockText);
    } catch {
      lock = undefined;
    }
  }
  let commit = "unknown";
  try {
    const res = await fetcher(`https://api.github.com/repos/${r.owner}/${r.name}/commits/${encodeURIComponent(project.branch)}`, { headers: { ...headers, accept: "application/vnd.github.sha" } });
    if (res.ok) commit = (await res.text()).trim().slice(0, 40);
  } catch {
    /* commit lookup is best-effort */
  }
  return { packageJson: pj, lockfile: lock, commit, source: `github:${r.owner}/${r.name}@${project.branch}` };
}

function nameFromLockPath(path: string): string | null {
  const i = path.lastIndexOf("node_modules/");
  return i === -1 ? null : path.slice(i + "node_modules/".length);
}

export function componentsFromLock(m: Manifest): Component[] | null {
  const lock = m.lockfile;
  if (!lock) return null;
  const direct = new Set<string>([
    ...Object.keys(m.packageJson.dependencies ?? {}),
    ...Object.keys(m.packageJson.devDependencies ?? {}),
    ...Object.keys(m.packageJson.optionalDependencies ?? {}),
  ]);
  const out = new Map<string, Component>();
  const add = (c: Component) => out.set(`${c.name}@${c.version}`, c);
  if (lock.packages) {
    for (const [path, p] of Object.entries(lock.packages)) {
      if (!path || p.link || !p.version) continue;
      const name = nameFromLockPath(path);
      if (!name) continue;
      add({
        name, version: p.version, direct: path === `node_modules/${name}` && direct.has(name), dev: !!p.dev,
        hasInstallScript: !!p.hasInstallScript, deprecated: p.deprecated,
        license: typeof p.license === "string" ? p.license : p.license?.type,
        integrity: p.integrity, resolved: p.resolved, sap: isSapScoped(name),
      });
    }
    return [...out.values()];
  }
  if (lock.dependencies) {
    const walk = (deps: Record<string, LockV1>, top: boolean) => {
      for (const [name, d] of Object.entries(deps)) {
        add({ name, version: d.version, direct: top && direct.has(name), dev: !!d.dev, hasInstallScript: false, integrity: d.integrity, resolved: d.resolved, sap: isSapScoped(name) });
        if (d.dependencies) walk(d.dependencies, false);
      }
    };
    walk(lock.dependencies, true);
    return [...out.values()];
  }
  return null;
}

type AbbrevVersion = { version: string; dependencies?: Record<string, string>; optionalDependencies?: Record<string, string>; deprecated?: string; hasInstallScript?: boolean; dist?: { tarball?: string; integrity?: string } };
type Abbrev = { name: string; "dist-tags"?: Record<string, string>; versions: Record<string, AbbrevVersion> };

export class Registry {
  private abbrev = new Map<string, Promise<Abbrev | null>>();
  private full = new Map<string, Promise<any | null>>();
  constructor(private fetcher: Fetcher, private limit = createLimiter(12)) {}

  packument(name: string): Promise<Abbrev | null> {
    let p = this.abbrev.get(name);
    if (!p) {
      p = this.limit(async () => {
        const res = await this.fetcher(`${REGISTRY}/${enc(name)}`, { headers: { accept: "application/vnd.npm.install-v1+json" } });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`npm registry HTTP ${res.status} for ${name}`);
        return (await res.json()) as Abbrev;
      });
      this.abbrev.set(name, p);
    }
    return p;
  }

  fullPackument(name: string): Promise<any | null> {
    let p = this.full.get(name);
    if (!p) {
      p = this.limit(async () => {
        const res = await this.fetcher(`${REGISTRY}/${enc(name)}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`npm registry HTTP ${res.status} for ${name}`);
        return res.json();
      });
      this.full.set(name, p);
    }
    return p;
  }

  /** Resolve the dependency tree from package.json alone (no lockfile) — breadth-first, capped. */
  async resolveTree(pj: Manifest["packageJson"], onProgress?: (n: number) => void, cap = 700): Promise<{ components: Component[]; unresolved: string[] }> {
    const roots: Array<[string, string, boolean]> = [
      ...Object.entries(pj.dependencies ?? {}).map(([n, r]) => [n, r, false] as [string, string, boolean]),
      ...Object.entries(pj.optionalDependencies ?? {}).map(([n, r]) => [n, r, false] as [string, string, boolean]),
      ...Object.entries(pj.devDependencies ?? {}).map(([n, r]) => [n, r, true] as [string, string, boolean]),
    ];
    const found = new Map<string, Component>();
    const unresolved: string[] = [];
    let frontier = roots.map(([name, range, dev]) => ({ name, range, dev, direct: true }));
    const seenReq = new Set<string>();
    for (let depth = 0; depth < 12 && frontier.length && found.size < cap; depth += 1) {
      const next: typeof frontier = [];
      await Promise.all(
        frontier.map(async (req) => {
          const key = `${req.name}@${req.range}`;
          if (seenReq.has(key)) return;
          seenReq.add(key);
          if (/^(file:|link:|git|github:|https?:|workspace:)/.test(req.range) || req.range.startsWith("npm:")) {
            unresolved.push(`${req.name}@${req.range}`);
            return;
          }
          let pack: Abbrev | null;
          try {
            pack = await this.packument(req.name);
          } catch {
            unresolved.push(`${req.name}@${req.range}`);
            return;
          }
          if (!pack) {
            unresolved.push(`${req.name}@${req.range} (not on registry)`);
            return;
          }
          const versions = Object.keys(pack.versions);
          const range = req.range === "latest" || req.range === "*" || req.range === "" ? pack["dist-tags"]?.latest ?? "*" : req.range;
          const v = semver.validRange(range) ? semver.maxSatisfying(versions, range, { includePrerelease: false }) : pack["dist-tags"]?.[range] ?? null;
          if (!v) {
            unresolved.push(`${req.name}@${req.range}`);
            return;
          }
          const k = `${req.name}@${v}`;
          const meta = pack.versions[v]!;
          const existing = found.get(k);
          if (existing) {
            existing.direct = existing.direct || req.direct;
            existing.dev = existing.dev && req.dev;
            return;
          }
          found.set(k, {
            name: req.name, version: v, direct: req.direct, dev: req.dev, hasInstallScript: !!meta.hasInstallScript,
            deprecated: meta.deprecated, integrity: meta.dist?.integrity, resolved: meta.dist?.tarball, sap: isSapScoped(req.name),
          });
          onProgress?.(found.size);
          if (!req.dev || req.direct) {
            for (const [n, r] of Object.entries({ ...(meta.optionalDependencies ?? {}), ...(meta.dependencies ?? {}) })) next.push({ name: n, range: r, dev: req.dev, direct: false });
          }
        }),
      );
      frontier = next;
    }
    return { components: [...found.values()], unresolved };
  }

  /** Tier-2 metadata: maintainers, publish time, scripts, tarball. */
  async enrich(c: Component): Promise<void> {
    const doc = await this.fullPackument(c.name);
    if (!doc) return;
    const v = doc.versions?.[c.version];
    c.publishedAt = doc.time?.[c.version];
    c.createdAt = doc.time?.created;
    c.maintainers = (v?.maintainers ?? doc.maintainers ?? []).map((m: { name: string }) => m.name);
    c.scripts = v?.scripts;
    c.tarball = v?.dist?.tarball ?? c.resolved;
    c.license ??= typeof v?.license === "string" ? v.license : v?.license?.type;
    c.deprecated ??= v?.deprecated;
    c.repository = typeof v?.repository === "string" ? v.repository : v?.repository?.url;
    if (v && (v.scripts?.preinstall || v.scripts?.install || v.scripts?.postinstall)) c.hasInstallScript = true;
    // New-maintainer detection: maintainers of this version not seen on any earlier version.
    const order = Object.keys(doc.versions ?? {}).sort((a, b) => (doc.time?.[a] ?? "").localeCompare(doc.time?.[b] ?? ""));
    const idx = order.indexOf(c.version);
    const prior = new Set<string>();
    for (const pv of order.slice(Math.max(0, idx - 5), idx)) {
      for (const m of doc.versions[pv]?.maintainers ?? []) prior.add(m.name);
      if (doc.versions[pv]?._npmUser?.name) prior.add(doc.versions[pv]._npmUser.name);
    }
    const publisher = v?._npmUser?.name;
    const current = new Set<string>([...(c.maintainers ?? []), ...(publisher ? [publisher] : [])]);
    c.newMaintainers = idx > 0 ? [...current].filter((m) => !prior.has(m)) : [];
    c.detailed = true;
  }
}
