import semver from "semver";
import { analyzeTarball, type ScriptAnalysis } from "./analysis";
import { queryVulns, type VulnResult } from "./osv";
import { Registry, componentsFromLock, loadManifest, type Component, type Manifest } from "./registry";
import { buildSbom, type CompStatus } from "./sbom";
import { HostLedger, createLimiter, globMatch, isSapScoped, levenshtein, makeFetcher, POPULAR, type Fetcher } from "./util";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Mode = "audit" | "warn" | "block";
export type EventKind = "ok" | "warn" | "block" | "info";
export type ScanEvent = { t: number; kind: EventKind; title: string; body: string };

export type PolicyContext = {
  mode: Mode;
  version: string;
  enabled: Set<string>;
  allow: { packages: string[]; egress: string[]; maintainers: string[] };
  deny: { packages: string[]; egress: string[] };
  approvals: Map<string, { scriptHash?: string }>; // "name@version" approved via quarantine
  githubToken?: string;
};

export type FindingOut = { severity: Severity; title: string; rule: string; package?: string; description: string; blocking: boolean };
export type QuarantineOut = { name: string; version: string; risk: number; reason: string; lifecycle: boolean; maintainer: "verified" | "untrusted"; scanner: "blocked" | "warned" | "ok"; age: string; factors: string[]; scripts: Record<string, string> | null; analysis: ScriptAnalysis | null; weeklyDownloads?: number };

export type ScanResult = {
  status: "blocked" | "warned" | "passed";
  commit: string;
  source: string;
  components: Array<Component & { status: CompStatus }>;
  findings: FindingOut[];
  quarantine: QuarantineOut[];
  events: ScanEvent[];
  hosts: Array<{ host: string; count: number; allowed: boolean; note: string }>;
  flaggedHosts: Array<{ host: string; package: string; reason: string; denied: boolean }>;
  forensic: { packages: Array<{ name: string; version: string; risk: number; scripts: Record<string, string>; excerpt: string; indicators: ScriptAnalysis["indicators"]; hosts: string[]; note?: string }> };
  summary: { components: number; direct: number; sap: number; lifecycle: number; vulnerabilities: number; resolution: string; advisoryFeed: "ok" | "unreachable"; unresolved: number };
  sbom: ReturnType<typeof buildSbom>;
};

type Deps = { fetcher?: Fetcher; now?: () => Date; onEvent?: (events: ScanEvent[]) => Promise<void> | void };

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];
const sevRank = (s: Severity) => SEV_ORDER.indexOf(s);
const ageDays = (iso?: string, now = new Date()) => (iso ? (now.getTime() - new Date(iso).getTime()) / 86_400_000 : undefined);
const humanAge = (d?: number) => (d === undefined ? "unknown" : d < 1 ? "<1 day" : d < 60 ? `${Math.floor(d)} days` : d < 730 ? `${Math.floor(d / 30)} mo` : `${(d / 365).toFixed(1)} yr`);
const sapLookalike = (name: string) => /(^|[-_/@.])sap([-_.]|$)/i.test(name) && !isSapScoped(name);

export function hostMatches(pattern: string, hostport: string): boolean {
  const [host] = hostport.split(":");
  return globMatch(pattern, hostport) || globMatch(pattern, host!) || globMatch(pattern.replace(/:\d+$/, ""), host!);
}

export async function runScan(
  project: { name: string; repo: string; branch: string; manifest: string | null; lockfile: string | null },
  policy: PolicyContext,
  buildId: string,
  worker: string,
  deps: Deps = {},
): Promise<ScanResult> {
  const now = deps.now ?? (() => new Date());
  const started = Date.now();
  const events: ScanEvent[] = [];
  const emit = async (kind: EventKind, title: string, body: string) => {
    events.push({ t: Date.now() - started, kind, title, body });
    await deps.onEvent?.(events);
  };
  const ledger = new HostLedger();
  const fetcher = makeFetcher(ledger, deps.fetcher);
  const on = (r: string) => policy.enabled.has(r);
  const findings: FindingOut[] = [];
  const flag = (f: Omit<FindingOut, "blocking">) => {
    const sev = f.severity;
    findings.push({ ...f, blocking: policy.mode === "block" && (sev === "critical" || sev === "high") });
  };

  await emit("ok", "Scanner bootstrap", `Policy bundle v${policy.version} loaded · enforcement=${policy.mode} · ${policy.enabled.size} rules active · analysis=static (package code is never executed).`);

  // 1. source
  const manifest: Manifest = await loadManifest(project, fetcher, policy.githubToken);
  await emit("ok", "Source fetched", `${manifest.source} @ ${manifest.commit.slice(0, 12)} · package.json${manifest.lockfile ? " + package-lock.json" : " (no lockfile)"}.`);

  // 2. resolution
  const registry = new Registry(fetcher);
  let components: Component[];
  let resolution: string;
  let unresolved: string[] = [];
  const fromLock = componentsFromLock(manifest);
  if (fromLock && fromLock.length) {
    components = fromLock;
    resolution = `lockfile v${manifest.lockfile?.lockfileVersion ?? "?"}`;
  } else {
    await emit("info", "Resolving without lockfile", "No usable package-lock.json — resolving the dependency graph from the npm registry (semver ranges → newest matching versions).");
    const res = await registry.resolveTree(manifest.packageJson);
    components = res.components;
    unresolved = res.unresolved;
    resolution = "registry resolution";
  }
  if (!components.length) throw new Error("No dependencies found in package.json — nothing to scan.");
  const sapCount = components.filter((c) => c.sap).length;
  await emit("ok", "Dependency resolution", `${components.length} components resolved (${components.filter((c) => c.direct).length} direct, ${sapCount} in SAP scopes) via ${resolution}.${unresolved.length ? ` ${unresolved.length} specifiers could not be resolved (git/file/alias).` : ""}`);

  const isAllowed = (c: Component) => policy.allow.packages.some((p) => globMatch(p, c.name) || globMatch(p, `${c.name}@${c.version}`));
  const denied = (c: Component) => policy.deny.packages.some((p) => globMatch(p, c.name) || globMatch(p, `${c.name}@${c.version}`));

  // 3. choose components for deep metadata
  const popular = POPULAR.filter((p) => p.length >= 5);
  const typoOf = (c: Component) => (POPULAR.includes(c.name) ? undefined : popular.find((p) => p !== c.name && levenshtein(c.name.replace(/^@[^/]+\//, ""), p.replace(/^@[^/]+\//, ""), 2) <= (c.name.length >= 8 ? 2 : 1)));
  const prio = (c: Component) => (c.hasInstallScript ? 0 : sapLookalike(c.name) ? 1 : typoOf(c) ? 2 : c.deprecated ? 3 : c.sap ? 4 : c.direct ? 5 : 9);
  const pick = components.filter((c) => prio(c) < 9).sort((a, b) => prio(a) - prio(b)).slice(0, 80);
  const limit = createLimiter(10);
  await Promise.all(pick.map((c) => limit(() => registry.enrich(c).catch(() => undefined))));
  await emit("ok", "Registry metadata", `Publisher, maintainer history and publish dates retrieved for ${pick.filter((c) => c.detailed).length}/${pick.length} priority packages.`);

  // 4. lifecycle inspection
  const lifecycle = components.filter((c) => c.hasInstallScript);
  const analyses = new Map<string, ScriptAnalysis>();
  const inspect = lifecycle.sort((a, b) => Number(b.detailed) - Number(a.detailed)).slice(0, 25);
  await Promise.all(
    inspect.map((c) =>
      limit(async () => {
        const url = c.tarball ?? c.resolved;
        if (!url) return;
        analyses.set(`${c.name}@${c.version}`, await analyzeTarball(url, c.scripts, fetcher));
      }),
    ),
  );
  await emit(lifecycle.length ? "warn" : "ok", "Lifecycle scripts", lifecycle.length ? `${lifecycle.length} packages run install hooks; ${analyses.size} inspected statically (tarball unpacked in memory, scripts pattern-scanned).` : "No dependency declares a preinstall/install/postinstall hook.");

  // 5. advisories
  const vulnRes: VulnResult = await queryVulns(components, fetcher);
  let vulnTotal = 0;
  for (const v of vulnRes.byComponent.values()) vulnTotal += v.length;
  if (vulnRes.error) await emit("warn", "Advisory feed unreachable", `OSV.dev lookup failed (${vulnRes.error}). Vulnerability coverage is incomplete for this build.`);
  else await emit(vulnTotal ? "warn" : "ok", "Advisory check", `OSV (GHSA + NVD) queried for ${vulnRes.queried} components · ${vulnTotal} advisories across ${vulnRes.byComponent.size} packages.`);

  // 6. policy evaluation
  const quarantine = new Map<string, QuarantineOut>();
  const hostFlags: ScanResult["flaggedHosts"] = [];
  const touched = new Map<string, CompStatus>();
  const bump = (key: string, s: CompStatus) => {
    const order = { ok: 0, warn: 1, block: 2 } as const;
    if (order[s] > order[touched.get(key) ?? "ok"]) touched.set(key, s);
  };
  const quarantineAdd = (c: Component, reason: string, factors: string[], extra: Partial<QuarantineOut> = {}) => {
    const key = `${c.name}@${c.version}`;
    const a = analyses.get(key);
    const base = quarantine.get(key);
    const risk = Math.min(100, (a?.risk ?? 0) + factors.length * 12 + (c.newMaintainers?.length ? 15 : 0) + (c.hasInstallScript ? 12 : 0));
    const prev = base?.factors ?? [];
    quarantine.set(key, {
      name: c.name, version: c.version,
      risk: Math.max(base?.risk ?? 0, risk), reason: base ? `${base.reason} ${reason}` : reason,
      lifecycle: c.hasInstallScript, maintainer: c.newMaintainers?.length || sapLookalike(c.name) ? "untrusted" : "verified",
      scanner: "warned", age: humanAge(ageDays(c.createdAt ?? c.publishedAt, now())),
      factors: [...new Set([...prev, ...factors])],
      scripts: a?.scripts ?? c.scripts ?? null, analysis: a ?? null, ...extra,
    });
  };

  for (const c of components) {
    const key = `${c.name}@${c.version}`;
    const a = analyses.get(key);
    const approved = policy.approvals.get(key);

    if (denied(c)) {
      flag({ severity: "critical", rule: "DENY-01", package: key, title: `Package ${key} is on the tenant denylist`, description: "A reviewer rejected or blocked this package in the quarantine queue. Remove it or have a reviewer lift the block." });
      bump(key, "block");
      continue;
    }
    // PKG-04: SAP-branded packages outside approved scopes
    if (on("PKG-04") && sapLookalike(c.name)) {
      const crit = c.hasInstallScript;
      flag({ severity: crit ? "critical" : "high", rule: "PKG-04", package: key, title: `SAP-branded package outside approved scopes: ${key}`, description: `"${c.name}" looks like an SAP package but is not published under @sap/*, @cap-js/*, @sap-cloud-sdk/* or another approved SAP scope — a common dependency-confusion / brand-impersonation pattern.${crit ? " It also runs install scripts." : ""}` });
      quarantineAdd(c, "SAP-branded name outside approved SAP scopes.", ["sap-lookalike"]);
      bump(key, crit ? "block" : "warn");
    }
    // PKG-05: typosquat
    const typo = on("PKG-05") && !isAllowed(c) ? typoOf(c) : undefined;
    if (typo) {
      const young = ageDays(c.createdAt, now());
      if (c.detailed ? (young !== undefined && young < 365) || c.hasInstallScript : c.hasInstallScript) {
        flag({ severity: "high", rule: "PKG-05", package: key, title: `Possible typosquat of "${typo}": ${key}`, description: `Name is within edit distance 2 of the popular package "${typo}" and the package is ${young !== undefined ? `only ${humanAge(young)} old` : "unverified"}${c.hasInstallScript ? " with install scripts" : ""}.` });
        quarantineAdd(c, `Name closely resembles "${typo}".`, ["typosquat"]);
        bump(key, "warn");
      }
    }
    // PKG-02: min age
    const age = ageDays(c.publishedAt, now());
    if (on("PKG-02") && age !== undefined && age < 14 && !isAllowed(c)) {
      flag({ severity: c.hasInstallScript ? "high" : "medium", rule: "PKG-02", package: key, title: `Version published ${humanAge(age)} ago is below the 14-day age floor: ${key}`, description: "Newly published versions are quarantined to give the community time to detect malicious releases." });
      quarantineAdd(c, `Version published ${humanAge(age)} ago (policy floor 14 days).`, ["young-version"]);
      bump(key, c.hasInstallScript ? "block" : "warn");
    }
    // PKG-03: deprecated
    if (on("PKG-03") && c.deprecated) {
      flag({ severity: "low", rule: "PKG-03", package: key, title: `Deprecated package: ${key}`, description: `Registry deprecation notice: ${String(c.deprecated).slice(0, 200)}` });
      bump(key, "warn");
    }
    // PKG-01: maintainer pin
    if (on("PKG-01") && c.newMaintainers?.length && (c.sap || c.hasInstallScript) && !policy.allow.maintainers.some((m) => c.maintainers?.includes(m))) {
      flag({ severity: "high", rule: "PKG-01", package: key, title: `Maintainer change on ${key}`, description: `New publisher(s) not seen on the previous releases: ${c.newMaintainers.join(", ")}.${c.sap ? " Package is in an SAP scope." : " Package also runs install scripts."}` });
      quarantineAdd(c, `New maintainer(s): ${c.newMaintainers.join(", ")}.`, ["new-maintainer"]);
      bump(key, "block");
    }
    // LSF: lifecycle scripts
    if (c.hasInstallScript) {
      const hashDrift = approved?.scriptHash && a?.inspected && approved.scriptHash !== a.scriptHash;
      if (on("LSF-02") && hashDrift) {
        flag({ severity: "high", rule: "LSF-02", package: key, title: `Approved lifecycle script changed (hash drift): ${key}`, description: "The install script no longer matches the sha256 pinned when a reviewer approved it." });
        quarantineAdd(c, "Install script hash differs from the approved version.", ["script-drift"]);
        bump(key, "block");
      } else if (on("LSF-01") && !isAllowed(c) && !approved) {
        flag({ severity: "medium", rule: "LSF-01", package: key, title: `Install script requires review: ${key}`, description: `Runs ${Object.keys(a?.scripts ?? c.scripts ?? {}).filter((k) => ["preinstall", "install", "postinstall"].includes(k)).join(", ") || "an install hook"} on npm install. Approve it in the quarantine queue to pin its hash.` });
        quarantineAdd(c, "Declares install-time lifecycle scripts.", ["lifecycle-script"]);
        bump(key, "warn");
      }
      for (const ind of a?.indicators ?? []) {
        const ruleOn = on(ind.id) || (ind.id === "EXFIL" && on("EGR-01")) || ind.id === "SHELL-PIPE" || ind.id === "OBFUSCATION" || ind.id === "EXEC";
        if (!ruleOn) continue;
        // Network use / process spawning alone is routine (binary downloaders such as esbuild); it only
        // escalates when combined with credential reads, env capture, obfuscation or pipe-to-shell.
        const hard = a!.indicators.some((i) => ["LSF-04", "LSF-05", "SHELL-PIPE", "OBFUSCATION"].includes(i.id));
        if (ind.id === "EXFIL" && !a!.hosts.length && !hard) continue;
        const sev: Severity = ind.id === "EXFIL" ? (hard ? "high" : "low") : ind.id === "EXEC" ? (hard ? "medium" : "low") : ind.severity;
        const rule = ["LSF-04", "LSF-05"].includes(ind.id) ? ind.id : "LSF-03";
        flag({ severity: sev, rule, package: key, title: `${ind.label}: ${key}`, description: `Static analysis of the install script found "${ind.evidence}". Risk score ${a!.risk}/100.` });
        quarantineAdd(c, `${ind.label}.`, [ind.id.toLowerCase()]);
        bump(key, sev === "low" ? "warn" : sev === "medium" ? "warn" : "block");
      }
      // egress review of hosts referenced by scripts
      for (const hp of a?.hosts ?? []) {
        const denyHit = policy.deny.egress.find((d) => hostMatches(d, hp));
        const allowHit = policy.allow.egress.some((e) => hostMatches(e, hp));
        if (denyHit && on("EGR-02")) {
          flag({ severity: "critical", rule: "EGR-02", package: key, title: `Install script references denylisted destination ${hp}: ${key}`, description: `Matches denylist pattern "${denyHit}". The script was not executed; the destination was never contacted.` });
          hostFlags.push({ host: hp, package: key, reason: `denylist ${denyHit}`, denied: true });
          quarantineAdd(c, `Install script references ${hp} (denylisted).`, ["denied-egress"]);
          bump(key, "block");
        } else if (!allowHit && on("EGR-01")) {
          flag({ severity: "low", rule: "EGR-01", package: key, title: `Install script references non-allowlisted host ${hp}: ${key}`, description: "Add the destination to the egress allowlist if this is expected (e.g. a binary download CDN)." });
          hostFlags.push({ host: hp, package: key, reason: "not on egress allowlist", denied: false });
          bump(key, "warn");
        }
      }
    }
    // Vulnerabilities
    const vulns = vulnRes.byComponent.get(key);
    if (vulns?.length) {
      const worst = vulns.map((v) => v.severity).sort((x, y) => sevRank(x) - sevRank(y))[0]!;
      const ruleId = worst === "critical" ? "VLN-01" : "VLN-02";
      if (on(ruleId)) {
        const sla = worst === "critical" ? 7 : worst === "high" ? 30 : 90;
        const fix = vulns.find((v) => v.fixed)?.fixed;
        flag({ severity: worst, rule: ruleId, package: key, title: `${vulns.length} known ${vulns.length > 1 ? "vulnerabilities" : "vulnerability"} in ${key} (worst: ${worst})`, description: `${vulns.slice(0, 4).map((v) => `${v.id}${v.cvss ? ` (CVSS ${v.cvss})` : ""}: ${v.summary}`).join(" · ")}${vulns.length > 4 ? ` · +${vulns.length - 4} more` : ""}.${fix ? ` Fixed in ${fix}.` : ""}${on("VLN-03") ? ` Fix-by SLA: ${sla} days.` : ""}` });
        bump(key, worst === "critical" ? "block" : "warn");
      }
    }
  }

  // quarantine scanner badge + weekly downloads
  for (const q of quarantine.values()) {
    const sevs = findings.filter((f) => f.package === `${q.name}@${q.version}`).map((f) => f.severity);
    q.scanner = sevs.some((s) => s === "critical" || s === "high") ? "blocked" : "warned";
  }
  await Promise.all(
    [...quarantine.values()].slice(0, 15).map((q) =>
      limit(async () => {
        try {
          const r = await fetcher(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(q.name).replace(/^%40/, "@")}`);
          if (r.ok) q.weeklyDownloads = ((await r.json()) as { downloads?: number }).downloads;
        } catch {
          /* optional */
        }
      }),
    ),
  );
  if (vulnRes.error) findings.push({ severity: "low", rule: "VLN-04", title: "Vulnerability advisory feed was unreachable", description: `OSV.dev could not be queried: ${vulnRes.error}. Re-run the build once the feed is reachable.`, blocking: false });

  for (const f of findings.filter((x) => x.blocking).slice(0, 6)) await emit("block", `Policy gate: ${f.rule}`, f.title);
  for (const f of findings.filter((x) => !x.blocking && x.severity !== "info").slice(0, 4)) await emit("warn", `Finding: ${f.rule}`, f.title);

  // 7. verdict
  const real = findings.filter((f) => f.severity !== "info");
  let status: ScanResult["status"] = "passed";
  if (policy.mode === "block" && findings.some((f) => f.blocking)) status = "blocked";
  else if (policy.mode !== "audit" && real.some((f) => sevRank(f.severity) <= sevRank("medium"))) status = "warned";
  else if (policy.mode === "audit" && real.length) status = "passed";
  else if (real.length && policy.mode === "warn") status = "warned";

  const finalComponents = components.map((c) => ({ ...c, status: touched.get(`${c.name}@${c.version}`) ?? ("ok" as CompStatus) }));
  const sbom = buildSbom({ project, commit: manifest.commit, buildId, components: finalComponents, worker, timestamp: now().toISOString() });
  await emit("ok", "SBOM generated", `CycloneDX 1.5 · ${finalComponents.length} components · ${finalComponents.filter((c) => c.sap).length} SAP-scoped.`);
  await emit(status === "blocked" ? "block" : status === "warned" ? "warn" : "ok", status === "blocked" ? "Build blocked" : status === "warned" ? "Build passed with warnings" : "Build passed", `${findings.length} findings · ${quarantine.size} packages quarantined for review · enforcement=${policy.mode}.`);

  const registryHosts = new Set(["registry.npmjs.org:443", "api.osv.dev:443", "api.github.com:443", "raw.githubusercontent.com:443", "api.npmjs.org:443"]);
  return {
    status, commit: manifest.commit, source: manifest.source, components: finalComponents, findings, quarantine: [...quarantine.values()].sort((a, b) => b.risk - a.risk), events,
    hosts: ledger.list().map((h) => ({ ...h, allowed: registryHosts.has(h.host) || policy.allow.egress.some((e) => hostMatches(e, h.host)), note: registryHosts.has(h.host) ? "scanner control traffic" : "allowlisted" })),
    flaggedHosts: hostFlags,
    forensic: { packages: [...analyses.entries()].filter(([, a]) => a.indicators.length || a.risk).map(([k, a]) => { const [n, v] = [k.slice(0, k.lastIndexOf("@")), k.slice(k.lastIndexOf("@") + 1)]; return { name: n, version: v, risk: a.risk, scripts: a.scripts, excerpt: a.excerpt, indicators: a.indicators, hosts: a.hosts, note: a.note }; }) },
    summary: { components: finalComponents.length, direct: finalComponents.filter((c) => c.direct).length, sap: sapCount, lifecycle: lifecycle.length, vulnerabilities: vulnTotal, resolution, advisoryFeed: vulnRes.error ? "unreachable" : "ok", unresolved: unresolved.length },
    sbom,
  };
}
export { semver };
