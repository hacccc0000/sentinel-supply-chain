import { randomUUID } from "node:crypto";
import type { Component } from "./registry";
import { purl } from "./util";

export type CompStatus = "ok" | "warn" | "block";

function hashEntry(integrity?: string) {
  if (!integrity) return undefined;
  const m = integrity.match(/^(sha512|sha256|sha1)-(.+)$/);
  if (!m) return undefined;
  const alg = { sha512: "SHA-512", sha256: "SHA-256", sha1: "SHA-1" }[m[1] as "sha1"];
  return [{ alg, content: Buffer.from(m[2]!, "base64").toString("hex") }];
}

export function buildSbom(args: { project: { name: string; repo: string }; commit: string; buildId: string; components: Array<Component & { status: CompStatus }>; worker: string; timestamp: string }) {
  const comps = [...args.components].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: args.timestamp,
      tools: { components: [{ type: "application", name: "BuildBouncer Scanner", version: "1.0.0" }] },
      component: { type: "application", name: args.project.name, version: args.commit, "bom-ref": `project:${args.project.repo}` },
      properties: [{ name: "bb:build", value: args.buildId }, { name: "bb:worker", value: args.worker }, { name: "bb:analysis", value: "static" }],
    },
    components: comps.map((c) => ({
      type: "library",
      "bom-ref": purl(c.name, c.version),
      name: c.name,
      version: c.version,
      purl: purl(c.name, c.version),
      scope: c.dev ? "optional" : "required",
      ...(c.license ? { licenses: [{ license: /^[A-Za-z0-9.+-]+$/.test(c.license) ? { id: c.license } : { name: c.license } }] } : {}),
      ...(hashEntry(c.integrity) ? { hashes: hashEntry(c.integrity) } : {}),
      properties: [
        { name: "bb:sap", value: String(c.sap) },
        { name: "bb:direct", value: String(c.direct) },
        { name: "bb:lifecycle", value: String(c.hasInstallScript) },
        { name: "bb:status", value: c.status },
      ],
    })),
  };
}

export function buildProvenance(args: { project: { name: string; repo: string; branch: string }; commit: string; buildId: string; worker: string; startedOn: string; finishedOn: string; policyVersion: string; mode: string; sbomDigest: string }) {
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: `git+https://github.com/${args.project.repo}`, digest: { gitCommit: args.commit } }],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://buildbouncer.io/scan/v1",
        externalParameters: { repository: args.project.repo, ref: args.project.branch, policyVersion: args.policyVersion, enforcement: args.mode },
        resolvedDependencies: [{ uri: `git+https://github.com/${args.project.repo}@${args.project.branch}`, digest: { gitCommit: args.commit } }],
      },
      runDetails: {
        builder: { id: `https://buildbouncer.io/builders/${args.worker}` },
        metadata: { invocationId: args.buildId, startedOn: args.startedOn, finishedOn: args.finishedOn },
        byproducts: [{ name: "sbom.cdx.json", digest: { sha256: args.sbomDigest } }],
      },
    },
  };
}
