#!/usr/bin/env node

const { ethers } = require('ethers');
const crypto = require('crypto');

console.log('🔐 Flash Loan Arbitrage Bot - Wallet Setup Utility');
console.log('===================================================\n');

// Generate secure random wallet
function generateWallet() {
    try {
        const wallet = ethers.Wallet.createRandom();
        
        console.log('✨ New Trading Wallet Generated:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📍 Address:     ${wallet.address}`);
        console.log(`🔑 Private Key: ${wallet.privateKey}`);
        console.log(`🗂️  Mnemonic:   ${wallet.mnemonic.phrase}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log('\n⚠️  CRITICAL SECURITY WARNINGS:');
        console.log('   • Save this information in a secure location (password manager)');
        console.log('   • NEVER share your private key with anyone');
        console.log('   • NEVER store private key in code or version control');
        console.log('   • Use this wallet ONLY for the trading bot');
        console.log('   • Keep your main wallet separate');
        
        console.log('\n💰 Funding Instructions:');
        console.log(`   • Send 0.1-0.5 ETH to: ${wallet.address}`);
        console.log('   • Start with small amounts ($100-500) for testing');
        console.log('   • Never send more than you can afford to lose');
        
        console.log('\n📋 Environment Configuration:');
        console.log('   Add these lines to your .env file:');
        console.log('   ─────────────────────────────────────────────');
        console.log(`   PRIVATE_KEY=${wallet.privateKey}`);
        console.log(`   WALLET_ADDRESS=${wallet.address}`);
        console.log('   ─────────────────────────────────────────────');
        
        return wallet;
    } catch (error) {
        console.error('❌ Error generating wallet:', error.message);
        process.exit(1);
    }
}

// Validate existing wallet
function validateWallet(privateKey) {
    try {
        console.log('🔍 Validating Existing Wallet:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Remove 0x prefix if present
        const cleanKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
        
        if (cleanKey.length !== 66) {
            throw new Error('Private key must be 64 characters (plus optional 0x prefix)');
        }
        
        const wallet = new ethers.Wallet(cleanKey);
        
        console.log(`✅ Valid private key`);
        console.log(`📍 Address: ${wallet.address}`);
        
        // Generate security recommendations
        const entropy = crypto.randomBytes(32);
        const isSecure = checkPrivateKeyEntropy(cleanKey);
        
        if (isSecure) {
            console.log('🔒 Security: Good entropy detected');
        } else {
            console.log('⚠️  Security: Consider generating a new wallet for better security');
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        return wallet;
    } catch (error) {
        console.error('❌ Invalid private key:', error.message);
        process.exit(1);
    }
}

// Check private key entropy (basic security check)
function checkPrivateKeyEntropy(privateKey) {
    const keyBytes = privateKey.slice(2); // Remove 0x
    const uniqueChars = new Set(keyBytes).size;
    
    // Simple entropy check - good keys should have diverse characters
    return uniqueChars >= 12;
}

// Get wallet balance
async function checkBalance(wallet, rpcUrl) {
    try {
        console.log('\n💰 Checking Wallet Balance:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const balance = await provider.getBalance(wallet.address);
        const balanceEth = ethers.formatEther(balance);
        
        console.log(`📍 Address: ${wallet.address}`);
        console.log(`💎 ETH Balance: ${balanceEth} ETH`);
        
        if (parseFloat(balanceEth) < 0.01) {
            console.log('⚠️  Warning: Balance is very low. Fund wallet before trading.');
        } else if (parseFloat(balanceEth) < 0.1) {
            console.log('⚠️  Warning: Consider adding more ETH for gas fees.');
        } else {
            console.log('✅ Balance looks good for trading.');
        }
        
        // Get gas price for cost estimation
        const gasPrice = await provider.getFeeData();
        const gasPriceGwei = ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei');
        
        console.log(`⛽ Current Gas Price: ${gasPriceGwei} Gwei`);
        
        // Estimate transaction costs
        const avgGasUsed = 200000; // Average for flash loan transaction
        const txCost = ethers.formatEther(gasPrice.gasPrice * BigInt(avgGasUsed));
        
        console.log(`💸 Est. Transaction Cost: ${txCost} ETH`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
    } catch (error) {
        console.error('❌ Error checking balance:', error.message);
        console.error('   Make sure your RPC URL is correct and accessible');
    }
}

// Main function
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'generate':
        case 'new':
            generateWallet();
            break;
            
        case 'validate':
            const privateKey = args[1];
            if (!privateKey) {
                console.error('❌ Error: Please provide a private key to validate');
                console.error('Usage: node setup-wallet.js validate <private_key>');
                process.exit(1);
            }
            validateWallet(privateKey);
            break;
            
        case 'balance':
            const privateKeyForBalance = args[1];
            const rpcUrl = args[2];
            
            if (!privateKeyForBalance || !rpcUrl) {
                console.error('❌ Error: Please provide private key and RPC URL');
                console.error('Usage: node setup-wallet.js balance <private_key> <rpc_url>');
                process.exit(1);
            }
            
            const wallet = validateWallet(privateKeyForBalance);
            await checkBalance(wallet, rpcUrl);
            break;
            
        case 'help':
        case undefined:
            console.log('📚 Wallet Setup Utility Commands:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🆕 Generate new wallet:');
            console.log('   node scripts/setup-wallet.js generate');
            console.log('');
            console.log('🔍 Validate existing wallet:');
            console.log('   node scripts/setup-wallet.js validate <private_key>');
            console.log('');
            console.log('💰 Check wallet balance:');
            console.log('   node scripts/setup-wallet.js balance <private_key> <rpc_url>');
            console.log('');
            console.log('📋 Examples:');
            console.log('   node scripts/setup-wallet.js generate');
            console.log('   node scripts/setup-wallet.js validate 0x1234...');
            console.log('   node scripts/setup-wallet.js balance 0x1234... https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            break;
            
        default:
            console.error(`❌ Unknown command: ${command}`);
            console.error('Run "node setup-wallet.js help" for available commands');
            process.exit(1);
    }
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error.message);
    process.exit(1);
});

// Run the utility
main().catch(console.error);