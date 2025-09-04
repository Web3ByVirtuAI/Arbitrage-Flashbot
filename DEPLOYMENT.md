# 🚀 Flash Loan Arbitrage Bot - Production Deployment Guide

## 📋 Prerequisites

### 1. Server Requirements
- **OS**: Ubuntu 20.04+ or CentOS 7+
- **CPU**: 2+ cores (4+ recommended for high-frequency trading)
- **RAM**: 4GB minimum (8GB+ recommended)
- **Storage**: 20GB SSD minimum
- **Network**: Low latency connection (<50ms to Ethereum nodes)

### 2. Required Accounts & APIs
- **Ethereum Wallet**: Dedicated trading wallet with private key
- **RPC Provider**: Alchemy (recommended) or Infura account
- **Etherscan API**: For contract verification (optional)
- **Telegram Bot**: For notifications (optional)

---

## ⚡ Quick Start (5 Minutes)

### Step 1: Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install git
sudo apt install git -y
```

### Step 2: Clone and Setup
```bash
# Clone your repository or upload files
cd /home/ubuntu
git clone YOUR_REPOSITORY_URL flashbot
cd flashbot

# Run production setup
./scripts/setup-production.sh
```

### Step 3: Configure Environment
```bash
# Edit environment file
nano .env

# Add your private key and RPC URL:
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
RPC_URL_MAINNET=https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY
```

### Step 4: Start Trading Bot
```bash
# Start in demo mode first (recommended)
echo "DEMO_MODE=true" >> .env
./start-production.sh

# Monitor
./scripts/monitor.sh
```

---

## 🔧 Detailed Setup Instructions

### 1. Environment Configuration

**Copy and edit the environment file:**
```bash
cp .env.production.example .env
chmod 600 .env  # Secure permissions
nano .env
```

**Critical settings to configure:**
```bash
# REQUIRED: Your trading wallet
PRIVATE_KEY=0xYOUR_64_CHARACTER_PRIVATE_KEY_HERE
WALLET_ADDRESS=0xYOUR_WALLET_ADDRESS_HERE

# REQUIRED: Ethereum RPC endpoint
RPC_URL_MAINNET=https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY

# RECOMMENDED: Trading parameters
MIN_PROFIT_THRESHOLD=0.02  # $0.02 minimum profit
MAX_SLIPPAGE=0.007         # 0.7% max slippage
MAX_TRADE_SIZE=1000        # $1000 max trade size
DAILY_PROFIT_LIMIT=100     # $100 daily profit limit

# SAFETY: Demo mode (set to false when ready)
DEMO_MODE=true
```

### 2. Wallet Setup

**Create a dedicated trading wallet:**
```bash
# Generate new wallet (save this output securely!)
node -e "
const { ethers } = require('ethers');
const wallet = ethers.Wallet.createRandom();
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
console.log('Mnemonic:', wallet.mnemonic.phrase);
"
```

**Fund your trading wallet:**
- Send ETH for gas fees (0.1-0.5 ETH recommended)
- Send capital for trading (start small: $100-500)
- **Never use your main wallet for trading!**

### 3. API Setup

**Alchemy (Recommended):**
1. Create account at [https://dashboard.alchemy.com/](https://dashboard.alchemy.com/)
2. Create new app (Ethereum Mainnet)
3. Copy API key to `RPC_URL_MAINNET`

**Infura (Alternative):**
1. Create account at [https://infura.io/](https://infura.io/)
2. Create new project
3. Use endpoint: `https://mainnet.infura.io/v3/YOUR_PROJECT_ID`

### 4. Security Hardening

**File Permissions:**
```bash
chmod 600 .env                    # Secure environment file
chmod 700 logs/                   # Secure log directory
chmod +x scripts/*.sh             # Make scripts executable
```

**Firewall Setup:**
```bash
# UFW (Ubuntu)
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 3000/tcp           # API port (optional)
sudo ufw status
```

**Process Security:**
```bash
# Run as non-root user
sudo useradd -m -s /bin/bash flashbot
sudo chown -R flashbot:flashbot /home/ubuntu/flashbot
```

---

## 📊 Monitoring & Management

### Real-time Monitoring
```bash
# System status
./scripts/monitor.sh

# Live logs
pm2 logs

# Process monitoring
pm2 monit

# Web interface
curl http://localhost:3000/api/stats
```

### Log Management
```bash
# View recent trades
tail -f logs/flashbot-out.log

# Search for errors
grep -i error logs/flashbot-error.log

# Rotate logs
logrotate -f config/logrotate.conf
```

### Backup & Recovery
```bash
# Create backup
./scripts/backup.sh

# View backups
ls -la backups/

# Restore from backup
tar -xzf backups/flashbot_backup_YYYYMMDD_HHMMSS.tar.gz
```

---

## 🎯 Trading Strategy Configuration

### Conservative Strategy (Recommended for beginners)
```bash
MIN_PROFIT_THRESHOLD=0.05         # $0.05 minimum profit
MAX_TRADE_SIZE=500                # $500 max trade
MAX_CONCURRENT_TRADES=1           # One trade at a time
DAILY_PROFIT_LIMIT=50             # $50 daily limit
DEMO_MODE=false                   # After testing
```

### Aggressive Strategy (Advanced users)
```bash
MIN_PROFIT_THRESHOLD=0.01         # $0.01 minimum profit
MAX_TRADE_SIZE=2000               # $2000 max trade
MAX_CONCURRENT_TRADES=3           # Multiple trades
DAILY_PROFIT_LIMIT=500            # $500 daily limit
OPPORTUNITY_SCAN_INTERVAL=1000    # 1-second scanning
```

---

## 🚨 Safety & Risk Management

### Testing Phase
1. **Always start with `DEMO_MODE=true`**
2. Monitor for 24 hours in demo mode
3. Verify all functions work correctly
4. Test emergency stop functionality

### Production Phase
```bash
# Gradual scaling approach:
# Week 1: $100 capital, $10 daily limit
# Week 2: $500 capital, $50 daily limit  
# Week 3: $1000 capital, $100 daily limit
```

### Emergency Procedures
```bash
# Emergency stop
curl -X POST http://localhost:3000/api/emergency-stop

# Force stop all processes
./stop-production.sh

# Check wallet balance
curl http://localhost:3000/api/stats | grep balance
```

---

## 🌐 Hosting Providers

### VPS Providers (Recommended)
1. **DigitalOcean** - $20-40/month, excellent network
2. **Vultr** - $10-20/month, global locations
3. **Linode** - $20-40/month, reliable performance

### Trading-Specific VPS
1. **QuantVPS** - Ultra-low latency, $59/month
2. **MyForexVPS** - Trading optimized, $28-89/month
3. **BeeksFX** - London/NY locations, $39-199/month

### Setup Commands for Popular Providers
```bash
# DigitalOcean Ubuntu 20.04
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm install -g pm2

# AWS EC2 (Amazon Linux)
sudo yum update -y
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
sudo yum install git -y
npm install -g pm2
```

---

## 📈 Performance Optimization

### Network Optimization
```bash
# TCP optimization for trading
echo 'net.core.rmem_max = 268435456' | sudo tee -a /etc/sysctl.conf
echo 'net.core.wmem_max = 268435456' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Process Priority
```bash
# High priority for trading processes
sudo renice -n -10 $(pgrep -f flashbot-main)
```

### Multiple RPC Endpoints
```bash
# Add backup RPC endpoints in .env
RPC_URL_MAINNET_BACKUP=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
RPC_URL_MAINNET_BACKUP2=https://ethereum.blockpi.network/v1/rpc/public
```

---

## 🔍 Troubleshooting

### Common Issues

**Bot not finding opportunities:**
```bash
# Check RPC connection
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  YOUR_RPC_URL
```

**High gas fees:**
```bash
# Monitor gas prices
curl https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=YOUR_API_KEY
```

**Memory issues:**
```bash
# Increase PM2 memory limit
pm2 delete flashbot-main
pm2 start ecosystem.config.production.cjs --max-memory-restart 2G
```

### Log Analysis
```bash
# Find profitable trades
grep "Profitable opportunity" logs/flashbot-out.log

# Check error patterns
grep -A 5 -B 5 "Error" logs/flashbot-error.log

# Monitor gas usage
grep "Gas used" logs/flashbot-out.log | tail -10
```

---

## 📞 Support & Maintenance

### Regular Maintenance Tasks
- **Daily**: Check logs and performance metrics
- **Weekly**: Update dependencies and restart
- **Monthly**: Rotate API keys and update configurations

### Update Procedures
```bash
# Update bot software
git pull origin main
npm ci --only=production
npm run build
pm2 restart all
```

### Health Checks
```bash
# Automated health check script
#!/bin/bash
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "API down, restarting..."
    pm2 restart flashbot-main
fi
```

---

## ⚠️ Legal & Risk Disclaimers

1. **Financial Risk**: Trading cryptocurrencies involves substantial risk
2. **Regulatory Compliance**: Ensure compliance with local regulations
3. **MEV Risks**: Arbitrage transactions may be front-run by MEV bots
4. **Smart Contract Risk**: Flash loan contracts may have bugs or vulnerabilities
5. **Market Risk**: Crypto markets are highly volatile and unpredictable

**Use only funds you can afford to lose completely.**

---

## 📚 Additional Resources

- **Ethereum Gas Tracker**: [https://etherscan.io/gastracker](https://etherscan.io/gastracker)
- **MEV Protection**: [https://flashbots.net/](https://flashbots.net/)
- **DeFiPulse**: [https://defipulse.com/](https://defipulse.com/)
- **Arbitrage Analytics**: [https://www.dextools.io/](https://www.dextools.io/)

---

**🎯 Ready to deploy? Start with the Quick Start section above!**