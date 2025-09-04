import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Moralis Enhanced RPC + Web3 Data API Service
 * Now with dedicated RPC node endpoints for Extended RPC methods
 */
export class MoralisService {
  private apiKey: string;
  private baseUrl = 'https://deep-index.moralis.io/api/v2.2';
  
  // Dedicated RPC node endpoints - OPTIMIZED FOR FREE TIER (Ethereum only)
  private rpcNodes: { [key: string]: string[] } = {
    'eth': [
      'https://site1.moralis-nodes.com/eth/87db561a51774a28b7de52a40b774341',
      'https://site2.moralis-nodes.com/eth/87db561a51774a28b7de52a40b774341'
    ]
    // Base RPC removed to optimize for Moralis free tier limits
    // Free tier: 100 CUs/second Node Throughput, 1,500 CUs/second API Throughput
  };

  // Rate limiting for Moralis free tier
  private rateLimiter = {
    nodeRequests: [] as number[], // Track Extended RPC request timestamps
    apiRequests: [] as number[],  // Track Web3 Data API request timestamps
    nodeLimit: 80, // 80 requests/second for Extended RPC (buffer for 100 CU limit)
    apiLimit: 1200, // 1200 requests/second for Web3 Data API (buffer for 1500 CU limit)
    windowMs: 1000 // 1 second window
  };

  private cache: Map<string, { data: any, timestamp: number }> = new Map();
  private cacheTimeout = 30000; // 30 seconds

  constructor() {
    this.apiKey = process.env.MORALIS_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Moralis API key not configured - enhanced features disabled');
    }
  }

  /**
   * Get enhanced token data using Web3 Data API (WORKING)
   */
  async getTokenData(tokenAddress: string, chain: string = 'eth'): Promise<any> {
    if (!this.apiKey) return null;

    const cacheKey = `token_${tokenAddress}_${chain}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const [tokenInfo, tokenPrice] = await Promise.allSettled([
        // Token metadata
        this.makeRequest(`/erc20/metadata`, { addresses: [tokenAddress], chain }),
        // Current price with DEX data
        this.makeRequest(`/erc20/${tokenAddress}/price`, { chain, include: 'percent_change' })
      ]);

      const result = {
        address: tokenAddress,
        chain,
        metadata: tokenInfo.status === 'fulfilled' ? tokenInfo.value[0] : null,
        price: tokenPrice.status === 'fulfilled' ? tokenPrice.value : null,
        timestamp: Date.now(),
        source: 'moralis-web3-data-api'
      };

      this.setCache(cacheKey, result);
      logger.info(`Got token data for ${tokenAddress} on ${chain}`);
      return result;
    } catch (error) {
      logger.error(`Moralis token data error for ${tokenAddress}:`, error);
      return null;
    }
  }

  /**
   * Get multiple token prices using Extended RPC (FASTEST - for supported chains)
   */
  async getMultiTokenPricesRPC(tokenAddresses: string[], chain: string = 'eth'): Promise<any> {
    if (!tokenAddresses.length || !this.rpcNodes[chain]) return null;

    const cacheKey = `rpc_multi_prices_${tokenAddresses.join(',')}_${chain}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      // Use Extended RPC for batch token prices
      const pricesData = await this.makeExtendedRpcCall('moralis_getTokenPrice', {
        addresses: tokenAddresses,
        chain: this.getChainId(chain),
        to_block: 'latest'
      }, chain);

      const result = {
        chain,
        prices: pricesData || [],
        timestamp: Date.now(),
        count: Array.isArray(pricesData) ? pricesData.length : 0,
        total: tokenAddresses.length,
        source: 'extended-rpc'
      };

      this.setCache(cacheKey, result);
      logger.info(`RPC got prices for ${result.count}/${tokenAddresses.length} tokens on ${chain}`);
      return result;
    } catch (error) {
      const errorMsg = (error as any)?.response?.data?.message || (error as Error).message;
      if (errorMsg.includes('free-plan-daily total included usage has been consumed')) {
        logger.info(`Moralis Extended RPC daily limit reached for ${chain}, using Web3 Data API`);
      } else {
        logger.warn(`Extended RPC failed for ${chain}, falling back to Web3 Data API:`, errorMsg);
      }
      return await this.getMultiTokenPricesAPI(tokenAddresses, chain);
    }
  }

  /**
   * Get multiple token prices using Web3 Data API (FALLBACK)
   */
  async getMultiTokenPricesAPI(tokenAddresses: string[], chain: string = 'eth'): Promise<any> {
    if (!this.apiKey || !tokenAddresses.length) return null;

    const cacheKey = `api_multi_prices_${tokenAddresses.join(',')}_${chain}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      // Get individual prices for each token
      const pricePromises = tokenAddresses.map(address => 
        this.makeRequest(`/erc20/${address}/price`, { 
          chain, 
          include: 'percent_change' 
        }).catch(err => {
          logger.debug(`Price error for ${address}:`, err.message);
          return null;
        })
      );

      const pricesData = await Promise.allSettled(pricePromises);
      
      const prices = pricesData.map((result, index) => ({
        address: tokenAddresses[index],
        data: result.status === 'fulfilled' ? result.value : null
      })).filter(item => item.data !== null);

      const result = {
        chain,
        prices,
        timestamp: Date.now(),
        count: prices.length,
        total: tokenAddresses.length,
        source: 'web3-data-api'
      };

      this.setCache(cacheKey, result);
      logger.info(`API got prices for ${prices.length}/${tokenAddresses.length} tokens on ${chain}`);
      return result;
    } catch (error) {
      logger.error(`Moralis API batch price error:`, error);
      return null;
    }
  }

  /**
   * Get multiple token prices (AUTO - tries RPC first, falls back to API)
   */
  async getMultiTokenPrices(tokenAddresses: string[], chain: string = 'eth'): Promise<any> {
    // Try Extended RPC first for supported chains (eth, base)
    if (this.rpcNodes[chain]) {
      return await this.getMultiTokenPricesRPC(tokenAddresses, chain);
    }
    
    // Fallback to Web3 Data API for other chains
    return await this.getMultiTokenPricesAPI(tokenAddresses, chain);
  }

  /**
   * Get DEX liquidity data across multiple exchanges
   */
  async getDexLiquidity(tokenA: string, tokenB: string, chain: string = 'eth'): Promise<any> {
    if (!this.apiKey) return null;

    const cacheKey = `liquidity_${tokenA}_${tokenB}_${chain}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.makeRequest('/defi/pairs', {
        chain,
        token0_address: tokenA,
        token1_address: tokenB
      });

      const exchangeSet = new Set<string>();
      const pairs = response.result || [];
      let totalLiquidity = 0;

      // Calculate total liquidity across all DEXes
      pairs.forEach((pair: any) => {
        totalLiquidity += parseFloat(pair.reserve_usd || '0');
        exchangeSet.add(pair.exchange_name);
      });

      const liquidityData = {
        pairs,
        totalLiquidity,
        exchanges: Array.from(exchangeSet),
        timestamp: Date.now()
      };
      
      this.setCache(cacheKey, liquidityData);
      logger.info(`Found ${liquidityData.pairs.length} DEX pairs with $${liquidityData.totalLiquidity.toFixed(0)} liquidity`);
      
      return liquidityData;
    } catch (error) {
      logger.error(`Moralis DEX liquidity error:`, error);
      return null;
    }
  }

  /**
   * Get wallet portfolio and transaction history
   */
  async getWalletData(walletAddress: string, chain: string = 'eth'): Promise<any> {
    if (!this.apiKey) return null;

    try {
      const [balance, tokens, transactions] = await Promise.allSettled([
        // Native balance (ETH, MATIC, etc.)
        this.makeRequest(`/${walletAddress}/balance`, { chain }),
        // ERC20 token balances
        this.makeRequest(`/${walletAddress}/erc20`, { chain }),
        // Recent transactions  
        this.makeRequest(`/${walletAddress}`, { chain, limit: 10 })
      ]);

      return {
        nativeBalance: balance.status === 'fulfilled' ? balance.value : null,
        tokens: tokens.status === 'fulfilled' ? tokens.value : [],
        transactions: transactions.status === 'fulfilled' ? transactions.value.result : [],
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Moralis wallet data error for ${walletAddress}:`, error);
      return null;
    }
  }

  /**
   * Get gas price recommendations across chains
   */
  async getGasRecommendations(chain: string = 'eth'): Promise<any> {
    if (!this.apiKey) return null;

    const cacheKey = `gas_${chain}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      // Moralis doesn't have direct gas API, but we can get block data
      const blockData = await this.makeRequest('/block/latest', { 
        chain, 
        include: 'internal_transactions' 
      });

      const gasData = {
        chain,
        blockNumber: blockData.number,
        gasUsed: blockData.gas_used,
        gasLimit: blockData.gas_limit,
        baseFeePerGas: blockData.base_fee_per_gas,
        timestamp: Date.now()
      };

      this.setCache(cacheKey, gasData);
      return gasData;
    } catch (error) {
      logger.error(`Moralis gas data error for ${chain}:`, error);
      return null;
    }
  }

  /**
   * ULTRA-FAST cross-chain arbitrage detection using Extended RPC (NEW)
   */
  async findFastArbitrageOpportunities(): Promise<any[]> {
    if (!this.apiKey) return [];

    try {
      const opportunities: any[] = [];
      const targetTokens = [
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC  
        '0x514910771AF9Ca656af840dff83E8264EcF986CA', // LINK
        '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
        '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9'  // AAVE
      ];

      // Use only Ethereum chain for Extended RPC (optimized for free tier)
      const rpcChains = Object.keys(this.rpcNodes); // ['eth'] - Base removed for free tier optimization
      
      const chainData = await Promise.allSettled(
        rpcChains.map(chain => this.getMultiTokenPricesRPC(targetTokens, chain))
      );

      const pricesByToken = new Map();

      // Organize prices by token across RPC chains
      chainData.forEach((result, chainIndex) => {
        if (result.status === 'fulfilled' && result.value?.prices) {
          const chain = rpcChains[chainIndex];
          
          result.value.prices.forEach((tokenPrice: any, tokenIndex: number) => {
            const tokenAddress = targetTokens[tokenIndex];
            
            if (!pricesByToken.has(tokenAddress)) {
              pricesByToken.set(tokenAddress, []);
            }
            
            pricesByToken.get(tokenAddress).push({
              chain,
              price: parseFloat(tokenPrice.usdPrice || '0'),
              timestamp: Date.now(),
              tokenSymbol: tokenPrice.tokenSymbol || 'Unknown',
              source: 'extended-rpc'
            });
          });
        }
      });

      // Find cross-chain arbitrage opportunities
      pricesByToken.forEach((chainPrices, tokenAddress) => {
        if (chainPrices.length >= 2) {
          chainPrices.sort((a: any, b: any) => a.price - b.price);
          const lowest = chainPrices[0];
          const highest = chainPrices[chainPrices.length - 1];
          
          if (lowest.price > 0 && highest.price > 0) {
            const priceDiff = highest.price - lowest.price;
            const profitPercentage = (priceDiff / lowest.price) * 100;

            if (profitPercentage > 0.1) { // 0.1% minimum for RPC speed
              opportunities.push({
                id: `moralis-rpc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                type: 'cross-chain-extended-rpc',
                tokenAddress,
                tokenSymbol: lowest.tokenSymbol,
                buyChain: lowest.chain,
                sellChain: highest.chain,
                buyPrice: lowest.price,
                sellPrice: highest.price,
                profitPercentage,
                estimatedProfit: priceDiff,
                timestamp: Date.now(),
                priority: Math.floor(profitPercentage * 100),
                source: 'Moralis Extended RPC',
                method: 'moralis_getTokenPrice'
              });
            }
          }
        }
      });

      opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
      logger.info(`Moralis Extended RPC found ${opportunities.length} opportunities`);
      
      return opportunities.slice(0, 10);
    } catch (error) {
      logger.error('Error in Moralis Extended RPC arbitrage detection:', error);
      return [];
    }
  }

  /**
   * Cross-chain arbitrage detection using Web3 Data API (WORKING)
   */
  async findCrossChainArbitrageOpportunities(): Promise<any[]> {
    if (!this.apiKey) return [];

    try {
      const opportunities: any[] = [];
      const targetTokens = [
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC  
        '0x514910771AF9Ca656af840dff83E8264EcF986CA', // LINK
        '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
        '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9'  // AAVE
      ];

      // Focus on main chains with good liquidity (Base removed for free tier optimization)
      const mainChains = ['eth', 'polygon', 'arbitrum', 'optimism'];
      
      const chainData = await Promise.allSettled(
        mainChains.map(chain => this.getMultiTokenPrices(targetTokens, chain))
      );

      const pricesByToken = new Map();

      // Organize prices by token across chains
      chainData.forEach((result, chainIndex) => {
        if (result.status === 'fulfilled' && result.value?.prices) {
          const chain = mainChains[chainIndex];
          result.value.prices.forEach((priceResult: any) => {
            if (!priceResult.data) return;
            
            const tokenAddress = priceResult.address;
            const priceData = priceResult.data;
            
            if (!pricesByToken.has(tokenAddress)) {
              pricesByToken.set(tokenAddress, []);
            }
            
            pricesByToken.get(tokenAddress).push({
              chain,
              price: parseFloat(priceData.usdPrice || '0'),
              timestamp: Date.now(),
              tokenSymbol: priceData.tokenSymbol || 'Unknown'
            });
          });
        }
      });

      // Find cross-chain arbitrage opportunities
      pricesByToken.forEach((chainPrices, tokenAddress) => {
        if (chainPrices.length >= 2) {
          chainPrices.sort((a: any, b: any) => a.price - b.price);
          const lowest = chainPrices[0];
          const highest = chainPrices[chainPrices.length - 1];
          
          if (lowest.price > 0 && highest.price > 0) {
            const priceDiff = highest.price - lowest.price;
            const profitPercentage = (priceDiff / lowest.price) * 100;

            if (profitPercentage > 0.3) { // 0.3% minimum for cross-chain
              opportunities.push({
                id: `moralis-xchain-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                type: 'cross-chain-moralis',
                tokenAddress,
                tokenSymbol: lowest.tokenSymbol,
                buyChain: lowest.chain,
                sellChain: highest.chain,
                buyPrice: lowest.price,
                sellPrice: highest.price,
                profitPercentage,
                estimatedProfit: priceDiff,
                timestamp: Date.now(),
                priority: Math.floor(profitPercentage * 20),
                source: 'Moralis Web3 Data API',
                method: 'erc20/price'
              });
            }
          }
        }
      });

      opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
      logger.info(`Moralis Web3 Data API found ${opportunities.length} cross-chain opportunities`);
      
      return opportunities.slice(0, 10);
    } catch (error) {
      logger.error('Error in Moralis cross-chain arbitrage detection:', error);
      return [];
    }
  }

  /**
   * Search for arbitrage opportunities using Moralis DEX data
   */
  async findMoralisArbitrageOpportunities(): Promise<any[]> {
    if (!this.apiKey) return [];

    try {
      const opportunities: any[] = [];
      const supportedTokens = [
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
        '0x514910771AF9Ca656af840dff83E8264EcF986CA', // LINK
        '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
        '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9'  // AAVE
      ];

      for (const tokenA of supportedTokens) {
        for (const tokenB of supportedTokens) {
          if (tokenA === tokenB) continue;

          const liquidityData = await this.getDexLiquidity(tokenA, tokenB);
          if (liquidityData && liquidityData.pairs.length >= 2) {
            // Find price differences between DEXes
            const prices = liquidityData.pairs.map((pair: any) => ({
              exchange: pair.exchange_name,
              price: parseFloat(pair.price_usd || '0'),
              liquidity: parseFloat(pair.reserve_usd || '0')
            })).filter((p: any) => p.price > 0);

            if (prices.length >= 2) {
              prices.sort((a: any, b: any) => a.price - b.price);
              const lowest = prices[0];
              const highest = prices[prices.length - 1];
              
              const priceDiff = highest.price - lowest.price;
              const profitPercentage = (priceDiff / lowest.price) * 100;

              if (profitPercentage > 0.3) { // 0.3% minimum profit
                opportunities.push({
                  id: `moralis-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                  type: 'moralis-dex',
                  tokenA,
                  tokenB,
                  buyExchange: lowest.exchange,
                  sellExchange: highest.exchange,
                  buyPrice: lowest.price,
                  sellPrice: highest.price,
                  profitPercentage,
                  liquidityUSD: Math.min(lowest.liquidity, highest.liquidity),
                  timestamp: Date.now(),
                  priority: Math.floor(profitPercentage * 10),
                  source: 'Moralis'
                });
              }
            }
          }
        }
      }

      opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
      logger.info(`Moralis found ${opportunities.length} arbitrage opportunities`);
      
      return opportunities.slice(0, 5); // Top 5 opportunities
    } catch (error) {
      logger.error('Error finding Moralis arbitrage opportunities:', error);
      return [];
    }
  }



  /**
   * Check if request is within rate limits for Moralis free tier
   */
  private canMakeRequest(type: 'node' | 'api'): boolean {
    const now = Date.now();
    const requests = type === 'node' ? this.rateLimiter.nodeRequests : this.rateLimiter.apiRequests;
    const limit = type === 'node' ? this.rateLimiter.nodeLimit : this.rateLimiter.apiLimit;
    
    // Remove old requests outside the window
    const cutoff = now - this.rateLimiter.windowMs;
    const recentRequests = requests.filter(timestamp => timestamp > cutoff);
    
    // Update the array
    if (type === 'node') {
      this.rateLimiter.nodeRequests = recentRequests;
    } else {
      this.rateLimiter.apiRequests = recentRequests;
    }
    
    return recentRequests.length < limit;
  }

  /**
   * Record a request for rate limiting
   */
  private recordRequest(type: 'node' | 'api'): void {
    const now = Date.now();
    if (type === 'node') {
      this.rateLimiter.nodeRequests.push(now);
    } else {
      this.rateLimiter.apiRequests.push(now);
    }
  }

  /**
   * Wait for rate limit reset if needed
   */
  private async waitForRateLimit(type: 'node' | 'api'): Promise<void> {
    if (this.canMakeRequest(type)) return;
    
    const waitTime = 100; // 100ms wait
    logger.debug(`Rate limit reached for ${type}, waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Make Extended RPC call using dedicated node endpoints with rate limiting
   */
  private async makeExtendedRpcCall(method: string, params: any, chain: string = 'eth'): Promise<any> {
    if (!this.rpcNodes[chain]) {
      throw new Error(`No RPC nodes configured for chain: ${chain}. Only Ethereum is supported on free tier.`);
    }

    // Check and wait for rate limit if needed
    await this.waitForRateLimit('node');
    this.recordRequest('node');

    const rpcPayload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params: Array.isArray(params) ? params : [params]
    };

    // Try primary node, fallback to secondary  
    const nodeUrls = this.rpcNodes[chain];
    let lastError;

    for (const nodeUrl of nodeUrls) {
      try {
        const config = {
          method: 'POST',
          url: nodeUrl,
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey
          },
          data: rpcPayload,
          timeout: 8000
        };

        const response = await axios(config);
        
        if (response.data.error) {
          throw new Error(`RPC Error: ${response.data.error.message}`);
        }
        
        return response.data.result;
      } catch (error) {
        lastError = error;
        logger.debug(`RPC node ${nodeUrl} failed, trying next...`, (error as Error).message);
      }
    }

    throw lastError;
  }

  /**
   * Make authenticated request to Moralis Web3 Data API with rate limiting
   */
  private async makeRequest(endpoint: string, params: any = {}): Promise<any> {
    // Check and wait for rate limit if needed
    await this.waitForRateLimit('api');
    this.recordRequest('api');
    const config = {
      method: 'GET',
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      params,
      timeout: 10000
    };

    const response = await axios(config);
    return response.data;
  }

  /**
   * Convert chain name to chain ID for Moralis API calls
   */
  private getChainId(chain: string): string {
    const chainIds: { [key: string]: string } = {
      // Primary Networks
      'eth': '0x1',
      'ethereum': '0x1',
      'polygon': '0x89',
      'bsc': '0x38',
      'bnb': '0x38',
      'arbitrum': '0xa4b1',
      'optimism': '0xa',
      'base': '0x2105',
      'avalanche': '0xa86a',
      
      // Layer 2s & Scaling
      'linea': '0xe708',
      'blast': '0x13e31',
      'zksync': '0x144',
      'mantle': '0x1388',
      'opbnb': '0xcc',
      'polygon-zkevm': '0x44d',
      
      // Other Networks
      'fantom': '0xfa',
      'cronos': '0x19',
      'gnosis': '0x64',
      'moonbeam': '0x504',
      'zetachain': '0x1b58',
      'flow': '0x2eb',
      'ronin': '0x7e4',
      'lisk': '0x46f',
      'pulsechain': '0x171',
      'chiliz': '0x15b38'
    };
    return chainIds[chain.toLowerCase()] || '0x1';
  }

  /**
   * Get supported chains for multi-chain operations (optimized for free tier)
   */
  getSupportedChains(): string[] {
    return [
      'eth', 'polygon', 'bsc', 'arbitrum', 'optimism', 'avalanche',
      'linea', 'blast', 'zksync', 'mantle', 'fantom', 'cronos', 'gnosis',
      'moonbeam', 'zetachain', 'flow', 'ronin', 'lisk', 'pulsechain'
      // Base removed to optimize for Moralis free tier limits
    ];
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): any {
    const now = Date.now();
    const cutoff = now - this.rateLimiter.windowMs;
    
    const nodeRequests = this.rateLimiter.nodeRequests.filter(t => t > cutoff);
    const apiRequests = this.rateLimiter.apiRequests.filter(t => t > cutoff);
    
    return {
      nodeRequests: {
        current: nodeRequests.length,
        limit: this.rateLimiter.nodeLimit,
        remaining: Math.max(0, this.rateLimiter.nodeLimit - nodeRequests.length),
        percentUsed: Math.round((nodeRequests.length / this.rateLimiter.nodeLimit) * 100)
      },
      apiRequests: {
        current: apiRequests.length,
        limit: this.rateLimiter.apiLimit,
        remaining: Math.max(0, this.rateLimiter.apiLimit - apiRequests.length),
        percentUsed: Math.round((apiRequests.length / this.rateLimiter.apiLimit) * 100)
      },
      timestamp: now,
      optimizedForFreeTier: true,
      supportedRpcChains: Object.keys(this.rpcNodes) // ['eth']
    };
  }

  // Helper methods
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
    if (!this.apiKey) return false;
    
    try {
      await this.makeRequest('/info/endpointWeights');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get API usage statistics
   */
  async getUsageStats(): Promise<any> {
    if (!this.apiKey) return null;

    try {
      const stats = await this.makeRequest('/info/endpointWeights');
      return {
        rateLimitUsed: stats.rateLimitUsed || 0,
        rateLimitRemaining: stats.rateLimitRemaining || 0,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Error getting Moralis usage stats:', error);
      return null;
    }
  }
}