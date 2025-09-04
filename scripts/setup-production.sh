#!/bin/bash

# Interactive Production Setup Script
# This script guides you through the complete production setup process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${PURPLE}🔧 $1${NC}"; }

echo "🚀 Flash Loan Arbitrage Bot - Production Setup Wizard"
echo "====================================================="
echo ""

# Step 1: Welcome & Warnings
echo "⚠️  CRITICAL WARNINGS:"
echo "- This bot trades with REAL cryptocurrency"
echo "- You can lose ALL your invested funds"
echo "- Only invest what you can afford to lose completely"
echo "- DeFi protocols have inherent smart contract risks"
echo "- Gas fees can eliminate profits during network congestion"
echo ""

read -p "Do you understand these risks and wish to continue? (yes/no): " confirm
if [[ $confirm != "yes" ]]; then
    log_error "Setup cancelled for safety"
    exit 1
fi

# Step 2: Generate or Import Wallet
echo ""
log_step "Step 1: Wallet Setup"
echo "===================="

if [[ -f ".env" ]]; then
    log_info "Existing .env file found"
    read -p "Do you want to generate a new wallet? (yes/no): " new_wallet
else
    new_wallet="yes"
fi

if [[ $new_wallet == "yes" ]]; then
    log_info "Generating new trading wallet..."
    node scripts/generate-wallet.js
    
    echo ""
    log_warning "IMPORTANT: Your wallet has been generated above"
    log_warning "Write down the mnemonic phrase and store it safely!"
    echo ""
    
    read -p "Press Enter after you've safely stored your wallet information..."
fi

# Step 3: API Keys Setup
echo ""
log_step "Step 2: API Keys Setup"
echo "======================"

if [[ ! -f ".env" && ! -f ".env.production" ]]; then
    log_error "No environment file found. Please run wallet generation first."
    exit 1
fi

# Copy production template if needed
if [[ -f ".env.production" && ! -f ".env" ]]; then
    cp .env.production .env
    log_success "Copied .env.production to .env"
fi

echo "You need to configure the following API keys in your .env file:"
echo ""
echo "1. 🔗 Alchemy API Key (Primary RPC)"
echo "   - Sign up at: https://alchemy.com"
echo "   - Create new app → Ethereum Mainnet"
echo "   - Copy API key and replace YOUR_ALCHEMY_API_KEY in .env"
echo ""
echo "2. 🔗 Infura API Key (Backup RPC)"
echo "   - Sign up at: https://infura.io"
echo "   - Create new project → Ethereum"  
echo "   - Copy Project ID and replace YOUR_INFURA_PROJECT_ID in .env"
echo ""
echo "3. 📊 Etherscan API Key (Optional)"
echo "   - Sign up at: https://etherscan.io"
echo "   - Create API key and replace your_etherscan_api_key in .env"
echo ""

read -p "Have you updated your .env file with API keys? (yes/no): " api_keys_done
if [[ $api_keys_done != "yes" ]]; then
    log_warning "Please update .env file with your API keys and run this script again"
    echo "Edit file: nano .env"
    exit 1
fi

# Step 4: Test Configuration
echo ""
log_step "Step 3: Configuration Testing"
echo "============================="

log_info "Testing your configuration..."
if ! node scripts/test-config.js; then
    log_error "Configuration tests failed. Please fix the issues above."
    exit 1
fi

log_success "Configuration tests passed!"

# Step 5: Wallet Funding
echo ""
log_step "Step 4: Wallet Funding"
echo "======================"

# Get wallet address from .env
WALLET_ADDRESS=$(grep "WALLET_ADDRESS" .env | cut -d '=' -f2)

echo "Your trading wallet address: $WALLET_ADDRESS"
echo ""
echo "💰 FUNDING RECOMMENDATIONS:"
echo "- Testing: 0.1 ETH (~\$250)"
echo "- Small scale: 0.5-1 ETH (\$1,250-\$2,500)"
echo "- Production: 2-5 ETH (\$5,000-\$12,500)"
echo ""
echo "⚠️  Remember:"
echo "- Keep 30% for gas fees (trading uses gas for each transaction)"
echo "- Start small and scale up gradually"
echo "- You can always add more funds later"
echo ""

read -p "Have you funded your wallet with ETH? (yes/no): " wallet_funded
if [[ $wallet_funded != "yes" ]]; then
    log_warning "Please fund your wallet before proceeding"
    echo "Send ETH to: $WALLET_ADDRESS"
    exit 1
fi

# Re-test configuration to verify balance
log_info "Re-testing configuration with funded wallet..."
if ! node scripts/test-config.js; then
    log_error "Configuration tests failed after funding. Please check your wallet balance."
    exit 1
fi

# Step 6: Risk Settings Review
echo ""
log_step "Step 5: Risk Management Review"
echo "=============================="

log_info "Current risk settings in .env:"
echo ""

# Show current risk settings
grep -E "(MIN_PROFIT_THRESHOLD|MAX_TRADE_SIZE_ETH|MAX_DAILY_TRADES|STOP_LOSS_PERCENT)" .env | while read line; do
    echo "  $line"
done

echo ""
echo "🎯 RECOMMENDED STARTING SETTINGS:"
echo "  MIN_PROFIT_THRESHOLD=0.02     # 2% minimum profit"
echo "  MAX_TRADE_SIZE_ETH=0.1        # 0.1 ETH per trade maximum"
echo "  MAX_DAILY_TRADES=20           # 20 trades per day maximum"
echo "  STOP_LOSS_PERCENT=5           # Stop if 5% daily loss"
echo ""

read -p "Are you satisfied with your risk settings? (yes/no): " risk_ok
if [[ $risk_ok != "yes" ]]; then
    echo "Please edit your .env file to adjust risk settings:"
    echo "nano .env"
    read -p "Press Enter after adjusting settings..."
fi

# Step 7: Deploy to Production
echo ""
log_step "Step 6: Production Deployment"
echo "============================="

log_info "Ready to deploy to production!"
echo ""
echo "This will:"
echo "- Build the application"
echo "- Start it with PM2"
echo "- Set up monitoring"
echo "- Create emergency stop scripts"
echo ""

read -p "Proceed with production deployment? (yes/no): " deploy_now
if [[ $deploy_now == "yes" ]]; then
    log_info "Starting deployment..."
    ./scripts/deploy-production.sh
else
    log_info "Deployment cancelled. You can deploy later with:"
    echo "./scripts/deploy-production.sh"
    exit 0
fi

# Step 8: Final Instructions
echo ""
log_step "Step 7: Final Setup Complete!"
echo "============================="

log_success "Production setup completed successfully!"

echo ""
echo "🎯 IMMEDIATE NEXT STEPS:"
echo "1. 📊 Monitor the bot: ./scripts/monitor.sh"
echo "2. 🌐 Access web interface: http://localhost:3000"
echo "3. 📝 Check logs: pm2 logs flash-loan-bot-prod"
echo ""

echo "⚠️  BEFORE STARTING TRADING:"
echo "1. Monitor in demo mode for 24 hours first"
echo "2. Verify opportunities are being detected"
echo "3. Check that gas estimates are reasonable"
echo "4. Ensure profit calculations include gas costs"
echo ""

echo "🚀 WHEN READY TO START TRADING:"
echo "curl -X POST http://localhost:3000/api/start"
echo ""

echo "🛑 EMERGENCY STOP (if needed):"
echo "./scripts/emergency-stop.sh"
echo ""

echo "📈 MONITORING COMMANDS:"
echo "- Overall status: ./scripts/monitor.sh"
echo "- PM2 dashboard: pm2 monit"
echo "- Recent logs: pm2 logs flash-loan-bot-prod --lines 50"
echo "- Restart bot: pm2 restart flash-loan-bot-prod"
echo ""

log_warning "REMEMBER: Start with small amounts and monitor closely!"
log_success "Your Flash Loan Arbitrage Bot is ready for production!"

echo ""
echo "Happy Trading! 🎉"