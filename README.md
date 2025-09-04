# 🌐 Multi-Chain Flash Loan Arbitrage Bot

Advanced cross-chain arbitrage bot with flash loan execution across 45+ blockchain networks.

## 🔗 Links
- **🌐 Live Demo**: https://3000-i1mgqyt1ey3fe1w45gozt-6532622b.e2b.dev
- **📂 Repository**: https://github.com/Web3ByVirtuAI/Arbitrage-Flashbot

## 🏗️ Architecture

### Core Components
- **MultiChainPriceService** - Scans 45+ networks for arbitrage opportunities
- **MoralisService** - Enhanced DEX data and cross-chain price aggregation  
- **APIService** - Coordinates real-time data from multiple sources
- **PriceService** - Live market data integration
- **OpportunityFinder** - Multi-DEX arbitrage detection
- **AutoTrader** - Automated cross-chain trading engine

### 🌐 Supported Networks (45+)
**Major Chains**: Ethereum, Polygon, Arbitrum, Optimism, Base, BNB, Avalanche  
**Emerging**: Unichain, Blast, Linea, zkSync, Mantle, Flow, Ronin  
**Gaming/NFT**: Ronin, ApeChain, Lisk, Pulsechain  
**Via Alchemy (45+ networks)** + **Via Moralis (20+ networks)**

### 📊 Live Data Sources
- **Alchemy RPC** - 45+ blockchain network access & transaction execution
- **Moralis Web3 Data API** - Enhanced DEX data, token prices, cross-chain aggregation
- **CoinGecko API** - Market data and price feeds
- **The Graph** - DEX liquidity data (Uniswap, SushiSwap)

## 🚀 Features

### ✅ Multi-Chain Arbitrage
- Cross-chain price difference detection with Moralis aggregation
- Multi-DEX scanning (Uniswap V2/V3, SushiSwap, PancakeSwap, QuickSwap)
- Enhanced DEX liquidity tracking across 20+ networks
- Flash loan execution via AAVE, Balancer, dYdX
- Real-time opportunity alerts

### 📈 Live Market Data
- Real ETH ($4,283), WBTC, LINK, UNI, AAVE prices via Moralis
- Enhanced token metadata and price feeds
- Live gas tracking across all chains
- 5-second update cycles with caching
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
- **Alchemy API key** (free at https://alchemy.com) - For RPC & transaction execution
- **Moralis API key** (free at https://moralis.com) - For enhanced DEX data
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
Add to your `.env` file:
```env
# Primary APIs (both required for full functionality)
ALCHEMY_API_KEY=your_alchemy_api_key     # Get from https://alchemy.com
MORALIS_API_KEY=your_moralis_api_key     # Get from https://moralis.com

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
- **Blockchain**: ethers.js + Alchemy RPC (45+ networks)
- **Enhanced Data**: Moralis Web3 Data API (20+ networks)
- **APIs**: Alchemy, Moralis, CoinGecko, The Graph
- **Process**: PM2 daemon management
- **Architecture**: Multi-provider failover with enhanced DEX aggregation

---

**⚡ Production-ready multi-chain arbitrage bot with real API integration!**