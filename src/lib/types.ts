export type WorkerStatus = "online" | "degraded" | "update" | "offline";
export type BuildStatus = "blocked" | "passed" | "warned" | "failed" | "running" | "overridden";
export type Decision = "approve" | "reject" | "block";
export type Enforcement = "audit" | "warn" | "block";
export type Role = "admin" | "operator" | "reviewer" | "auditor";
export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Me = { id: string; email: string; name: string; role: Role; mustChangePassword: boolean; permissions: string[] };

export type WorkerRow = { id: string; name: string; env: string; region: string; status: WorkerStatus; version: string; heartbeat_s: number; projects: number; isolation: string; builds: number; queue: number; sample: boolean; builtin: boolean };
export type ProjectRow = { id: string; name: string; type: string; repo: string; branch: string; policy: string; owner: string; last_build: string | null; has_manifest: boolean; worker_id: string | null; sample: boolean };
export type BuildRow = { id: string; status: BuildStatus; project_id: string; project: string; commit: string; branch: string; author: string; worker: string; duration: string; findings: number; created_at: string; finished_at: string | null; trigger: string; requested_by: string | null; override_by: string | null; analysis_mode: string; policy_mode: string | null; error: string | null; sample: boolean };
export type ScriptAnalysisView = { scripts: Record<string, string>; scriptHash?: string; excerpt: string; indicators: Array<{ id: string; label: string; severity: Severity; evidence: string }>; hosts: string[]; risk: number; inspected: boolean; note?: string };
export type QuarantineRow = { id: number; name: string; version: string; project: string; project_id: string | null; build_id: string | null; created_at: string; lifecycle: boolean; maintainer: string; scanner: string; risk: number; age: string; reason: string; decision: Decision | null; decided_by: string | null; decided_at: string | null; note: string | null; risk_factors: string[]; scripts: Record<string, string> | null; analysis: ScriptAnalysisView | null; weekly_downloads: number | null; sample: boolean };
export type PolicyRule = { id: string; category: string; label: string; description: string; enabled: boolean; sort_order: number };
export type AllowlistRow = { id: number; kind: "package" | "maintainer" | "egress" | "deny" | "egress-deny"; value: string; note: string; created_by: string | null; sample: boolean };
export type FindingRow = { id: string; build_id: string; severity: Severity; title: string; rule: string; status: "open" | "acked" | "resolved"; project: string; project_id: string | null; package: string | null; description: string | null; note: string | null; updated_by: string | null; created_at: string; sample: boolean };
export type AuditRow = { id: number; actor: string; action: string; target: string; detail: string; created_at: string; ip: string | null };
export type SbomRow = { id: string; project: string; build: string; created_at: string; components: number; sap: number; status: string; signed: boolean; digest: string; key_id: string | null; sample: boolean };
export type IntegrationRow = { id: string; name: string; category: string; connected: boolean; note: string; config: Record<string, string>; has_secret: boolean; updated_at: string | null };
export type UserRow = { id: string; email: string; name: string; role: Role; active: boolean; created_at: string; last_login_at: string | null };
export type TokenRow = { id: string; name: string; prefix: string; scope: string; created_by: string; created_at: string; last_used_at: string | null; revoked: boolean };
export type NotificationRow = { id: number; title: string; body: string; link: string | null; severity: string; read: boolean; created_at: string };
export type PolicyVersionRow = { id: number; version: string; mode: string; published_by: string; note: string; created_at: string; rules: Array<{ id: string; enabled: boolean }> };

export type Stats = {
  buildsToday: number; passRate: number | null; blocked24h: number; series: Array<{ day: string; passed: number; blocked: number; warned: number }>;
  components: number; sapComponents: number; signedSboms: number; egressViolations: number; criticalOpen: number; pendingQuarantine: number; complianceScore: number; online: number;
};

export type Tenant = { tenant_name: string; region: string; signing_key_id: string; notify_slack: boolean; notify_email: boolean };

export type Bootstrap = {
  me: Me; tenant: Tenant; workers: WorkerRow[]; projects: ProjectRow[]; builds: BuildRow[]; quarantine: QuarantineRow[];
  rules: PolicyRule[]; mode: Enforcement; policyVersion: string; policyVersions: PolicyVersionRow[]; policyDirty: boolean;
  allowlist: AllowlistRow[]; findings: FindingRow[]; audit: AuditRow[]; sboms: SbomRow[]; integrations: IntegrationRow[];
  users: UserRow[]; tokens: TokenRow[]; notifications: NotificationRow[]; unread: number; stats: Stats; sampleCount: number; running: number;
};

export type ScanEventView = { t: number; kind: "ok" | "warn" | "block" | "info"; title: string; body: string };
export type BuildDetail = {
  build: BuildRow & { events: ScanEventView[]; summary: Record<string, any>; hosts: { contacted?: Array<{ host: string; count: number; allowed: boolean; note: string }>; flagged?: Array<{ host: string; package: string; reason: string; denied: boolean }> } | any[]; forensic: { packages?: Array<{ name: string; version: string; risk: number; scripts: Record<string, string>; excerpt: string; indicators: ScriptAnalysisView["indicators"]; hosts: string[]; note?: string }>; provenance?: any; sample?: { script: string; containment: Array<[string, string]> } } | null };
  findings: FindingRow[];
  quarantine: QuarantineRow[];
  components: Array<{ name: string; version: string; license: string | null; sap: boolean; status: "ok" | "warn" | "block"; direct: boolean; lifecycle: boolean }>;
  sbom: { id: string; signed: boolean; digest: string; key_id: string | null; components: number } | null;
};
