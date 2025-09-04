# Flash Loan Arbitrage Bot - Production Setup Guide

## 🚨 CRITICAL SECURITY WARNING
**This bot will trade with real cryptocurrency. Only proceed if you:**
- Understand the risks of automated trading
- Are prepared to lose the capital you deploy
- Have thoroughly tested the strategy
- Understand smart contract and DeFi risks

## Prerequisites Checklist

### 1. Required Accounts & API Keys
- [ ] **Ethereum Wallet** with private key (MetaMask, hardware wallet, etc.)
- [ ] **Alchemy Account** - Free tier: https://alchemy.com
- [ ] **Infura Account** - Alternative RPC: https://infura.io  
- [ ] **Etherscan API Key** - For transaction monitoring: https://etherscan.io/apis
- [ ] **Telegram Bot** (Optional) - For notifications: @BotFather

### 2. Capital Requirements
- **Minimum**: 0.1 ETH (~$250) for testing
- **Recommended**: 1-5 ETH ($2,500-$12,500) for profitable trading
- **Gas Reserve**: Keep 0.05-0.1 ETH for transaction fees

### 3. Technical Requirements
- VPS or dedicated server (see hosting recommendations in README.md)
- Node.js 18+ environment
- Reliable internet connection with low latency

## Step 1: Create and Fund Trading Wallet

### Option A: Create New Wallet (Recommended for Trading Bot)
```bash
# Generate new wallet (KEEP PRIVATE KEY SECURE!)
node -e "
const { ethers } = require('ethers');
const wallet = ethers.Wallet.createRandom();
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
console.log('Mnemonic:', wallet.mnemonic.phrase);
"
```

### Option B: Use Existing Wallet
- Export private key from MetaMask/hardware wallet
- **NEVER use your main wallet for trading bots**
- Create a dedicated trading wallet for safety

### Fund Your Wallet
1. Send ETH to your trading wallet address
2. Keep 70% for trading, 30% for gas fees
3. Start small - you can always add more later

## Step 2: Get API Keys

### Alchemy Setup (Primary RPC)
1. Sign up at https://alchemy.com
2. Create new app → Ethereum Mainnet
3. Copy your API key from dashboard
4. Your RPC URL: `https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY`

### Infura Setup (Backup RPC)  
1. Sign up at https://infura.io
2. Create new project → Ethereum Mainnet
3. Copy Project ID
4. Your RPC URL: `https://mainnet.infura.io/v3/YOUR_PROJECT_ID`

### Etherscan API
1. Sign up at https://etherscan.io
2. Go to API Keys section
3. Create new API key
4. Copy the key for transaction monitoring

## Step 3: Configure Environment

### Production Environment File
Create `/home/user/webapp/.env` with your actual values:

```bash
# Ethereum Network Configuration
RPC_URL_MAINNET=https://eth-mainnet.alchemyapi.io/v2/YOUR_ALCHEMY_KEY
RPC_URL_BACKUP=https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID

# CRITICAL: Your trading wallet private key (KEEP SECURE!)
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
WALLET_ADDRESS=0x742d35Cc6634C0532925a3b8D6bC9C0532925a3b

# Flash Loan Providers (Mainnet Addresses)
AAVE_POOL_ADDRESS=0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
BALANCER_VAULT_ADDRESS=0xBA12222222228d8Ba445958a75a0704d566BF2C8

# DEX Addresses (Ethereum Mainnet - Verified)
UNISWAP_V2_ROUTER=0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
UNISWAP_V3_ROUTER=0xE592427A0AEce92De3Edee1F18E0157C05861564
SUSHISWAP_ROUTER=0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F

# Trading Configuration (ADJUST BASED ON YOUR RISK TOLERANCE)
MIN_PROFIT_THRESHOLD=0.015    # 1.5% minimum profit (higher = safer)
MAX_SLIPPAGE=0.005           # 0.5% maximum slippage
GAS_PRICE_GWEI=25            # Base gas price (adjust for network conditions)
MAX_GAS_LIMIT=500000         # Maximum gas per transaction

# Risk Management (CRITICAL FOR SAFETY)
MAX_TRADE_SIZE_ETH=0.5       # Maximum ETH per trade (start small!)
MAX_DAILY_TRADES=50          # Maximum trades per day
STOP_LOSS_PERCENT=5          # Stop trading if 5% daily loss

# Monitoring & Notifications
ETHERSCAN_API_KEY=your_etherscan_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token    # Optional
TELEGRAM_CHAT_ID=your_telegram_chat_id        # Optional

# Server Configuration
PORT=3000
NODE_ENV=production
```

### Environment Security
```bash
# Set proper file permissions (readable only by owner)
chmod 600 /home/user/webapp/.env

# Verify private key is not in git
cd /home/user/webapp
git status  # Should not show .env file
```

## Step 4: Deploy Smart Contracts (Optional Advanced Setup)

For maximum gas efficiency, deploy custom flash loan contracts:

### Flash Loan Arbitrage Contract
```solidity
// contracts/FlashLoanArbitrage.sol
pragma solidity ^0.8.19;

import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";

contract FlashLoanArbitrage is FlashLoanSimpleReceiverBase {
    constructor(IPoolAddressesProvider _addressProvider) 
        FlashLoanSimpleReceiverBase(_addressProvider) {}
    
    function executeArbitrage(
        address asset,
        uint256 amount,
        address dexA,
        address dexB,
        bytes calldata params
    ) external {
        POOL.flashLoanSimple(address(this), asset, amount, params, 0);
    }
    
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // Decode arbitrage parameters
        (address dexA, address dexB, address tokenA, address tokenB) = 
            abi.decode(params, (address, address, address, address));
        
        // Execute arbitrage logic here
        // 1. Swap on DEX A
        // 2. Swap on DEX B  
        // 3. Ensure profit > premium + gas
        
        // Approve pool to pull the owed amount
        uint256 amountOwed = amount + premium;
        IERC20(asset).approve(address(POOL), amountOwed);
        
        return true;
    }
}
```

## Step 5: Production Deployment

### Build and Deploy
```bash
cd /home/user/webapp

# Install production dependencies
npm install --production

# Build TypeScript
npm run build

# Test configuration
npm run test-config  # We'll create this script

# Deploy to production
pm2 start ecosystem.config.cjs --env production

# Verify deployment
pm2 logs flash-loan-bot --lines 50
```

### Production PM2 Configuration
```javascript
// ecosystem.config.cjs (updated for production)
module.exports = {
  apps: [
    {
      name: 'flash-loan-bot-prod',
      script: 'dist/index.js',
      env_production: {
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
      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 5000
    }
  ]
};
```

## Step 6: Pre-Launch Testing

### Configuration Test Script
Create testing script to verify setup:

```bash
# Test wallet connection and balance
curl http://localhost:3000/api/wallet-info

# Test RPC connections
curl http://localhost:3000/api/network-status

# Test DEX price feeds
curl http://localhost:3000/api/dex-prices

# Dry run arbitrage detection
curl http://localhost:3000/api/dry-run
```

### Start with Paper Trading
1. Set `PAPER_TRADING=true` in environment
2. Monitor for 24-48 hours
3. Verify profitable opportunities are found
4. Check gas cost estimations are accurate

## Step 7: Go Live Checklist

### Pre-Launch Verification
- [ ] Wallet has sufficient ETH balance (minimum 0.1 ETH)
- [ ] RPC endpoints are responding correctly
- [ ] Gas prices are set appropriately for current network
- [ ] Profit thresholds account for gas costs
- [ ] Emergency stop mechanisms are tested
- [ ] Monitoring and alerts are configured

### Launch Sequence
```bash
# 1. Start in monitoring mode
curl -X POST http://localhost:3000/api/monitor-only

# 2. Verify opportunities are detected
curl http://localhost:3000/api/opportunities

# 3. Execute single test trade manually
curl -X POST http://localhost:3000/api/execute-single -d '{"opportunityId":"test-123"}'

# 4. If successful, enable auto-trading
curl -X POST http://localhost:3000/api/start
```

## Step 8: Production Monitoring

### Essential Monitoring
1. **Wallet Balance**: Monitor for unexpected drops
2. **Gas Prices**: Adjust based on network conditions  
3. **Success Rate**: Should be >70% for profitable operation
4. **Profit Margins**: Account for gas cost increases
5. **Error Logs**: Watch for RPC failures, reverted transactions

### Alerts Setup
```bash
# Set up monitoring alerts
# Low balance alert
# High gas price alert  
# Low success rate alert
# RPC endpoint failure alert
```

## Risk Management & Safety

### Position Sizing
- Start with 0.1-0.5 ETH per trade
- Never risk more than 10% of portfolio per trade
- Keep 30% in reserve for gas fees

### Stop Loss Mechanisms  
- Daily loss limits (stop trading if >5% daily loss)
- Consecutive failure limits (stop after 5 failed trades)
- Maximum drawdown limits

### Emergency Procedures
```bash
# Emergency stop all trading
curl -X POST http://localhost:3000/api/emergency-stop

# Withdraw all funds to safe wallet
curl -X POST http://localhost:3000/api/emergency-withdraw
```

## Maintenance & Optimization

### Daily Tasks
- Check wallet balance and gas reserves
- Review trading logs for errors
- Monitor success rate and profitability
- Adjust gas prices based on network conditions

### Weekly Tasks  
- Review and optimize profit thresholds
- Update RPC endpoints if needed
- Check for new arbitrage opportunities/DEXs
- Backup trading logs and statistics

### Monthly Tasks
- Analyze overall profitability vs holding ETH
- Consider strategy optimizations
- Update dependencies and security patches
- Review and adjust risk parameters

---

## 🚨 FINAL WARNING

**This bot trades with real money. You can lose everything.**

- Start with small amounts you can afford to lose
- Monitor constantly during first week of operation
- DeFi protocols can have bugs, exploits, or failures
- Gas prices can spike and eliminate profits
- Network congestion can cause failed transactions
- Market conditions change rapidly

**Only proceed if you fully understand these risks.**