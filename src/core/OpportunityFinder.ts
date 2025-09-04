import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { DEX_CONFIG, TOKENS, BOT_CONFIG } from '../config/constants';

export interface ArbitrageOpportunity {
  id: string;
  tokenA: string;
  tokenB: string;
  amountIn: string;
  expectedProfit: string;
  profitPercentage: number;
  dexA: {
    name: string;
    router: string;
    priceA: string;
  };
  dexB: {
    name: string;
    router: string;
    priceB: string;
  };
  gasEstimate: string;
  timestamp: number;
  priority: number;
  type?: string; // Optional type field for cross-chain vs single-chain
  chain?: string; // Optional chain identifier
}

export class OpportunityFinder {
  private provider: ethers.JsonRpcProvider;
  private opportunities: Map<string, ArbitrageOpportunity> = new Map();
  private isScanning: boolean = false;

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
  }

  // Uniswap V2 Router ABI (simplified)
  private readonly UNISWAP_V2_ROUTER_ABI = [
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
    'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)'
  ];

  async startScanning(): Promise<void> {
    if (this.isScanning) {
      logger.warn('Opportunity scanner is already running');
      return;
    }

    this.isScanning = true;
    logger.info('🔍 Starting opportunity scanner...');

    // Scan continuously
    this.scanLoop();
  }

  async stopScanning(): Promise<void> {
    this.isScanning = false;
    logger.info('⏹️  Stopped opportunity scanner');
  }

  private async scanLoop(): Promise<void> {
    while (this.isScanning) {
      try {
        await this.scanForOpportunities();
        await this.sleep(BOT_CONFIG.OPPORTUNITY_SCAN_INTERVAL);
      } catch (error) {
        logger.error('Error in scan loop:', error);
        await this.sleep(5000); // Wait 5 seconds on error
      }
    }
  }

  private async scanForOpportunities(): Promise<void> {
    const tokenPairs = this.generateTokenPairs();
    const scanPromises = tokenPairs.map(pair => this.scanTokenPair(pair.tokenA, pair.tokenB));
    
    await Promise.all(scanPromises);
  }

  private generateTokenPairs(): { tokenA: string; tokenB: string }[] {
    const tokens = Object.values(TOKENS);
    const pairs: { tokenA: string; tokenB: string }[] = [];

    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        pairs.push({ tokenA: tokens[i], tokenB: tokens[j] });
      }
    }

    return pairs;
  }

  private async scanTokenPair(tokenA: string, tokenB: string): Promise<void> {
    try {
      const amountIn = ethers.parseUnits('1.0', 18); // 1 ETH equivalent
      const dexPrices = await this.getPricesFromAllDEXs(tokenA, tokenB, amountIn);
      
      // Find arbitrage opportunities
      const opportunities = this.findArbitrageOpportunities(tokenA, tokenB, amountIn.toString(), dexPrices);
      
      for (const opportunity of opportunities) {
        if (opportunity.profitPercentage >= BOT_CONFIG.MIN_PROFIT_THRESHOLD) {
          this.opportunities.set(opportunity.id, opportunity);
          logger.opportunity(
            `Found arbitrage: ${opportunity.profitPercentage.toFixed(4)}% profit`,
            {
              tokenA,
              tokenB,
              profit: opportunity.expectedProfit,
              dexA: opportunity.dexA.name,
              dexB: opportunity.dexB.name
            }
          );
        }
      }
    } catch (error) {
      logger.debug(`Error scanning pair ${tokenA}-${tokenB}:`, error);
    }
  }

  private async getPricesFromAllDEXs(tokenA: string, tokenB: string, amountIn: bigint): Promise<any[]> {
    const promises = [];

    // Uniswap V2
    promises.push(this.getUniswapV2Price(DEX_CONFIG.UNISWAP_V2.router, tokenA, tokenB, amountIn, 'Uniswap V2'));
    
    // SushiSwap
    promises.push(this.getUniswapV2Price(DEX_CONFIG.SUSHISWAP.router, tokenA, tokenB, amountIn, 'SushiSwap'));

    const results = await Promise.allSettled(promises);
    return results
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<any>).value)
      .filter(price => price !== null);
  }

  private async getUniswapV2Price(routerAddress: string, tokenA: string, tokenB: string, amountIn: bigint, dexName: string): Promise<any> {
    try {
      const router = new ethers.Contract(routerAddress, this.UNISWAP_V2_ROUTER_ABI, this.provider);
      const path = [tokenA, tokenB];
      
      const amounts = await router.getAmountsOut(amountIn, path);
      const amountOut = amounts[1];
      
      return {
        dex: dexName,
        router: routerAddress,
        amountOut: amountOut.toString(),
        price: parseFloat(ethers.formatUnits(amountOut, 18))
      };
    } catch (error) {
      logger.debug(`Failed to get price from ${dexName}:`, error);
      return null;
    }
  }

  private findArbitrageOpportunities(tokenA: string, tokenB: string, amountIn: string, dexPrices: any[]): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    for (let i = 0; i < dexPrices.length; i++) {
      for (let j = i + 1; j < dexPrices.length; j++) {
        const dexA = dexPrices[i];
        const dexB = dexPrices[j];

        // Check both directions
        const opportunity1 = this.calculateArbitrage(tokenA, tokenB, amountIn, dexA, dexB);
        const opportunity2 = this.calculateArbitrage(tokenA, tokenB, amountIn, dexB, dexA);

        if (opportunity1) opportunities.push(opportunity1);
        if (opportunity2) opportunities.push(opportunity2);
      }
    }

    return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
  }

  private calculateArbitrage(tokenA: string, tokenB: string, amountIn: string, dexA: any, dexB: any): ArbitrageOpportunity | null {
    const priceA = dexA.price;
    const priceB = dexB.price;
    
    if (priceA >= priceB) return null; // No arbitrage opportunity

    const profit = priceB - priceA;
    const profitPercentage = (profit / priceA) * 100;
    
    // Estimate gas costs (simplified)
    const gasEstimate = ethers.parseUnits('0.01', 18); // 0.01 ETH estimated gas
    const netProfit = profit - parseFloat(ethers.formatUnits(gasEstimate, 18));
    
    if (netProfit <= 0) return null;

    return {
      id: `${tokenA}-${tokenB}-${dexA.dex}-${dexB.dex}-${Date.now()}`,
      tokenA,
      tokenB,
      amountIn,
      expectedProfit: netProfit.toString(),
      profitPercentage,
      dexA: {
        name: dexA.dex,
        router: dexA.router,
        priceA: priceA.toString()
      },
      dexB: {
        name: dexB.dex,
        router: dexB.router,
        priceB: priceB.toString()
      },
      gasEstimate: gasEstimate.toString(),
      timestamp: Date.now(),
      priority: this.calculatePriority(profitPercentage, netProfit)
    };
  }

  private calculatePriority(profitPercentage: number, netProfit: number): number {
    // Higher priority for higher profit percentage and net profit
    return Math.floor(profitPercentage * 10 + netProfit * 100);
  }

  getOpportunities(): ArbitrageOpportunity[] {
    return Array.from(this.opportunities.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10); // Return top 10 opportunities
  }

  getBestOpportunity(): ArbitrageOpportunity | null {
    const opportunities = this.getOpportunities();
    return opportunities.length > 0 ? opportunities[0] : null;
  }

  removeOpportunity(id: string): void {
    this.opportunities.delete(id);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}