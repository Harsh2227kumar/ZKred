# ========================================================
# ZKred Frontend Dockerfile (Multi-stage Vite SPA Build)
# Compiles Vite React 19 app and exports static assets
# ========================================================

# Stage 1: Build the production static distribution
FROM node:22-alpine AS builder

WORKDIR /app
# Same pnpm as the root package.json "packageManager" field.
RUN npm install -g pnpm@12.15.0

# Vite inlines VITE_* values into the public bundle at build time (frontend/.env is not in git).
# Only public values belong here: paths behind Caddy, never secrets.
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_ZK_ARTIFACTS_BASE_URL=/zk
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_ZK_ARTIFACTS_BASE_URL=$VITE_ZK_ARTIFACTS_BASE_URL

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY frontend ./frontend
# The wallet builds proofs in the browser with @zkred/zk-core (workspace package, bundled by Vite).
COPY packages/zk-core ./packages/zk-core

# Install dependencies strictly with lockfile
RUN pnpm install --frozen-lockfile

# Compile production bundle to /app/frontend/dist
RUN pnpm --filter frontend build

# Stage 2: Distribute to Caddy web server volume
FROM alpine:3.20 AS runner

WORKDIR /srv/frontend
COPY --from=builder /app/frontend/dist /dist

# Replace the shared volume's contents with this build on startup (drops stale hashed assets from older builds)
CMD ["sh", "-c", "rm -rf /srv/frontend/* && cp -rf /dist/* /srv/frontend/ && echo 'Frontend assets synchronized to volume' && sleep infinity"]
