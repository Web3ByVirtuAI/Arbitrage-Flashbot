# 🌐 Multi-Chain Flash Loan Arbitrage Bot

Advanced cross-chain arbitrage bot with flash loan execution across 45+ blockchain networks.

## 🔗 Links
- **🌐 Live Demo**: https://3000-i1mgqyt1ey3fe1w45gozt-6532622b.e2b.dev
- **📂 Repository**: https://github.com/Web3ByVirtuAI/Arbitrage-Flashbot

## 🏗️ Architecture

### Core Components
- **MultiChainPriceService** - Scans 45+ networks for arbitrage opportunities
- **APIService** - Coordinates real-time data from CoinGecko, Alchemy, The Graph
- **PriceService** - Live market data integration
- **OpportunityFinder** - DEX arbitrage detection
- **AutoTrader** - Automated cross-chain trading engine

### 🌐 Supported Networks (45+)
**Major Chains**: Ethereum, Polygon, Arbitrum, Optimism, Base, BNB, Avalanche  
**Emerging**: Unichain, Blast, World Chain, Berachain, Sonic, Abstract  
**Gaming/NFT**: Ronin, ApeChain, Galactica  
**And 30+ more via single Alchemy API key**

### 📊 Live Data Sources
- **CoinGecko API** - Real-time token prices
- **Alchemy API** - 45+ blockchain network access
- **The Graph** - DEX liquidity data (Uniswap, SushiSwap)

## 🚀 Features

### ✅ Multi-Chain Arbitrage
- Cross-chain price difference detection
- Multi-DEX scanning (Uniswap V2/V3, SushiSwap, PancakeSwap)
- Flash loan execution via AAVE, Balancer, dYdX
- Real-time opportunity alerts

### 📈 Live Market Data
- Real ETH, WBTC, LINK, UNI, AAVE prices
- Live gas tracking across all chains
- 5-second update cycles
- Multi-chain health monitoring

### 🔌 API Endpoints
- `GET /health` - System status across all chains
- `GET /api/prices` - Live token prices
- `GET /api/opportunities` - Current arbitrage opportunities
- `GET /api/stats` - Multi-chain statistics
- `POST /api/start|stop|pause|resume` - Trading controls

## ⚙️ Setup

### Prerequisites
- Node.js 18+
- Alchemy API key (free at https://alchemy.com)
- Optional: Private key for trading (⚠️ keep secure!)

### Installation
```bash
# Clone and install
git clone https://github.com/Web3ByVirtuAI/Arbitrage-Flashbot.git
cd Arbitrage-Flashbot
npm install

# Create your .env file locally (never commit!)
touch .env
```

### Configuration
Add to your `.env` file (replace YOUR_API_KEY):
```env
# Get free API key from https://alchemy.com
ALCHEMY_API_KEY=YOUR_API_KEY

# Bot settings
MIN_PROFIT_THRESHOLD=0.01
MAX_SLIPPAGE=0.005
PORT=3000

# Optional trading (⚠️ use test keys only)
# PRIVATE_KEY=your_test_private_key
```

### Run
```bash
# Development
npm run build
npm run dev

# Production (with PM2)
npm run build
pm2 start ecosystem.config.cjs
```

## 🛡️ Security

**⚠️ This repository contains ZERO sensitive data:**
- No `.env` files in git
- No API keys in code  
- No private keys anywhere
- Your local `.env` is gitignored

## 🎯 Current Status

**Live Bot**: https://3000-i1mgqyt1ey3fe1w45gozt-6532622b.e2b.dev

**Real Data Flowing**:
- ETH: $4,304 (-3.74% 24h)
- Gas: 1.37 Gwei (live)
- Networks: 7 active chains
- Mode: `multi-chain-live`

## 🔧 Technology Stack
- **Backend**: Node.js + TypeScript
- **Blockchain**: ethers.js + Alchemy (45+ networks)
- **APIs**: CoinGecko, The Graph, Alchemy
- **Process**: PM2 daemon management

---

**⚡ Production-ready multi-chain arbitrage bot with real API integration!**