import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Advanced DEX Service - Monitors major DEX platforms beyond Uniswap/SushiSwap
 * Integrates Curve, Balancer, 1inch, PancakeSwap, and other major exchanges
 */
export class AdvancedDEXService {
  private cache: Map<string, { data: any, timestamp: number }> = new Map();
  private cacheTimeout = 30000; // 30 seconds
  private oneInchApiKey: string;

  // API Endpoints for different DEX protocols
  private endpoints = {
    // Curve Finance - Multiple networks
    curve: {
      ethereum: 'https://api.thegraph.com/subgraphs/id/3fy93eAT56UJsRCEht8iFhfi6wjHWXtZ9dnnbQmvFopF',
      arbitrum: 'https://api.thegraph.com/subgraphs/id/Gv6NJRut2zrm79ef4QHyKAm41YHqaLF392sM3cz9wywc',
      polygon: 'https://api.thegraph.com/subgraphs/id/4UKcJ82nGDrGW21NREhfyZGGb5LMHW3RoJZ3ShyKzgK1'
    },
    
    // Balancer V2 - Production endpoints (require The Graph API key in production)
    balancer: {
      ethereum_dev: 'https://api.studio.thegraph.com/query/75376/balancer-v2/version/latest',
      polygon_dev: 'https://api.studio.thegraph.com/query/75376/balancer-polygon-v2/version/latest',
      arbitrum_dev: 'https://api.studio.thegraph.com/query/75376/balancer-arbitrum-v2/version/latest',
      optimism_dev: 'https://api.studio.thegraph.com/query/75376/balancer-optimism-v2/version/latest',
      base_dev: 'https://api.studio.thegraph.com/query/24660/balancer-base-v2/version/latest'
    },
    
    // 1inch Aggregator API
    oneInch: {
      base: 'https://api.1inch.io/v6.0',
      chains: {
        ethereum: '1',
        polygon: '137', 
        arbitrum: '42161',
        optimism: '10',
        bsc: '56',
        avalanche: '43114'
      }
    },

    // PancakeSwap - BSC & Ethereum
    pancakeSwap: {
      bsc: 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange',
      ethereum: 'https://api.thegraph.com/subgraphs/name/pancakeswap/exhange-eth'
    }
  };

  // Token mappings for cross-DEX price comparison
  private tokenMappings = {
    ethereum: {
      'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      'USDC': '0xA0b86991c31cC62cD32E5e8b598c13254EE3DAD51',
      'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    },
    polygon: {
      'WMATIC': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      'WETH': '0x7ceB23fD6bC0adD59E62ac25578270cCc411f18C',
      'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
    }
  };

  constructor() {
    this.oneInchApiKey = process.env.ONEINCH_API_KEY || '';
    
    if (this.oneInchApiKey) {
      logger.info('✅ 1inch API key configured for enhanced aggregation');
    } else {
      logger.warn('⚠️ 1inch API key not found - using public endpoints with rate limits');
    }
  }

  /**
   * Get Curve Finance pool data across multiple networks
   */
  async getCurvePools(network: 'ethereum' | 'arbitrum' | 'polygon' = 'ethereum'): Promise<any[]> {
    const cacheKey = `curve_pools_${network}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const query = `
        query {
          pools(first: 50, orderBy: tvl, orderDirection: desc) {
            id
            name
            symbol
            swapFee
            totalLiquidity: tvl
            virtualPrice
            coins {
              id
              name
              symbol
              decimals
              balance
            }
            dailyVolume: daySnapshot(first: 1, orderBy: timestamp, orderDirection: desc) {
              volume
              timestamp
            }
          }
        }
      `;

      const response = await axios.post(this.endpoints.curve[network], {
        query
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      const pools = response.data?.data?.pools || [];
      const enhancedPools = pools.map((pool: any) => ({
        ...pool,
        source: `Curve Finance (${network})`,
        network,
        poolType: 'stable',
        timestamp: Date.now()
      }));

      this.setCache(cacheKey, enhancedPools);
      logger.info(`✅ Fetched ${enhancedPools.length} Curve pools from ${network}`);
      
      return enhancedPools;
    } catch (error) {
      logger.error(`Failed to fetch Curve pools from ${network}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * Get Balancer weighted and stable pools
   */
  async getBalancerPools(network: 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base' = 'ethereum'): Promise<any[]> {
    const cacheKey = `balancer_pools_${network}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const query = `
        query {
          pools(first: 50, orderBy: totalLiquidity, orderDirection: desc) {
            id
            address
            poolType
            swapFee
            totalLiquidity
            totalShares
            tokens {
              address
              balance
              weight
              token {
                id
                symbol
                name
                decimals
              }
            }
          }
        }
      `;

      const endpoint = this.endpoints.balancer[`${network}_dev` as keyof typeof this.endpoints.balancer];
      const response = await axios.post(endpoint, {
        query
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      const pools = response.data?.data?.pools || [];
      const enhancedPools = pools.map((pool: any) => ({
        ...pool,
        source: `Balancer V2 (${network})`,
        network,
        timestamp: Date.now()
      }));

      this.setCache(cacheKey, enhancedPools);
      logger.info(`✅ Fetched ${enhancedPools.length} Balancer pools from ${network}`);
      
      return enhancedPools;
    } catch (error) {
      logger.error(`Failed to fetch Balancer pools from ${network}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * Get 1inch aggregated quotes for multiple tokens
   */
  async getOneInchQuotes(fromToken: string, toTokens: string[], amount: string, network: 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'bsc' = 'ethereum'): Promise<any[]> {
    const cacheKey = `1inch_quotes_${fromToken}_${network}_${amount}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const chainId = this.endpoints.oneInch.chains[network];
      if (!chainId) {
        throw new Error(`Unsupported network: ${network}`);
      }

      const quotes = await Promise.allSettled(
        toTokens.map(async (toToken) => {
          const url = `${this.endpoints.oneInch.base}/${chainId}/quote`;
          const params = {
            src: fromToken,
            dst: toToken,
            amount,
            includeTokensInfo: 'true',
            includeProtocols: 'true'
          };

          const headers: any = {
            'Accept': 'application/json'
          };

          // Add API key if available
          if (this.oneInchApiKey) {
            headers['Authorization'] = `Bearer ${this.oneInchApiKey}`;
          }

          const response = await axios.get(url, {
            params,
            headers,
            timeout: 8000
          });

          return {
            fromToken,
            toToken,
            ...response.data,
            source: '1inch Aggregator',
            network,
            timestamp: Date.now()
          };
        })
      );

      const successfulQuotes = quotes
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);

      this.setCache(cacheKey, successfulQuotes);
      logger.info(`✅ Fetched ${successfulQuotes.length}/${toTokens.length} 1inch quotes for ${network}`);
      
      return successfulQuotes;
    } catch (error) {
      logger.error(`Failed to fetch 1inch quotes for ${network}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * Get PancakeSwap pool data (BSC primarily)
   */
  async getPancakeSwapPools(network: 'bsc' | 'ethereum' = 'bsc'): Promise<any[]> {
    const cacheKey = `pancakeswap_pools_${network}`;
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
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            reserve0
            reserve1
            token0Price
            token1Price
            volumeUSD
            txCount
            totalSupply
          }
        }
      `;

      const response = await axios.post(this.endpoints.pancakeSwap[network], {
        query
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      const pairs = response.data?.data?.pairs || [];
      const enhancedPairs = pairs.map((pair: any) => ({
        ...pair,
        source: `PancakeSwap (${network.toUpperCase()})`,
        network: network === 'bsc' ? 'binance-smart-chain' : network,
        timestamp: Date.now()
      }));

      this.setCache(cacheKey, enhancedPairs);
      logger.info(`✅ Fetched ${enhancedPairs.length} PancakeSwap pairs from ${network}`);
      
      return enhancedPairs;
    } catch (error) {
      logger.error(`Failed to fetch PancakeSwap pools from ${network}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * Get comprehensive cross-DEX arbitrage opportunities
   */
  async findCrossDEXArbitrageOpportunities(): Promise<any[]> {
    try {
      const opportunities: any[] = [];
      
      // Get data from all supported DEXes
      const [curveEth, balancerEth, pancakeBsc] = await Promise.allSettled([
        this.getCurvePools('ethereum'),
        this.getBalancerPools('ethereum'),
        this.getPancakeSwapPools('bsc')
      ]);

      // Sample 1inch quote for major pairs
      const majorTokens = Object.values(this.tokenMappings.ethereum);
      const oneInchQuotes = await this.getOneInchQuotes(
        this.tokenMappings.ethereum.USDC, // From USDC
        [this.tokenMappings.ethereum.WETH, this.tokenMappings.ethereum.WBTC],
        '1000000000', // 1000 USDC
        'ethereum'
      );

      // Analyze price differences across DEXes
      const allPools = [
        ...(curveEth.status === 'fulfilled' ? curveEth.value : []),
        ...(balancerEth.status === 'fulfilled' ? balancerEth.value : []),
        ...(pancakeBsc.status === 'fulfilled' ? pancakeBsc.value : [])
      ];

      // Find potential arbitrage opportunities by comparing similar token pairs
      const tokenPairMap = new Map<string, any[]>();
      
      allPools.forEach(pool => {
        if (pool.tokens && pool.tokens.length >= 2) {
          const symbols = pool.tokens.map((t: any) => t.token?.symbol || t.symbol).filter(Boolean).sort();
          const pairKey = symbols.join('-');
          
          if (!tokenPairMap.has(pairKey)) {
            tokenPairMap.set(pairKey, []);
          }
          tokenPairMap.get(pairKey)!.push(pool);
        }
      });

      // Identify arbitrage opportunities
      for (const [pairKey, pools] of tokenPairMap) {
        if (pools.length >= 2) {
          // Calculate implied prices and find discrepancies
          const priceData = pools.map(pool => {
            let impliedPrice = 1;
            
            if (pool.source.includes('Curve')) {
              // Curve: stable pools, prices close to 1:1
              impliedPrice = parseFloat(pool.virtualPrice || '1');
            } else if (pool.source.includes('Balancer')) {
              // Balancer: weighted pools, calculate from reserves and weights
              const tokens = pool.tokens;
              if (tokens.length >= 2) {
                const token0 = tokens[0];
                const token1 = tokens[1];
                const weight0 = parseFloat(token0.weight || '0.5');
                const weight1 = parseFloat(token1.weight || '0.5');
                const balance0 = parseFloat(token0.balance || '0');
                const balance1 = parseFloat(token1.balance || '0');
                
                if (balance0 > 0 && balance1 > 0 && weight0 > 0 && weight1 > 0) {
                  impliedPrice = (balance1 / balance0) * (weight0 / weight1);
                }
              }
            } else if (pool.source.includes('PancakeSwap')) {
              // PancakeSwap: AMM, use token prices
              impliedPrice = parseFloat(pool.token0Price || pool.token1Price || '1');
            }
            
            return {
              pool: pool.id,
              source: pool.source,
              network: pool.network,
              price: impliedPrice,
              liquidity: parseFloat(pool.totalLiquidity || pool.volumeUSD || '0')
            };
          });

          // Sort by price to find spreads
          priceData.sort((a, b) => a.price - b.price);
          const lowest = priceData[0];
          const highest = priceData[priceData.length - 1];
          
          if (lowest.price > 0 && highest.price > 0) {
            const priceDiff = highest.price - lowest.price;
            const profitPercentage = (priceDiff / lowest.price) * 100;
            
            // Only include opportunities with meaningful profit potential
            if (profitPercentage > 0.5 && lowest.liquidity > 10000 && highest.liquidity > 10000) {
              opportunities.push({
                id: `cross-dex-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                type: 'cross-dex',
                tokenPair: pairKey,
                buyFrom: lowest,
                sellTo: highest,
                profitPercentage,
                estimatedProfit: priceDiff,
                minLiquidity: Math.min(lowest.liquidity, highest.liquidity),
                crossChain: lowest.network !== highest.network,
                timestamp: Date.now(),
                priority: Math.floor(profitPercentage * 10),
                source: 'Advanced DEX Monitor'
              });
            }
          }
        }
      }

      // Include 1inch aggregator opportunities
      oneInchQuotes.forEach(quote => {
        if (quote.dstAmount && quote.srcAmount) {
          const srcAmount = parseFloat(quote.srcAmount);
          const dstAmount = parseFloat(quote.dstAmount);
          
          if (srcAmount > 0 && dstAmount > 0) {
            opportunities.push({
              id: `1inch-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              type: '1inch-aggregator',
              fromToken: quote.fromToken,
              toToken: quote.toToken,
              srcAmount,
              dstAmount,
              protocols: quote.protocols?.map((p: any) => p.name) || [],
              estimatedGas: parseInt(quote.gas || '0'),
              network: quote.network,
              timestamp: Date.now(),
              source: '1inch Aggregator',
              aggregatedPrice: dstAmount / srcAmount
            });
          }
        }
      });

      opportunities.sort((a, b) => (b.profitPercentage || 0) - (a.profitPercentage || 0));
      logger.info(`🎯 Found ${opportunities.length} cross-DEX arbitrage opportunities`);
      
      return opportunities.slice(0, 15); // Top 15 opportunities
      
    } catch (error) {
      logger.error('Error finding cross-DEX arbitrage opportunities:', error);
      return [];
    }
  }

  /**
   * Get real-time 1inch route analysis for specific trade
   */
  async getOneInchRouteAnalysis(fromToken: string, toToken: string, amount: string, network: 'ethereum' | 'polygon' | 'arbitrum' = 'ethereum'): Promise<any> {
    try {
      const chainId = this.endpoints.oneInch.chains[network];
      const url = `${this.endpoints.oneInch.base}/${chainId}/quote`;
      
      const headers: any = {
        'Accept': 'application/json'
      };

      if (this.oneInchApiKey) {
        headers['Authorization'] = `Bearer ${this.oneInchApiKey}`;
      }

      const response = await axios.get(url, {
        params: {
          src: fromToken,
          dst: toToken,
          amount,
          includeTokensInfo: 'true',
          includeProtocols: 'true',
          includeGasInfo: 'true'
        },
        headers,
        timeout: 8000
      });

      return {
        ...response.data,
        analysis: {
          priceImpact: this.calculatePriceImpact(response.data),
          routeComplexity: response.data.protocols?.length || 0,
          gasEfficiency: this.calculateGasEfficiency(response.data),
          liquiditySources: response.data.protocols?.map((p: any) => p.name) || []
        },
        network,
        timestamp: Date.now()
      };
      
    } catch (error) {
      logger.error(`1inch route analysis failed:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Get supported DEX platforms and their status
   */
  getDEXStatus(): any {
    return {
      supported: {
        curve: {
          networks: ['ethereum', 'arbitrum', 'polygon'],
          speciality: 'Stablecoin and wrapped asset swaps',
          status: 'active'
        },
        balancer: {
          networks: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
          speciality: 'Weighted and stable pools with custom ratios',
          status: 'active'
        },
        oneInch: {
          networks: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche'],
          speciality: 'DEX aggregation and optimal routing',
          status: this.oneInchApiKey ? 'authenticated' : 'rate-limited'
        },
        pancakeSwap: {
          networks: ['bsc', 'ethereum'],
          speciality: 'Low-fee AMM on Binance Smart Chain',
          status: 'active'
        }
      },
      totalNetworksSupported: 8,
      totalDEXProtocols: 4,
      lastUpdated: Date.now()
    };
  }

  // Helper methods
  private calculatePriceImpact(quoteData: any): number {
    // Simplified price impact calculation
    const fromAmount = parseFloat(quoteData.fromTokenAmount || '0');
    const toAmount = parseFloat(quoteData.toTokenAmount || '0');
    
    if (fromAmount > 0 && toAmount > 0) {
      // This is a simplified calculation - real implementation would need market prices
      return Math.abs(1 - (toAmount / fromAmount)) * 100;
    }
    return 0;
  }

  private calculateGasEfficiency(quoteData: any): string {
    const gas = parseInt(quoteData.gas || '0');
    const protocols = quoteData.protocols?.length || 1;
    
    if (gas < 150000) return 'high';
    if (gas < 300000 && protocols <= 2) return 'medium';
    return 'low';
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
   * Health check for all integrated services
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Test basic connectivity to each service
      const healthChecks = await Promise.allSettled([
        this.getCurvePools('ethereum'),
        this.getBalancerPools('ethereum'),
        this.getPancakeSwapPools('bsc')
      ]);

      const successfulChecks = healthChecks.filter(result => result.status === 'fulfilled').length;
      return successfulChecks >= 2; // At least 2 out of 3 services working
      
    } catch {
      return false;
    }
  }
}