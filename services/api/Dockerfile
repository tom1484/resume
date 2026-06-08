# Build context = repo root (see deploy/docker-compose.yml).
# Stage 1: build the resume renderer (base /resume/) and the review SPA.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/renderer/package.json packages/renderer/
COPY apps/site/package.json apps/site/
COPY apps/review/package.json apps/review/
COPY services/api/package.json services/api/
RUN pnpm install --frozen-lockfile
COPY data data
COPY packages/renderer packages/renderer
COPY apps/site apps/site
COPY apps/review apps/review
RUN VITE_BASE=/resume/ pnpm --filter site build && pnpm --filter review build

# Stage 2: API runtime with built static assets co-located.
FROM node:22-alpine
WORKDIR /app
COPY services/api/package.json ./
RUN npm install --omit=dev
COPY services/api/src ./src
COPY --from=build /repo/apps/site/build ./site
COPY --from=build /repo/apps/review/build ./review
CMD ["node", "src/server.js"]
