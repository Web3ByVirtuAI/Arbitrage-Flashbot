import axios from 'axios';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { PriceData } from '../core/PriceMonitor';

/**
 * Real-time price service integrating multiple data sources
 * Replaces mock data with live market feeds
 */
export class PriceService {
  private providers: ethers.JsonRpcProvider[];
  private coinGeckoBaseUrl = 'https://api.coingecko.com/api/v3';
  private alchemyApiKey: string;
  private cache: Map<string, { data: any, timestamp: number }> = new Map();
  private cacheTimeout = 30000; // 30 seconds

  // Token mappings for real contracts
  private readonly tokenAddresses = {
    'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    'LINK': '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    'UNI': '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    'AAVE': '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9'
  };

  private readonly coinGeckoIds = {
    'WETH': 'ethereum',
    'WBTC': 'wrapped-bitcoin', 
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'AAVE': 'aave'
  };

  constructor() {
    this.alchemyApiKey = process.env.ALCHEMY_API_KEY || '';
    
    // Initialize multiple RPC providers for redundancy
    const mainnetUrl = process.env.RPC_URL_MAINNET;
    const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${this.alchemyApiKey}`;
    
    this.providers = [
      mainnetUrl ? new ethers.JsonRpcProvider(mainnetUrl) : null,
      this.alchemyApiKey ? new ethers.JsonRpcProvider(alchemyUrl) : null
    ].filter((p): p is ethers.JsonRpcProvider => p !== null);

    if (this.providers.length === 0) {
      throw new Error('No valid RPC providers configured');
    }
  }

  /**
   * Get base prices from CoinGecko API
   */
  async getBasePrices(): Promise<Map<string, PriceData>> {
    const cacheKey = 'base_prices';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const tokenIds = Object.values(this.coinGeckoIds).join(',');
      const response = await axios.get(
        `${this.coinGeckoBaseUrl}/simple/price`,
        {
          params: {
            ids: tokenIds,
            vs_currencies: 'usd',
            include_24hr_change: 'true',
            include_24hr_vol: 'true'
          },
          timeout: 10000
        }
      );

      const prices = new Map<string, PriceData>();
      const timestamp = Date.now();

      for (const [symbol, geckoId] of Object.entries(this.coinGeckoIds)) {
        const data = response.data[geckoId];
        if (data) {
          prices.set(symbol, {
            symbol,
            price: data.usd,
            change24h: data.usd_24h_change || 0,
            volume24h: data.usd_24h_vol || 0,
            timestamp,
            source: 'CoinGecko'
          });
        }
      }

      // Cache the results
      this.setCache(cacheKey, prices);
      logger.info(`✅ Fetched ${prices.size} base prices from CoinGecko`);
      
      return prices;
    } catch (error) {
      logger.error('Failed to fetch CoinGecko prices:', error);
      throw error;
    }
  }

  /**
   * Get Uniswap V2 prices using The Graph
   */
  async getUniswapV2Prices(): Promise<Map<string, any>> {
    const cacheKey = 'uniswap_v2_prices';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const query = `
        query {
          pairs(first: 100, orderBy: volumeUSD, orderDirection: desc) {
            id
            token0 {
              id
              symbol
              name
            }
            token1 {
              id
              symbol
              name  
            }
            reserve0
            reserve1
            token0Price
            token1Price
            volumeUSD
            txCount
          }
        }
      `;

      const response = await axios.post(
        'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
        { query },
        { timeout: 10000 }
      );

      const pairs = new Map();
      if (response.data?.data?.pairs) {
        response.data.data.pairs.forEach((pair: any) => {
          // Filter for tokens we care about
          if (this.isTrackedToken(pair.token0.symbol) || this.isTrackedToken(pair.token1.symbol)) {
            pairs.set(pair.id, {
              ...pair,
              source: 'Uniswap V2',
              timestamp: Date.now()
            });
          }
        });
      }

      this.setCache(cacheKey, pairs);
      logger.info(`✅ Fetched ${pairs.size} Uniswap V2 pairs`);
      
      return pairs;
    } catch (error) {
      logger.error('Failed to fetch Uniswap V2 prices:', error);
      return new Map();
    }
  }

  /**
   * Get Uniswap V3 prices using The Graph
   */
  async getUniswapV3Prices(): Promise<Map<string, any>> {
    const cacheKey = 'uniswap_v3_prices';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const query = `
        query {
          pools(first: 100, orderBy: volumeUSD, orderDirection: desc) {
            id
            token0 {
              id
              symbol
              name
            }
            token1 {
              id
              symbol
              name
            }
            feeTier
            liquidity
            token0Price  
            token1Price
            volumeUSD
            txCount
          }
        }
      `;

      const response = await axios.post(
        'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
        { query },
        { timeout: 10000 }
      );

      const pools = new Map();
      if (response.data?.data?.pools) {
        response.data.data.pools.forEach((pool: any) => {
          // Filter for tokens we care about
          if (this.isTrackedToken(pool.token0.symbol) || this.isTrackedToken(pool.token1.symbol)) {
            pools.set(pool.id, {
              ...pool,
              source: 'Uniswap V3',
              timestamp: Date.now()
            });
          }
        });
      }

      this.setCache(cacheKey, pools);
      logger.info(`✅ Fetched ${pools.size} Uniswap V3 pools`);
      
      return pools;
    } catch (error) {
      logger.error('Failed to fetch Uniswap V3 prices:', error);
      return new Map();
    }
  }

  /**
   * Get SushiSwap prices using The Graph
   */
  async getSushiSwapPrices(): Promise<Map<string, any>> {
    const cacheKey = 'sushiswap_prices';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const query = `
        query {
          pairs(first: 100, orderBy: volumeUSD, orderDirection: desc) {
            id
            token0 {
              id
              symbol
              name
            }
            token1 {
              id
              symbol
              name
            }
            reserve0
            reserve1
            token0Price
            token1Price
            volumeUSD
            txCount
          }
        }
      `;

      const response = await axios.post(
        'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
        { query },
        { timeout: 10000 }
      );

      const pairs = new Map();
      if (response.data?.data?.pairs) {
        response.data.data.pairs.forEach((pair: any) => {
          // Filter for tokens we care about  
          if (this.isTrackedToken(pair.token0.symbol) || this.isTrackedToken(pair.token1.symbol)) {
            pairs.set(pair.id, {
              ...pair,
              source: 'SushiSwap',
              timestamp: Date.now()
            });
          }
        });
      }

      this.setCache(cacheKey, pairs);
      logger.info(`✅ Fetched ${pairs.size} SushiSwap pairs`);
      
      return pairs;
    } catch (error) {
      logger.error('Failed to fetch SushiSwap prices:', error);
      return new Map();
    }
  }

  /**
   * Get all prices from all sources
   */
  async getAllPrices(): Promise<{
    basePrices: Map<string, PriceData>,
    uniswapV2: Map<string, any>,
    uniswapV3: Map<string, any>, 
    sushiSwap: Map<string, any>
  }> {
    try {
      logger.info('🔄 Fetching prices from all sources...');
      
      const [basePrices, uniswapV2, uniswapV3, sushiSwap] = await Promise.allSettled([
        this.getBasePrices(),
        this.getUniswapV2Prices(),
        this.getUniswapV3Prices(),
        this.getSushiSwapPrices()
      ]);

      return {
        basePrices: basePrices.status === 'fulfilled' ? basePrices.value : new Map(),
        uniswapV2: uniswapV2.status === 'fulfilled' ? uniswapV2.value : new Map(),
        uniswapV3: uniswapV3.status === 'fulfilled' ? uniswapV3.value : new Map(),
        sushiSwap: sushiSwap.status === 'fulfilled' ? sushiSwap.value : new Map()
      };
    } catch (error) {
      logger.error('Error fetching all prices:', error);
      throw error;
    }
  }

  /**
   * Find arbitrage opportunities from price data
   */
  async findArbitrageOpportunities(): Promise<any[]> {
    try {
      const priceData = await this.getAllPrices();
      const opportunities: any[] = [];

      // Simple arbitrage detection between DEXes
      const { basePrices, uniswapV2, uniswapV3, sushiSwap } = priceData;

      // Compare prices across DEXes for same token pairs
      const allPairs = [
        ...Array.from(uniswapV2.values()),
        ...Array.from(uniswapV3.values()),
        ...Array.from(sushiSwap.values())
      ];

      // Group by token pair
      const pairGroups = new Map();
      allPairs.forEach(pair => {
        const key = `${pair.token0.symbol}-${pair.token1.symbol}`;
        if (!pairGroups.has(key)) {
          pairGroups.set(key, []);
        }
        pairGroups.get(key).push(pair);
      });

      // Find opportunities where same pair has different prices
      for (const [pairKey, pairs] of pairGroups) {
        if (pairs.length >= 2) {
          // Sort by token0Price 
          pairs.sort((a: any, b: any) => parseFloat(a.token0Price) - parseFloat(b.token0Price));
          
          const lowest = pairs[0];
          const highest = pairs[pairs.length - 1];
          
          const priceDiff = parseFloat(highest.token0Price) - parseFloat(lowest.token0Price);
          const profitPercentage = (priceDiff / parseFloat(lowest.token0Price)) * 100;
          
          // Only consider opportunities with >0.5% profit
          if (profitPercentage > 0.5) {
            opportunities.push({
              id: `real-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              tokenA: lowest.token0.id,
              tokenB: lowest.token1.id,
              tokenASymbol: lowest.token0.symbol,
              tokenBSymbol: lowest.token1.symbol,
              amountIn: '1.0', // 1 ETH equivalent
              expectedProfit: (profitPercentage / 100).toFixed(6),
              profitPercentage: profitPercentage,
              dexA: {
                name: lowest.source,
                router: this.getDexRouter(lowest.source),
                priceA: lowest.token0Price
              },
              dexB: {
                name: highest.source,
                router: this.getDexRouter(highest.source),
                priceB: highest.token0Price
              },
              gasEstimate: '0.015', // Estimated gas in ETH
              timestamp: Date.now(),
              priority: Math.floor(profitPercentage * 10)
            });
          }
        }
      }

      // Sort by profitability
      opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
      
      logger.info(`🎯 Found ${opportunities.length} arbitrage opportunities`);
      return opportunities.slice(0, 10); // Top 10 opportunities
    } catch (error) {
      logger.error('Error finding arbitrage opportunities:', error);
      return [];
    }
  }

  /**
   * Get current blockchain data
   */
  async getBlockchainData(): Promise<{
    blockNumber: number,
    gasPrice: string,
    timestamp: number
  }> {
    try {
      const provider = this.providers[0];
      
      const [blockNumber, feeData] = await Promise.all([
        provider.getBlockNumber(),
        provider.getFeeData()
      ]);

      return {
        blockNumber,
        gasPrice: feeData.gasPrice?.toString() || '0',
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Error fetching blockchain data:', error);
      throw error;
    }
  }

  // Helper methods
  private isTrackedToken(symbol: string): boolean {
    return Object.keys(this.tokenAddresses).includes(symbol);
  }

  private getDexRouter(source: string): string {
    const routers = {
      'Uniswap V2': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      'Uniswap V3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'SushiSwap': '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'
    };
    return routers[source as keyof typeof routers] || '';
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
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      const blockData = await this.getBlockchainData();
      return blockData.blockNumber > 0;
    } catch {
      return false;
    }
  }
}