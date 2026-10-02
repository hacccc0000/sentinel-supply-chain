# BuildBouncer

Supply-chain security for SAP (CAP / BTP / Fiori) Node.js builds. Scans dependency graphs against policy **before** anything is installed, quarantines suspicious packages for human review, and produces signed SBOM / provenance / evidence bundles.

**What runs today:** real auth + RBAC, GitHub/pasted-manifest ingestion, lockfile or registry graph resolution, OSV vulnerability lookup, install-script static analysis (never executed), policy engine (audit/warn/block), quarantine workflow, signed CycloneDX SBOM + in-toto provenance (HMAC-SHA256), evidence zip, compliance mapping, audit log, CI scan API, Slack/Teams/webhook alerts.
**Roadmap (shown as such in UI):** runtime syscall sandbox agent, Java/Maven, KMS signing, BTP/Jira/Vault integrations.

## Deploy (GitHub → GHCR → Azure App Service)
1. Run `infra/setup-azure.sh` in Azure Cloud Shell (creates RG, Postgres B1ms, App Service B1, app settings).
2. Add GitHub repo variable `AZURE_WEBAPP_NAME` and secret `AZURE_WEBAPP_PUBLISH_PROFILE` (printed by the script).
3. Push to `main` → workflow builds the image, pushes to GHCR, deploys. Make the GHCR package public (or give App Service a read PAT).
4. Migrations run automatically at container start (advisory-locked).

See `.env.example` for configuration. Health: `GET /api/health`.

## CI gate
`POST /api/v1/scans` with `Authorization: Bearer bb_…` (create under Integrations) — see the in-app snippets.

## Local dev
`npm i && npm run dev` (embedded PGLite when `DATABASE_URL` is empty; first user becomes admin).

`legacy/` holds the earlier FastAPI/React pilot, kept for reference only.
