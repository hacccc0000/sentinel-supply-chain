#!/usr/bin/env bash
# BuildBouncer — one-shot Azure setup (run in Azure Cloud Shell, bash). Low-cost: B1 plan + Burstable B1ms Postgres.
# Usage:  curl -fsSL <raw url> | bash     or paste this file.
# Optional env before running:  APP=bb-demo-123  LOCATION=centralindia  ADMIN_EMAIL=you@x.com  ADMIN_PASSWORD='StrongPass123'
#   GHCR_USER / GHCR_PAT  (only if the GHCR package is private; a PAT with read:packages)
set -euo pipefail
RAND=$(openssl rand -hex 3)
APP=${APP:-buildbouncer-$RAND}
RG=${RG:-rg-buildbouncer}
LOCATION=${LOCATION:-centralindia}
PG=${PG:-pg-$APP}
DB=buildbouncer
PGUSER=bbadmin
PGPASS=${PGPASS:-"Bb$(openssl rand -hex 10)9x"}
IMAGE=${IMAGE:-ghcr.io/hacccc0000/sentinel-supply-chain:latest}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@buildbouncer.io}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-"Bb$(openssl rand -hex 6)Aa1"}
SESSION_SECRET=$(openssl rand -hex 32)
SIGNING_KEY=$(openssl rand -hex 32)

az group create -n "$RG" -l "$LOCATION" -o none
echo "→ PostgreSQL Flexible Server (Burstable B1ms)…"
az postgres flexible-server create -g "$RG" -n "$PG" -l "$LOCATION" --tier Burstable --sku-name Standard_B1ms \
  --storage-size 32 --version 16 --admin-user "$PGUSER" --admin-password "$PGPASS" --public-access 0.0.0.0 --yes -o none
az postgres flexible-server db create -g "$RG" -s "$PG" -d "$DB" -o none
echo "→ App Service plan (Linux B1) + Web App…"
az appservice plan create -g "$RG" -n "plan-$APP" --is-linux --sku B1 -o none
az webapp create -g "$RG" -p "plan-$APP" -n "$APP" --container-image-name "$IMAGE" -o none
if [ -n "${GHCR_PAT:-}" ]; then
  az webapp config container set -g "$RG" -n "$APP" --container-image-name "$IMAGE" \
    --container-registry-url https://ghcr.io --container-registry-user "${GHCR_USER:?set GHCR_USER}" --container-registry-password "$GHCR_PAT" -o none
fi
DBURL="postgresql://$PGUSER:$PGPASS@$PG.postgres.database.azure.com:5432/$DB?sslmode=require"
az webapp config appsettings set -g "$RG" -n "$APP" -o none --settings \
  WEBSITES_PORT=8080 PORT=8080 WEBSITES_CONTAINER_START_TIME_LIMIT=600 WEBSITES_ENABLE_APP_SERVICE_STORAGE=false \
  DATABASE_URL="$DBURL" SESSION_SECRET="$SESSION_SECRET" SIGNING_KEY="$SIGNING_KEY" \
  ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" ALLOW_SIGNUP=true SIGNUP_ROLE=operator \
  PUBLIC_URL="https://$APP.azurewebsites.net"
az webapp config set -g "$RG" -n "$APP" --always-on true --health-check-path /api/health --http20-enabled true -o none
az webapp update -g "$RG" -n "$APP" --https-only true -o none
az webapp log config -g "$RG" -n "$APP" --docker-container-logging filesystem -o none
az webapp deployment list-publishing-profiles -g "$RG" -n "$APP" --xml > publish-profile.xml

cat <<OUT

════════════════ DONE ════════════════
App URL           : https://$APP.azurewebsites.net
Admin login       : $ADMIN_EMAIL / $ADMIN_PASSWORD
Postgres          : $PG.postgres.database.azure.com  (user $PGUSER, password $PGPASS)

GitHub → repo Settings → Secrets and variables → Actions:
  Variable  AZURE_WEBAPP_NAME            = $APP
  Secret    AZURE_WEBAPP_PUBLISH_PROFILE = (contents of publish-profile.xml — run: cat publish-profile.xml)

Make the GHCR package public after the first workflow run (github.com → profile → Packages → sentinel-supply-chain
→ Package settings → Change visibility → Public) — or re-run this script with GHCR_USER/GHCR_PAT.
Then restart:  az webapp restart -g $RG -n $APP
Logs:           az webapp log tail -g $RG -n $APP
══════════════════════════════════════
OUT
