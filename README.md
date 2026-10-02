# Sentinel Supply Chain

A small, tenant-isolated supply-chain operations pilot for SAP S/4HANA Cloud. The web console is React/Vite, the API is FastAPI, persistent data is PostgreSQL, and SAP client secrets are stored in Azure Key Vault. The supported live SAP flow uses OAuth 2.0 client credentials and a caller-selected, read-only OData API path.

## What works

- Live and demo workspaces are deliberately separate. Demo data and demo releases never write to a tenant workspace or call SAP.
- Tenant-scoped build and worker ingestion, build/worker inventory, policy storage, quarantine review, and audit events are persisted in PostgreSQL.
- SAP S/4HANA Cloud connection settings can be saved per tenant, the client secret is written to Key Vault (locally it is AES-GCM encrypted), and the connection test obtains an OAuth token and calls the configured OData endpoint.
- Microsoft Entra sign-in is enforced on the deployed API by App Service Authentication. The browser requests a delegated API scope with MSAL.
- PostgreSQL is private to a dedicated VNet; App Service uses managed identity for Key Vault access. HTTPS, TLS, image pull credentials, and health/readiness checks are configured.

**Integration boundary:** this pilot verifies and reads the configured SAP OData endpoint; it does not write SAP business records. The build/policy screens store and display records, but policy enforcement and release actions are not wired into an external CI/CD or SAP control plane. A production rollout that acts on builds needs an explicitly authorized scanner/CI adapter, policy enforcement semantics, and operational approval gates.

## Run locally

Requirements: Docker Compose, or Python 3.12+, Node.js 22+, and PostgreSQL 16+.

With Docker Compose:

```bash
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
export APP_ENCRYPTION_KEY="$(openssl rand -base64 32)"
docker compose up --build
```

Open <http://localhost:8080>. The API is at <http://localhost:8000>; its interactive OpenAPI docs are available at <http://localhost:8000/docs> in development. The default workspace is clearly labeled demo. To test a real SAP system locally, switch to Live, configure its OAuth endpoint and read-only API path, and keep `APP_ENCRYPTION_KEY` stable. Never commit `.env` files, SAP credentials, or generated secrets.

To run the checks:

```bash
cd backend
python -m pip install -r requirements.txt
python -m pytest

cd ../frontend
npm ci
npm audit
npm run build
```

## Deploy to Azure

The GitHub Actions workflow builds and tests both images, publishes immutable commit-tagged containers to private GHCR, previews the Azure deployment with `what-if`, then provisions/deploys to **a dedicated resource group**. It uses GitHub OIDC for Azure login (not an App Service publish profile), a private PostgreSQL Flexible Server, a shared Basic B1 Linux App Service plan, a Standard Key Vault, and VNet integration. The pipeline refuses to use an existing resource group unless it carries the application's ownership tag.

### Low-cost pilot profile

The default pilot uses one shared B1 App Service plan and a private Burstable `Standard_B1ms` PostgreSQL server with 32 GiB storage, seven-day backups, and no geo-redundant backup or zone-redundant HA. This keeps the baseline small, but it is **not** an HA/production-SLA configuration. It can be upgraded in place after the end-to-end pilot is accepted. Azure charges continue while the resources run; check current West Europe prices in the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) before deploying. The pricing lookup available in this workspace did not return SKU prices.

### One-time identity and repository setup

Use a **new private repository** and the isolated resource group `rg-sapsc-pilot-weu` in `westeurope`. Do not reuse a production resource group. Create and tag this empty group once using an administrator identity that has permission to create resource groups:

```bash
az group create --name rg-sapsc-pilot-weu --location westeurope \
  --tags application=sap-supply-chain-security managedBy=github-actions environment=pilot
```

The GitHub deployment identity should have Owner only on this dedicated resource group so it can create narrowly scoped Key Vault role assignments. Do not grant it subscription-wide rights.

1. Register one single-tenant Microsoft Entra application for this API/SPA. Expose a delegated scope named `access_as_user` with App ID URI `api://<application-client-id>`. Add the app roles `SupplyChain.Reader`, `SupplyChain.Operator`, and `SupplyChain.Admin`; assign them to the intended users/service principals. Add the SPA redirect URI `https://<web-app-name>.azurewebsites.net` after the first deployment, and grant/admin-consent the delegated scope for the intended users. Set `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, and `API_SCOPE=api://<application-client-id>/access_as_user`.
2. Create an Azure deployment application/service principal for GitHub Actions. Add a federated credential with issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`, and subject `repo:<owner>/sentinel-supply-chain:ref:refs/heads/main`. Give it **Owner on this new resource group only** so Bicep can create the app's Key Vault role assignments; do not grant subscription-wide rights.
3. Configure the GitHub repository's Actions variables:
   - `AZURE_RESOURCE_GROUP=rg-sapsc-pilot-weu`
   - `AZURE_LOCATION=westeurope`
   - `DEPLOYMENT_PRINCIPAL_OBJECT_ID=<OIDC service-principal object ID>`
   - `ENTRA_TENANT_ID=<tenant ID>`
   - `ENTRA_CLIENT_ID=<API/SPA application client ID>`
   - `API_SCOPE=api://<application-client-id>/access_as_user`
4. Configure GitHub Actions secrets:
   - `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` for the OIDC service principal
   - `GHCR_USERNAME` and `GHCR_READ_TOKEN` (a read-only package token for App Service image pulls)
   - `POSTGRES_ADMIN_PASSWORD` (at least 20 characters; keep it only in GitHub Secrets and Key Vault)
5. Ensure the OIDC principal can deploy to the resource group and write secrets to the new Key Vault. Push to `main` to run tests, publish the images, preview, and deploy. The first deployment output includes the website and API URLs. Add the website URL as the Entra SPA redirect URI, grant consent, then use Integrations to configure the SAP Communication Arrangement and run the live test.

Never use a publish profile, database password, SAP secret, or GHCR token in source control or workflow logs. GHCR images remain private; only the minimum read permission is needed for App Service pulls. The PostgreSQL URL uses `sslmode=verify-full`.

### Endpoints and ingestion

All application API routes are under `/api/v1`; `/healthz` and `/readyz` are the only unauthenticated operational probes in Azure. In local development, browse `/docs` for exact request/response schemas. Tenant build ingestion uses `POST /api/v1/builds`; worker registration and heartbeat use `POST /api/v1/workers` and `POST /api/v1/workers/{worker_id}/heartbeat`. Production build release is deliberately not exposed as an app-side action.

## Azure design references

- [App Service custom containers](https://learn.microsoft.com/azure/app-service/configure-custom-container)
- [App Service authentication and authorization](https://learn.microsoft.com/azure/app-service/overview-authentication-authorization)
- [PostgreSQL Flexible Server private networking](https://learn.microsoft.com/azure/postgresql/flexible-server/concepts-networking-private)
- [Key Vault RBAC guide](https://learn.microsoft.com/azure/key-vault/general/rbac-guide)
- [GitHub Actions OIDC for Azure](https://learn.microsoft.com/azure/developer/github/connect-from-azure-openid-connect)
