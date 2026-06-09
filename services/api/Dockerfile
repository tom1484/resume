# Build context = repo root (see deploy/docker-compose.yml).
#
# v2 NOTE (Agent C / integrator): the static SPA layout changed. v1 built two
# apps (apps/site renderer at /resume/, apps/review SPA at /). v2 serves ONE
# unified dashboard SPA at / (apps/dashboard/build) PLUS the bare résumé render
# path at /resume/ (apps/site/build). `apps/dashboard` is built later by the
# dashboard agent — until it exists, the dashboard `pnpm --filter dashboard build`
# step below will fail; the integrator wires it at merge once the app lands.
# This Dockerfile is otherwise complete for the v2 API runtime (TS build +
# migrations + co-located static assets).

# Stage 1: build the contracts spine, the API (TS → dist), and the SPAs.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/renderer/package.json packages/renderer/
COPY apps/site/package.json apps/site/
COPY apps/dashboard/package.json apps/dashboard/
COPY services/api/package.json services/api/
RUN pnpm install --frozen-lockfile
COPY data data
COPY scripts scripts
COPY packages packages
COPY apps apps
COPY services/api services/api
# contracts must build first (every package imports its dist/).
RUN pnpm --filter @resume/contracts build
RUN pnpm --filter @resume/api build
# Bare résumé render path at /resume/, unified dashboard SPA at /.
RUN VITE_BASE=/resume/ pnpm --filter site build && pnpm --filter dashboard build

# Stage 2: API runtime — compiled dist + runtime deps + .sql migrations + static.
FROM node:22-alpine
WORKDIR /app
# Runtime deps installed BY NAME. The api package.json uses `@resume/contracts:
# workspace:*`, which a plain `npm install` cannot resolve (that was the v1-image
# bug: it failed and `|| true` masked it, leaving `pg` etc. missing at runtime).
# These are the api's direct prod deps + @resume/contracts's own runtime deps
# (zod, fast-json-patch), pinned to the package.json ranges. Their transitive
# deps (pino, etc.) come along.
RUN npm install --no-save --no-package-lock --omit=dev \
      fastify@^5.2.0 @fastify/static@^8.0.0 pg@^8.16.0 zod@^4.4.3 fast-json-patch@^3.1.1
# @resume/contracts (workspace pkg) as a real dir, AFTER the install so npm
# doesn't touch it. Its deps (zod/fast-json-patch) resolve from node_modules above.
COPY --from=build /repo/packages/contracts/dist ./node_modules/@resume/contracts/dist
COPY --from=build /repo/packages/contracts/package.json ./node_modules/@resume/contracts/package.json
COPY --from=build /repo/services/api/dist ./dist
# .sql files are not compiled by tsc — co-locate them next to the compiled runner.
COPY --from=build /repo/services/api/migrations/*.sql ./dist/migrations/
COPY --from=build /repo/apps/site/build ./site
COPY --from=build /repo/apps/dashboard/build ./dashboard
ENV APP_STATIC_ROOT=/app
# server.ts applies DB migrations at startup, then listens on :8080.
CMD ["node", "dist/src/server.js"]
