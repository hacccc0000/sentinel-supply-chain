create table if not exists workers (
  id text primary key,
  name text not null,
  env text not null,
  region text not null,
  status text not null,
  version text not null,
  heartbeat_s integer not null,
  projects integer not null,
  isolation text not null,
  builds integer not null,
  queue integer not null
);

create table if not exists projects (
  id text primary key,
  name text not null,
  type text not null,
  repo text not null,
  policy text not null,
  owner text not null,
  last_build text
);

create table if not exists builds (
  id text primary key,
  status text not null,
  project_id text not null,
  project text not null,
  commit text not null,
  branch text not null,
  author text not null,
  worker text not null,
  duration text not null,
  findings integer not null,
  started_ago text not null
);

create table if not exists quarantine_items (
  id serial primary key,
  name text not null,
  version text not null,
  project text not null,
  at text not null,
  lifecycle boolean not null,
  maintainer text not null,
  scanner text not null,
  risk integer not null,
  age text not null,
  reason text not null,
  decision text
);

create table if not exists policy_rules (
  id text primary key,
  category text not null,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null
);

create table if not exists policy_settings (
  id text primary key,
  enforcement_mode text not null,
  version text not null
);

create table if not exists allowlist_entries (
  id serial primary key,
  kind text not null,
  value text not null,
  note text not null default ''
);

create table if not exists findings (
  id text primary key,
  build_id text not null,
  severity text not null,
  title text not null,
  rule text not null,
  status text not null default 'open',
  project text not null
);

create table if not exists audit_events (
  id serial primary key,
  actor text not null,
  action text not null,
  target text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists sboms (
  id text primary key,
  project text not null,
  build text not null,
  time_ago text not null,
  components integer not null,
  sap integer not null,
  status text not null,
  signed boolean not null,
  digest text not null
);

create table if not exists integrations (
  id text primary key,
  name text not null,
  category text not null,
  connected boolean not null default false,
  note text not null default ''
);

create table if not exists members (
  id text primary key,
  name text not null,
  role text not null,
  title text not null,
  last_seen text not null
);

create table if not exists tenant_settings (
  id text primary key,
  tenant_name text not null,
  region text not null,
  kms text not null,
  notify_slack boolean not null default true,
  notify_email boolean not null default true
);

insert into workers (id, name, env, region, status, version, heartbeat_s, projects, isolation, builds, queue) values
  ('w1', 'azure-prod-worker-east-us-2', 'Azure AKS', 'East US 2', 'online', '3.4.1', 12, 4, 'gVisor', 187, 2),
  ('w2', 'aws-prod-worker-eu-central', 'AWS EKS', 'EU Central', 'online', '3.4.1', 9, 3, 'gVisor', 142, 0),
  ('w3', 'onprem-mum-worker-01', 'On-prem K8s', 'Mumbai DC', 'degraded', '3.4.1', 38, 2, 'Kata', 84, 1),
  ('w4', 'gke-stage-worker-asia', 'Google GKE', 'Asia SE 1', 'online', '3.4.1', 14, 1, 'gVisor', 53, 0),
  ('w5', 'azure-stage-worker-eus', 'Azure AKS', 'East US', 'update', '3.3.7', 11, 2, 'gVisor', 61, 0),
  ('w6', 'aws-dev-worker-us-east', 'AWS EKS', 'US East 1', 'online', '3.4.1', 8, 1, 'rootless', 29, 0),
  ('w7', 'onprem-bom-worker-02', 'On-prem K8s', 'Mumbai DC', 'offline', '3.3.7', 480, 1, 'Kata', 17, 0)
on conflict (id) do nothing;

insert into projects (id, name, type, repo, policy, owner, last_build) values
  ('btp-order-extension', 'BTP Order Extension', 'BTP Node.js', 'northbank/btp-order-extension', 'Strict Prod SAP CAP', 'platform', '47128'),
  ('cap-supplier-risk', 'CAP Supplier Risk Service', 'SAP CAP', 'northbank/cap-supplier-risk', 'Strict Prod SAP CAP', 'risk', '47127'),
  ('fiori-launchpad', 'Fiori Launchpad', 'Fiori / UI5', 'northbank/fiori-launchpad', 'Strict Prod SAP CAP', 'ux', '47126'),
  ('sap-finance-approval', 'SAP Finance Approval', 'SAP CAP', 'northbank/sap-finance-approval', 'Strict Prod SAP CAP', 'finance', '47125'),
  ('hana-reporting-api', 'HANA Reporting API', 'SAP CAP', 'northbank/hana-reporting-api', 'Standard SAP', 'analytics', '47124'),
  ('btp-procurement', 'BTP Procurement', 'BTP Node.js', 'northbank/btp-procurement', 'Strict Prod SAP CAP', 'procurement', '47123')
on conflict (id) do nothing;

insert into builds (id, status, project_id, project, commit, branch, author, worker, duration, findings, started_ago) values
  ('47128', 'blocked', 'btp-order-extension', 'BTP Order Extension', 'a78f3c1', 'main', 'platform-bot', 'azure-prod-worker-east-us-2', '2:41', 6, '4 min ago'),
  ('47127', 'passed', 'cap-supplier-risk', 'CAP Supplier Risk Service', 'b211a0f', 'main', 'risk-bot', 'azure-prod-worker-east-us-2', '3:18', 0, '12 min ago'),
  ('47126', 'passed', 'fiori-launchpad', 'Fiori Launchpad', 'c98e2d4', 'main', 'ux-bot', 'aws-prod-worker-eu-central', '4:02', 0, '1h ago'),
  ('47125', 'warned', 'sap-finance-approval', 'SAP Finance Approval', 'f4a1b09', 'release', 'finance-bot', 'aws-prod-worker-eu-central', '3:47', 2, '32 min ago'),
  ('47124', 'passed', 'hana-reporting-api', 'HANA Reporting API', '918ac3e', 'main', 'analytics-bot', 'azure-prod-worker-east-us-2', '2:11', 0, '2h ago'),
  ('47123', 'failed', 'btp-procurement', 'BTP Procurement', '7c1d2fa', 'main', 'procurement-bot', 'onprem-mum-worker-01', '0:42', 0, '5h ago'),
  ('47122', 'passed', 'cap-supplier-risk', 'CAP Supplier Risk Service', '11aa90c', 'main', 'risk-bot', 'gke-stage-worker-asia', '2:58', 0, '7h ago'),
  ('47121', 'passed', 'fiori-launchpad', 'Fiori Launchpad', 'ee12ab0', 'main', 'ux-bot', 'azure-prod-worker-east-us-2', '3:44', 1, '9h ago')
on conflict (id) do nothing;

insert into quarantine_items (name, version, project, at, lifecycle, maintainer, scanner, risk, age, reason, decision) values
  ('sap-helper-utils', '1.2.8', 'BTP Order Extension', '4 min ago', true, 'untrusted', 'blocked', 94, '12 days', 'Lifecycle script attempted .npmrc exfiltration to non-allowlisted host.', null),
  ('node-cap-toolkit', '0.4.0', 'CAP Supplier Risk Service', '18 min ago', true, 'untrusted', 'warned', 72, '5 days', 'New maintainer published v0.4.0 with previously absent postinstall hook.', null),
  ('@cdsx/forms', '2.1.0', 'Fiori Launchpad', '1h ago', false, 'verified', 'warned', 38, '9 days', 'Package age below 14-day policy floor.', null),
  ('passport-saml-helper', '3.0.0', 'SAP Finance Approval', '2h ago', true, 'verified', 'ok', 24, '94 days', 'Major version bump introduces install scripts; manual approval required.', null),
  ('axios-retry-cap', '1.4.2', 'BTP Procurement', '3h ago', false, 'verified', 'ok', 14, '2 yr', 'Version pin drift from approved baseline.', null);

insert into policy_rules (id, category, label, description, enabled, sort_order) values
  ('PKG-01', 'packages', 'Require maintainer pin for @sap/* scope', 'Block any @sap/* package whose maintainer changes without prior approval.', true, 1),
  ('PKG-02', 'packages', 'Require minimum package age', 'Packages younger than 14 days are quarantined for review.', true, 2),
  ('PKG-03', 'packages', 'Deny deprecated packages', 'Packages marked deprecated on registry are blocked.', true, 3),
  ('PKG-04', 'packages', 'Allow only approved scopes', 'Restrict installs to @sap/*, @cap-js/*, @sap-cloud-sdk/* and the approved transitive set.', true, 4),
  ('PKG-05', 'packages', 'Block typosquat patterns', 'Reject installs that fuzzy-match an approved package name within Levenshtein distance 2.', true, 5),
  ('LSF-01', 'lifecycle', 'Block all postinstall scripts by default', 'Deny pre/post/install hooks unless explicitly allowlisted.', true, 1),
  ('LSF-02', 'lifecycle', 'Allowlist requires script hash pin', 'Approved scripts must match a known sha256 hash. Drift quarantines the install.', true, 2),
  ('LSF-03', 'lifecycle', 'Sandbox lifecycle scripts', 'Run lifecycle stages with no env access, no network, read-only FS.', true, 3),
  ('LSF-04', 'lifecycle', 'Block secret-shaped reads', 'Detect reads against .npmrc, .env, ~/.aws/, ~/.kube/, /run/secrets/* — deny.', true, 4),
  ('LSF-05', 'lifecycle', 'Restrict env scope per stage', 'Lifecycle stages cannot read SAP/BTP credential env variables.', true, 5),
  ('LSF-06', 'lifecycle', 'Capture full lifecycle audit log', 'Every lifecycle invocation is recorded with syscall summary as evidence.', true, 6),
  ('VLN-01', 'vulns', 'Block critical CVEs', 'Any matched CVSS ≥ 9.0 halts the build.', true, 1),
  ('VLN-02', 'vulns', 'Warn on high CVEs', 'CVSS 7.0–8.9 produces a build warning with grace period.', true, 2),
  ('VLN-03', 'vulns', 'Require fix-by SLA', 'Critical: 7 days. High: 30 days. Medium: 90 days.', true, 3),
  ('VLN-04', 'vulns', 'Consume GHSA + OSV', 'Pull advisories from GHSA, OSV.dev, and SAP Note feed.', true, 4),
  ('SEC-01', 'secrets', 'Broker secrets only', 'Builds cannot use env-baked secrets — broker injection only.', true, 1),
  ('SEC-02', 'secrets', 'Scope secrets per build stage', 'Lifecycle scripts cannot see runtime secrets and vice versa.', true, 2),
  ('SEC-03', 'secrets', 'Redact secrets in logs', 'Pattern-match SAP tokens, JWTs, npm auth tokens — replace before storage.', true, 3),
  ('SEC-04', 'secrets', 'Rotate broker tokens hourly', 'Build-scoped tokens expire on build completion or after 60 minutes.', true, 4),
  ('SBM-01', 'sbom', 'Generate SBOM on every build', 'CycloneDX 1.5, full dependency graph.', true, 1),
  ('SBM-02', 'sbom', 'Sign SBOM with worker key', 'Signed via customer-managed KMS key.', true, 2),
  ('SBM-03', 'sbom', 'Attach SLSA provenance', 'Generate SLSA Level 3 provenance predicate.', true, 3),
  ('SBM-04', 'sbom', 'Refuse build without SBOM', 'If SBOM generation fails, build is marked failed.', true, 4),
  ('ISO-01', 'isolation', 'Rootless containers', 'No build step runs as UID 0.', true, 1),
  ('ISO-02', 'isolation', 'gVisor / Kata syscall filter', 'Restricted syscall surface per build.', true, 2),
  ('ISO-03', 'isolation', 'Ephemeral workspace', 'Workspace destroyed on build end.', true, 3),
  ('ISO-04', 'isolation', 'Read-only base image', 'Only /tmp and workspace writable.', true, 4)
on conflict (id) do nothing;

insert into policy_settings (id, enforcement_mode, version) values
  ('default', 'block', '4.2')
on conflict (id) do nothing;

insert into allowlist_entries (kind, value, note) values
  ('egress', 'registry.npmjs.org:443', 'Approved mirror'),
  ('egress', 'vault.northbank.internal:8200', 'Secrets broker'),
  ('egress', 'registry.northbank.internal:443', 'Artifact registry'),
  ('egress', 'control.buildbouncer.io:443', 'Metadata egress'),
  ('package', '@sap/*', 'SAP scope'),
  ('package', '@cap-js/*', 'CAP JS scope'),
  ('package', '@sap-cloud-sdk/*', 'Cloud SDK scope'),
  ('maintainer', 'sap-npm', 'Verified SAP publisher');

insert into findings (id, build_id, severity, title, rule, status, project) values
  ('VB-LIFE-1024', '47128', 'critical', 'Lifecycle exfiltration attempt on sap-helper-utils@1.2.8', 'LSF-03 / LSF-04', 'open', 'BTP Order Extension'),
  ('VB-EGR-0049', '47128', 'critical', 'Outbound connect to denied destination telemetry.example.cn:443', 'EGR-DENY-01', 'open', 'BTP Order Extension'),
  ('VB-PKG-0488', '47128', 'high', 'Untrusted maintainer published @sap-look-alike package', 'PKG-01', 'open', 'BTP Order Extension'),
  ('VB-DEP-2317', '47128', 'medium', 'Transitive dependency axios@1.6.8 has open advisory GHSA-wf5p', 'VLN-02', 'open', 'BTP Order Extension'),
  ('VB-LIC-0033', '47128', 'low', 'License compatibility check skipped due to build halt', 'LIC-01', 'open', 'BTP Order Extension'),
  ('VB-OBS-1101', '47128', 'info', 'Worker entered self-reset after halt — clean rootfs restored', 'ISO-04', 'acked', 'BTP Order Extension'),
  ('VB-AGE-0192', '47125', 'medium', 'Package age below policy floor for @cdsx/forms@2.1.0', 'PKG-02', 'open', 'SAP Finance Approval'),
  ('VB-CVE-8821', '47125', 'high', 'passport@0.7.0 matches GHSA medium with upgrade path', 'VLN-02', 'open', 'SAP Finance Approval')
on conflict (id) do nothing;

insert into audit_events (actor, action, target, detail) values
  ('control-plane', 'worker.heartbeat', 'azure-prod-worker-east-us-2', 'online · 12s'),
  ('policy-engine', 'build.blocked', '47128', 'LSF-04 + EGR-DENY-01'),
  ('security-admin', 'override.temp', '47128', 'TEMP staging override'),
  ('worker', 'rootfs.reset', 'azure-prod-worker-east-us-2', 'clean image restored'),
  ('policy-engine', 'package.quarantine', 'sap-helper-utils@1.2.8', 'new maintainer + lifecycle');

insert into sboms (id, project, build, time_ago, components, sap, status, signed, digest) values
  ('sbom_8b21a4', 'BTP Order Extension', '47128', '4m ago', 412, 47, 'draft (partial)', false, 'f97a28e1…b218'),
  ('sbom_8b219f', 'CAP Supplier Risk Service', '47127', '12m ago', 318, 38, 'signed', true, 'c1b047e2…aa14'),
  ('sbom_8b219a', 'Fiori Launchpad', '47126', '1h ago', 561, 19, 'signed', true, '9d12f2bc…0017'),
  ('sbom_8b2195', 'SAP Finance Approval', '47125', '32m ago', 442, 41, 'signed', true, '44e8a317…91ce'),
  ('sbom_8b218e', 'HANA Reporting API', '47124', '2h ago', 247, 28, 'signed', true, 'fa01b4d2…77fb'),
  ('sbom_8b2188', 'BTP Procurement', '47123', '5h ago', 387, 44, 'signed', true, '21bd09a0…3e44')
on conflict (id) do nothing;

insert into integrations (id, name, category, connected, note) values
  ('github', 'GitHub', 'source', true, 'northbank org · checks + status'),
  ('gitlab', 'GitLab', 'source', false, 'Self-hosted CE'),
  ('jenkins', 'Jenkins', 'ci', true, 'BTP pipeline folder'),
  ('azure-devops', 'Azure DevOps', 'ci', true, 'NorthBank-SAP project'),
  ('btp', 'SAP BTP', 'sap', true, 'Subaccount connected'),
  ('slack', 'Slack', 'notify', true, '#sap-sec-builds'),
  ('teams', 'Microsoft Teams', 'notify', false, 'Security channel'),
  ('jira', 'Jira', 'tickets', true, 'SEC project'),
  ('vault', 'HashiCorp Vault', 'secrets', true, 'prod/sap path'),
  ('akv', 'Azure Key Vault', 'secrets', true, 'eastus2')
on conflict (id) do nothing;

insert into members (id, name, role, title, last_seen) values
  ('m1', 'Security Admin', 'admin', 'Tenant owner', 'now'),
  ('m2', 'Platform Lead', 'operator', 'Worker ops', '12 min ago'),
  ('m3', 'AppSec Reviewer', 'reviewer', 'Package firewall', '1h ago'),
  ('m4', 'Auditor', 'auditor', 'Read-only evidence', '2d ago'),
  ('m5', 'CI Bot', 'bot', 'Pipeline identity', '4 min ago')
on conflict (id) do nothing;

insert into tenant_settings (id, tenant_name, region, kms, notify_slack, notify_email) values
  ('default', 'NorthBank Industries', 'EAST-US-2', 'azure-keyvault:northbank-sap-kms', true, true)
on conflict (id) do nothing;
