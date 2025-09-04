#!/usr/bin/env node

const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

console.log('🧪 Flash Loan Arbitrage Bot - Production Testing Suite');
console.log('======================================================\n');

class ProductionTester {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            tests: []
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
        console.log(`${icons[type]} ${message}`);
        
        this.results.tests.push({
            timestamp,
            message,
            type
        });
    }

    async test(name, testFn) {
        try {
            console.log(`\n🔍 Testing: ${name}`);
            console.log('─'.repeat(50));
            
            await testFn();
            this.results.passed++;
            this.log(`PASSED: ${name}`, 'success');
        } catch (error) {
            this.results.failed++;
            this.log(`FAILED: ${name} - ${error.message}`, 'error');
        }
    }

    warn(message) {
        this.results.warnings++;
        this.log(message, 'warning');
    }

    // Test environment configuration
    async testEnvironmentConfig() {
        this.log('Checking environment configuration...');

        const requiredVars = [
            'RPC_URL_MAINNET',
            'PRIVATE_KEY',
            'WALLET_ADDRESS'
        ];

        for (const varName of requiredVars) {
            if (!process.env[varName]) {
                throw new Error(`Missing required environment variable: ${varName}`);
            }
            if (process.env[varName].includes('YOUR_')) {
                throw new Error(`Environment variable ${varName} contains placeholder value`);
            }
        }

        this.log('All required environment variables are set');

        // Check optional but important vars
        const recommendedVars = [
            'MIN_PROFIT_THRESHOLD',
            'MAX_SLIPPAGE',
            'MAX_TRADE_SIZE'
        ];

        for (const varName of recommendedVars) {
            if (!process.env[varName]) {
                this.warn(`Recommended environment variable not set: ${varName}`);
            }
        }
    }

    // Test RPC connection
    async testRPCConnection() {
        this.log('Testing RPC connection...');

        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_MAINNET);
        
        // Test basic connection
        const blockNumber = await provider.getBlockNumber();
        this.log(`Connected to Ethereum mainnet, current block: ${blockNumber}`);

        // Test response time
        const startTime = Date.now();
        await provider.getBlock('latest');
        const responseTime = Date.now() - startTime;
        
        this.log(`RPC response time: ${responseTime}ms`);
        
        if (responseTime > 1000) {
            this.warn('RPC response time is slow (>1s). Consider using a faster provider.');
        }

        // Test gas price
        const feeData = await provider.getFeeData();
        const gasPriceGwei = ethers.formatUnits(feeData.gasPrice || 0, 'gwei');
        this.log(`Current gas price: ${gasPriceGwei} Gwei`);
    }

    // Test wallet configuration
    async testWalletConfig() {
        this.log('Testing wallet configuration...');

        const privateKey = process.env.PRIVATE_KEY;
        const expectedAddress = process.env.WALLET_ADDRESS;

        // Validate private key format
        if (!privateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
            throw new Error('Private key format is invalid');
        }

        // Create wallet and verify address
        const wallet = new ethers.Wallet(privateKey);
        
        if (wallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
            throw new Error('Wallet address does not match private key');
        }

        this.log(`Wallet address verified: ${wallet.address}`);

        // Check wallet balance
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_MAINNET);
        const balance = await provider.getBalance(wallet.address);
        const balanceEth = ethers.formatEther(balance);

        this.log(`Wallet balance: ${balanceEth} ETH`);

        if (parseFloat(balanceEth) < 0.01) {
            this.warn('Wallet balance is very low. Fund wallet before live trading.');
        } else if (parseFloat(balanceEth) < 0.1) {
            this.warn('Consider adding more ETH for gas fees.');
        } else {
            this.log('Wallet balance looks good for trading');
        }
    }

    // Test DEX contract connections
    async testDEXConnections() {
        this.log('Testing DEX contract connections...');

        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_MAINNET);
        
        const dexContracts = {
            'Uniswap V2': process.env.UNISWAP_V2_ROUTER || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
            'Uniswap V3': process.env.UNISWAP_V3_ROUTER || '0xE592427A0AEce92De3Edee1F18E0157C05861564',
            'SushiSwap': process.env.SUSHISWAP_ROUTER || '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'
        };

        for (const [name, address] of Object.entries(dexContracts)) {
            try {
                const code = await provider.getCode(address);
                if (code === '0x') {
                    throw new Error(`No contract found at address ${address}`);
                }
                this.log(`${name} contract verified at ${address}`);
            } catch (error) {
                throw new Error(`Failed to verify ${name} contract: ${error.message}`);
            }
        }
    }

    // Test flash loan provider connections
    async testFlashLoanProviders() {
        this.log('Testing flash loan provider connections...');

        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_MAINNET);
        
        const flashLoanProviders = {
            'AAVE': process.env.AAVE_POOL_ADDRESS || '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
            'Balancer': process.env.BALANCER_VAULT_ADDRESS || '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
        };

        for (const [name, address] of Object.entries(flashLoanProviders)) {
            try {
                const code = await provider.getCode(address);
                if (code === '0x') {
                    throw new Error(`No contract found at address ${address}`);
                }
                this.log(`${name} flash loan provider verified at ${address}`);
            } catch (error) {
                throw new Error(`Failed to verify ${name} provider: ${error.message}`);
            }
        }
    }

    // Test API server connectivity
    async testAPIServer() {
        this.log('Testing API server connectivity...');

        const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
        
        // Test health endpoint
        try {
            const healthResponse = await axios.get(`${baseUrl}/health`);
            this.log(`Health check passed: ${healthResponse.status}`);
        } catch (error) {
            throw new Error(`Health check failed: ${error.message}`);
        }

        // Test API endpoints
        const endpoints = [
            '/api/opportunities',
            '/api/prices',
            '/api/stats'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await axios.get(`${baseUrl}${endpoint}`);
                this.log(`${endpoint} endpoint responded: ${response.status}`);
            } catch (error) {
                throw new Error(`${endpoint} endpoint failed: ${error.message}`);
            }
        }
    }

    // Test trading parameters
    async testTradingParameters() {
        this.log('Testing trading parameters...');

        const params = {
            MIN_PROFIT_THRESHOLD: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.01'),
            MAX_SLIPPAGE: parseFloat(process.env.MAX_SLIPPAGE || '0.01'),
            MAX_TRADE_SIZE: parseFloat(process.env.MAX_TRADE_SIZE || '1000'),
            GAS_PRICE_GWEI: parseInt(process.env.GAS_PRICE_GWEI || '20')
        };

        // Validate parameters
        if (params.MIN_PROFIT_THRESHOLD <= 0) {
            throw new Error('MIN_PROFIT_THRESHOLD must be positive');
        }
        if (params.MAX_SLIPPAGE <= 0 || params.MAX_SLIPPAGE > 0.1) {
            throw new Error('MAX_SLIPPAGE must be between 0 and 0.1 (10%)');
        }
        if (params.MAX_TRADE_SIZE <= 0) {
            throw new Error('MAX_TRADE_SIZE must be positive');
        }
        if (params.GAS_PRICE_GWEI <= 0) {
            throw new Error('GAS_PRICE_GWEI must be positive');
        }

        this.log('All trading parameters are valid');

        // Recommendations
        if (params.MIN_PROFIT_THRESHOLD < 0.005) {
            this.warn('Very low profit threshold may result in unprofitable trades due to gas costs');
        }
        if (params.MAX_SLIPPAGE > 0.02) {
            this.warn('High slippage tolerance may result in poor execution prices');
        }
        if (params.MAX_TRADE_SIZE > 5000) {
            this.warn('Large trade size increases risk - consider starting smaller');
        }
    }

    // Test security configuration
    async testSecurityConfig() {
        this.log('Testing security configuration...');

        // Check file permissions
        try {
            const envStats = fs.statSync('.env');
            const permissions = (envStats.mode & parseInt('777', 8)).toString(8);
            
            if (permissions !== '600') {
                this.warn(`Environment file permissions are ${permissions}, recommended: 600`);
            } else {
                this.log('Environment file permissions are secure');
            }
        } catch (error) {
            throw new Error('.env file not found or inaccessible');
        }

        // Check for demo mode
        if (process.env.DEMO_MODE === 'true') {
            this.log('Demo mode is enabled - safe for testing');
        } else {
            this.warn('Demo mode is disabled - will execute real trades!');
        }

        // Check for dry run mode
        if (process.env.DRY_RUN === 'true') {
            this.log('Dry run mode is enabled - transactions will be simulated');
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🚀 Starting comprehensive production tests...\n');

        await this.test('Environment Configuration', () => this.testEnvironmentConfig());
        await this.test('RPC Connection', () => this.testRPCConnection());
        await this.test('Wallet Configuration', () => this.testWalletConfig());
        await this.test('DEX Connections', () => this.testDEXConnections());
        await this.test('Flash Loan Providers', () => this.testFlashLoanProviders());
        await this.test('API Server', () => this.testAPIServer());
        await this.test('Trading Parameters', () => this.testTradingParameters());
        await this.test('Security Configuration', () => this.testSecurityConfig());

        this.showResults();
    }

    // Show test results
    showResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(60));
        
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`⚠️  Warnings: ${this.results.warnings}`);
        
        const total = this.results.passed + this.results.failed;
        const successRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;
        
        console.log(`📈 Success Rate: ${successRate}%`);
        
        if (this.results.failed === 0) {
            console.log('\n🎉 ALL TESTS PASSED!');
            if (this.results.warnings > 0) {
                console.log('⚠️  Please review warnings above before deploying to production.');
            }
            console.log('\n✅ Your bot is ready for production deployment!');
        } else {
            console.log('\n❌ SOME TESTS FAILED');
            console.log('Please fix the issues above before deploying to production.');
        }
        
        // Save detailed results
        const resultsFile = `test-results-${Date.now()}.json`;
        fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
        console.log(`\n📄 Detailed results saved to: ${resultsFile}`);
    }
}

// Main execution
async function main() {
    const tester = new ProductionTester();
    
    try {
        await tester.runAllTests();
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    }
}

// Handle graceful exit
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Test interrupted by user');
    process.exit(0);
});

// Run tests
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ProductionTester;