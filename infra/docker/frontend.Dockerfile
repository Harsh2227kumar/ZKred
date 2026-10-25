# ========================================================
# ZKred Frontend Dockerfile (Multi-stage Vite SPA Build)
# Compiles Vite React 19 app and exports static assets
# ========================================================

# Stage 1: Build the production static distribution
FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@10

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY frontend ./frontend

# Install dependencies strictly with lockfile
RUN pnpm install --frozen-lockfile

# Compile production bundle to /app/frontend/dist
RUN pnpm --filter frontend build

# Stage 2: Distribute to Caddy web server volume
FROM alpine:3.20 AS runner

WORKDIR /srv/frontend
COPY --from=builder /app/frontend/dist /dist

# Copy freshly built assets into the shared volume mount point on startup
CMD ["sh", "-c", "cp -rf /dist/* /srv/frontend/ && echo 'Frontend assets synchronized to volume' && sleep infinity"]
