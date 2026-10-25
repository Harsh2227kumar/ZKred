# V0-S2 Implementation Details: Container Infrastructure

## 1. File Structure Overview
```
ZKred/
├── docker-compose.yml                  # Root compose definition
├── infra/
│   ├── docker/
│   │   ├── backend.Dockerfile          # Node 22 Alpine multi-stage build
│   │   └── frontend.Dockerfile         # Vite multi-stage build
│   └── caddy/
│       └── Caddyfile                   # Reverse proxy, SPA routing, SSL, ZK static
├── docs/
│   ├── plan.md                         # Plan document for V0-S2
│   └── implementation.md               # This implementation document
└── md/progress/SPARSH-PROGRESS.md      # Work log
```

---

## 2. Dockerfile Specifications

### A. `infra/docker/backend.Dockerfile`
The backend requires `@zkred/zk-core` as a workspace dependency. To build efficiently and cleanly without copying unnecessary local files, the build context is set to the repo root `.`:

```dockerfile
# Stage 1: Build workspace packages
FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@10

# Monorepo configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/zk-core ./packages/zk-core
COPY backend ./backend

# Install dependencies strictly with lockfile
RUN pnpm install --frozen-lockfile

# Build zk-core first, then backend
RUN pnpm --filter @zkred/zk-core build
RUN pnpm --filter backend build

# Stage 2: Production runner
FROM node:22-alpine AS runner

WORKDIR /app
RUN npm install -g pnpm@10

ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY --from=builder /app/packages/zk-core/dist ./packages/zk-core/dist
COPY --from=builder /app/packages/zk-core/package.json ./packages/zk-core/package.json
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY backend/drizzle ./backend/drizzle

# Production dependencies only
RUN pnpm install --prod --frozen-lockfile

USER node
EXPOSE 8080

CMD ["node", "backend/dist/main.js"]
```

---

### B. `infra/docker/frontend.Dockerfile`
The frontend is compiled to static HTML/JS/CSS assets with Vite and served through Caddy:

```dockerfile
# Stage 1: Build frontend
FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@10

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY frontend ./frontend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter frontend build

# Stage 2: Static assets export
FROM alpine:3.20 AS runner
WORKDIR /srv/frontend
COPY --from=builder /app/frontend/dist /srv/frontend
CMD ["sleep", "infinity"]
```

---

### C. `infra/caddy/Caddyfile`
Caddy handles HTTPS termination, acts as the API reverse proxy, routes circuit artifacts with CORS headers, and provides SPA client-side fallback:

```caddy
{
    admin off
    auto_https off # Or on when DOMAIN is a valid public FQDN
}

# Site block using environment variable with localhost fallback
{$DOMAIN:localhost} {
    encode gzip zstd

    # Security headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # ZK Circom Artifacts (static files served directly with permissive CORS)
    handle /zk/* {
        uri strip_prefix /zk
        root * /srv/zk
        file_server
        header Access-Control-Allow-Origin *
    }

    # API Proxy to backend Express container
    handle /api/* {
        reverse_proxy backend:8080 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
        }
    }

    # Frontend Single Page App (SPA) handler
    handle {
        root * /srv/frontend
        try_files {path} /index.html
        file_server
    }
}
```

---

### D. `docker-compose.yml`
Root orchestration definition:

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: zkred-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-zkred}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-zkred_dev_pass}
      POSTGRES_DB: ${POSTGRES_DB:-zkred}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-zkred} -d ${POSTGRES_DB:-zkred}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - zkred-net

  backend:
    build:
      context: .
      dockerfile: infra/docker/backend.Dockerfile
    container_name: zkred-backend
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-zkred}:${POSTGRES_PASSWORD:-zkred_dev_pass}@db:5432/${POSTGRES_DB:-zkred}
      PORT: 8080
      ZK_ARTIFACTS_DIR: /app/circuits/build
    volumes:
      - ./circuits/build:/app/circuits/build:ro
    networks:
      - zkred-net

  frontend:
    build:
      context: .
      dockerfile: infra/docker/frontend.Dockerfile
    container_name: zkred-frontend
    volumes:
      - frontend_dist:/srv/frontend
    networks:
      - zkred-net

  caddy:
    image: caddy:2-alpine
    container_name: zkred-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      DOMAIN: ${DOMAIN:-localhost}
      ACME_EMAIL: ${ACME_EMAIL:-}
    volumes:
      - ./infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - frontend_dist:/srv/frontend:ro
      - ./circuits/build:/srv/zk:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - backend
      - frontend
    networks:
      - zkred-net

volumes:
  pgdata:
  frontend_dist:
  caddy_data:
  caddy_config:

networks:
  zkred-net:
    driver: bridge
```

---

## 3. Verification Sequence
1. **Config Validation**:
   `docker compose config`
2. **Build Test**:
   `docker compose build`
3. **Hardcoded Secrets & Path Check**:
   `bash scripts/check-hardcoded.sh`
4. **Ownership Verification**:
   Ensure only `infra/`, `docker-compose.yml`, `docs/`, and `md/progress/SPARSH-PROGRESS.md` are touched.
