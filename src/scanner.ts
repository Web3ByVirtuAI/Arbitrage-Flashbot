#!/usr/bin/env node

import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { logger } from './utils/logger';
import { OpportunityFinder } from './core/OpportunityFinder';
import { PriceMonitor } from './core/PriceMonitor';
import { NETWORK_CONFIG } from './config/constants';

// Load environment variables
dotenv.config();

/**
 * Standalone opportunity scanner
 * Use this to test and monitor arbitrage opportunities without executing trades
 */
class OpportunityScanner {
  private provider: ethers.JsonRpcProvider;
  private opportunityFinder: OpportunityFinder;
  private priceMonitor: PriceMonitor;
  
  constructor() {
    this.provider = new ethers.JsonRpcProvider(
      process.env.RPC_URL_MAINNET || NETWORK_CONFIG.ETHEREUM.rpcUrl
    );
    this.opportunityFinder = new OpportunityFinder(this.provider);
    this.priceMonitor = new PriceMonitor();
  }

  async start(): Promise<void> {
    logger.info('🔍 Starting Opportunity Scanner...');
    
    try {
      // Start price monitoring
      await this.priceMonitor.startMonitoring();
      
      // Setup price update callbacks
      this.priceMonitor.onPriceUpdate((update) => {
        logger.debug(`Price Update: ${update.symbol} = $${update.price}`);
      });
      
      // Start opportunity scanning
      await this.opportunityFinder.startScanning();
      
      // Setup periodic reporting
      this.setupReporting();
      
      logger.success('✅ Opportunity Scanner is running!');
      logger.info('Press Ctrl+C to stop');
      
    } catch (error) {
      logger.error('Failed to start scanner:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    logger.info('🛑 Stopping Opportunity Scanner...');
    
    try {
      await this.opportunityFinder.stopScanning();
      await this.priceMonitor.stopMonitoring();
      logger.success('✅ Scanner stopped');
    } catch (error) {
      logger.error('Error stopping scanner:', error);
    }
  }

  private setupReporting(): void {
    // Report opportunities every 30 seconds
    setInterval(() => {
      this.reportOpportunities();
    }, 30000);

    // Report price monitor stats every 60 seconds
    setInterval(() => {
      this.reportPriceStats();
    }, 60000);
  }

  private reportOpportunities(): void {
    const opportunities = this.opportunityFinder.getOpportunities();
    
    if (opportunities.length === 0) {
      logger.info('📊 No profitable opportunities found');
      return;
    }

    logger.info(`📊 Found ${opportunities.length} opportunities:`);
    
    opportunities.slice(0, 5).forEach((opp, index) => {
      logger.opportunity(
        `#${index + 1}: ${opp.profitPercentage.toFixed(4)}% profit`,
        {
          tokens: `${this.getTokenSymbol(opp.tokenA)} → ${this.getTokenSymbol(opp.tokenB)}`,
          dexA: opp.dexA.name,
          dexB: opp.dexB.name,
          expectedProfit: `${opp.expectedProfit} ETH`,
          age: `${Math.round((Date.now() - opp.timestamp) / 1000)}s ago`
        }
      );
    });
  }

  private reportPriceStats(): void {
    const stats = this.priceMonitor.getStats();
    const prices = this.priceMonitor.getAllPrices();
    
    logger.info('📈 Price Monitor Status:', {
      isMonitoring: stats.isMonitoring,
      wsConnections: stats.wsConnections,
      trackedTokens: stats.trackedTokens,
      lastUpdate: new Date(stats.lastUpdate).toLocaleTimeString()
    });

    // Show current prices
    const priceArray = Array.from(prices.entries());
    if (priceArray.length > 0) {
      logger.info('💰 Current Prices:');
      priceArray.forEach(([symbol, data]) => {
        const change = data.change24h >= 0 ? '+' : '';
        logger.info(`  ${symbol}: $${data.price.toFixed(4)} (${change}${data.change24h.toFixed(2)}%)`);
      });
    }
  }

  private getTokenSymbol(address: string): string {
    const tokenMap: { [key: string]: string } = {
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'WETH',
      '0xA0b86a33E6417c13C812C72De3FE58dD2C5d1D65': 'USDC',
      '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT',
      '0x6B175474E89094C44Da98b954EedeAC495271d0F': 'DAI',
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 'WBTC'
    };
    
    return tokenMap[address] || address.slice(0, 8) + '...';
  }
}

// Initialize scanner
const scanner = new OpportunityScanner();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await scanner.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await scanner.stop();
  process.exit(0);
});

// Start scanner
if (require.main === module) {
  scanner.start().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export default OpportunityScanner;