# Flash Loan Arbitrage Bot

## 🔗 Links
- **🌐 Live Demo**: https://3000-i1mgqyt1ey3fe1w45gozt-6532622b.e2b.dev
- **📂 GitHub Repository**: https://github.com/Web3ByVirtuAI/Arbitrage-Flashbot
- **🚀 Status**: ✅ **PRODUCTION READY** - Complete Flash Loan Arbitrage Bot with Security Hardening

## Project Overview
- **Name**: Flash Loan Arbitrage Bot
- **Goal**: Automated arbitrage trading bot that uses flash loans to exploit price differences between DEXs
- **Features**: Real-time opportunity scanning, automatic trade execution, risk management, monitoring API

## Architecture

### Core Components
1. **OpportunityFinder** - Scans DEXs for arbitrage opportunities
2. **FlashLoanExecutor** - Executes flash loan arbitrage trades
3. **PriceMonitor** - Real-time price monitoring with WebSocket connections
4. **AutoTrader** - Automated trading engine with risk management
5. **API Server** - REST API for monitoring and control

### Technology Stack
- **Backend**: Node.js + TypeScript
- **Blockchain**: ethers.js for Ethereum interactions
- **WebSockets**: Real-time price feeds from exchanges
- **API**: Express.js with security middleware
- **Process Management**: PM2 for production deployment
- **Database**: File-based logging (can be extended to use databases)

## Features Implemented ✅

### Core Functionality
- ✅ **Multi-DEX Support**: Uniswap V2, Uniswap V3, SushiSwap integration
- ✅ **Flash Loan Providers**: AAVE, Balancer, dYdX support
- ✅ **Real-time Price Monitoring**: WebSocket connections to Binance, CoinGecko
- ✅ **Opportunity Detection**: Automated scanning of token pairs across DEXs
- ✅ **Risk Management**: Daily limits, consecutive failure limits, position sizing
- ✅ **Gas Optimization**: Dynamic gas price estimation and optimization

### API Endpoints
- ✅ `GET /health` - System health check
- ✅ `GET /api/opportunities` - Current arbitrage opportunities
- ✅ `GET /api/prices` - Real-time token prices
- ✅ `GET /api/stats` - Trading statistics and performance metrics
- ✅ `POST /api/start` - Start automated trading
- ✅ `POST /api/stop` - Stop automated trading
- ✅ `POST /api/pause` - Pause trading (keep monitoring)
- ✅ `POST /api/resume` - Resume trading
- ✅ `POST /api/emergency-stop` - Emergency shutdown

### Monitoring & Logging
- ✅ **Comprehensive Logging**: Color-coded console output with file logging
- ✅ **Performance Metrics**: Trade success rate, profit tracking, uptime monitoring
- ✅ **Real-time Alerts**: Opportunity notifications and trade execution logs
- ✅ **Health Monitoring**: System component status checks

## Usage Guide

### Prerequisites
1. Node.js 18+ and npm/yarn installed
2. Ethereum RPC endpoint (Alchemy, Infura, or local node)
3. Private key for trading wallet (⚠️ KEEP SECURE)
4. API keys for price feeds (optional but recommended)

### Installation
```bash
# Clone and install dependencies
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env file with your configuration

# Build TypeScript
npm run build
```

### Configuration
Edit `.env` file with your settings:
```env
# Required
RPC_URL_MAINNET=https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY
PRIVATE_KEY=your_private_key_here

# Optional
MIN_PROFIT_THRESHOLD=0.01
MAX_SLIPPAGE=0.005
GAS_PRICE_GWEI=20
```

### Running the Bot

#### Development Mode
```bash
# Run main bot with API server
npm run dev

# Run opportunity scanner only
npm run scanner
```

#### Production Mode
```bash
# Build first
npm run build

# Start with PM2
pm2 start ecosystem.config.cjs

# Monitor logs
pm2 logs flash-loan-bot --nostream
```

### API Usage Examples
```bash
# Check system health
curl http://localhost:3000/health

# Get current opportunities
curl http://localhost:3000/api/opportunities

# Start automated trading
curl -X POST http://localhost:3000/api/start

# Get trading statistics
curl http://localhost:3000/api/stats
```

## Hosting Solutions 🚀

### Recommended Hosting Options

#### 1. **Specialized Trading VPS** (BEST for HFT)
- **QuantVPS**: Ultra-low latency (0.52ms), 99.999% uptime - $59/month
- **MyForexVPS**: Trading-optimized servers - $28-89/month
- **TradingFXVPS**: Low-latency worldwide locations - $35-120/month

#### 2. **General VPS Providers** (Good balance)
- **DigitalOcean**: Droplets starting $5/month, 99.99% uptime
- **Vultr**: High-performance instances, global locations - $6-320/month
- **Linode**: Developer-friendly, consistent performance - $5-320/month

#### 3. **Cloud Providers** (Scalable)
- **AWS EC2**: Auto-scaling, global regions - $0-500+/month (**FREE TIER AVAILABLE!**)
- **Google Cloud Compute**: Low-latency networking - $13-400+/month  
- **Azure**: Enterprise-grade reliability - $13-400+/month

#### 🆓 **NEW: AWS EC2 Free Tier Deployment** (RECOMMENDED)
- **Cost**: $0/month for 12 months (T2 micro, 750 hours/month)
- **Specs**: 1 vCPU, 1GB RAM, 30GB storage
- **Perfect for**: Testing and small-scale production trading
- **Setup Time**: 30 minutes with automated scripts
- **Documentation**: See `AWS_DEPLOYMENT.md` for complete guide

#### 4. **Crypto-Specific Hosting**
- **BaCloud**: Crypto-optimized VPS with DDoS protection - $15-200/month
- **VPS-Mart**: Blockchain infrastructure focus - $20-150/month

### Hosting Requirements
- **CPU**: 2-4 cores minimum (high clock speed preferred)
- **RAM**: 4-8GB minimum
- **Storage**: 20GB+ SSD
- **Network**: Low latency (<50ms to major exchanges)
- **Uptime**: 99.9%+ guaranteed
- **Location**: Close to exchange servers (US East, Europe, Asia)

### Recommended Setup
```bash
# Server specs for production
- 4 vCPU cores (3.0GHz+)
- 8GB RAM  
- 40GB SSD storage
- 1Gbps network
- DDoS protection
- Location: New York or London (closest to major CEXs)
```

## Data Architecture

### Storage Services
- **File System**: Logs and temporary data storage
- **In-Memory**: Price data and opportunity cache
- **External APIs**: Real-time price feeds (Binance, CoinGecko)

### Data Models
```typescript
// Arbitrage Opportunity
{
  id: string;
  tokenA: string; 
  tokenB: string;
  amountIn: string;
  expectedProfit: string;
  profitPercentage: number;
  dexA: { name, router, price };
  dexB: { name, router, price };
  gasEstimate: string;
  timestamp: number;
  priority: number;
}

// Trading Statistics
{
  totalTrades: number;
  successfulTrades: number; 
  failedTrades: number;
  totalProfit: string;
  averageProfit: string;
  uptime: number;
}
```

## Features Not Yet Implemented ⏳

### Advanced Features (Future Development)
- ❌ **MEV Protection**: Flashbots integration for private mempool
- ❌ **Multi-chain Support**: Polygon, BSC, Arbitrum deployment
- ❌ **Advanced Strategies**: Triangular arbitrage, liquidation hunting
- ❌ **Machine Learning**: Predictive opportunity scoring
- ❌ **Portfolio Management**: Multi-token position management
- ❌ **Telegram/Discord Bots**: Real-time notifications
- ❌ **Web Dashboard**: React-based monitoring interface
- ❌ **Database Integration**: PostgreSQL/MongoDB for historical data

### Smart Contract Integration
- ❌ **Custom Flash Loan Contract**: Optimized gas usage
- ❌ **Multi-hop Arbitrage**: Complex routing through multiple DEXs
- ❌ **Slippage Protection**: Advanced slippage calculation and protection

## Deployment Status
- **Platform**: Ready for VPS/Cloud deployment
- **Status**: ✅ Development Complete - Ready for Production
- **Environment**: Node.js + TypeScript + PM2
- **Last Updated**: September 2025

## Security Considerations ⚠️

### Critical Security Requirements
1. **Private Key Security**: Store in environment variables, never commit to git
2. **RPC Endpoint Security**: Use authenticated endpoints, monitor usage
3. **Rate Limiting**: API endpoints protected against abuse
4. **Input Validation**: All user inputs validated and sanitized
5. **Error Handling**: Comprehensive error handling to prevent crashes
6. **Monitoring**: Real-time monitoring of all transactions and balances

### Risk Management Features
- Daily trade limits and profit/loss caps
- Consecutive failure detection and auto-pause
- Gas price monitoring and dynamic adjustment
- Slippage protection and minimum profit thresholds
- Emergency stop functionality

## 🚀 PRODUCTION DEPLOYMENT GUIDE

### 🆓 AWS EC2 Free Tier Deployment (RECOMMENDED)
```bash
# 1. Launch AWS EC2 T2 micro instance (FREE for 12 months)
# 2. SSH to your instance: ssh -i "key.pem" ubuntu@EC2-IP
# 3. Clone repository and run automated setup:
git clone YOUR_REPOSITORY_URL flashbot
cd flashbot
./scripts/setup-aws-production.sh

# 4. Configure your trading settings:
cp .env.aws.example .env.production
nano .env.production  # Add your private key, RPC URL, etc.

# 5. Start the bot:
./start-bot.sh

# 6. Access web interface: http://EC2-PUBLIC-IP:3000
```

📖 **Complete AWS Guide**: See `AWS_DEPLOYMENT.md` and `AWS_CHECKLIST.md` for detailed instructions.

### ⚡ Local/VPS Quick Start (5 Minutes)
```bash
# 1. Clone the repository
git clone YOUR_REPOSITORY_URL flashbot
cd flashbot

# 2. Generate a trading wallet
node scripts/setup-wallet.js generate

# 3. Run production setup
./scripts/setup-production.sh

# 4. Configure environment
cp .env.production.example .env
nano .env  # Add your private key and RPC URL

# 5. Check production readiness
./scripts/production-ready.sh

# 6. Start the bot (in demo mode first!)
echo "DEMO_MODE=true" >> .env
./start-production.sh
```

### 🔧 Production Scripts & Tools

| Script | Purpose | Usage |
|--------|---------|--------|
| `setup-wallet.js` | Generate secure trading wallets | `node scripts/setup-wallet.js generate` |
| `setup-production.sh` | Complete production setup | `./scripts/setup-production.sh` |
| `production-ready.sh` | Readiness assessment | `./scripts/production-ready.sh` |
| `test-production.js` | Comprehensive testing | `node scripts/test-production.js` |
| `security-hardening.sh` | Security configuration | `./scripts/security-hardening.sh` |
| `start-production.sh` | Start bot in production | `./start-production.sh` |
| `stop-production.sh` | Stop all bot processes | `./stop-production.sh` |

### 💰 Wallet Setup & Security

**Generate a secure trading wallet:**
```bash
node scripts/setup-wallet.js generate
```

**Validate existing wallet:**
```bash
node scripts/setup-wallet.js validate YOUR_PRIVATE_KEY
```

**Check wallet balance:**
```bash
node scripts/setup-wallet.js balance YOUR_PRIVATE_KEY YOUR_RPC_URL
```

**Critical Security Requirements:**
- ✅ Use a dedicated trading wallet (not your main wallet)
- ✅ Fund with 0.1-0.5 ETH for gas fees
- ✅ Start with small amounts ($100-500) for testing
- ✅ Never share or expose your private key
- ✅ Store keys in secure password manager

### 🏭 Production Environment Setup

**Required Environment Variables:**
```bash
# CRITICAL - Trading Configuration
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
WALLET_ADDRESS=0xYOUR_WALLET_ADDRESS_HERE
RPC_URL_MAINNET=https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY

# SAFETY - Trading Parameters
MIN_PROFIT_THRESHOLD=0.02    # $0.02 minimum profit
MAX_SLIPPAGE=0.007          # 0.7% max slippage
MAX_TRADE_SIZE=1000         # $1000 max trade
DAILY_PROFIT_LIMIT=100      # $100 daily limit
DEMO_MODE=true              # ALWAYS start with demo mode!

# OPTIONAL - API Keys
ALCHEMY_API_KEY=YOUR_ALCHEMY_API_KEY
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_TOKEN
TELEGRAM_CHAT_ID=YOUR_CHAT_ID
```

### 🔒 Security & Risk Management

**Built-in Safety Features:**
- ✅ Demo mode for safe testing
- ✅ Daily profit/loss limits
- ✅ Maximum trade size limits
- ✅ Consecutive failure detection
- ✅ Emergency stop functionality
- ✅ Gas price monitoring
- ✅ Slippage protection

**Security Hardening:**
```bash
# Run security hardening script
./scripts/security-hardening.sh

# Check security configuration
./scripts/production-ready.sh

# Monitor security
./scripts/security-monitor.sh
```

### 📊 Monitoring & Management

**Real-time Monitoring:**
```bash
# Check system status
pm2 status

# View live logs
pm2 logs

# Real-time performance monitoring
pm2 monit

# Custom monitoring script
./scripts/monitor.sh
```

**Web Interface:**
- **URL**: http://localhost:3000
- **Features**: Live opportunities, trading controls, performance metrics
- **Security**: Rate-limited, IP-whitelisted for production

### 🧪 Testing & Validation

**Pre-deployment Testing:**
```bash
# Comprehensive production test
node scripts/test-production.js

# Validate all configurations
./scripts/production-ready.sh

# Test wallet setup
node scripts/setup-wallet.js validate YOUR_PRIVATE_KEY
```

**Demo Mode Testing (REQUIRED):**
1. Set `DEMO_MODE=true` in .env
2. Run bot for 24 hours in demo mode
3. Verify all functions work correctly
4. Monitor simulated performance
5. Only then switch to `DEMO_MODE=false`

### 🎯 Trading Strategy Configuration

**Conservative Strategy (Beginners):**
```bash
MIN_PROFIT_THRESHOLD=0.05    # $0.05 minimum
MAX_TRADE_SIZE=500           # $500 max
MAX_CONCURRENT_TRADES=1      # Single trades only
DAILY_PROFIT_LIMIT=50        # $50 daily limit
```

**Aggressive Strategy (Advanced):**
```bash
MIN_PROFIT_THRESHOLD=0.01    # $0.01 minimum
MAX_TRADE_SIZE=2000          # $2000 max
MAX_CONCURRENT_TRADES=3      # Multiple trades
DAILY_PROFIT_LIMIT=500       # $500 daily limit
OPPORTUNITY_SCAN_INTERVAL=1000  # 1-second scanning
```

### 🌐 Recommended Hosting Providers

**🆓 FREE TIER OPTIONS:**
- **AWS EC2 Free Tier**: T2 micro, 1GB RAM, 30GB storage - $0/month (12 months) ⭐ **RECOMMENDED**
  - 750 hours/month (24/7 operation)
  - Perfect for testing and small-scale trading
  - Complete setup guide: `AWS_DEPLOYMENT.md`
  - Automated deployment: `./scripts/setup-aws-production.sh`

**Trading-Optimized VPS:**
- **QuantVPS**: Ultra-low latency, 99.999% uptime - $59/month
- **MyForexVPS**: Trading-optimized servers - $28-89/month
- **BeeksFX**: London/NY locations - $39-199/month

**Cloud Providers:**
- **DigitalOcean**: Reliable performance - $20-40/month
- **Vultr**: Global locations - $10-20/month
- **Linode**: Developer-friendly - $20-40/month

**Server Requirements:**
- **CPU**: 2-4 cores minimum (high clock speed preferred)
- **RAM**: 4-8GB minimum
- **Storage**: 20GB+ SSD
- **Network**: Low latency (<50ms to exchanges)
- **Location**: Close to exchange servers (US East, Europe, Asia)

### 📋 Production Deployment Checklist

**Pre-Deployment (CRITICAL):**
- [ ] Generated dedicated trading wallet
- [ ] Configured .env with real values (no placeholders)
- [ ] Funded wallet with ETH for gas fees
- [ ] Set DEMO_MODE=true for initial testing
- [ ] Ran ./scripts/production-ready.sh successfully
- [ ] Completed security hardening
- [ ] Tested in demo mode for 24+ hours

**Deployment:**
- [ ] Deployed to production VPS
- [ ] Configured firewall and security
- [ ] Set up monitoring and alerting
- [ ] Documented emergency procedures
- [ ] Created backup strategy

**Post-Deployment:**
- [ ] Monitor for 48 hours with small amounts
- [ ] Verify profitability and performance
- [ ] Scale gradually (increase trade sizes slowly)
- [ ] Regular security audits and updates

### 🚨 Emergency Procedures

**Emergency Stop:**
```bash
# Immediate stop via API
curl -X POST http://localhost:3000/api/emergency-stop

# Force stop all processes
./stop-production.sh

# Check wallet balance
curl http://localhost:3000/api/stats
```

**Recovery Procedures:**
```bash
# Restart after emergency
./start-production.sh

# Check system health
./scripts/monitor.sh

# Review logs for issues
pm2 logs --lines 100
```

### 📈 Performance Optimization

**Network Optimization:**
- Use multiple RPC endpoints for redundancy
- Choose hosting close to Ethereum nodes
- Configure TCP optimization for trading

**Gas Optimization:**
- Monitor gas prices continuously
- Use EIP-1559 for better fee prediction
- Set emergency stop at high gas thresholds

**Trading Optimization:**
- Start with conservative parameters
- Gradually increase based on performance
- Monitor success rates and adjust accordingly

## Next Steps for Advanced Features

### Short-term Enhancements (Month 1)
1. **Multi-chain Support**: Deploy to Polygon, BSC, Arbitrum
2. **MEV Protection**: Integrate Flashbots for private mempool
3. **Advanced Analytics**: Add profitability tracking and reporting
4. **Telegram Integration**: Real-time notifications and control

### Long-term Roadmap (Months 2-6)
1. **Machine Learning**: Predictive opportunity scoring
2. **Portfolio Management**: Multi-token position management  
3. **Advanced Strategies**: Triangular arbitrage, liquidation hunting
4. **Enterprise Features**: Multi-user dashboard, API access

---

⚠️ **DISCLAIMER**: This bot involves financial risk. Only use funds you can afford to lose. Always test thoroughly before deploying significant capital. The creators are not responsible for any financial losses.

🔧 **DEVELOPMENT**: This is a sophisticated trading system. Ensure you understand the code and risks before deployment.