export type Control = { id: string; title: string; rules: string[]; needs?: Array<"signedSbom" | "builds" | "audit" | "enforce"> };
export type Framework = { code: string; title: string; body: string; controls: Control[] };

export const FRAMEWORKS: Framework[] = [
  { code: "SOC 2", title: "SOC 2 Type II evidence", body: "Common criteria for supply-chain integrity and the access boundary around builds.", controls: [
    { id: "CC6.1", title: "Logical access and secret hygiene", rules: ["SEC-03"], needs: ["audit"] },
    { id: "CC6.6", title: "Boundary protection (egress)", rules: ["EGR-01", "EGR-02"], needs: ["enforce"] },
    { id: "CC7.1", title: "Vulnerability detection", rules: ["VLN-01", "VLN-02", "VLN-04"], needs: ["builds"] },
    { id: "CC7.2", title: "Monitoring for anomalies", rules: ["LSF-04", "LSF-06"], needs: ["audit"] },
    { id: "CC8.1", title: "Change management for dependencies", rules: ["PKG-01", "PKG-02", "LSF-01"], needs: ["builds"] },
  ] },
  { code: "ISO 27001", title: "ISO 27001 / 27002 evidence", body: "Annex A controls for supplier relationships and secure development.", controls: [
    { id: "A.5.19", title: "Supplier relationships (packages)", rules: ["PKG-01", "PKG-04"], needs: ["builds"] },
    { id: "A.5.23", title: "Use of cloud services", rules: ["EGR-01"], needs: ["audit"] },
    { id: "A.8.8", title: "Technical vulnerability management", rules: ["VLN-01", "VLN-02", "VLN-03"], needs: ["builds"] },
    { id: "A.8.25", title: "Secure development lifecycle", rules: ["SBM-01", "LSF-01"], needs: ["signedSbom"] },
    { id: "A.8.28", title: "Secure coding / dependency hygiene", rules: ["PKG-03", "PKG-05"], needs: ["builds"] },
  ] },
  { code: "NIST SSDF", title: "NIST SP 800-218 (SSDF) mapping", body: "Third-party component review, SBOM production and vulnerability response.", controls: [
    { id: "PS.2", title: "Provide a mechanism to verify integrity", rules: ["SBM-02"], needs: ["signedSbom"] },
    { id: "PS.3", title: "Archive and protect releases (SBOM)", rules: ["SBM-01", "SBM-03"], needs: ["signedSbom"] },
    { id: "PW.4", title: "Reuse existing, well-secured components", rules: ["PKG-01", "PKG-04", "PKG-05"], needs: ["builds"] },
    { id: "PW.6", title: "Configure build to improve security", rules: ["LSF-01", "LSF-03"], needs: ["enforce"] },
    { id: "RV.1", title: "Identify and confirm vulnerabilities", rules: ["VLN-01", "VLN-04"], needs: ["builds"] },
  ] },
  { code: "SLSA", title: "SLSA build provenance", body: "Provenance statements per build. Static-analysis provenance, signed with the platform key.", controls: [
    { id: "Provenance exists", title: "Build emits provenance", rules: ["SBM-03"], needs: ["signedSbom"] },
    { id: "Provenance authentic", title: "Provenance is signed", rules: ["SBM-02"], needs: ["signedSbom"] },
    { id: "Scripted build", title: "Policy-defined, repeatable scan", rules: ["SBM-01"], needs: ["builds"] },
  ] },
  { code: "OWASP SCVS", title: "OWASP SCVS mapping", body: "Component identification and dependency-chain integrity.", controls: [
    { id: "V1", title: "Inventory (SBOM)", rules: ["SBM-01", "SBM-04"], needs: ["signedSbom"] },
    { id: "V2", title: "SBOM integrity", rules: ["SBM-02"], needs: ["signedSbom"] },
    { id: "V4", title: "Component analysis", rules: ["PKG-03", "PKG-05", "VLN-01"], needs: ["builds"] },
    { id: "V6", title: "Pedigree and provenance", rules: ["PKG-01", "SBM-03"], needs: ["builds"] },
  ] },
  { code: "DORA", title: "EU DORA — ICT third-party risk", body: "Evidence supporting Article 28 / 30 ICT third-party risk obligations.", controls: [
    { id: "Art. 28", title: "ICT third-party risk register (SBOM)", rules: ["SBM-01"], needs: ["signedSbom"] },
    { id: "Art. 9", title: "Protection and prevention", rules: ["EGR-02", "LSF-01"], needs: ["enforce"] },
    { id: "Art. 10", title: "Detection", rules: ["VLN-01", "VLN-04"], needs: ["builds"] },
  ] },
  { code: "GDPR / DPDP", title: "Data residency evidence", body: "Evidence that build analysis does not export source code (only dependency metadata is sent to public registries).", controls: [
    { id: "Art. 32", title: "Security of processing", rules: ["EGR-01", "EGR-02"], needs: ["enforce"] },
    { id: "Art. 25", title: "Data minimisation", rules: ["SEC-03"], needs: ["audit"] },
  ] },
];

export type ControlState = { control: Control; status: "met" | "partial" | "gap"; missing: string[] };
export type Posture = { enabled: Set<string>; signedSbom: boolean; builds: boolean; audit: boolean; mode: string };

export function evaluateFramework(fw: Framework, p: Posture) {
  const states: ControlState[] = fw.controls.map((c) => {
    const missing: string[] = [];
    const offRules = c.rules.filter((r) => !p.enabled.has(r));
    if (offRules.length) missing.push(`rule(s) disabled: ${offRules.join(", ")}`);
    for (const n of c.needs ?? []) {
      if (n === "signedSbom" && !p.signedSbom) missing.push("no signed SBOM yet — run a build");
      if (n === "builds" && !p.builds) missing.push("no completed build yet");
      if (n === "audit" && !p.audit) missing.push("no audit events");
      if (n === "enforce" && p.mode === "audit") missing.push("enforcement is audit-only");
    }
    const status = missing.length === 0 ? "met" : offRules.length === c.rules.length ? "gap" : "partial";
    return { control: c, status, missing };
  });
  const met = states.filter((s) => s.status === "met").length;
  return { states, met, total: states.length, pct: Math.round((met / states.length) * 100) };
}

export const complianceScore = (p: Posture) => {
  const all = FRAMEWORKS.map((f) => evaluateFramework(f, p));
  const met = all.reduce((a, r) => a + r.met, 0);
  const total = all.reduce((a, r) => a + r.total, 0);
  return Math.round((met / total) * 100);
};
