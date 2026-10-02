export type IntegrationDef = { id: string; kind: "secret" | "ci" | "soon"; label?: string; placeholder?: string; configFields?: Array<{ key: string; label: string; placeholder: string }>; help: string };
export const INTEGRATION_DEFS: Record<string, IntegrationDef> = {
  github: { id: "github", kind: "secret", label: "GitHub access token", placeholder: "github_pat_… or ghp_…", help: "Fine-grained token with read access to Contents (and Issues: write to file remediation issues). Needed only for private repositories." },
  slack: { id: "slack", kind: "secret", label: "Slack incoming webhook URL", placeholder: "https://hooks.slack.com/services/…", help: "Build verdicts and quarantine alerts are posted to this channel." },
  teams: { id: "teams", kind: "secret", label: "Teams incoming webhook URL", placeholder: "https://….webhook.office.com/…", help: "Build verdicts and quarantine alerts are posted to this channel." },
  webhook: { id: "webhook", kind: "secret", label: "Webhook URL", placeholder: "https://example.com/hooks/buildbouncer", help: "Receives a JSON POST per build event. Deliveries are signed (x-buildbouncer-signature) when a signing secret is set." },
  gitlab: { id: "gitlab", kind: "ci", help: "Call the CI scan API from .gitlab-ci.yml with an API token." },
  jenkins: { id: "jenkins", kind: "ci", help: "Call the CI scan API from a Jenkins pipeline stage with an API token." },
  "azure-devops": { id: "azure-devops", kind: "ci", help: "Call the CI scan API from an Azure Pipelines step with an API token." },
  btp: { id: "btp", kind: "soon", help: "SAP BTP subaccount sync is on the roadmap." },
  jira: { id: "jira", kind: "soon", help: "Jira issue creation from findings is on the roadmap." },
  vault: { id: "vault", kind: "soon", help: "HashiCorp Vault secret brokering needs a runtime worker agent (roadmap)." },
  akv: { id: "akv", kind: "soon", help: "Azure Key Vault signing keys are on the roadmap. Today SBOMs are signed with the platform HMAC key." },
};

export const RULE_ENGINE: Record<string, "scan" | "runtime"> = {
  "PKG-01": "scan", "PKG-02": "scan", "PKG-03": "scan", "PKG-04": "scan", "PKG-05": "scan",
  "LSF-01": "scan", "LSF-02": "scan", "LSF-03": "scan", "LSF-04": "scan", "LSF-05": "scan", "LSF-06": "scan",
  "VLN-01": "scan", "VLN-02": "scan", "VLN-03": "scan", "VLN-04": "scan",
  "SEC-03": "scan", "SBM-01": "scan", "SBM-02": "scan", "SBM-03": "scan", "SBM-04": "scan",
  "EGR-01": "scan", "EGR-02": "scan",
  "SEC-01": "runtime", "SEC-02": "runtime", "SEC-04": "runtime", "ISO-01": "runtime", "ISO-02": "runtime", "ISO-03": "runtime", "ISO-04": "runtime",
};
