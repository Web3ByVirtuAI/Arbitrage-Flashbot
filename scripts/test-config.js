#!/usr/bin/env node

const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

/**
 * Test production configuration before going live
 */
async function testConfiguration() {
  console.log('\n🧪 Testing Flash Loan Bot Configuration...\n');
  
  const tests = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Environment Variables
  console.log('1️⃣  Testing Environment Variables...');
  const requiredVars = [
    'RPC_URL_MAINNET',
    'PRIVATE_KEY',
    'WALLET_ADDRESS',
    'MIN_PROFIT_THRESHOLD',
    'GAS_PRICE_GWEI'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.log('❌ Missing environment variables:', missingVars.join(', '));
    failed++;
    tests.push({ name: 'Environment Variables', status: 'FAILED', error: `Missing: ${missingVars.join(', ')}` });
  } else {
    console.log('✅ All required environment variables found');
    passed++;
    tests.push({ name: 'Environment Variables', status: 'PASSED' });
  }

  // Test 2: Wallet Connection
  console.log('\n2️⃣  Testing Wallet Connection...');
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_MAINNET);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Verify wallet address matches
    if (wallet.address.toLowerCase() !== process.env.WALLET_ADDRESS.toLowerCase()) {
      throw new Error(`Address mismatch: ${wallet.address} != ${process.env.WALLET_ADDRESS}`);
    }
    
    console.log(`✅ Wallet connected: ${wallet.address}`);
    passed++;
    tests.push({ name: 'Wallet Connection', status: 'PASSED', data: { address: wallet.address } });
  } catch (error) {
    console.log('❌ Wallet connection failed:', error.message);
    failed++;
    tests.push({ name: 'Wallet Connection', status: 'FAILED', error: error.message });
  }

  // Test 3: RPC Connection & Network
  console.log('\n3️⃣  Testing RPC Connection...');
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_MAINNET);
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    if (network.chainId !== 1n) {
      throw new Error(`Wrong network: ${network.chainId} (expected: 1 for mainnet)`);
    }
    
    console.log(`✅ Connected to Ethereum Mainnet (Chain ID: ${network.chainId})`);
    console.log(`   Latest block: ${blockNumber}`);
    passed++;
    tests.push({ 
      name: 'RPC Connection', 
      status: 'PASSED', 
      data: { chainId: network.chainId.toString(), blockNumber } 
    });
  } catch (error) {
    console.log('❌ RPC connection failed:', error.message);
    failed++;
    tests.push({ name: 'RPC Connection', status: 'FAILED', error: error.message });
  }

  // Test 4: Wallet Balance
  console.log('\n4️⃣  Testing Wallet Balance...');
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_MAINNET);
    const balance = await provider.getBalance(process.env.WALLET_ADDRESS);
    const balanceEth = ethers.formatEther(balance);
    
    if (parseFloat(balanceEth) < 0.05) {
      console.log(`⚠️  Low balance: ${balanceEth} ETH (recommended: >0.1 ETH)`);
      tests.push({ 
        name: 'Wallet Balance', 
        status: 'WARNING', 
        data: { balance: balanceEth },
        warning: 'Balance may be too low for profitable trading'
      });
    } else {
      console.log(`✅ Wallet balance: ${balanceEth} ETH`);
      passed++;
      tests.push({ name: 'Wallet Balance', status: 'PASSED', data: { balance: balanceEth } });
    }
  } catch (error) {
    console.log('❌ Balance check failed:', error.message);
    failed++;
    tests.push({ name: 'Wallet Balance', status: 'FAILED', error: error.message });
  }

  // Test 5: Gas Price Configuration
  console.log('\n5️⃣  Testing Gas Configuration...');
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_MAINNET);
    const feeData = await provider.getFeeData();
    const configuredGasPrice = ethers.parseUnits(process.env.GAS_PRICE_GWEI, 'gwei');
    const currentGasPrice = feeData.gasPrice;
    
    console.log(`   Current network gas price: ${ethers.formatUnits(currentGasPrice, 'gwei')} gwei`);
    console.log(`   Configured gas price: ${process.env.GAS_PRICE_GWEI} gwei`);
    
    if (configuredGasPrice < currentGasPrice / 2n) {
      console.log(`⚠️  Configured gas price may be too low for reliable execution`);
      tests.push({
        name: 'Gas Configuration',
        status: 'WARNING',
        data: { configured: process.env.GAS_PRICE_GWEI, current: ethers.formatUnits(currentGasPrice, 'gwei') },
        warning: 'Consider increasing gas price for better execution'
      });
    } else {
      console.log(`✅ Gas configuration looks reasonable`);
      passed++;
      tests.push({ name: 'Gas Configuration', status: 'PASSED' });
    }
  } catch (error) {
    console.log('❌ Gas configuration test failed:', error.message);
    failed++;
    tests.push({ name: 'Gas Configuration', status: 'FAILED', error: error.message });
  }

  // Test 6: DEX Contract Accessibility
  console.log('\n6️⃣  Testing DEX Contract Accessibility...');
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_MAINNET);
    const uniswapRouter = process.env.UNISWAP_V2_ROUTER;
    
    // Simple call to verify contract exists
    const code = await provider.getCode(uniswapRouter);
    if (code === '0x') {
      throw new Error(`No contract found at Uniswap V2 Router address: ${uniswapRouter}`);
    }
    
    console.log(`✅ DEX contracts accessible`);
    passed++;
    tests.push({ name: 'DEX Contract Access', status: 'PASSED' });
  } catch (error) {
    console.log('❌ DEX contract test failed:', error.message);
    failed++;
    tests.push({ name: 'DEX Contract Access', status: 'FAILED', error: error.message });
  }

  // Test 7: Profit Threshold Validation
  console.log('\n7️⃣  Testing Profit Thresholds...');
  try {
    const minProfit = parseFloat(process.env.MIN_PROFIT_THRESHOLD);
    const gasPrice = parseFloat(process.env.GAS_PRICE_GWEI);
    const maxGasLimit = parseInt(process.env.MAX_GAS_LIMIT);
    
    // Estimate gas cost in ETH (rough calculation)
    const estimatedGasCostEth = (gasPrice * maxGasLimit) / 1e9; // Convert gwei to ETH
    
    console.log(`   Minimum profit threshold: ${(minProfit * 100).toFixed(2)}%`);
    console.log(`   Estimated max gas cost: ~${estimatedGasCostEth.toFixed(6)} ETH`);
    
    if (minProfit < 0.01) {
      console.log(`⚠️  Profit threshold may be too low considering gas costs`);
      tests.push({
        name: 'Profit Thresholds',
        status: 'WARNING',
        warning: 'Consider higher profit threshold to account for gas costs'
      });
    } else {
      console.log(`✅ Profit threshold configuration looks reasonable`);
      passed++;
      tests.push({ name: 'Profit Thresholds', status: 'PASSED' });
    }
  } catch (error) {
    console.log('❌ Profit threshold test failed:', error.message);
    failed++;
    tests.push({ name: 'Profit Thresholds', status: 'FAILED', error: error.message });
  }

  // Summary
  console.log('\n📊 CONFIGURATION TEST SUMMARY');
  console.log('================================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${tests.filter(t => t.status === 'WARNING').length}`);
  
  console.log('\n📋 DETAILED RESULTS:');
  tests.forEach((test, index) => {
    const icon = test.status === 'PASSED' ? '✅' : test.status === 'WARNING' ? '⚠️ ' : '❌';
    console.log(`${index + 1}. ${icon} ${test.name}: ${test.status}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
    if (test.warning) {
      console.log(`   Warning: ${test.warning}`);
    }
  });

  console.log('\n🚀 READINESS ASSESSMENT:');
  if (failed === 0) {
    console.log('✅ Configuration looks good! Ready for production deployment.');
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Start with paper trading mode first');
    console.log('2. Monitor for 24-48 hours before going live');
    console.log('3. Begin with small trade sizes');
    console.log('4. Set up monitoring and alerts');
    return true;
  } else {
    console.log('❌ Configuration has issues that must be resolved before production.');
    console.log('\n🔧 REQUIRED ACTIONS:');
    console.log('1. Fix all failed tests above');
    console.log('2. Review warnings and adjust settings');
    console.log('3. Re-run this test before deployment');
    return false;
  }
}

if (require.main === module) {
  testConfiguration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed with error:', error);
      process.exit(1);
    });
}

module.exports = { testConfiguration };