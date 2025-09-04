#!/bin/bash

echo "🛑 Stopping Flash Loan Arbitrage Bot..."

pm2 stop flashbot-main flashbot-opportunity-scanner 2>/dev/null || true
pm2 delete flashbot-main flashbot-opportunity-scanner 2>/dev/null || true

echo "✅ Flash Loan Arbitrage Bot stopped successfully!"