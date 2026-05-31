# Production Dockerfile for the Aurex Bot (single-stage, reliable monorepo build).
# Build context must be the repo ROOT so the shared workspace packages are included:
#   flyctl deploy . --config apps/bot/fly.toml --dockerfile apps/bot/Dockerfile
FROM node:20-alpine

WORKDIR /app
RUN npm install -g pnpm@9.1.4

# Workspace manifests + lockfile first (better layer caching).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./

# Shared packages and the bot app (apps/web is excluded via .dockerignore).
COPY packages/ ./packages/
COPY apps/bot/ ./apps/bot/

# Install the full workspace, then build every internal package and the bot so all
# dist/ outputs (@arbitrage/core, @arbitrage/config, @arbitrage/testing, bot) exist.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @arbitrage/core build \
 && pnpm --filter @arbitrage/config build \
 && pnpm --filter @arbitrage/testing build \
 && pnpm --filter bot build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "apps/bot/dist/index.js"]
