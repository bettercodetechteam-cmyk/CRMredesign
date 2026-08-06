#!/bin/bash
# One-time AWS Lightsail / EC2 setup for Zica-Zima CRM (Ubuntu 22.04)
# Run on a fresh server as ubuntu user: bash aws-server-setup.sh

set -e

echo "=== Zica-Zima CRM — AWS server setup ==="

sudo apt update && sudo apt upgrade -y

# Node.js 20
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

sudo apt install -y nginx git

if ! command -v pm2 &>/dev/null; then
  sudo npm install -g pm2
fi

# Firewall (ufw) — optional; Lightsail also has its own firewall in the console
if command -v ufw &>/dev/null; then
  sudo ufw allow OpenSSH
  sudo ufw allow 'Nginx Full'
  sudo ufw --force enable || true
fi

echo ""
echo "=== Setup complete ==="
echo "Node: $(node -v)"
echo "npm:  $(npm -v)"
echo ""
echo "Next steps:"
echo "  1. Clone repo to /home/ubuntu/Zica-Zima-CRM"
echo "  2. Create .env and client/.env (see .env.aws.example)"
echo "  3. Run: bash scripts/deploy-aws.sh"
echo "  4. Copy scripts/aws-nginx-crm.conf to /etc/nginx/sites-available/crm and reload nginx"
echo "  5. Add GoDaddy A record: crm -> this server's public IP"
echo "  6. Run: sudo certbot --nginx -d crm.zicazimapcmc.com"
