# syntax=docker/dockerfile:1
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-slim AS runner
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0
WORKDIR /app
RUN printf '{"name":"bb-runtime","private":true,"type":"module"}' > package.json \
 && npm i --omit=dev --no-audit --no-fund pg@8 && npm cache clean --force
COPY --from=build /app/.output ./.output
COPY migrations ./migrations
COPY scripts/migrate.mjs scripts/migration-plan.mjs scripts/azure-entry.mjs ./scripts/
RUN chown -R node:node /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/azure-entry.mjs"]
