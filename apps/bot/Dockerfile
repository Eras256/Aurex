# Multi-stage production Dockerfile for Aurex Bot
FROM node:20-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@9.1.4

# Copy workspace settings and codebases
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/bot/ ./apps/bot/

# Install dependencies and build all internal monorepo packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @arbitrage/core build
RUN pnpm --filter @arbitrage/config build
RUN pnpm --filter @arbitrage/testing build
RUN pnpm --filter bot build

# Production runner image
FROM node:20-alpine AS runner

WORKDIR /app
RUN npm install -g pnpm@9.1.4

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/bot/package.json ./apps/bot/

# Copy compiled bundles from build stage
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist

# Install production-only packages
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "apps/bot/dist/index.js"]
