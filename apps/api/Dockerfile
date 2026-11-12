# Construir a partir da raiz do projeto: docker build -f apps/api/Dockerfile .
FROM node:20-bookworm-slim AS base
# Necessário caso o better-sqlite3 precise ser compilado.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

FROM base AS build
RUN npm ci -w @makarios/api
COPY apps/api apps/api
RUN npm run build -w @makarios/api

FROM base AS deps
RUN npm ci --omit=dev -w @makarios/api

FROM node:20-bookworm-slim
ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_FILE=/app/apps/api/data/makarios.db
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/package.json package.json
COPY --from=deps /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
# A pasta já pertence a "node" para o volume herdar o dono.
RUN mkdir -p apps/api/data && chown node:node apps/api/data
USER node
WORKDIR /app/apps/api
EXPOSE 8080
CMD ["node", "dist/main.js"]
