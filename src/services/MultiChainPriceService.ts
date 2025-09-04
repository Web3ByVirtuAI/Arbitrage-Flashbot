import axios from 'axios';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { PriceData } from '../core/PriceMonitor';
import { NETWORK_CONFIG } from '../config/constants';

/**
 * Multi-chain price service for cross-chain arbitrage opportunities
 */
export class MultiChainPriceService {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private coinGeckoBaseUrl = 'https://api.coingecko.com/api/v3';
  private cache: Map<string, { data: any, timestamp: number }> = new Map();
  private cacheTimeout = 30000; // 30 seconds

  // Multi-chain token mappings
  private readonly chainTokens = {
    ethereum: ['ethereum', 'wrapped-bitcoin', 'chainlink', 'uniswap', 'aave'],
    polygon: ['matic-network', 'ethereum', 'wrapped-bitcoin', 'chainlink', 'uniswap'],
    arbitrum: ['ethereum', 'wrapped-bitcoin', 'chainlink', 'uniswap', 'arbitrum'],
    base: ['ethereum', 'wrapped-bitcoin', 'chainlink', 'uniswap', 'coinbase-wrapped-staked-eth'],
    optimism: ['ethereum', 'wrapped-bitcoin', 'chainlink', 'uniswap', 'optimism'],
    bnb: ['binancecoin', 'ethereum', 'wrapped-bitcoin', 'chainlink', 'uniswap'],
    avalanche: ['avalanche-2', 'ethereum', 'wrapped-bitcoin', 'chainlink', 'uniswap']
  };

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const supportedChains = ['ETHEREUM', 'POLYGON', 'ARBITRUM', 'BASE', 'OPTIMISM', 'BNB', 'AVALANCHE'];
    
    supportedChains.forEach(chain => {
      const config = NETWORK_CONFIG[chain as keyof typeof NETWORK_CONFIG];
      if (config?.rpcUrl) {
        try {
          const provider = new ethers.JsonRpcProvider(config.rpcUrl);
          this.providers.set(chain.toLowerCase(), provider);
          logger.info(`✅ Connected to ${config.name} (${chain})`);
        } catch (error) {
          logger.warn(`❌ Failed to connect to ${config.name}: ${error}`);
        }
      }
    });

    logger.success(`🌐 Multi-chain service initialized with ${this.providers.size} networks`);
  }

  /**
   * Get prices from all supported chains
   */
  async getAllChainPrices(): Promise<Map<string, Map<string, PriceData>>> {
    const chainPrices = new Map<string, Map<string, PriceData>>();

    try {
      logger.info('🔄 Fetching multi-chain prices...');

      // Fetch base prices for all chains
      for (const [chain, tokens] of Object.entries(this.chainTokens)) {
        try {
          const prices = await this.getChainPrices(chain, tokens);
          chainPrices.set(chain, prices);
        } catch (error) {
          logger.warn(`Failed to fetch prices for ${chain}:`, error);
          chainPrices.set(chain, new Map());
        }
      }

      logger.success(`✅ Fetched prices from ${chainPrices.size} chains`);
      return chainPrices;
    } catch (error) {
      logger.error('Error fetching multi-chain prices:', error);
      return chainPrices;
    }
  }

  /**
   * Get prices for a specific chain
   */
  private async getChainPrices(chain: string, tokenIds: string[]): Promise<Map<string, PriceData>> {
    const cacheKey = `prices_${chain}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(
        `${this.coinGeckoBaseUrl}/simple/price`,
        {
          params: {
            ids: tokenIds.join(','),
            vs_currencies: 'usd',
            include_24hr_change: 'true',
            include_24hr_vol: 'true'
          },
          timeout: 10000
        }
      );

      const prices = new Map<string, PriceData>();
      const timestamp = Date.now();

      for (const [tokenId, data] of Object.entries(response.data)) {
        const tokenData = data as any;
        const symbol = this.getSymbolFromCoinGeckoId(tokenId);
        
        prices.set(symbol, {
          symbol,
          price: tokenData.usd,
          change24h: tokenData.usd_24h_change || 0,
          volume24h: tokenData.usd_24h_vol || 0,
          timestamp,
          source: `CoinGecko-${chain}`,
          chain
        });
      }

      this.setCache(cacheKey, prices);
      return prices;
    } catch (error) {
      logger.error(`Error fetching ${chain} prices:`, error);
      return new Map();
    }
  }

  /**
   * Find cross-chain arbitrage opportunities
   */
  async findCrossChainOpportunities(): Promise<any[]> {
    try {
      const allPrices = await this.getAllChainPrices();
      const opportunities: any[] = [];

      // Compare same tokens across different chains
      const tokenSymbols = new Set<string>();
      for (const chainPrices of allPrices.values()) {
        for (const symbol of chainPrices.keys()) {
          tokenSymbols.add(symbol);
        }
      }

      for (const symbol of tokenSymbols) {
        const tokenPrices: { chain: string, price: number, data: PriceData }[] = [];

        // Collect prices for this token across all chains
        for (const [chain, prices] of allPrices) {
          const priceData = prices.get(symbol);
          if (priceData) {
            tokenPrices.push({
              chain,
              price: priceData.price,
              data: priceData
            });
          }
        }

        // Find arbitrage opportunities (need at least 2 chains)
        if (tokenPrices.length >= 2) {
          tokenPrices.sort((a, b) => a.price - b.price);
          
          const cheapest = tokenPrices[0];
          const most_expensive = tokenPrices[tokenPrices.length - 1];
          
          const priceDiff = most_expensive.price - cheapest.price;
          const profitPercentage = (priceDiff / cheapest.price) * 100;

          // Only consider opportunities with >0.3% profit (accounting for bridge fees)
          if (profitPercentage > 0.3) {
            opportunities.push({
              id: `cross-chain-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              type: 'cross-chain',
              token: symbol,
              buyChain: cheapest.chain,
              sellChain: most_expensive.chain,
              buyPrice: cheapest.price,
              sellPrice: most_expensive.price,
              profitPercentage,
              estimatedProfit: priceDiff,
              buyNetwork: this.getNetworkConfig(cheapest.chain),
              sellNetwork: this.getNetworkConfig(most_expensive.chain),
              timestamp: Date.now(),
              priority: Math.floor(profitPercentage * 5), // Lower priority due to bridge complexity
              bridgeRequired: true
            });
          }
        }
      }

      // Sort by profitability
      opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
      
      logger.info(`🌉 Found ${opportunities.length} cross-chain arbitrage opportunities`);
      return opportunities.slice(0, 5); // Top 5 cross-chain opportunities
    } catch (error) {
      logger.error('Error finding cross-chain opportunities:', error);
      return [];
    }
  }

  /**
   * Get blockchain data for multiple chains
   */
  async getMultiChainData(): Promise<Map<string, any>> {
    const chainData = new Map();

    for (const [chain, provider] of this.providers) {
      try {
        const [blockNumber, feeData] = await Promise.all([
          provider.getBlockNumber(),
          provider.getFeeData()
        ]);

        chainData.set(chain, {
          chain,
          blockNumber,
          gasPrice: feeData.gasPrice?.toString() || '0',
          timestamp: Date.now(),
          network: this.getNetworkConfig(chain)
        });
      } catch (error) {
        logger.warn(`Failed to fetch data for ${chain}:`, error);
      }
    }

    return chainData;
  }

  /**
   * Get total value locked across all chains
   */
  async getTotalMultiChainTVL(): Promise<number> {
    try {
      // This would typically call DeFiLlama or similar API
      // For now, return estimated TVL based on major chains
      const estimatedTVL = {
        ethereum: 50000000000, // $50B
        polygon: 5000000000,   // $5B
        arbitrum: 8000000000,  // $8B
        base: 3000000000,      // $3B
        optimism: 2000000000,  // $2B
        bnb: 4000000000,       // $4B
        avalanche: 1500000000  // $1.5B
      };

      return Object.values(estimatedTVL).reduce((sum, tvl) => sum + tvl, 0);
    } catch (error) {
      logger.error('Error calculating multi-chain TVL:', error);
      return 0;
    }
  }

  // Helper methods
  private getSymbolFromCoinGeckoId(coinGeckoId: string): string {
    const mapping: { [key: string]: string } = {
      'ethereum': 'ETH',
      'wrapped-bitcoin': 'WBTC',
      'chainlink': 'LINK',
      'uniswap': 'UNI',
      'aave': 'AAVE',
      'matic-network': 'MATIC',
      'arbitrum': 'ARB',
      'optimism': 'OP',
      'binancecoin': 'BNB',
      'avalanche-2': 'AVAX'
    };
    return mapping[coinGeckoId] || coinGeckoId.toUpperCase();
  }

  private getNetworkConfig(chain: string): any {
    const chainKey = chain.toUpperCase();
    return NETWORK_CONFIG[chainKey as keyof typeof NETWORK_CONFIG] || null;
  }

  private getCached(key: string): any {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Health check across all chains
   */
  async isHealthy(): Promise<{ overall: boolean, chains: Map<string, boolean> }> {
    const chainHealth = new Map<string, boolean>();

    for (const [chain, provider] of this.providers) {
      try {
        const blockNumber = await provider.getBlockNumber();
        chainHealth.set(chain, blockNumber > 0);
      } catch {
        chainHealth.set(chain, false);
      }
    }

    const healthyChains = Array.from(chainHealth.values()).filter(healthy => healthy).length;
    const overall = healthyChains >= Math.ceil(chainHealth.size * 0.7); // 70% must be healthy

    return { overall, chains: chainHealth };
  }

  /**
   * Get supported networks
   */
  getSupportedNetworks(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get active provider count
   */
  getProviderCount(): number {
    return this.providers.size;
  }
}