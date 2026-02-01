#!/bin/bash
# ============================================
# MYCSC - Complete Deployment Script
# Ubuntu 24.04 with Docker + Nginx SSL
# ============================================

set -e

echo "=========================================="
echo "MYCSC Database Deployment"
echo "=========================================="

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Обновление системы
echo -e "${YELLOW}[1/8]${NC} Updating system packages..."
apt update && apt upgrade -y

# Установка Docker
echo -e "${YELLOW}[2/8]${NC} Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Docker Compose
if ! command -v docker-compose &> /dev/null; then
    apt install -y docker-compose-plugin
    ln -sf /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose || true
fi

echo "Docker version: $(docker --version)"

# Создание директорий
echo -e "${YELLOW}[3/8]${NC} Creating directories..."
mkdir -p /opt/mycsc
mkdir -p /opt/mycsc/data
mkdir -p /opt/mycsc/ssl/adskoekoleso.ru
mkdir -p /opt/mycsc/ssl/adskoekoleso.store
mkdir -p /var/www/certbot

# Настройка firewall
echo -e "${YELLOW}[4/8]${NC} Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3002/tcp
ufw --force enable

# Установка Certbot для Let's Encrypt
echo -e "${YELLOW}[5/8]${NC} Installing Certbot..."
apt install -y certbot

# Создание .env файла
echo -e "${YELLOW}[6/8]${NC} Creating environment config..."
if [ ! -f /opt/mycsc/.env ]; then
cat > /opt/mycsc/.env << 'EOF'
# MYCSC Production Environment
NODE_ENV=production
PORT=3001
TCP_PORT=3002
DATA_DIR=/opt/mycsc/data
BASE_URL=https://adskoekoleso.ru

# JWT Secret - CHANGE THIS!
JWT_SECRET=mycsc-production-secret-change-me-please

# OAuth - Google
GOOGLE_CLIENT_ID=160740603053-nfi30ppntvi45ab5f2hligv4nu26a0sk.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=

# OAuth - GitHub
GITHUB_CLIENT_ID=Ov23li1MHiyddtC00Jtg
GITHUB_CLIENT_SECRET=

# Email - Mail.ru SMTP
EMAIL_PASSWORD=
EMAIL_FROM=mycsc@mail.ru
EOF
echo -e "${GREEN}Created /opt/mycsc/.env${NC}"
else
echo -e "${GREEN}.env already exists${NC}"
fi

# Инструкции по SSL
echo -e "${YELLOW}[7/8]${NC} SSL Certificate Instructions..."
echo ""
echo "For SSL certificates, you have two options:"
echo ""
echo "Option 1: Let's Encrypt (automatic, free)"
echo "  Run after DNS is configured:"
echo "  certbot certonly --standalone -d adskoekoleso.ru -d www.adskoekoleso.ru"
echo "  certbot certonly --standalone -d adskoekoleso.store -d www.adskoekoleso.store"
echo "  Then copy certificates:"
echo "  cp /etc/letsencrypt/live/adskoekoleso.ru/* /opt/mycsc/ssl/adskoekoleso.ru/"
echo "  cp /etc/letsencrypt/live/adskoekoleso.store/* /opt/mycsc/ssl/adskoekoleso.store/"
echo ""
echo "Option 2: Upload from Beget"
echo "  SCP your fullchain.pem and privkey.pem to:"
echo "  /opt/mycsc/ssl/adskoekoleso.ru/"
echo "  /opt/mycsc/ssl/adskoekoleso.store/"
echo ""

# Финальные инструкции
echo -e "${YELLOW}[8/8]${NC} Setup complete!"
echo ""
echo -e "${GREEN}=========================================="
echo "Deployment Ready!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure DNS A records:"
echo "   adskoekoleso.ru      -> 31.129.98.56"
echo "   www.adskoekoleso.ru  -> 31.129.98.56"
echo "   adskoekoleso.store   -> 31.129.98.56"
echo "   www.adskoekoleso.store -> 31.129.98.56"
echo ""
echo "2. Edit secrets in /opt/mycsc/.env"
echo ""
echo "3. Upload SSL certificates (or run certbot)"
echo ""
echo "4. Upload and start application:"
echo "   cd /opt/mycsc"
echo "   docker-compose up -d --build"
echo ""
echo "5. Check status:"
echo "   docker-compose ps"
echo "   docker-compose logs -f"
echo ""
