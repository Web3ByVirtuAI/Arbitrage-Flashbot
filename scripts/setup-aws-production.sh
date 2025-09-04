#!/bin/bash

# AWS EC2 Production Setup Script for Flash Loan Arbitrage Bot
# This script automates the deployment process on AWS EC2 T2 micro instances

set -e  # Exit on any error

echo "🚀 Starting AWS EC2 Production Setup for Flash Loan Arbitrage Bot"
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Ubuntu (AWS EC2 default)
if ! command -v lsb_release &> /dev/null || [[ $(lsb_release -si) != "Ubuntu" ]]; then
    print_error "This script is designed for Ubuntu. Please run on AWS EC2 Ubuntu instance."
    exit 1
fi

print_status "Detected Ubuntu $(lsb_release -sr) on $(uname -m) architecture"

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
sudo apt install -y curl wget git unzip build-essential htop nginx certbot python3-certbot-nginx

# Install Node.js 18.x LTS
print_status "Installing Node.js 18.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
print_status "Node.js $NODE_VERSION and npm $NPM_VERSION installed successfully"

# Install PM2 globally
print_status "Installing PM2 process manager..."
sudo npm install -g pm2

# Setup PM2 startup script
print_status "Configuring PM2 startup script..."
pm2 startup ubuntu -u ubuntu --hp /home/ubuntu
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup ubuntu -u ubuntu --hp /home/ubuntu

# Create necessary directories
print_status "Creating project directories..."
mkdir -p ~/backups
mkdir -p ~/logs
mkdir -p ~/.ssh

# Setup swap space for T2 micro (1GB RAM is limited)
print_status "Setting up swap space for T2 micro instance..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 1G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    print_status "1GB swap space created and enabled"
else
    print_warning "Swap file already exists"
fi

# Configure Git if not already configured
print_status "Checking Git configuration..."
if [ -z "$(git config --global user.name)" ]; then
    read -p "Enter your Git username: " git_username
    read -p "Enter your Git email: " git_email
    git config --global user.name "$git_username"
    git config --global user.email "$git_email"
    print_status "Git configured successfully"
fi

# Clone or update the flash loan bot repository
print_status "Setting up Flash Loan Arbitrage Bot..."
if [ -d "flash-loan-arbitrage-bot" ]; then
    print_warning "Directory already exists, pulling latest changes..."
    cd flash-loan-arbitrage-bot
    git pull origin main
else
    print_status "Please clone your repository manually:"
    echo "git clone https://github.com/YOUR-USERNAME/flash-loan-arbitrage-bot.git"
    echo "Then run: cd flash-loan-arbitrage-bot && ./scripts/setup-aws-production.sh --skip-clone"
    exit 0
fi

# Install project dependencies
print_status "Installing project dependencies..."
npm ci --production

# Build the project
print_status "Building the project..."
if [ -f "package.json" ] && grep -q "\"build\"" package.json; then
    npm run build
else
    print_warning "No build script found in package.json"
fi

# Setup environment configuration
print_status "Setting up environment configuration..."
if [ ! -f ".env.production" ]; then
    if [ -f ".env.production.example" ]; then
        cp .env.production.example .env.production
        chmod 600 .env.production
        print_warning "Copied .env.production.example to .env.production"
        print_warning "Please edit .env.production with your actual configuration:"
        echo "  - PRIVATE_KEY: Your wallet private key"
        echo "  - ETHEREUM_RPC_URL: Your Alchemy/Infura endpoint"
        echo "  - JWT_SECRET: Secure random string"
        echo "  - ADMIN_PASSWORD: Secure admin password"
    else
        print_error ".env.production.example not found. Please create environment configuration."
        exit 1
    fi
else
    print_status "Environment configuration already exists"
fi

# Setup firewall rules
print_status "Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw allow 3000/tcp  # Development access
sudo ufw --force enable
print_status "Firewall configured successfully"

# Setup fail2ban for SSH protection
print_status "Setting up fail2ban for SSH protection..."
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Create backup script
print_status "Creating automated backup script..."
cat > ~/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups
PROJECT_DIR=~/flash-loan-arbitrage-bot

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create backup
tar -czf $BACKUP_DIR/bot-backup-$DATE.tar.gz -C ~ flash-loan-arbitrage-bot

# Keep only last 7 days of backups
find $BACKUP_DIR -name "bot-backup-*.tar.gz" -mtime +7 -delete

# Log backup completion
echo "$(date): Backup completed - bot-backup-$DATE.tar.gz" >> $BACKUP_DIR/backup.log
EOF

chmod +x ~/backup.sh

# Setup cron job for daily backups
print_status "Setting up daily backup cron job..."
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/backup.sh") | crontab -

# Create startup script for the bot
print_status "Creating production startup script..."
cat > start-bot.sh << 'EOF'
#!/bin/bash

# Flash Loan Arbitrage Bot Startup Script
echo "Starting Flash Loan Arbitrage Bot..."

# Kill any existing processes on port 3000
sudo fuser -k 3000/tcp 2>/dev/null || true

# Wait a moment for processes to terminate
sleep 2

# Start with PM2
pm2 delete flash-loan-bot 2>/dev/null || true
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

echo "Bot started successfully!"
echo "Check status: pm2 status"
echo "Check logs: pm2 logs flash-loan-bot"
echo "Web interface: http://$(curl -s http://checkip.amazonaws.com):3000"
EOF

chmod +x start-bot.sh

# Create stop script
cat > stop-bot.sh << 'EOF'
#!/bin/bash
echo "Stopping Flash Loan Arbitrage Bot..."
pm2 delete flash-loan-bot 2>/dev/null || true
pm2 save
echo "Bot stopped successfully!"
EOF

chmod +x stop-bot.sh

# Setup Nginx reverse proxy configuration
print_status "Setting up Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/flash-loan-bot << 'EOF'
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout       60s;
        proxy_send_timeout          60s;
        proxy_read_timeout          60s;
    }

    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Rate limiting zone
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/flash-loan-bot /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# Create system monitoring script
print_status "Creating system monitoring script..."
cat > ~/monitor.sh << 'EOF'
#!/bin/bash

echo "=== Flash Loan Arbitrage Bot System Status ==="
echo "Date: $(date)"
echo ""

# System resources
echo "=== System Resources ==="
echo "Memory Usage:"
free -h
echo ""
echo "Disk Usage:"
df -h /
echo ""
echo "CPU Load:"
uptime
echo ""

# T2 micro specific - CPU credits (requires AWS CLI)
if command -v aws &> /dev/null; then
    echo "=== T2 Micro CPU Credits ==="
    INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
    aws cloudwatch get-metric-statistics \
        --namespace AWS/EC2 \
        --metric-name CPUCreditBalance \
        --dimensions Name=InstanceId,Value=$INSTANCE_ID \
        --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --statistics Average \
        --query 'Datapoints[0].Average' \
        --output text 2>/dev/null || echo "AWS CLI not configured"
    echo ""
fi

# PM2 status
echo "=== PM2 Process Status ==="
pm2 status
echo ""

# Bot API status
echo "=== Bot API Status ==="
curl -s -o /dev/null -w "HTTP Status: %{http_code} - Response Time: %{time_total}s\n" http://localhost:3000/api/health || echo "Bot API not responding"
echo ""

# Recent logs
echo "=== Recent Bot Logs ==="
pm2 logs flash-loan-bot --lines 10 --nostream 2>/dev/null || echo "No PM2 logs available"
EOF

chmod +x ~/monitor.sh

# Final setup verification
print_status "Verifying installation..."

# Check Node.js
node_ok=false
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    node_ok=true
    print_status "✓ Node.js and npm installed"
else
    print_error "✗ Node.js or npm not found"
fi

# Check PM2
pm2_ok=false
if command -v pm2 &> /dev/null; then
    pm2_ok=true
    print_status "✓ PM2 installed"
else
    print_error "✗ PM2 not found"
fi

# Check Nginx
nginx_ok=false
if command -v nginx &> /dev/null && sudo nginx -t &>/dev/null; then
    nginx_ok=true
    print_status "✓ Nginx installed and configured"
else
    print_error "✗ Nginx not properly configured"
fi

# Check project files
project_ok=false
if [ -f "package.json" ] && [ -f "ecosystem.config.cjs" ]; then
    project_ok=true
    print_status "✓ Project files present"
else
    print_error "✗ Missing project files"
fi

echo ""
echo "=================================================="
echo "🎉 AWS EC2 Production Setup Complete!"
echo "=================================================="

if [ "$node_ok" = true ] && [ "$pm2_ok" = true ] && [ "$nginx_ok" = true ] && [ "$project_ok" = true ]; then
    print_status "✅ All components installed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Edit .env.production with your configuration:"
    echo "   nano .env.production"
    echo ""
    echo "2. Start the bot:"
    echo "   ./start-bot.sh"
    echo ""
    echo "3. Check status:"
    echo "   pm2 status"
    echo "   ./monitor.sh"
    echo ""
    echo "4. Access web interface:"
    echo "   http://$(curl -s http://checkip.amazonaws.com):3000"
    echo ""
    echo "5. For SSL certificate (optional):"
    echo "   sudo certbot --nginx -d YOUR-DOMAIN.com"
    echo ""
    print_status "Your flash loan arbitrage bot is ready for production! 🚀"
else
    print_error "❌ Some components failed to install. Please check the errors above."
    exit 1
fi

# Display final system information
echo ""
echo "=== System Information ==="
echo "Instance Type: $(curl -s http://169.254.169.254/latest/meta-data/instance-type)"
echo "Public IP: $(curl -s http://checkip.amazonaws.com)"
echo "Private IP: $(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)"
echo "Available Zone: $(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone)"
echo "Memory: $(free -h | awk '/^Mem:/ {print $2}')"
echo "Storage: $(df -h / | awk 'NR==2 {print $2}')"
echo "Swap: $(free -h | awk '/^Swap:/ {print $2}')"
echo ""
echo "Happy trading! 💰"