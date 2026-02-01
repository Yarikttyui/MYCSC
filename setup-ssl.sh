#!/bin/bash
# ============================================
# MYCSC - SSL Setup Script for Domains
# adskoekoleso.ru & adskoekoleso.store
# ============================================

set -e

echo "=========================================="
echo "MYCSC SSL Certificate Setup"
echo "=========================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Создаем директории для SSL сертификатов
echo -e "${YELLOW}[1/5]${NC} Creating SSL directories..."
mkdir -p /opt/mycsc/ssl/adskoekoleso.ru
mkdir -p /opt/mycsc/ssl/adskoekoleso.store
mkdir -p /var/www/certbot

# Функция для получения сертификата Let's Encrypt
get_certificate() {
    DOMAIN=$1
    echo -e "${YELLOW}Getting certificate for ${DOMAIN}...${NC}"
    
    # Устанавливаем certbot если нет
    if ! command -v certbot &> /dev/null; then
        echo "Installing certbot..."
        apt update
        apt install -y certbot
    fi
    
    # Получаем сертификат (standalone mode, временно остановим nginx)
    docker-compose stop nginx 2>/dev/null || true
    
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email admin@${DOMAIN} \
        -d ${DOMAIN} \
        -d www.${DOMAIN}
    
    # Копируем сертификаты в нашу директорию
    if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
        cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /opt/mycsc/ssl/${DOMAIN}/
        cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem /opt/mycsc/ssl/${DOMAIN}/
        echo -e "${GREEN}Certificate for ${DOMAIN} installed!${NC}"
    else
        echo -e "${RED}Failed to get certificate for ${DOMAIN}${NC}"
        return 1
    fi
}

# Проверяем, нужно ли использовать сертификаты с Beget
echo -e "${YELLOW}[2/5]${NC} Checking for existing certificates..."

# Если сертификаты уже есть (например, загружены с Beget)
if [ -f "/opt/mycsc/ssl/adskoekoleso.ru/fullchain.pem" ]; then
    echo -e "${GREEN}Certificate for adskoekoleso.ru already exists${NC}"
else
    echo -e "${YELLOW}No certificate found for adskoekoleso.ru${NC}"
    echo "Do you want to:"
    echo "  1) Get new certificate from Let's Encrypt"
    echo "  2) Upload certificate manually from Beget"
    read -p "Choice [1/2]: " CHOICE
    
    if [ "$CHOICE" == "1" ]; then
        get_certificate "adskoekoleso.ru"
    else
        echo ""
        echo "Please upload certificates to:"
        echo "  /opt/mycsc/ssl/adskoekoleso.ru/fullchain.pem"
        echo "  /opt/mycsc/ssl/adskoekoleso.ru/privkey.pem"
        echo ""
        echo "You can use SCP to upload from your machine:"
        echo "  scp fullchain.pem root@31.129.98.56:/opt/mycsc/ssl/adskoekoleso.ru/"
        echo "  scp privkey.pem root@31.129.98.56:/opt/mycsc/ssl/adskoekoleso.ru/"
    fi
fi

if [ -f "/opt/mycsc/ssl/adskoekoleso.store/fullchain.pem" ]; then
    echo -e "${GREEN}Certificate for adskoekoleso.store already exists${NC}"
else
    echo -e "${YELLOW}No certificate found for adskoekoleso.store${NC}"
    echo "Do you want to:"
    echo "  1) Get new certificate from Let's Encrypt"
    echo "  2) Upload certificate manually from Beget"
    read -p "Choice [1/2]: " CHOICE
    
    if [ "$CHOICE" == "1" ]; then
        get_certificate "adskoekoleso.store"
    else
        echo ""
        echo "Please upload certificates to:"
        echo "  /opt/mycsc/ssl/adskoekoleso.store/fullchain.pem"
        echo "  /opt/mycsc/ssl/adskoekoleso.store/privkey.pem"
    fi
fi

# Устанавливаем правильные права
echo -e "${YELLOW}[3/5]${NC} Setting permissions..."
chmod 644 /opt/mycsc/ssl/*/fullchain.pem 2>/dev/null || true
chmod 600 /opt/mycsc/ssl/*/privkey.pem 2>/dev/null || true

# Создаём .env файл
echo -e "${YELLOW}[4/5]${NC} Creating environment file..."
cat > /opt/mycsc/.env << 'EOF'
# MYCSC Production Environment
NODE_ENV=production
PORT=3001
TCP_PORT=3002
DATA_DIR=/opt/mycsc/data

# Base URL (change to your domain)
BASE_URL=https://adskoekoleso.ru

# JWT Secret (CHANGE THIS!)
JWT_SECRET=your-super-secret-jwt-key-change-me

# OAuth - Google
GOOGLE_CLIENT_ID=160740603053-nfi30ppntvi45ab5f2hligv4nu26a0sk.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_SECRET

# OAuth - GitHub  
GITHUB_CLIENT_ID=Ov23li1MHiyddtC00Jtg
GITHUB_CLIENT_SECRET=YOUR_GITHUB_SECRET

# Email - Mail.ru
EMAIL_PASSWORD=YOUR_EMAIL_PASSWORD
EMAIL_FROM=mycsc@mail.ru
EOF

echo -e "${GREEN}Created /opt/mycsc/.env - Please edit with your secrets!${NC}"

# Настраиваем автообновление сертификатов
echo -e "${YELLOW}[5/5]${NC} Setting up certificate auto-renewal..."
cat > /etc/cron.d/mycsc-ssl-renew << 'EOF'
# Renew SSL certificates twice a day
0 0,12 * * * root certbot renew --quiet --post-hook "cp /etc/letsencrypt/live/*/fullchain.pem /opt/mycsc/ssl/*/ && cp /etc/letsencrypt/live/*/privkey.pem /opt/mycsc/ssl/*/ && docker-compose -f /opt/mycsc/docker-compose.yml restart nginx" 2>/dev/null || true
EOF

echo ""
echo -e "${GREEN}=========================================="
echo "SSL Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/mycsc/.env with your secrets"
echo "  2. Make sure DNS for domains points to 31.129.98.56"
echo "  3. Run: cd /opt/mycsc && docker-compose up -d"
echo ""
echo "DNS Records needed:"
echo "  adskoekoleso.ru     -> A Record -> 31.129.98.56"
echo "  www.adskoekoleso.ru -> A Record -> 31.129.98.56"
echo "  adskoekoleso.store  -> A Record -> 31.129.98.56"
echo "  www.adskoekoleso.store -> A Record -> 31.129.98.56"
