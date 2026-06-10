# Pipeline worker (TS). This image needs the @resume/contracts workspace package
# at build time, so build with the REPO ROOT as the docker context (or a pre-built
# contracts dist copied in). The API owns DB migrations; the pipeline does not run them.
FROM node:22-alpine AS build
WORKDIR /repo
RUN npm install -g pnpm@9.12.0
# Expect repo-root build context: workspace manifest + contracts + pipeline.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY services/pipeline ./services/pipeline
RUN pnpm install --frozen-lockfile --filter @resume/contracts --filter @resume/pipeline
RUN pnpm --filter @resume/contracts build && pnpm --filter @resume/pipeline build

FROM node:22-alpine
WORKDIR /repo
RUN npm install -g pnpm@9.12.0
COPY --from=build /repo /repo
WORKDIR /repo/services/pipeline
CMD ["node", "dist/src/poller.js"]
