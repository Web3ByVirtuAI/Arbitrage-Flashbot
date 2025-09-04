import { PriceService } from './PriceService';
import { MultiChainPriceService } from './MultiChainPriceService';
import { MoralisService } from './MoralisService';
import { MetaMaskService } from './MetaMaskService';
import { AdvancedDEXService } from './AdvancedDEXService';
import { logger } from '../utils/logger';
import { PriceData } from '../core/PriceMonitor';
import { ArbitrageOpportunity } from '../core/OpportunityFinder';

/**
 * Main API service coordinator
 * Integrates all external services and provides unified interface
 */
export class APIService {
  private priceService: PriceService;
  private multiChainService: MultiChainPriceService;
  private moralisService: MoralisService;
  public metaMaskService: MetaMaskService;
  private advancedDEXService: AdvancedDEXService;
  private isRunning: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_FREQUENCY = 5000; // 5 seconds

  // Latest data cache
  private latestPrices: Map<string, PriceData> = new Map();
  private latestOpportunities: ArbitrageOpportunity[] = [];
  private latestStats: any = {};

  constructor() {
    this.priceService = new PriceService();
    this.multiChainService = new MultiChainPriceService();
    this.moralisService = new MoralisService();
    this.metaMaskService = new MetaMaskService();
    this.advancedDEXService = new AdvancedDEXService();
  }

  /**
   * Start the API service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('API service is already running');
      return;
    }

    try {
      logger.info('🚀 Starting API service with real market data...');
      
      // Initial data fetch
      await this.updateAllData();
      
      this.isRunning = true;
      
      // Set up periodic updates
      this.updateInterval = setInterval(async () => {
        try {
          await this.updateAllData();
        } catch (error) {
          logger.error('Error during periodic update:', error);
        }
      }, this.UPDATE_FREQUENCY);

      logger.success('✅ API service started successfully');
    } catch (error) {
      logger.error('Failed to start API service:', error);
      throw error;
    }
  }

  /**
   * Stop the API service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.isRunning = false;
    logger.info('⏹️  API service stopped');
  }

  /**
   * Update all data from external APIs
   */
  private async updateAllData(): Promise<void> {
    try {
      logger.debug('🔄 Updating market data...');

      // Fetch all price data
      const priceData = await this.priceService.getAllPrices();
      
      // Update latest prices from base data
      this.latestPrices = priceData.basePrices;
      
      // Find arbitrage opportunities (all sources including advanced DEXes)
      const [singleChainOpportunities, crossChainOpportunities, moralisOpportunities, moralisCrossChainOpportunities, moralisFastOpportunities, crossDEXOpportunities] = await Promise.all([
        this.priceService.findArbitrageOpportunities(),
        this.multiChainService.findCrossChainOpportunities(),
        this.moralisService.findMoralisArbitrageOpportunities(),
        this.moralisService.findCrossChainArbitrageOpportunities(),
        this.moralisService.findFastArbitrageOpportunities(),
        this.advancedDEXService.findCrossDEXArbitrageOpportunities()
      ]);
      
      // Combine opportunities, prioritizing by profitability
      this.latestOpportunities = [
        ...singleChainOpportunities,
        ...crossChainOpportunities,
        ...moralisOpportunities,
        ...moralisCrossChainOpportunities,
        ...moralisFastOpportunities,
        ...crossDEXOpportunities
      ].sort((a, b) => b.profitPercentage - a.profitPercentage);
      
      // Get blockchain data (all sources) including Moralis rate limit status and DEX status
      const [blockchainData, multiChainData, gasOptimization, networkHealth, moralisRateLimit, dexStatus] = await Promise.all([
        this.priceService.getBlockchainData(),
        this.multiChainService.getMultiChainData(),
        this.metaMaskService.getGasOptimization(),
        this.metaMaskService.getNetworkHealth(),
        Promise.resolve(this.moralisService.getRateLimitStatus()),
        Promise.resolve(this.advancedDEXService.getDEXStatus())
      ]);
      
      // Update stats
      this.latestStats = {
        blockchain: blockchainData,
        multiChain: {
          supportedNetworks: this.multiChainService.getSupportedNetworks(),
          activeProviders: this.multiChainService.getProviderCount(),
          chainData: Array.from(multiChainData.values())
        },
        gasOptimization: {
          networks: Array.from(gasOptimization.values()),
          healthStatus: networkHealth
        },
        moralis: {
          rateLimit: moralisRateLimit,
          freeTierOptimized: true,
          supportedRpcChains: ['eth'], // Base removed for free tier optimization
          message: 'Optimized for Moralis free tier: 100 CUs/sec Node, 1,500 CUs/sec API'
        },
        advancedDEX: {
          status: dexStatus,
          message: 'Monitoring Curve, Balancer, 1inch, PancakeSwap across multiple networks'
        },
        priceData: {
          basePrices: this.latestPrices.size,
          uniswapV2Pairs: priceData.uniswapV2.size,
          uniswapV3Pools: priceData.uniswapV3.size,
          sushiSwapPairs: priceData.sushiSwap.size
        },
        opportunities: {
          total: this.latestOpportunities.length,
          crossChain: this.latestOpportunities.filter(op => op.type === 'cross-chain').length,
          moralis: this.latestOpportunities.filter(op => op.type === 'moralis-dex').length,
          crossDEX: this.latestOpportunities.filter(op => op.type === 'cross-dex').length,
          oneInch: this.latestOpportunities.filter(op => op.type === '1inch-aggregator').length,
          singleChain: this.latestOpportunities.filter(op => !op.type || !['cross-chain', 'moralis-dex', 'cross-dex', '1inch-aggregator'].includes(op.type)).length
        },
        lastUpdate: Date.now(),
        mode: 'multi-chain-live'
      };

      logger.debug(`✅ Data updated: ${this.latestPrices.size} prices, ${this.latestOpportunities.length} opportunities`);
      logger.info(`📊 Opportunity sources: Single-chain: ${this.latestOpportunities.filter(op => !op.type).length}, Cross-chain: ${this.latestOpportunities.filter(op => op.type === 'cross-chain').length}, Moralis: ${this.latestOpportunities.filter(op => op.type === 'moralis-dex').length}, Cross-DEX: ${this.latestOpportunities.filter(op => op.type === 'cross-dex').length}, 1inch: ${this.latestOpportunities.filter(op => op.type === '1inch-aggregator').length}`);
    } catch (error) {
      logger.error('Error updating market data:', error);
    }
  }

  /**
   * Get current prices
   */
  getCurrentPrices(): Map<string, PriceData> {
    return new Map(this.latestPrices);
  }

  /**
   * Get current arbitrage opportunities
   */
  getCurrentOpportunities(): ArbitrageOpportunity[] {
    return [...this.latestOpportunities];
  }

  /**
   * Get service statistics
   */
  getStats(): any {
    return {
      ...this.latestStats,
      isRunning: this.isRunning,
      updateFrequency: this.UPDATE_FREQUENCY,
      uptime: this.isRunning ? Date.now() - (this.latestStats.lastUpdate || Date.now()) : 0
    };
  }

  /**
   * Get trading statistics (for compatibility with demo mode)
   */
  getTradingStats(): any {
    return {
      totalTrades: 0,
      successfulTrades: 0, 
      failedTrades: 0,
      totalProfit: '0.0000',
      averageProfit: '0.0000',
      uptime: this.isRunning ? Date.now() - (this.latestStats.lastUpdate || Date.now()) : 0,
      mode: 'live'
    };
  }

  /**
   * Get risk statistics (for compatibility with demo mode)
   */
  getRiskStats(): any {
    return {
      dailyTradeCount: 0,
      dailyProfit: 0,
      consecutiveFailures: 0,
      riskLevel: 'low'
    };
  }

  /**
   * Get wallet balance (mock for now, would need real wallet integration)
   */
  async getWalletBalance(): Promise<string> {
    try {
      // TODO: Implement real wallet balance checking
      // For now, return mock balance
      return '5.2451';
    } catch (error) {
      logger.error('Error getting wallet balance:', error);
      return '0.0000';
    }
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      const isServiceHealthy = await this.priceService.isHealthy();
      return this.isRunning && isServiceHealthy;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed system health
   */
  async getSystemHealth(): Promise<any> {
    try {
      const priceServiceHealth = await this.priceService.isHealthy();
      const lastUpdateAge = Date.now() - (this.latestStats.lastUpdate || 0);
      
      return {
        overall: this.isRunning && priceServiceHealth && lastUpdateAge < 60000, // 1 minute
        services: {
          apiService: this.isRunning,
          priceService: priceServiceHealth,
          dataFreshness: lastUpdateAge < 60000
        },
        dataAge: lastUpdateAge,
        lastUpdate: this.latestStats.lastUpdate,
        opportunitiesCount: this.latestOpportunities.length,
        pricesCount: this.latestPrices.size
      };
    } catch (error) {
      logger.error('Error checking system health:', error);
      return {
        overall: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Force data refresh
   */
  async refresh(): Promise<void> {
    logger.info('🔄 Forcing data refresh...');
    await this.updateAllData();
  }

  /**
   * Get supported tokens
   */
  getSupportedTokens(): string[] {
    return ['WETH', 'WBTC', 'LINK', 'UNI', 'AAVE'];
  }
}