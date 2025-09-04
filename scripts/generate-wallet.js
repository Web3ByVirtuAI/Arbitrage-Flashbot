#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Generate a new Ethereum wallet for trading
 * KEEP THE PRIVATE KEY SECURE - NEVER SHARE IT!
 */
function generateWallet() {
  console.log('\n🔐 Generating new Ethereum wallet for trading bot...\n');
  
  // Generate random wallet
  const wallet = ethers.Wallet.createRandom();
  
  console.log('📋 WALLET INFORMATION (KEEP SECURE!):');
  console.log('=====================================');
  console.log(`Address: ${wallet.address}`);
  console.log(`Private Key: ${wallet.privateKey}`);
  console.log(`Mnemonic: ${wallet.mnemonic.phrase}`);
  console.log('=====================================\n');
  
  // Generate .env template
  const envTemplate = `# PRODUCTION CONFIGURATION - Generated ${new Date().toISOString()}

# Ethereum Network Configuration  
RPC_URL_MAINNET=https://eth-mainnet.alchemyapi.io/v2/YOUR_ALCHEMY_API_KEY
RPC_URL_BACKUP=https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID

# Trading Wallet (KEEP SECURE!)
PRIVATE_KEY=${wallet.privateKey}
WALLET_ADDRESS=${wallet.address}

# Flash Loan Providers
AAVE_POOL_ADDRESS=0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
BALANCER_VAULT_ADDRESS=0xBA12222222228d8Ba445958a75a0704d566BF2C8

# DEX Addresses (Ethereum Mainnet)
UNISWAP_V2_ROUTER=0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
UNISWAP_V3_ROUTER=0xE592427A0AEce92De3Edee1F18E0157C05861564
SUSHISWAP_ROUTER=0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F

# Trading Configuration (ADJUST FOR YOUR RISK TOLERANCE)
MIN_PROFIT_THRESHOLD=0.015    # 1.5% minimum profit
MAX_SLIPPAGE=0.005           # 0.5% maximum slippage  
GAS_PRICE_GWEI=25            # Base gas price
MAX_GAS_LIMIT=500000         # Maximum gas per transaction

# Risk Management
MAX_TRADE_SIZE_ETH=0.5       # Start small!
MAX_DAILY_TRADES=50
STOP_LOSS_PERCENT=5

# API Keys (REPLACE WITH YOUR KEYS)
ETHERSCAN_API_KEY=your_etherscan_api_key
# TELEGRAM_BOT_TOKEN=your_telegram_bot_token
# TELEGRAM_CHAT_ID=your_telegram_chat_id

# Server Configuration
PORT=3000
NODE_ENV=production
`;

  // Save to .env.production file
  const envPath = path.join(process.cwd(), '.env.production');
  fs.writeFileSync(envPath, envTemplate);
  
  // Set secure permissions
  try {
    fs.chmodSync(envPath, 0o600); // Read/write for owner only
  } catch (error) {
    console.log('⚠️  Could not set file permissions. Manually run: chmod 600 .env.production');
  }
  
  console.log('💾 Configuration saved to: .env.production');
  console.log('\n🔧 NEXT STEPS:');
  console.log('1. Replace YOUR_ALCHEMY_API_KEY with your Alchemy API key');
  console.log('2. Replace YOUR_INFURA_PROJECT_ID with your Infura project ID');  
  console.log('3. Fund this wallet address with ETH for trading');
  console.log('4. Copy .env.production to .env for production use');
  console.log('5. Review and adjust risk management settings');
  
  console.log('\n⚠️  SECURITY WARNINGS:');
  console.log('- NEVER commit the .env file to git');
  console.log('- NEVER share your private key with anyone');
  console.log('- This wallet is for TRADING ONLY - not for long-term storage');
  console.log('- Start with small amounts you can afford to lose');
  
  console.log('\n💰 FUNDING YOUR WALLET:');
  console.log(`Send ETH to: ${wallet.address}`);
  console.log('Recommended amounts:');
  console.log('- Testing: 0.1 ETH (~$250)');
  console.log('- Small scale: 0.5-1 ETH ($1,250-$2,500)');
  console.log('- Production: 2-5 ETH ($5,000-$12,500)');
}

if (require.main === module) {
  generateWallet();
}

module.exports = { generateWallet };