# V0-S4 Implementation: EC2 Deployment & Live Production URL

## 1. Automation Scripts

### A. Server Setup Script (`infra/setup-ec2.sh`)
This script installs Docker, Docker Compose, Git, and enables system services on a fresh Ubuntu 24.04/22.04 LTS instance:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "==> [1/4] Updating package index and installing dependencies..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release git

echo "==> [2/4] Setting up official Docker GPG key and repository..."
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> [3/4] Enabling Docker daemon and granting user permissions..."
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker "$USER"

echo "==> [4/4] Docker installed successfully:"
docker --version
docker compose version
echo "==> Setup complete! Please log out and back in (or run 'newgrp docker') to apply group permissions."
```

---

### B. Deployment & Update Script (`infra/deploy.sh`)
Automates deploying or updating the ZKred stack on the EC2 host:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [ ! -f .env ]; then
  echo "Error: .env file missing in repository root!"
  echo "Copy .env.example to .env and configure DOMAIN, ACME_EMAIL, and database credentials."
  exit 1
fi

echo "==> [1/3] Pulling and building Docker images..."
docker compose pull --ignore-pull-failures || true
docker compose build

echo "==> [2/3] Starting containers..."
docker compose up -d --remove-orphans

echo "==> [3/3] Waiting for services to become healthy..."
sleep 10
docker compose ps

echo "==> Container status:"
docker compose logs --tail=20 backend
docker compose logs --tail=20 caddy

echo "==> Deployment complete!"
```

---

## 2. Step-by-Step EC2 Deployment Guide

### Step 1: AWS Console Launch
1. Launch instance:
   - **Name:** `zkred-demo-node`
   - **AMI:** Ubuntu 24.04 LTS
   - **Instance Type:** `t3.medium` (recommended) or `t3.small`
   - **Key Pair:** Create or select your key-pair (`zkred-key.pem`)
   - **Storage:** 25 GiB gp3
2. Security Group:
   - Port 22 (SSH) &rarr; `My IP`
   - Port 80 (HTTP) &rarr; `0.0.0.0/0`
   - Port 443 (HTTPS) &rarr; `0.0.0.0/0`

### Step 2: Connect & Initialize
```bash
ssh -i zkred-key.pem ubuntu@<EC2_PUBLIC_IP>
```
Clone the repository:
```bash
git clone https://github.com/Harsh2227kumar/ZKred.git
cd ZKred
```
Run the setup script:
```bash
chmod +x infra/setup-ec2.sh infra/deploy.sh
./infra/setup-ec2.sh
newgrp docker
```

### Step 3: Configure Environment
Copy `.env.example`:
```bash
cp .env.example .env
```
Edit `.env` (using nano or sed) with the server's public IP:
```bash
# If EC2 IP is 54.210.12.34:
DOMAIN=54.210.12.34.sslip.io
ACME_EMAIL=your-email@example.com
PUBLIC_BASE_URL=https://54.210.12.34.sslip.io
```

### Step 4: Launch the Stack
```bash
./infra/deploy.sh
```

---

## 3. Remote Smoke Verification
From your local machine or browser:
```bash
# Verify health endpoint returns 200 OK over HTTPS:
curl -i https://<EC2_PUBLIC_IP>.sslip.io/api/v1/health

# Verify frontend shell renders:
curl -i https://<EC2_PUBLIC_IP>.sslip.io/
```
Output must return HTTP 200 with JSON payload containing:
`{"status":"ok", "db":"ok", ...}`
