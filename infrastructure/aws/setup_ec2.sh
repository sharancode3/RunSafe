#!/usr/bin/env bash
# ==============================================================================
# RunSafe AWS EC2 Host Provisioning & Deployment Script
# ==============================================================================
set -euo pipefail

echo "=================================================================="
echo " Starting RunSafe AWS EC2 Controlled Environment Setup..."
echo "=================================================================="

# 1. Update OS packages
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 2. Install Docker
if ! command -v docker &> /dev/null; then
    echo "[+] Installing Docker Engine..."
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker "$USER"
fi

# 3. Security: ensure UFW / iptables only allows HTTP (80) and SSH (22)
echo "[+] Configuring host firewall (allow 80, 22; block 5432)..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw deny 5432/tcp
    sudo ufw --force enable || true
fi

# 4. Clone / Deploy RunSafe repository
APP_DIR="/opt/runsafe"
echo "[+] Setting up RunSafe application directory at $APP_DIR..."
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR"

echo "=================================================================="
echo " Host provisioning completed."
echo " Next: Copy repository to $APP_DIR and execute:"
echo "   docker compose -f $APP_DIR/infrastructure/aws/docker-compose.yml up -d --build"
echo "=================================================================="
