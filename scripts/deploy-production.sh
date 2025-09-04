#!/bin/bash

# Flash Loan Arbitrage Bot - Production Deployment Script
# This script helps deploy the bot safely to production

set -e  # Exit on any error

echo "🚀 Flash Loan Arbitrage Bot - Production Deployment"
echo "=================================================="
echo ""

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
   log_error "Do not run this script as root for security reasons"
   exit 1
fi

# Step 1: Pre-deployment Checks
echo "1️⃣  Pre-deployment Checks"
echo "========================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Are you in the bot directory?"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    log_error ".env file not found. Run 'node scripts/generate-wallet.js' first"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js 18+ first"
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    log_warning "PM2 is not installed. Installing PM2..."
    npm install -g pm2
    log_success "PM2 installed"
fi

log_success "Pre-deployment checks passed"

# Step 2: Test Configuration
echo ""
echo "2️⃣  Testing Configuration"
echo "========================"

log_info "Running configuration tests..."
if ! node scripts/test-config.js; then
    log_error "Configuration tests failed. Please fix issues before proceeding."
    exit 1
fi

log_success "Configuration tests passed"

# Step 3: Build Application
echo ""
echo "3️⃣  Building Application"
echo "======================="

log_info "Installing production dependencies..."
npm ci --only=production

log_info "Building TypeScript..."
npm run build

if [ ! -d "dist" ]; then
    log_error "Build failed - dist directory not found"
    exit 1
fi

log_success "Application built successfully"

# Step 4: Setup Logging
echo ""
echo "4️⃣  Setting up Logging"
echo "====================="

# Create logs directory with proper permissions
mkdir -p logs
chmod 755 logs

log_success "Logging directory created"

# Step 5: Backup Current Production (if exists)
echo ""
echo "5️⃣  Backup Management"
echo "===================="

# Check if bot is already running
if pm2 list | grep -q "flash-loan-bot"; then
    log_info "Existing bot detected. Creating backup..."
    
    # Stop existing bot
    pm2 stop flash-loan-bot-prod 2>/dev/null || pm2 stop flash-loan-bot 2>/dev/null || true
    
    # Backup logs
    if [ -d "logs" ]; then
        BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        cp -r logs "$BACKUP_DIR/"
        log_success "Logs backed up to $BACKUP_DIR"
    fi
    
    # Remove from PM2
    pm2 delete flash-loan-bot-prod 2>/dev/null || pm2 delete flash-loan-bot 2>/dev/null || true
fi

# Step 6: Deploy Application
echo ""
echo "6️⃣  Deploying Application"
echo "========================"

log_info "Starting application with PM2..."

# Create production PM2 config
cat > ecosystem.production.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'flash-loan-bot-prod',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/prod-error.log',
      out_file: './logs/prod-out.log',
      log_file: './logs/prod-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 10000,
      // Production optimizations
      node_args: '--max-old-space-size=1024',
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Monitoring
      monitor: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
EOF

# Start with PM2
pm2 start ecosystem.production.config.cjs

# Save PM2 configuration
pm2 save

# Setup PM2 startup (for server reboots)
pm2 startup | tail -n 1 | sudo bash || log_warning "Could not setup PM2 startup (run as sudo if needed)"

log_success "Application deployed with PM2"

# Step 7: Health Check
echo ""
echo "7️⃣  Health Check"
echo "==============="

log_info "Waiting for application to start..."
sleep 10

# Check if PM2 process is running
if ! pm2 list | grep -q "flash-loan-bot-prod.*online"; then
    log_error "Application failed to start. Check PM2 logs:"
    echo "pm2 logs flash-loan-bot-prod"
    exit 1
fi

# Test HTTP endpoint
log_info "Testing HTTP endpoint..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    log_success "Health check passed"
else
    log_error "Health check failed. Check application logs:"
    echo "pm2 logs flash-loan-bot-prod"
    exit 1
fi

# Step 8: Final Setup
echo ""
echo "8️⃣  Final Setup"
echo "=============="

# Create monitoring script
cat > scripts/monitor.sh << 'EOF'
#!/bin/bash
# Production monitoring script

echo "📊 Flash Loan Bot Status"
echo "======================="

# PM2 status
echo "PM2 Status:"
pm2 list | grep flash-loan-bot-prod

echo ""
echo "Memory Usage:"
pm2 show flash-loan-bot-prod | grep -A 5 "Monit"

echo ""
echo "Recent Logs:"
pm2 logs flash-loan-bot-prod --lines 10 --nostream

echo ""
echo "API Health Check:"
curl -s http://localhost:3000/health | jq '.' 2>/dev/null || curl -s http://localhost:3000/health

echo ""
echo "Trading Stats:"
curl -s http://localhost:3000/api/stats | jq '.trading' 2>/dev/null || echo "Stats endpoint not responding"
EOF

chmod +x scripts/monitor.sh

# Create emergency stop script  
cat > scripts/emergency-stop.sh << 'EOF'
#!/bin/bash
# Emergency stop script

echo "🛑 EMERGENCY STOP - Stopping all trading immediately"
echo "=================================================="

# Stop trading via API
echo "Stopping trading..."
curl -X POST http://localhost:3000/api/emergency-stop

# Stop PM2 process
echo "Stopping PM2 process..."
pm2 stop flash-loan-bot-prod

echo "✅ Bot stopped. To restart: pm2 start flash-loan-bot-prod"
EOF

chmod +x scripts/emergency-stop.sh

log_success "Monitoring and emergency scripts created"

# Step 9: Security Hardening
echo ""
echo "9️⃣  Security Hardening"
echo "====================="

# Set secure permissions on .env
chmod 600 .env
log_success "Set secure permissions on .env file"

# Set secure permissions on logs
chmod 755 logs
log_success "Set secure permissions on logs directory"

# Final Success Message
echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================"
log_success "Flash Loan Arbitrage Bot deployed successfully!"

echo ""
echo "📋 NEXT STEPS:"
echo "1. Monitor the bot: ./scripts/monitor.sh"
echo "2. Check logs: pm2 logs flash-loan-bot-prod"
echo "3. View web interface: http://localhost:3000"
echo "4. Start trading: curl -X POST http://localhost:3000/api/start"

echo ""
echo "⚠️  IMPORTANT REMINDERS:"
echo "- Start with paper trading mode first"
echo "- Monitor closely for the first 24 hours"
echo "- Keep emergency stop ready: ./scripts/emergency-stop.sh"
echo "- Check wallet balance regularly"

echo ""
echo "🔧 USEFUL COMMANDS:"
echo "- View status: pm2 status"
echo "- View logs: pm2 logs flash-loan-bot-prod"
echo "- Restart: pm2 restart flash-loan-bot-prod"
echo "- Stop: pm2 stop flash-loan-bot-prod"
echo "- Monitor: ./scripts/monitor.sh"

echo ""
log_success "Bot is now running in production mode!"

# Show current status
pm2 list | grep flash-loan-bot-prod