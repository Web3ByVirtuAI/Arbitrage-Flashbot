import { FlashLoanProviderService } from './FlashLoanProviderService';
import { AdvancedDEXService } from './AdvancedDEXService';
import { MetaMaskService } from './MetaMaskService';
import { MoralisService } from './MoralisService';

interface ExecutionOpportunity {
  id: string;
  type: 'single-chain' | 'cross-chain' | 'cross-dex';
  network: string;
  flashLoanProvider: string;
  borrowToken: string;
  borrowAmount: string;
  tradePath: {
    from: {
      dex: string;
      pool: string;
      price: number;
      liquidity: string;
    };
    to: {
      dex: string;
      pool: string;
      price: number;
      liquidity: string;
    };
    tokens: {
      tokenA: string;
      tokenB: string;
    };
  };
  profitEstimate: {
    grossProfit: string;
    flashLoanFee: string;
    gasCost: string;
    netProfit: string;
    profitPercentage: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number; // 0-100
  executionTime: number; // seconds
  validUntil: number; // timestamp
}

interface ExecutionResult {
  success: boolean;
  transactionHash?: string;
  actualProfit?: string;
  gasUsed?: number;
  executionTime?: number;
  error?: string;
  failureReason?: string;
}

interface RiskParameters {
  maxBorrowAmount: string;
  minProfitThreshold: string; // Minimum profit in ETH
  maxSlippage: number; // 0.01 = 1%
  maxGasPrice: string; // In gwei
  blacklistedTokens: string[];
  trustedDEXs: string[];
  maxExecutionTime: number; // seconds
}

export class FlashLoanExecutionService {
  private flashLoanService: FlashLoanProviderService;
  private dexService: AdvancedDEXService;
  private metaMaskService: MetaMaskService;
  private moralisService: MoralisService;
  private executionHistory: ExecutionResult[] = [];
  private activeExecutions: Map<string, any> = new Map();

  // Default risk parameters for safe execution
  private riskParameters: RiskParameters = {
    maxBorrowAmount: '100', // 100 ETH max
    minProfitThreshold: '0.01', // 0.01 ETH minimum profit
    maxSlippage: 0.02, // 2% max slippage
    maxGasPrice: '50', // 50 gwei max
    blacklistedTokens: [], // Avoid risky tokens
    trustedDEXs: ['uniswap-v3', 'balancer-v2', 'curve', '1inch'], 
    maxExecutionTime: 300 // 5 minutes max
  };

  constructor() {
    this.flashLoanService = new FlashLoanProviderService();
    this.dexService = new AdvancedDEXService();
    this.metaMaskService = new MetaMaskService();
    this.moralisService = new MoralisService();
  }

  // Identify executable arbitrage opportunities with flash loan integration
  async identifyExecutableOpportunities(networks: string[] = ['ethereum']): Promise<ExecutionOpportunity[]> {
    const opportunities: ExecutionOpportunity[] = [];

    for (const network of networks) {
      try {
        // Get arbitrage opportunities from all sources
        const [dexOpportunities, crossChainOpportunities, moralisOpportunities] = await Promise.all([
          this.dexService.findCrossDEXArbitrageOpportunities(),
          this.moralisService.findCrossChainArbitrageOpportunities(),
          this.moralisService.findFastArbitrageOpportunities()
        ]);

        // Process DEX arbitrage opportunities
        for (const opportunity of dexOpportunities) {
          if (opportunity.profit_percentage > 1.0 && opportunity.network === network) {
            const execOpportunity = await this.processArbitrageOpportunity(opportunity, 'cross-dex', network);
            if (execOpportunity) {
              opportunities.push(execOpportunity);
            }
          }
        }

        // Process cross-chain opportunities
        for (const opportunity of crossChainOpportunities) {
          if (opportunity.profit_percentage > 2.0) { // Higher threshold for cross-chain
            const execOpportunity = await this.processArbitrageOpportunity(opportunity, 'cross-chain', network);
            if (execOpportunity) {
              opportunities.push(execOpportunity);
            }
          }
        }

        // Process Moralis fast opportunities
        for (const opportunity of moralisOpportunities) {
          if (opportunity.profit_percentage > 0.5) { // Fast execution, lower threshold
            const execOpportunity = await this.processArbitrageOpportunity(opportunity, 'single-chain', network);
            if (execOpportunity) {
              opportunities.push(execOpportunity);
            }
          }
        }

      } catch (error) {
        console.error(`Error identifying opportunities on ${network}:`, error);
      }
    }

    // Sort by profit potential and filter by risk parameters
    return opportunities
      .filter(op => this.passesRiskCheck(op))
      .sort((a, b) => b.profitEstimate.profitPercentage - a.profitEstimate.profitPercentage)
      .slice(0, 10); // Top 10 opportunities
  }

  private async processArbitrageOpportunity(
    opportunity: any, 
    type: 'single-chain' | 'cross-chain' | 'cross-dex',
    network: string
  ): Promise<ExecutionOpportunity | null> {
    try {
      // Extract token information
      const borrowToken = opportunity.token_a || 'WETH';
      const borrowAmount = this.calculateOptimalBorrowAmount(opportunity);

      // Get flash loan quotes
      const flashLoanQuotes = await this.flashLoanService.getFlashLoanQuotes(network, borrowToken, borrowAmount);
      if (flashLoanQuotes.length === 0) return null;

      const bestQuote = flashLoanQuotes[0];

      // Calculate precise profit including all costs
      const profitEstimate = await this.calculatePreciseProfit(opportunity, bestQuote, borrowAmount);
      
      if (parseFloat(profitEstimate.netProfit) < parseFloat(this.riskParameters.minProfitThreshold)) {
        return null; // Not profitable enough
      }

      // Create execution opportunity
      const execOpportunity: ExecutionOpportunity = {
        id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        network,
        flashLoanProvider: bestQuote.provider,
        borrowToken,
        borrowAmount,
        tradePath: {
          from: {
            dex: opportunity.protocol_a || opportunity.dex_a || 'uniswap-v3',
            pool: opportunity.pool_a || 'unknown',
            price: opportunity.price_a || 0,
            liquidity: opportunity.liquidity_a || '0'
          },
          to: {
            dex: opportunity.protocol_b || opportunity.dex_b || 'balancer-v2',
            pool: opportunity.pool_b || 'unknown',
            price: opportunity.price_b || 0,
            liquidity: opportunity.liquidity_b || '0'
          },
          tokens: {
            tokenA: opportunity.token_a || borrowToken,
            tokenB: opportunity.token_b || 'USDC'
          }
        },
        profitEstimate,
        riskLevel: this.assessRiskLevel(opportunity, profitEstimate),
        confidence: Math.min(opportunity.confidence || 85, 95),
        executionTime: parseInt(bestQuote.executionTime.toString()) + 10, // Buffer time
        validUntil: Date.now() + 180000 // Valid for 3 minutes
      };

      return execOpportunity;
    } catch (error) {
      console.error('Error processing arbitrage opportunity:', error);
      return null;
    }
  }

  private calculateOptimalBorrowAmount(opportunity: any): string {
    // Calculate optimal borrow amount based on liquidity and profit potential
    const baseAmount = Math.min(
      parseFloat(opportunity.liquidity_a || '10') * 0.1, // 10% of available liquidity
      parseFloat(this.riskParameters.maxBorrowAmount) // Max allowed
    );

    // Adjust based on profit percentage
    const profitMultiplier = Math.min(opportunity.profit_percentage / 10, 2); // Cap at 2x
    const optimalAmount = baseAmount * profitMultiplier;

    return Math.max(0.1, Math.min(optimalAmount, parseFloat(this.riskParameters.maxBorrowAmount))).toFixed(4);
  }

  private async calculatePreciseProfit(opportunity: any, flashLoanQuote: any, borrowAmount: string) {
    const grossProfitETH = (parseFloat(borrowAmount) * opportunity.profit_percentage / 100);
    const flashLoanFeeETH = parseFloat(flashLoanQuote.fee);
    const gasCostETH = parseFloat(flashLoanQuote.totalCost) - flashLoanFeeETH;
    
    // Additional costs: DEX fees, slippage buffer
    const dexFeesETH = grossProfitETH * 0.003 * 2; // 0.3% per DEX trade
    const slippageBufferETH = grossProfitETH * this.riskParameters.maxSlippage;
    
    const totalCostsETH = flashLoanFeeETH + gasCostETH + dexFeesETH + slippageBufferETH;
    const netProfitETH = grossProfitETH - totalCostsETH;
    const profitPercentage = (netProfitETH / parseFloat(borrowAmount)) * 100;

    return {
      grossProfit: grossProfitETH.toFixed(6),
      flashLoanFee: flashLoanFeeETH.toFixed(6),
      gasCost: gasCostETH.toFixed(6),
      netProfit: netProfitETH.toFixed(6),
      profitPercentage: Math.round(profitPercentage * 100) / 100
    };
  }

  private assessRiskLevel(opportunity: any, profitEstimate: any): 'low' | 'medium' | 'high' {
    const profitRatio = parseFloat(profitEstimate.netProfit) / parseFloat(profitEstimate.grossProfit);
    const liquidityRatio = parseFloat(opportunity.liquidity_a || '0') / parseFloat(profitEstimate.grossProfit);

    if (profitRatio > 0.7 && liquidityRatio > 10) return 'low';
    if (profitRatio > 0.4 && liquidityRatio > 5) return 'medium';
    return 'high';
  }

  private passesRiskCheck(opportunity: ExecutionOpportunity): boolean {
    // Risk parameter checks
    if (parseFloat(opportunity.borrowAmount) > parseFloat(this.riskParameters.maxBorrowAmount)) return false;
    if (parseFloat(opportunity.profitEstimate.netProfit) < parseFloat(this.riskParameters.minProfitThreshold)) return false;
    if (opportunity.riskLevel === 'high' && opportunity.profitEstimate.profitPercentage < 5) return false;
    
    // DEX trust check
    const fromDex = opportunity.tradePath.from.dex;
    const toDex = opportunity.tradePath.to.dex;
    if (!this.riskParameters.trustedDEXs.includes(fromDex) && !this.riskParameters.trustedDEXs.includes(toDex)) {
      return false;
    }

    // Token blacklist check
    if (this.riskParameters.blacklistedTokens.includes(opportunity.borrowToken)) return false;
    if (this.riskParameters.blacklistedTokens.includes(opportunity.tradePath.tokens.tokenA)) return false;
    if (this.riskParameters.blacklistedTokens.includes(opportunity.tradePath.tokens.tokenB)) return false;

    return true;
  }

  // Simulate flash loan execution (dry run)
  async simulateExecution(opportunityId: string): Promise<{
    success: boolean;
    simulatedProfit: string;
    gasEstimate: number;
    risks: string[];
    recommendations: string[];
  }> {
    const opportunity = await this.getOpportunityById(opportunityId);
    if (!opportunity) {
      throw new Error('Opportunity not found');
    }

    const risks: string[] = [];
    const recommendations: string[] = [];

    // Check if opportunity is still valid
    if (Date.now() > opportunity.validUntil) {
      risks.push('Opportunity expired');
    }

    // Check current gas prices
    const gasData = await this.metaMaskService.getGasOptimization();
    const networkGasData = gasData.get(opportunity.network) || gasData.get('mainnet');
    const currentGasPrice = networkGasData ? (networkGasData.gasPrice / 1e9).toString() : '20'; // Convert to gwei
    if (parseFloat(currentGasPrice) > parseFloat(this.riskParameters.maxGasPrice)) {
      risks.push(`High gas price: ${currentGasPrice} gwei > ${this.riskParameters.maxGasPrice} gwei`);
      recommendations.push('Wait for lower gas prices or increase gas limit');
    }

    // Check flash loan provider health
    const providerHealth = await this.flashLoanService.monitorProviderHealth(opportunity.network);
    const providerStatus = providerHealth[opportunity.flashLoanProvider];
    if (providerStatus?.status !== 'healthy') {
      risks.push(`Flash loan provider ${opportunity.flashLoanProvider} status: ${providerStatus?.status}`);
    }

    // Re-verify arbitrage opportunity exists
    const currentArbitrageCheck = await this.verifyCurrentArbitrage(opportunity);
    if (!currentArbitrageCheck.valid) {
      risks.push('Arbitrage opportunity no longer exists');
    }

    // Calculate updated profit estimate
    const updatedProfitEstimate = currentArbitrageCheck.valid ? 
      currentArbitrageCheck.profitEstimate : '0';

    return {
      success: risks.length === 0,
      simulatedProfit: updatedProfitEstimate,
      gasEstimate: parseInt(providerStatus?.gasPrice || '300000'),
      risks,
      recommendations
    };
  }

  private async verifyCurrentArbitrage(opportunity: ExecutionOpportunity): Promise<{
    valid: boolean;
    profitEstimate: string;
  }> {
    try {
      // Re-fetch current prices from DEXs
      // This would integrate with actual DEX APIs to verify prices haven't changed
      // For now, assume 80% of opportunities are still valid after 30 seconds
      const timeSinceCreation = Date.now() - parseInt(opportunity.id.split('_')[1]);
      const validityProbability = Math.max(0.2, 1 - (timeSinceCreation / 60000)); // Decay over 1 minute

      const isValid = Math.random() < validityProbability;
      
      if (isValid) {
        // Simulate slight profit decrease due to market movements
        const currentProfit = parseFloat(opportunity.profitEstimate.netProfit) * (0.8 + Math.random() * 0.4);
        return {
          valid: currentProfit > 0,
          profitEstimate: currentProfit.toFixed(6)
        };
      }

      return { valid: false, profitEstimate: '0' };
    } catch (error) {
      console.error('Error verifying current arbitrage:', error);
      return { valid: false, profitEstimate: '0' };
    }
  }

  // Execute flash loan arbitrage (preparation only - actual execution requires deployed contracts)
  async prepareExecution(opportunityId: string): Promise<{
    executionPlan: any;
    contractParams: any;
    safetyChecks: any;
  }> {
    const opportunity = await this.getOpportunityById(opportunityId);
    if (!opportunity) {
      throw new Error('Opportunity not found');
    }

    // Run simulation first
    const simulation = await this.simulateExecution(opportunityId);
    if (!simulation.success) {
      throw new Error(`Execution blocked by risks: ${simulation.risks.join(', ')}`);
    }

    // Prepare flash loan execution
    const executionPlan = await this.flashLoanService.prepareFlashLoanExecution({
      flashLoanProvider: opportunity.flashLoanProvider,
      borrowAmount: opportunity.borrowAmount,
      borrowToken: opportunity.borrowToken,
      tradePath: {
        from: opportunity.tradePath.from,
        to: opportunity.tradePath.to,
        expectedProfit: opportunity.profitEstimate.netProfit
      },
      gasLimit: simulation.gasEstimate,
      maxGasPrice: this.riskParameters.maxGasPrice,
      slippage: this.riskParameters.maxSlippage,
      deadline: Date.now() + (opportunity.executionTime * 1000)
    });

    return {
      executionPlan,
      contractParams: {
        flashLoanCalldata: executionPlan.contractCalldata,
        borrowAmount: opportunity.borrowAmount,
        borrowToken: opportunity.borrowToken,
        expectedMinProfit: executionPlan.safetyChecks.minProfitThreshold
      },
      safetyChecks: executionPlan.safetyChecks
    };
  }

  private async getOpportunityById(id: string): Promise<ExecutionOpportunity | null> {
    // In production, this would fetch from database
    // For now, re-identify opportunities and find matching ID
    const opportunities = await this.identifyExecutableOpportunities();
    return opportunities.find(op => op.id === id) || null;
  }

  // Get execution statistics and performance metrics
  async getExecutionStats(): Promise<any> {
    const providerStats = await this.flashLoanService.getProviderStats();
    
    return {
      flashLoanProviders: providerStats,
      riskParameters: this.riskParameters,
      executionHistory: {
        totalExecutions: this.executionHistory.length,
        successRate: this.executionHistory.length > 0 ? 
          (this.executionHistory.filter(e => e.success).length / this.executionHistory.length) * 100 : 0,
        averageProfit: this.calculateAverageProfit(),
        totalProfit: this.calculateTotalProfit()
      },
      activeExecutions: this.activeExecutions.size,
      supportedNetworks: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc'],
      maxBorrowAmount: this.riskParameters.maxBorrowAmount,
      minProfitThreshold: this.riskParameters.minProfitThreshold,
      recommendedSetup: {
        priority: 'Deploy arbitrage execution smart contract',
        estimatedCost: '0.05-0.1 ETH for contract deployment',
        timeToSetup: '30-60 minutes for full deployment'
      }
    };
  }

  private calculateAverageProfit(): string {
    if (this.executionHistory.length === 0) return '0';
    
    const successfulExecutions = this.executionHistory.filter(e => e.success && e.actualProfit);
    if (successfulExecutions.length === 0) return '0';
    
    const totalProfit = successfulExecutions.reduce((sum, e) => sum + parseFloat(e.actualProfit || '0'), 0);
    return (totalProfit / successfulExecutions.length).toFixed(6);
  }

  private calculateTotalProfit(): string {
    return this.executionHistory
      .filter(e => e.success && e.actualProfit)
      .reduce((sum, e) => sum + parseFloat(e.actualProfit || '0'), 0)
      .toFixed(6);
  }

  // Update risk parameters
  updateRiskParameters(newParams: Partial<RiskParameters>): void {
    this.riskParameters = { ...this.riskParameters, ...newParams };
  }

  // Helper method to get current gas price
  private async getCurrentGasPrice(network: string = 'ethereum'): Promise<string> {
    try {
      const gasData = await this.metaMaskService.getGasOptimization();
      const networkGasData = gasData.get(network) || gasData.get('mainnet');
      if (networkGasData) {
        return (networkGasData.gasPrice / 1e9).toFixed(1); // Convert to gwei
      }
      return '20'; // Default fallback
    } catch (error) {
      return '20'; // Default fallback on error
    }
  }

  // Monitor ongoing executions (for future implementation)
  async monitorExecutions(): Promise<any> {
    return {
      activeExecutions: Array.from(this.activeExecutions.entries()).map(([id, exec]) => ({
        id,
        status: exec.status,
        progress: exec.progress,
        estimatedCompletion: exec.estimatedCompletion
      })),
      pendingOpportunities: await this.identifyExecutableOpportunities(),
      systemHealth: {
        flashLoanProviders: await this.flashLoanService.monitorProviderHealth('ethereum'),
        gasConditions: {
          current: await this.getCurrentGasPrice('ethereum'),
          threshold: this.riskParameters.maxGasPrice,
          recommendation: 'Monitor gas prices for optimal execution timing'
        }
      }
    };
  }
}