# ========================================================
# ZKred Backend Dockerfile (Multi-stage Node 22 Alpine)
# Builds workspace @zkred/zk-core and backend API
# ========================================================

# Stage 1: Dependency resolution and compilation
FROM node:22-alpine AS builder

WORKDIR /app
# Same pnpm as the root package.json "packageManager" field.
RUN npm install -g pnpm@12.15.0

# Copy root monorepo manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

# Copy packages required for backend build
COPY packages/zk-core ./packages/zk-core
COPY backend ./backend

# Install dependencies strictly with lockfile
RUN pnpm install --frozen-lockfile

# Stage 2: Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app
RUN npm install -g pnpm@12.15.0

ENV NODE_ENV=production

# Copy workspace configuration and installed modules from builder
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/zk-core ./packages/zk-core
COPY --from=builder /app/backend ./backend

EXPOSE 8080

# Run migrations automatically, then start the Express server
CMD ["sh", "-c", "pnpm --filter backend db:migrate && pnpm --filter backend start"]
