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
pm2 start ecosystem.config.cjs

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