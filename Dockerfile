# Imagem única do monorepo, com um alvo por app: `--target api` e `--target web`.

FROM node:22-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# ------------------------------------------------------------ build
FROM base AS build
# Ferramentas para compilar o better-sqlite3 caso não haja binário pronto.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm ci
COPY apps ./apps
# As regras de rewrite do Next (/api → API) são gravadas no build.
ARG API_URL=http://api:8080
ENV API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ------------------------------------------------------------ dependências de produção
FROM build AS deps-api
RUN rm -rf node_modules apps/*/node_modules && npm ci --omit=dev -w @makarios/api

FROM build AS deps-web
RUN rm -rf node_modules apps/*/node_modules && npm ci --omit=dev -w @makarios/web

# ------------------------------------------------------------ api
FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production PORT=8080 DATABASE_FILE=/data/makarios.db TZ=America/Sao_Paulo
WORKDIR /app/apps/api
COPY --from=deps-api /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/package.json ./
COPY --from=build /app/apps/api/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
CMD ["node", "dist/main.js"]

# ------------------------------------------------------------ web
FROM node:22-bookworm-slim AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 TZ=America/Sao_Paulo
WORKDIR /app/apps/web
COPY --from=deps-web /app/node_modules /app/node_modules
COPY --from=build /app/apps/web/package.json /app/apps/web/next.config.mjs ./
COPY --from=build /app/apps/web/.next ./.next
USER node
EXPOSE 3002
CMD ["/app/node_modules/.bin/next", "start", "-p", "3002"]
