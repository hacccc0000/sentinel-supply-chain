import { createLimiter, type Fetcher } from "./util";
import type { Component } from "./registry";

export type Vuln = { id: string; aliases: string[]; severity: "critical" | "high" | "medium" | "low"; summary: string; fixed?: string; cvss?: number };
export type VulnResult = { byComponent: Map<string, Vuln[]>; error?: string; queried: number };

const mapSeverity = (s?: string): Vuln["severity"] | undefined => {
  switch ((s ?? "").toUpperCase()) {
    case "CRITICAL": return "critical";
    case "HIGH": return "high";
    case "MODERATE": case "MEDIUM": return "medium";
    case "LOW": return "low";
    default: return undefined;
  }
};

function cvssBase(vector: string): number | undefined {
  // CVSS v3.x base score from vector string.
  const m = Object.fromEntries(vector.split("/").slice(1).map((p) => p.split(":") as [string, string]));
  if (!m.AV || !m.AC || !m.PR || !m.UI || !m.S || !m.C || !m.I || !m.A) return undefined;
  const AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[m.AV as "N"];
  const AC = { L: 0.77, H: 0.44 }[m.AC as "L"];
  const changed = m.S === "C";
  const PR = (changed ? { N: 0.85, L: 0.68, H: 0.5 } : { N: 0.85, L: 0.62, H: 0.27 })[m.PR as "N"];
  const UI = { N: 0.85, R: 0.62 }[m.UI as "N"];
  const cia = { H: 0.56, L: 0.22, N: 0 };
  const iss = 1 - (1 - cia[m.C as "H"]) * (1 - cia[m.I as "H"]) * (1 - cia[m.A as "H"]);
  if ([AV, AC, PR, UI].some((x) => x === undefined)) return undefined;
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15 : 6.42 * iss;
  const expl = 8.22 * AV! * AC! * PR! * UI!;
  if (impact <= 0) return 0;
  const raw = changed ? Math.min(1.08 * (impact + expl), 10) : Math.min(impact + expl, 10);
  return Math.ceil(raw * 10) / 10;
}
const sevFromScore = (n: number): Vuln["severity"] => (n >= 9 ? "critical" : n >= 7 ? "high" : n >= 4 ? "medium" : "low");

export async function queryVulns(components: Component[], fetcher: Fetcher): Promise<VulnResult> {
  const byComponent = new Map<string, Vuln[]>();
  const queryable = components.filter((c) => /^\d/.test(c.version));
  try {
    const ids = new Map<string, Set<string>>(); // vuln id -> component keys
    for (let i = 0; i < queryable.length; i += 500) {
      const chunk = queryable.slice(i, i + 500);
      const res = await fetcher("https://api.osv.dev/v1/querybatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ queries: chunk.map((c) => ({ package: { name: c.name, ecosystem: "npm" }, version: c.version })) }),
      });
      if (!res.ok) throw new Error(`OSV querybatch HTTP ${res.status}`);
      const body = (await res.json()) as { results: Array<{ vulns?: Array<{ id: string }> }> };
      body.results.forEach((r, idx) => {
        const c = chunk[idx]!;
        for (const v of r.vulns ?? []) {
          if (!ids.has(v.id)) ids.set(v.id, new Set());
          ids.get(v.id)!.add(`${c.name}@${c.version}`);
        }
      });
    }
    const limit = createLimiter(10);
    const details = new Map<string, Vuln>();
    await Promise.all(
      [...ids.keys()].slice(0, 150).map((id) =>
        limit(async () => {
          try {
            const res = await fetcher(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`);
            if (!res.ok) return;
            const d = (await res.json()) as any;
            if (d.withdrawn) return;
            let sev = mapSeverity(d.database_specific?.severity);
            let cvss: number | undefined;
            for (const s of d.severity ?? []) {
              if (typeof s.score === "string" && s.score.startsWith("CVSS:3")) {
                cvss = cvssBase(s.score);
                if (cvss !== undefined && !sev) sev = sevFromScore(cvss);
              }
            }
            let fixed: string | undefined;
            for (const a of d.affected ?? []) for (const r of a.ranges ?? []) for (const e of r.events ?? []) if (e.fixed) fixed ??= e.fixed;
            details.set(id, { id, aliases: d.aliases ?? [], severity: sev ?? "medium", summary: String(d.summary ?? d.details ?? id).slice(0, 220), fixed, cvss });
          } catch {
            /* detail is best-effort */
          }
        }),
      ),
    );
    for (const [id, comps] of ids) {
      const v = details.get(id) ?? { id, aliases: [], severity: "medium" as const, summary: id };
      for (const key of comps) byComponent.set(key, [...(byComponent.get(key) ?? []), v]);
    }
    return { byComponent, queried: queryable.length };
  } catch (e) {
    return { byComponent, queried: queryable.length, error: (e as Error).message };
  }
}
