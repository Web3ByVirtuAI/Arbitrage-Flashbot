import { logger } from '../utils/logger';
import { OpportunityFinder, ArbitrageOpportunity } from './OpportunityFinder';
import { FlashLoanExecutor, TradeResult } from './FlashLoanExecutor';
import { PriceMonitor, WebSocketPriceUpdate } from './PriceMonitor';
import { BOT_CONFIG } from '../config/constants';

export interface TradingStats {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalProfit: string;
  averageProfit: string;
  uptime: number;
  startTime: number;
}

export interface RiskManagement {
  dailyTradeCount: number;
  dailyProfit: number;
  lastTradeTime: number;
  consecutiveFailures: number;
}

export class AutoTrader {
  private opportunityFinder: OpportunityFinder;
  private flashLoanExecutor: FlashLoanExecutor;
  private priceMonitor: PriceMonitor;
  
  private isRunning: boolean = false;
  private stats: TradingStats;
  private risk: RiskManagement;
  private tradingInterval: NodeJS.Timeout | null = null;

  constructor(
    opportunityFinder: OpportunityFinder,
    flashLoanExecutor: FlashLoanExecutor,
    priceMonitor: PriceMonitor
  ) {
    this.opportunityFinder = opportunityFinder;
    this.flashLoanExecutor = flashLoanExecutor;
    this.priceMonitor = priceMonitor;

    this.stats = {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfit: '0',
      averageProfit: '0',
      uptime: 0,
      startTime: Date.now()
    };

    this.risk = {
      dailyTradeCount: 0,
      dailyProfit: 0,
      lastTradeTime: 0,
      consecutiveFailures: 0
    };

    this.setupPriceMonitorCallbacks();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Auto trader is already running');
      return;
    }

    logger.info('🚀 Starting auto trader...');
    this.isRunning = true;
    this.stats.startTime = Date.now();

    try {
      // Start all monitoring services
      await this.priceMonitor.startMonitoring();
      await this.opportunityFinder.startScanning();
      
      // Start trading loop
      this.startTradingLoop();
      
      logger.success('Auto trader started successfully');
    } catch (error) {
      logger.error('Failed to start auto trader:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('⏹️  Stopping auto trader...');
    this.isRunning = false;

    // Stop trading loop
    if (this.tradingInterval) {
      clearInterval(this.tradingInterval);
      this.tradingInterval = null;
    }

    // Stop monitoring services
    await this.opportunityFinder.stopScanning();
    await this.priceMonitor.stopMonitoring();

    logger.success('Auto trader stopped');
  }

  private setupPriceMonitorCallbacks(): void {
    this.priceMonitor.onPriceUpdate((update: WebSocketPriceUpdate) => {
      // React to significant price movements
      this.handlePriceUpdate(update);
    });
  }

  private handlePriceUpdate(update: WebSocketPriceUpdate): void {
    logger.debug(`Price update: ${update.symbol} = $${update.price}`);
    
    // You can implement immediate reaction logic here
    // For example, if price moves significantly, trigger immediate scan
  }

  private startTradingLoop(): void {
    const interval = 2000; // Check every 2 seconds
    
    this.tradingInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.executeTradingCycle();
      } catch (error) {
        logger.error('Error in trading cycle:', error);
      }
    }, interval);
  }

  private async executeTradingCycle(): Promise<void> {
    // Check risk management constraints
    if (!this.checkRiskConstraints()) {
      return;
    }

    // Get best opportunity
    const opportunity = this.opportunityFinder.getBestOpportunity();
    if (!opportunity) {
      logger.debug('No profitable opportunities found');
      return;
    }

    logger.info(`Found opportunity: ${opportunity.profitPercentage.toFixed(4)}% profit potential`);

    // Validate opportunity is still valid
    if (!await this.validateOpportunity(opportunity)) {
      logger.warn('Opportunity validation failed, removing from queue');
      this.opportunityFinder.removeOpportunity(opportunity.id);
      return;
    }

    // Check if we should execute this trade
    if (!this.shouldExecuteTrade(opportunity)) {
      return;
    }

    // Execute the trade
    await this.executeTradeWithRiskManagement(opportunity);
  }

  private checkRiskConstraints(): boolean {
    const now = Date.now();
    
    // Reset daily counters if new day
    if (this.isNewDay(this.risk.lastTradeTime, now)) {
      this.risk.dailyTradeCount = 0;
      this.risk.dailyProfit = 0;
    }

    // Check daily trade limit
    if (this.risk.dailyTradeCount >= BOT_CONFIG.RISK_MANAGEMENT.MAX_DAILY_TRADES) {
      logger.warn('Daily trade limit reached');
      return false;
    }

    // Check consecutive failures
    if (this.risk.consecutiveFailures >= 5) {
      logger.warn('Too many consecutive failures, pausing trading');
      return false;
    }

    // Check if we have enough balance
    // This would check wallet balance in a real implementation

    return true;
  }

  private isNewDay(timestamp1: number, timestamp2: number): boolean {
    const date1 = new Date(timestamp1).toDateString();
    const date2 = new Date(timestamp2).toDateString();
    return date1 !== date2;
  }

  private async validateOpportunity(opportunity: ArbitrageOpportunity): Promise<boolean> {
    // Check if opportunity is not too old
    const maxAge = 30000; // 30 seconds
    if (Date.now() - opportunity.timestamp > maxAge) {
      logger.debug('Opportunity too old, discarding');
      return false;
    }

    // Simulate the trade to check if it's still profitable
    const isValid = await this.flashLoanExecutor.simulateArbitrage(opportunity);
    if (!isValid) {
      logger.debug('Opportunity simulation failed');
      return false;
    }

    return true;
  }

  private shouldExecuteTrade(opportunity: ArbitrageOpportunity): boolean {
    // More sophisticated logic can be added here
    
    // Check minimum profit threshold
    if (opportunity.profitPercentage < BOT_CONFIG.MIN_PROFIT_THRESHOLD * 100) {
      return false;
    }

    // Check gas prices (don't trade if gas is too high)
    // This would check current gas prices in a real implementation
    
    // Check market volatility
    // Don't trade during high volatility periods
    
    return true;
  }

  private async executeTradeWithRiskManagement(opportunity: ArbitrageOpportunity): Promise<void> {
    logger.trade(`Executing trade for opportunity ${opportunity.id}`);
    
    const startTime = Date.now();
    
    try {
      // Execute the arbitrage
      const result = await this.flashLoanExecutor.executeArbitrage(opportunity);
      
      // Update statistics
      this.updateStats(result, Date.now() - startTime);
      
      // Update risk management
      this.updateRiskManagement(result);
      
      // Remove opportunity from queue
      this.opportunityFinder.removeOpportunity(opportunity.id);
      
    } catch (error: any) {
      logger.error('Trade execution failed:', error);
      this.updateRiskManagement({ success: false, error: error?.message || 'Unknown error' });
    }
  }

  private updateStats(result: TradeResult, executionTime: number): void {
    this.stats.totalTrades++;
    
    if (result.success) {
      this.stats.successfulTrades++;
      const profit = parseFloat(result.profit || '0');
      const currentTotal = parseFloat(this.stats.totalProfit);
      this.stats.totalProfit = (currentTotal + profit).toString();
      this.stats.averageProfit = (currentTotal / this.stats.successfulTrades).toString();
    } else {
      this.stats.failedTrades++;
    }

    this.stats.uptime = Date.now() - this.stats.startTime;
    
    logger.info(`Trade stats: ${this.stats.successfulTrades}/${this.stats.totalTrades} successful`);
  }

  private updateRiskManagement(result: TradeResult): void {
    this.risk.lastTradeTime = Date.now();
    this.risk.dailyTradeCount++;

    if (result.success) {
      this.risk.consecutiveFailures = 0;
      const profit = parseFloat(result.profit || '0');
      this.risk.dailyProfit += profit;
    } else {
      this.risk.consecutiveFailures++;
    }
  }

  // Public methods for monitoring and control

  public getStats(): TradingStats {
    return { ...this.stats };
  }

  public getRiskStats(): RiskManagement {
    return { ...this.risk };
  }

  public getOpportunities(): ArbitrageOpportunity[] {
    return this.opportunityFinder.getOpportunities();
  }

  public async getWalletBalance(): Promise<string> {
    return await this.flashLoanExecutor.getWalletBalance();
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public getSystemHealth(): any {
    return {
      autoTrader: this.isRunning,
      priceMonitor: this.priceMonitor.isHealthy(),
      opportunityFinder: true, // Add health check
      flashLoanExecutor: true, // Add health check
      activeTrades: this.flashLoanExecutor.getActiveTradesCount(),
      opportunities: this.opportunityFinder.getOpportunities().length
    };
  }

  // Emergency stop
  public async emergencyStop(): Promise<void> {
    logger.error('🛑 EMERGENCY STOP TRIGGERED');
    await this.stop();
  }

  // Pause trading (keep monitoring active)
  public pauseTrading(): void {
    if (this.tradingInterval) {
      clearInterval(this.tradingInterval);
      this.tradingInterval = null;
    }
    logger.warn('⏸️  Trading paused (monitoring continues)');
  }

  // Resume trading
  public resumeTrading(): void {
    if (!this.tradingInterval && this.isRunning) {
      this.startTradingLoop();
      logger.info('▶️  Trading resumed');
    }
  }
}