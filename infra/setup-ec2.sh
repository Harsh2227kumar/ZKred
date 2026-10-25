#!/usr/bin/env bash
# ========================================================
# ZKred — Fresh EC2 Server Setup Script
# Installs Docker, Compose v2, and prepares systemd
# Conforms to VERSION-PLAN.md V0-S4
# ========================================================

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
echo "==> Setup complete! Run 'newgrp docker' (or re-login) to apply docker group permissions."
