export const NAV_DASH = [
  { title: "Overview", items: [{ to: "/dashboard", label: "Dashboard", icon: "layout-dashboard" }, { to: "/dashboard/builds", label: "Builds", icon: "hammer" }] },
  { title: "Pipeline", items: [
    { to: "/dashboard/projects", label: "Projects", icon: "folder-git-2" },
    { to: "/dashboard/quarantine", label: "Quarantine", icon: "package-x" },
    { to: "/dashboard/workers", label: "Workers", icon: "server-cog" },
  ] },
  { title: "Policy", items: [
    { to: "/dashboard/policy", label: "Policy Builder", icon: "sliders" },
    { to: "/dashboard/allowlist", label: "Allowlists", icon: "list-checks" },
    { to: "/dashboard/findings", label: "Findings", icon: "shield-alert" },
  ] },
  { title: "Evidence", items: [
    { to: "/dashboard/sbom", label: "SBOM & Provenance", icon: "file-signature" },
    { to: "/dashboard/compliance", label: "Compliance", icon: "scroll-text" },
    { to: "/dashboard/audit", label: "Audit log", icon: "history" },
  ] },
  { title: "Admin", items: [
    { to: "/dashboard/identity", label: "Identity & RBAC", icon: "users" },
    { to: "/dashboard/integrations", label: "Integrations", icon: "puzzle" },
    { to: "/dashboard/settings", label: "Settings", icon: "settings-2" },
  ] },
] as const;

/** Illustrative replay shown on the marketing hero (not live data). */
export const HERO_CONSOLE = [
  { c: "dim" as const, t: "[14:02:17] scan:start policy=strict-prod-sap-cap enforcement=block" },
  { c: "ok" as const, t: "[14:02:32] git:fetch  origin/main → a78f3c1 OK" },
  { c: "ok" as const, t: "[14:02:49] deps:resolve 412 components (47 @sap/*)" },
  { c: "warn" as const, t: "[14:03:24] quarantine sap-helper-utils@1.2.8 NEW MAINTAINER" },
  { c: "block" as const, t: "[14:04:58] lifecycle:postinstall script analysed" },
  { c: "block" as const, t: "[14:04:58] LSF-04 reads ~/.npmrc credential file" },
  { c: "block" as const, t: "[14:04:58] EGR-01 references denied host telemetry.example.cn" },
  { c: "block" as const, t: "[14:04:58] policy:block reason=lifecycle-exfil" },
  { c: "ok" as const, t: "[14:05:00] evidence signed · SBOM + provenance sealed" },
  { c: "ink" as const, t: "BUILD BLOCKED · nothing was installed or executed." },
];

export const SAP_COVERAGE = [
  ["SAP CAP (@sap/cds)", "Node.js 18 / 20 / 22", "Live", true, true, true, "Full @sap/* scope rules"],
  ["SAP BTP extensions", "Node.js (package.json)", "Live", true, true, true, "npm graph scanned"],
  ["Fiori / UI5 apps", "Node.js (ui5-cli)", "Live", true, true, true, "npm graph scanned"],
  ["SAP Cloud SDK", "Node.js", "Live", true, true, true, "@sap-cloud-sdk/* scope"],
  ["CAP Java / Maven", "Maven / Java 17+", "Roadmap", false, false, false, "Not yet supported"],
  ["HANA Cloud apps", "Node.js + HDI", "Live", true, true, true, "npm graph scanned"],
] as const;
