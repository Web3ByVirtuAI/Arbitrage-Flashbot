#!/bin/bash

# =====================================================
# FLASH LOAN ARBITRAGE BOT - PRODUCTION SETUP SCRIPT
# =====================================================

set -e  # Exit on any error

echo "🚀 Flash Loan Arbitrage Bot - Production Setup"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_error "This script should not be run as root for security reasons"
   exit 1
fi

# Create necessary directories
log_info "Creating necessary directories..."
mkdir -p logs
mkdir -p backups
mkdir -p config
chmod 755 logs backups config

# Set up environment file
log_info "Setting up environment configuration..."
if [ ! -f .env ]; then
    cp .env.production.example .env
    chmod 600 .env  # Restrict permissions
    log_warning "Created .env file from template. Please edit it with your actual values!"
    log_warning "File location: $(pwd)/.env"
    log_warning "Remember to:"
    log_warning "1. Add your private key and wallet address"
    log_warning "2. Add your RPC URLs (Alchemy/Infura)"
    log_warning "3. Configure notification settings"
    log_warning "4. Review trading parameters"
else
    log_success ".env file already exists"
fi

# Validate Node.js version
log_info "Checking Node.js version..."
NODE_VERSION=$(node --version | cut -c2-)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then 
    log_success "Node.js version $NODE_VERSION is compatible"
else
    log_error "Node.js version $NODE_VERSION is too old. Required: $REQUIRED_VERSION or higher"
    exit 1
fi

# Install dependencies
log_info "Installing production dependencies..."
npm ci --only=production
log_success "Dependencies installed"

# Build the project
log_info "Building TypeScript project..."
npm run build
log_success "Project built successfully"

# Set up PM2 ecosystem
log_info "Configuring PM2 ecosystem..."
cat > ecosystem.config.production.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'flashbot-main',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_file: './logs/flashbot-combined.log',
      out_file: './logs/flashbot-out.log',
      error_file: './logs/flashbot-error.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'flashbot-opportunity-scanner',
      script: 'dist/scripts/opportunity-scanner.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      log_file: './logs/scanner-combined.log',
      out_file: './logs/scanner-out.log',
      error_file: './logs/scanner-error.log',
      time: true,
      max_memory_restart: '512M',
      restart_delay: 2000,
      max_restarts: 5
    }
  ]
}
EOF
log_success "PM2 ecosystem configuration created"

# Set up log rotation
log_info "Setting up log rotation..."
cat > config/logrotate.conf << 'EOF'
logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF
log_success "Log rotation configured"

# Create startup script
log_info "Creating startup script..."
cat > start-production.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting Flash Loan Arbitrage Bot in Production Mode"

# Load environment variables
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.production.example to .env and configure it"
    exit 1
fi

# Source the environment
set -a
source .env
set +a

# Validate critical environment variables
if [ -z "$PRIVATE_KEY" ] || [ "$PRIVATE_KEY" = "0xYOUR_64_CHARACTER_PRIVATE_KEY_HERE" ]; then
    echo "❌ Error: PRIVATE_KEY not configured in .env file"
    exit 1
fi

if [ -z "$RPC_URL_MAINNET" ] || [[ "$RPC_URL_MAINNET" == *"YOUR_"* ]]; then
    echo "❌ Error: RPC_URL_MAINNET not configured in .env file"
    exit 1
fi

# Build if needed
if [ ! -d "dist" ]; then
    echo "📦 Building project..."
    npm run build
fi

# Start with PM2
echo "🔄 Starting services with PM2..."
pm2 start ecosystem.config.production.cjs

echo "✅ Flash Loan Arbitrage Bot started successfully!"
echo ""
echo "📊 Monitoring commands:"
echo "  pm2 status           - View process status"
echo "  pm2 logs             - View logs"
echo "  pm2 monit            - Real-time monitoring"
echo ""
echo "🛑 Stop commands:"
echo "  pm2 stop all         - Stop all processes"
echo "  pm2 restart all      - Restart all processes"
echo ""
echo "📱 Web interface: http://localhost:3000"
EOF

chmod +x start-production.sh
log_success "Startup script created: ./start-production.sh"

# Create stop script
cat > stop-production.sh << 'EOF'
#!/bin/bash

echo "🛑 Stopping Flash Loan Arbitrage Bot..."

pm2 stop flashbot-main flashbot-opportunity-scanner 2>/dev/null || true
pm2 delete flashbot-main flashbot-opportunity-scanner 2>/dev/null || true

echo "✅ Flash Loan Arbitrage Bot stopped successfully!"
EOF

chmod +x stop-production.sh
log_success "Stop script created: ./stop-production.sh"

# Create monitoring script
log_info "Creating monitoring script..."
cat > scripts/monitor.sh << 'EOF'
#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📊 Flash Loan Arbitrage Bot - System Monitor"
echo "=========================================="

# Check if processes are running
echo -e "\n🔍 Process Status:"
pm2 jlist 2>/dev/null | grep -q "flashbot" && echo -e "${GREEN}✅ Bot processes are running${NC}" || echo -e "${RED}❌ Bot processes are not running${NC}"

# Check API endpoint
echo -e "\n🌐 API Health Check:"
if curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ API endpoint is responding${NC}"
else
    echo -e "${RED}❌ API endpoint is not responding${NC}"
fi

# Check log files
echo -e "\n📋 Recent Log Activity:"
if [ -f logs/flashbot-out.log ]; then
    echo -e "${YELLOW}Last 3 log entries:${NC}"
    tail -3 logs/flashbot-out.log
else
    echo -e "${RED}❌ Log file not found${NC}"
fi

# Check disk space
echo -e "\n💾 Disk Usage:"
df -h . | tail -1 | awk '{print $4" available ("$5" used)"}'

# Check memory usage
echo -e "\n🧠 Memory Usage:"
pm2 show flashbot-main 2>/dev/null | grep -E "memory usage|cpu usage" || echo "Process not running"

echo -e "\n📈 Quick Stats:"
if curl -s http://localhost:3000/api/stats > /dev/null; then
    curl -s http://localhost:3000/api/stats | head -5
else
    echo "API not available"
fi
EOF

chmod +x scripts/monitor.sh
log_success "Monitoring script created: ./scripts/monitor.sh"

# Create backup script
log_info "Creating backup script..."
cat > scripts/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="flashbot_backup_$DATE.tar.gz"

echo "📦 Creating backup: $BACKUP_FILE"

tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='logs/*.log' \
    --exclude='.git' \
    .

echo "✅ Backup created: $BACKUP_DIR/$BACKUP_FILE"

# Keep only last 10 backups
cd $BACKUP_DIR
ls -t flashbot_backup_*.tar.gz | tail -n +11 | xargs -r rm --
cd ..

echo "🧹 Old backups cleaned up"
EOF

chmod +x scripts/backup.sh
log_success "Backup script created: ./scripts/backup.sh"

# Security check
log_info "Running security checks..."

# Check file permissions
if [ -f .env ]; then
    PERM=$(stat -c "%a" .env)
    if [ "$PERM" != "600" ]; then
        chmod 600 .env
        log_warning "Fixed .env file permissions (set to 600)"
    else
        log_success ".env file has correct permissions"
    fi
fi

# Create systemd service (optional)
log_info "Creating systemd service file (optional)..."
cat > flashbot.service << 'EOF'
[Unit]
Description=Flash Loan Arbitrage Bot
After=network.target

[Service]
Type=forking
User=ubuntu
WorkingDirectory=/home/ubuntu/flashbot
ExecStart=/home/ubuntu/flashbot/start-production.sh
ExecStop=/home/ubuntu/flashbot/stop-production.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

log_info "To enable systemd service (optional):"
log_info "  sudo cp flashbot.service /etc/systemd/system/"
log_info "  sudo systemctl enable flashbot"
log_info "  sudo systemctl start flashbot"

echo ""
log_success "🎉 Production setup completed!"
echo ""
log_warning "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Edit .env file with your actual configuration"
echo "2. Fund your trading wallet with ETH"
echo "3. Test in demo mode first: DEMO_MODE=true in .env"
echo "4. Start the bot: ./start-production.sh"
echo "5. Monitor: ./scripts/monitor.sh"
echo ""
log_info "📚 Documentation: Check README.md for detailed setup instructions"
log_info "🔗 Monitoring: http://localhost:3000 (web interface)"