# syntax=docker/dockerfile:1.7
# API image (DEPLOYMENT.md §3). Build context is the repository root:
#   docker build -f apps/api/Dockerfile .
# The stages were verified by replaying them locally without Docker (prune → install → build →
# production install → boot → migrate deploy); see IMPLEMENTATION_PLAN.md §4, Phase 4.

ARG NODE_IMAGE=node:24.22.1-bookworm-slim

FROM ${NODE_IMAGE} AS base
# OpenSSL is required by Prisma's schema engine, which the pre-deploy `migrate deploy` runs.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@11.20.0 \
  && npm cache clean --force
WORKDIR /repo

# 1. Only the API and the workspace packages it depends on. `turbo prune` skips git-ignored files
#    (.env, dist, node_modules), and .dockerignore keeps them out of the build context too.
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.11.10 prune @pos/api --docker

# 2. Install from the lockfile (layer cached by the manifests), build, then keep production
#    dependencies only. `prisma` is a dependency of @pos/database, so migrations still run.
FROM base AS build
ENV CI=true
COPY --from=prune /repo/out/json/ ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY --from=prune /repo/out/full/ ./
RUN pnpm exec turbo run build --filter=@pos/api
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --prod --frozen-lockfile --store-dir /pnpm/store

# 3. Runtime: non-root, production mode. Railway injects PORT and the secrets (DEPLOYMENT.md §4).
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /repo /repo
USER node
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
