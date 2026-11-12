# Construir a partir da raiz do projeto: docker build -f apps/web/Dockerfile .
FROM node:20-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

FROM base AS build
# O Next grava os rewrites no build, então o endereço da API precisa existir aqui.
ARG API_URL=http://api:8080
ENV API_URL=$API_URL
RUN npm ci -w @makarios/web
COPY apps/web apps/web
RUN npm run build -w @makarios/web

FROM base AS deps
RUN npm ci --omit=dev -w @makarios/web

FROM node:20-bookworm-slim
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/package.json package.json
COPY --from=deps /app/apps/web/package.json apps/web/package.json
COPY --from=build /app/apps/web/next.config.mjs apps/web/next.config.mjs
COPY --from=build --chown=node:node /app/apps/web/.next apps/web/.next
USER node
WORKDIR /app/apps/web
EXPOSE 3002
CMD ["../../node_modules/.bin/next", "start", "-p", "3002"]
