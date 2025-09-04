import { PriceData, WebSocketPriceUpdate } from '../core/PriceMonitor';
import { ArbitrageOpportunity } from '../core/OpportunityFinder';
import { logger } from '../utils/logger';

/**
 * Demo data provider for showcasing bot functionality
 * Provides realistic mock data when running without live connections
 */
export class DemoDataProvider {
  private opportunities: ArbitrageOpportunity[] = [];
  private prices: Map<string, PriceData> = new Map();
  private isRunning: boolean = false;
  private callbacks: ((update: WebSocketPriceUpdate) => void)[] = [];

  constructor() {
    this.initializeDemoData();
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('🎯 Starting demo mode with simulated data...');
    
    // Update demo data periodically
    setInterval(() => {
      if (this.isRunning) {
        this.updateDemoData();
      }
    }, 3000);
  }

  stop(): void {
    this.isRunning = false;
    logger.info('⏹️  Demo mode stopped');
  }

  private initializeDemoData(): void {
    // Initialize demo price data
    const demoTokens = [
      { symbol: 'WETH', price: 2456.78, change24h: 2.34 },
      { symbol: 'USDC', price: 1.0002, change24h: 0.01 },
      { symbol: 'USDT', price: 0.9998, change24h: -0.02 },
      { symbol: 'DAI', price: 1.0001, change24h: 0.003 },
      { symbol: 'WBTC', price: 58432.12, change24h: -1.23 }
    ];

    demoTokens.forEach(token => {
      this.prices.set(token.symbol, {
        symbol: token.symbol,
        price: token.price,
        change24h: token.change24h,
        volume24h: Math.random() * 1000000 + 50000,
        timestamp: Date.now(),
        source: 'Demo'
      });
    });

    // Initialize demo opportunities
    this.generateDemoOpportunities();
  }

  private generateDemoOpportunities(): void {
    const tokenAddresses = {
      'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      'USDC': '0xA0b86a33E6417c13C812C72De3FE58dD2C5d1D65',
      'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    };

    const dexPairs = [
      { dexA: 'Uniswap V2', dexB: 'SushiSwap', routerA: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', routerB: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F' },
      { dexA: 'Uniswap V3', dexB: 'Uniswap V2', routerA: '0xE592427A0AEce92De3Edee1F18E0157C05861564', routerB: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
      { dexA: 'SushiSwap', dexB: 'Uniswap V3', routerA: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', routerB: '0xE592427A0AEce92De3Edee1F18E0157C05861564' }
    ];

    const tokenPairs = [
      ['WETH', 'USDC'],
      ['WETH', 'USDT'], 
      ['USDC', 'DAI'],
      ['WETH', 'DAI']
    ];

    this.opportunities = [];

    // Generate 3-5 demo opportunities
    const numOpportunities = Math.floor(Math.random() * 3) + 3;
    
    for (let i = 0; i < numOpportunities; i++) {
      const tokenPair = tokenPairs[Math.floor(Math.random() * tokenPairs.length)];
      const dexPair = dexPairs[Math.floor(Math.random() * dexPairs.length)];
      const profitPercentage = Math.random() * 3 + 0.5; // 0.5% to 3.5% profit
      const amountIn = (Math.random() * 5 + 1).toFixed(2); // 1-6 ETH
      const expectedProfit = (parseFloat(amountIn) * profitPercentage / 100).toFixed(6);
      
      const opportunity: ArbitrageOpportunity = {
        id: `demo-${i}-${Date.now()}`,
        tokenA: tokenAddresses[tokenPair[0] as keyof typeof tokenAddresses],
        tokenB: tokenAddresses[tokenPair[1] as keyof typeof tokenAddresses],
        amountIn: amountIn,
        expectedProfit: expectedProfit,
        profitPercentage: profitPercentage,
        dexA: {
          name: dexPair.dexA,
          router: dexPair.routerA,
          priceA: (Math.random() * 1000 + 1000).toFixed(2)
        },
        dexB: {
          name: dexPair.dexB,
          router: dexPair.routerB,
          priceB: (Math.random() * 1000 + 1000).toFixed(2)
        },
        gasEstimate: (Math.random() * 0.02 + 0.01).toFixed(6),
        timestamp: Date.now() - Math.floor(Math.random() * 30000), // Up to 30 seconds old
        priority: Math.floor(profitPercentage * 10)
      };

      this.opportunities.push(opportunity);
    }
  }

  private updateDemoData(): void {
    // Update prices with small random changes
    for (const [symbol, priceData] of this.prices) {
      const change = (Math.random() - 0.5) * 0.02; // ±1% change
      const newPrice = priceData.price * (1 + change);
      const newChange24h = priceData.change24h + (Math.random() - 0.5) * 0.1;
      
      const updatedPrice: PriceData = {
        ...priceData,
        price: newPrice,
        change24h: newChange24h,
        timestamp: Date.now()
      };
      
      this.prices.set(symbol, updatedPrice);
      
      // Notify price update callbacks
      const update: WebSocketPriceUpdate = {
        symbol,
        price: newPrice,
        timestamp: Date.now()
      };
      
      this.callbacks.forEach(callback => {
        try {
          callback(update);
        } catch (error) {
          logger.error('Error in demo price update callback:', error);
        }
      });
    }

    // Randomly remove old opportunities and add new ones
    if (Math.random() < 0.3) { // 30% chance
      // Remove oldest opportunity
      this.opportunities.shift();
      
      // Maybe add a new one
      if (Math.random() < 0.7) { // 70% chance to add new opportunity
        this.generateDemoOpportunities();
      }
    }

    // Update opportunity timestamps to make them age
    this.opportunities.forEach(opp => {
      // Don't modify timestamp, let them age naturally
    });

    logger.debug(`Demo data updated: ${this.prices.size} prices, ${this.opportunities.length} opportunities`);
  }

  getOpportunities(): ArbitrageOpportunity[] {
    return [...this.opportunities].sort((a, b) => b.profitPercentage - a.profitPercentage);
  }

  getPrices(): Map<string, PriceData> {
    return new Map(this.prices);
  }

  onPriceUpdate(callback: (update: WebSocketPriceUpdate) => void): void {
    this.callbacks.push(callback);
  }

  getStats(): any {
    return {
      isMonitoring: this.isRunning,
      wsConnections: 0,
      trackedTokens: this.prices.size,
      subscribers: this.callbacks.length,
      lastUpdate: Math.max(...Array.from(this.prices.values()).map(p => p.timestamp)),
      mode: 'demo'
    };
  }

  isHealthy(): boolean {
    return this.isRunning;
  }
}