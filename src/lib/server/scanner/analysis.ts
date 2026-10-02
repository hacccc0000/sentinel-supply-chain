import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { redact, type Fetcher } from "./util";

export type ScriptAnalysis = {
  scripts: Record<string, string>;
  scriptHash: string;
  files: Array<{ path: string; bytes: number }>;
  excerpt: string;
  indicators: Array<{ id: string; label: string; severity: "critical" | "high" | "medium" | "low"; evidence: string }>;
  hosts: string[];
  risk: number;
  inspected: boolean;
  note?: string;
};

const INSTALL_HOOKS = ["preinstall", "install", "postinstall"];

/** Minimal ustar reader — enough to pull package.json and referenced scripts out of an npm tarball. */
function untar(buf: Buffer, want: (path: string) => boolean, maxFile = 256 * 1024): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let off = 0;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.toString("utf8", 0, 100).replace(/\0.*$/, "");
    const prefix = header.toString("utf8", 345, 500).replace(/\0.*$/, "");
    const size = parseInt(header.toString("utf8", 124, 136).replace(/\0.*$/, "").trim() || "0", 8);
    const type = String.fromCharCode(header[156] || 48);
    const full = (prefix ? `${prefix}/${name}` : name).replace(/^package\//, "");
    off += 512;
    if ((type === "0" || type === "\0") && want(full) && size <= maxFile) out.set(full, Buffer.from(buf.subarray(off, off + size)));
    off += Math.ceil(size / 512) * 512;
  }
  return out;
}

const PATTERNS: Array<{ id: string; label: string; severity: "critical" | "high" | "medium" | "low"; re: RegExp }> = [
  { id: "LSF-04", label: "Reads credential files (.npmrc / .ssh / cloud creds)", severity: "critical", re: /\.npmrc|\.ssh\/|id_rsa|\.aws\/credentials|\.kube\/config|\.docker\/config|\/run\/secrets|\.netrc|\.git-credentials/ },
  { id: "LSF-05", label: "Captures process environment", severity: "high", re: /JSON\.stringify\(\s*process\.env\s*\)|Object\.(keys|entries|values)\(\s*process\.env\s*\)|\{\s*\.\.\.process\.env\s*\}|\benv\s*\|\s*(base64|curl)/ },
  { id: "EXFIL", label: "Sends data over the network", severity: "high", re: /\bfetch\(|XMLHttpRequest|require\(['"](https?|net|dgram|tls)['"]\)|https?\.request\(|\bcurl\s|\bwget\s|net\.connect|dns\.(resolve|lookup)/ },
  { id: "SHELL-PIPE", label: "Downloads and executes remote code", severity: "critical", re: /(curl|wget)[^\n|]*\|\s*(sh|bash|node)\b|powershell[^\n]*(iex|Invoke-Expression)/i },
  { id: "OBFUSCATION", label: "Obfuscated / dynamically evaluated code", severity: "high", re: /\beval\(|new Function\(|atob\(|Buffer\.from\([^)]*['"]base64['"]\)|(?:\\x[0-9a-f]{2}){6,}|String\.fromCharCode\((?:\s*\d+\s*,){6,}/i },
  { id: "EXEC", label: "Spawns child processes", severity: "medium", re: /child_process|\bexecSync\(|\bspawnSync\(|\bexec\(/ },
];

const URL_RE = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?::(\d+))?/gi;

export async function analyzeTarball(tarballUrl: string, manifestScripts: Record<string, string> | undefined, fetcher: Fetcher): Promise<ScriptAnalysis> {
  const base: ScriptAnalysis = { scripts: {}, scriptHash: "", files: [], excerpt: "", indicators: [], hosts: [], risk: 0, inspected: false };
  try {
    const res = await fetcher(tarballUrl);
    if (!res.ok) throw new Error(`tarball HTTP ${res.status}`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > 12 * 1024 * 1024) return { ...base, note: `Tarball is ${(len / 1048576).toFixed(1)} MB — skipped deep inspection (limit 12 MB).` };
    const gz = Buffer.from(await res.arrayBuffer());
    if (gz.length > 12 * 1024 * 1024) return { ...base, note: "Tarball exceeds 12 MB — skipped deep inspection." };
    const tar = gunzipSync(gz, { maxOutputLength: 80 * 1024 * 1024 });
    const pjBuf = untar(tar, (p) => p === "package.json").get("package.json");
    const pj = pjBuf ? JSON.parse(pjBuf.toString("utf8")) : { scripts: manifestScripts };
    const scripts: Record<string, string> = {};
    for (const h of INSTALL_HOOKS) if (pj.scripts?.[h]) scripts[h] = String(pj.scripts[h]);
    const referenced = new Set<string>();
    for (const cmd of Object.values(scripts)) for (const m of cmd.matchAll(/(?:node|sh|bash)\s+([\w./@-]+)|(?:^|\s)(\.\/[\w./-]+)/g)) referenced.add((m[1] ?? m[2] ?? "").replace(/^\.\//, ""));
    const files = untar(tar, (p) => referenced.has(p) || referenced.has(p.replace(/\.js$/, "")) || (p.endsWith(".js") && /(^|\/)(install|postinstall|preinstall|setup|scripts?\/)/i.test(p)), 200 * 1024);
    let corpus = Object.values(scripts).join("\n");
    const listed: ScriptAnalysis["files"] = [];
    let excerpt = "";
    for (const [path, data] of files) {
      const text = data.toString("utf8");
      corpus += `\n${text}`;
      listed.push({ path, bytes: data.length });
      excerpt += `// ${path}\n${text.slice(0, 1800)}\n\n`;
    }
    const indicators: ScriptAnalysis["indicators"] = [];
    for (const p of PATTERNS) {
      const m = corpus.match(p.re);
      if (m) indicators.push({ id: p.id, label: p.label, severity: p.severity, evidence: redact(m[0]).slice(0, 120) });
    }
    const hosts = new Set<string>();
    for (const m of corpus.matchAll(URL_RE)) hosts.add(`${m[1]!.toLowerCase()}:${m[2] ?? 443}`);
    const weights = { critical: 45, high: 28, medium: 12, low: 4 };
    const risk = Math.min(100, indicators.reduce((s, i) => s + weights[i.severity], 0));
    return {
      scripts: Object.fromEntries(Object.entries(scripts).map(([k, v]) => [k, redact(v)])),
      scriptHash: createHash("sha256").update(corpus).digest("hex"),
      files: listed,
      excerpt: redact(excerpt || Object.entries(scripts).map(([k, v]) => `"${k}": "${v}"`).join("\n")).slice(0, 6000),
      indicators, hosts: [...hosts], risk, inspected: true,
    };
  } catch (e) {
    return { ...base, scripts: Object.fromEntries(Object.entries(manifestScripts ?? {}).filter(([k]) => INSTALL_HOOKS.includes(k))), note: `Static inspection unavailable: ${(e as Error).message}` };
  }
}
