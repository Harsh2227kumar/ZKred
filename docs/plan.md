# V0-S4 Plan: AWS EC2 Deployment & Live Production URL

## Overview
- **Task ID:** `V0-S4` (per `md/VERSION-PLAN.md`)
- **Owner:** SPARSH
- **Target Output:** Operational EC2 instance running the ZKred stack via Docker Compose with automated HTTPS via Caddy and a verified live health endpoint.
- **Done When:** `https://<ip>.sslip.io/api/v1/health` (or configured domain) returns HTTP 200 with `{ "status": "ok", ... }` over valid SSL/TLS.

---

## 1. Cloud Architecture & Topology

```
             Internet Clients & Judges
                         │
                         ▼ (HTTPS :443)
              ┌─────────────────────┐
              │    AWS EC2 Instance │ (t3.small / t3.medium, Ubuntu 24.04)
              │  Security Group:    │ Ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
              │  Public Elastic IP  │ DNS: <ec2-ip>.sslip.io
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Caddy Container   │ Auto-ACME Let's Encrypt SSL
              └────┬────────────┬───┘
                   │            │
       /api/v1/*   │            │  /* (SPA) & /zk/* (Groth16 ZK binaries)
                   ▼            ▼
         ┌──────────────┐  ┌──────────────────┐
         │   Backend    │  │  Frontend Assets │
         │  (Node 22)   │  │  + circuits/build│
         └───────┬──────┘  └──────────────────┘
                 │
                 ▼
         ┌──────────────┐
         │ Postgres 16  │ (Persistent Volume: zkred_pgdata)
         └──────────────┘
```

---

## 2. Implementation Steps

### Step 1: EC2 Instance Provisioning & Networking
1. **AMI & Instance Type:**
   - Ubuntu 24.04 LTS (x86_64).
   - Instance Size: `t3.small` (2 vCPU, 2GB RAM) or `t3.medium` (2 vCPU, 4GB RAM recommended for compiling inside Docker).
   - Storage: 25 GB gp3 SSD.
2. **Security Group Inbound Rules:**
   - `SSH` (TCP 22): My IP (or 0.0.0.0/0 with key-pair authentication).
   - `HTTP` (TCP 80): 0.0.0.0/0 (Required for ACME HTTP-01 challenge).
   - `HTTPS` (TCP 443): 0.0.0.0/0 (Production encrypted web traffic).

### Step 2: Automated Server Initialization Script (`infra/setup-ec2.sh`)
- Prepares fresh Ubuntu server:
  - Updates apt cache and installs prerequisites (`curl`, `git`, `ca-certificates`).
  - Installs official Docker Engine and Docker Compose v2 plugin.
  - Adds non-root `ubuntu` user to the `docker` group.
  - Enables and starts `docker.service`.

### Step 3: Zero-Cost Wildcard DNS via `sslip.io`
- Avoids domain purchase delays during hackathon.
- Mapping: If EC2 public IP is `54.210.12.34`, domain is set to `54.210.12.34.sslip.io`.
- Caddy connects to Let's Encrypt, completes the HTTP-01 challenge, and issues a trusted SSL certificate automatically.

### Step 4: Environment & Service Launch (`infra/deploy.sh`)
- Automated deployment script:
  - Clones or pulls the latest repository branch (`dev` or `main`).
  - Populates `.env` using `.env.example` with EC2 domain and production secrets.
  - Executes `docker compose up -d --build`.
  - Runs local smoke tests to ensure `zkred-backend`, `zkred-db`, and `zkred-caddy` are healthy.

### Step 5: Verification & Gate G0 Sign-off
- Perform remote curl smoke check:
  `curl -s https://<ec2-ip>.sslip.io/api/v1/health`
- Confirm frontend shell loads in browser at `https://<ec2-ip>.sslip.io/`.
