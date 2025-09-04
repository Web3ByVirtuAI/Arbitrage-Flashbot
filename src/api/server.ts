import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { OpportunityFinder } from '../core/OpportunityFinder';
import { FlashLoanExecutor } from '../core/FlashLoanExecutor';
import { PriceMonitor } from '../core/PriceMonitor';
import { AutoTrader } from '../core/AutoTrader';
import { NETWORK_CONFIG } from '../config/constants';
import { DemoDataProvider } from '../demo/DemoDataProvider';
import { APIService } from '../services/APIService';
import { FlashLoanProviderService } from '../services/FlashLoanProviderService';
import { FlashLoanExecutionService } from '../services/FlashLoanExecutionService';

export class APIServer {
  private app: express.Application;
  private server: any;
  private port: number;
  
  // Core components
  private provider!: ethers.JsonRpcProvider;
  private opportunityFinder!: OpportunityFinder;
  private flashLoanExecutor!: FlashLoanExecutor;
  private priceMonitor!: PriceMonitor;
  private autoTrader!: AutoTrader;
  private demoProvider!: DemoDataProvider;
  private apiService!: APIService;
  private flashLoanProviderService!: FlashLoanProviderService;
  private flashLoanExecutionService!: FlashLoanExecutionService;
  private isDemoMode: boolean = false;

  // Rate limiting
  private rateLimiter: RateLimiterMemory;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    
    // Initialize rate limiter
    this.rateLimiter = new RateLimiterMemory({
      points: 100, // Number of requests
      duration: 60, // Per 60 seconds
    });

    this.setupMiddleware();
    this.initializeComponents();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true
    }));
    
    // Logging
    this.app.use(morgan('combined'));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting middleware
    this.app.use(async (req, res, next) => {
      try {
        await this.rateLimiter.consume(req.ip || 'unknown');
        next();
      } catch (rejRes: any) {
        const remainingPoints = rejRes.remainingPoints || 0;
        const msBeforeNext = rejRes.msBeforeNext || 1000;
        
        res.set('Retry-After', String(Math.round(msBeforeNext / 1000)));
        res.set('X-RateLimit-Limit', '100');
        res.set('X-RateLimit-Remaining', String(remainingPoints));
        res.set('X-RateLimit-Reset', String(new Date(Date.now() + msBeforeNext)));
        
        res.status(429).json({ error: 'Rate limit exceeded' });
      }
    });
  }

  private async initializeComponents(): Promise<void> {
    try {
      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.ETHEREUM.rpcUrl);
      
      // Check if we should run in demo mode vs live API mode
      const privateKey = process.env.PRIVATE_KEY;
      const alchemyApiKey = process.env.ALCHEMY_API_KEY;
      
      this.isDemoMode = !alchemyApiKey;
      
      // Initialize flash loan services for all modes
      this.flashLoanProviderService = new FlashLoanProviderService();
      this.flashLoanExecutionService = new FlashLoanExecutionService();

      if (this.isDemoMode) {
        // Demo mode - use simulated data
        logger.info('🎯 Running in DEMO mode with simulated data');
        logger.info('💡 To use real APIs: Set ALCHEMY_API_KEY in .env');
        this.demoProvider = new DemoDataProvider();
        this.demoProvider.start();
      } else {
        // Live API mode - use real market data
        logger.info('⚡ Running in LIVE API mode with real market data');
        logger.info(`🔗 Using Alchemy API: ${alchemyApiKey?.substring(0, 8)}...`);
        
        // Initialize API service for real data
        this.apiService = new APIService();
        await this.apiService.start();
        
        if (privateKey) {
          // Full live trading mode
          logger.info('💰 Trading enabled with private key');
          this.opportunityFinder = new OpportunityFinder(this.provider);
          this.priceMonitor = new PriceMonitor();
          this.flashLoanExecutor = new FlashLoanExecutor(this.provider, privateKey);
          
          this.autoTrader = new AutoTrader(
            this.opportunityFinder,
            this.flashLoanExecutor,
            this.priceMonitor
          );
        } else {
          logger.info('📊 API-only mode (no trading without PRIVATE_KEY)');
        }
      }
      
      logger.info('API server components initialized');
    } catch (error) {
      logger.error('Failed to initialize components:', error);
      throw error;
    }
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async (req, res) => {
      const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        components: this.isDemoMode 
          ? { mode: 'demo', demoProvider: this.demoProvider?.isHealthy() || false }
          : this.apiService 
            ? await this.apiService.getSystemHealth()
            : (this.autoTrader?.getSystemHealth() || { mode: 'live_api' })
      };
      res.json(health);
    });

    // API Routes
    this.app.get('/api/opportunities', (req, res) => {
      try {
        const opportunities = this.isDemoMode 
          ? this.demoProvider.getOpportunities()
          : this.apiService 
            ? this.apiService.getCurrentOpportunities()
            : (this.opportunityFinder?.getOpportunities() || []);
        res.json({ opportunities });
      } catch (error) {
        logger.error('Error fetching opportunities:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/prices', (req, res) => {
      try {
        const prices = this.isDemoMode
          ? this.demoProvider.getPrices()
          : this.apiService 
            ? this.apiService.getCurrentPrices()
            : (this.priceMonitor?.getAllPrices() || new Map());
        const priceArray = Array.from(prices.entries()).map(([, data]) => data);
        res.json({ prices: priceArray });
      } catch (error) {
        logger.error('Error fetching prices:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/stats', async (req, res) => {
      try {
        if (this.isDemoMode) {
          // Demo mode stats
          res.json({
            trading: {
              totalTrades: Math.floor(Math.random() * 50) + 10,
              successfulTrades: Math.floor(Math.random() * 40) + 8,
              failedTrades: Math.floor(Math.random() * 10) + 2,
              totalProfit: (Math.random() * 5 + 1).toFixed(4),
              averageProfit: (Math.random() * 0.5 + 0.1).toFixed(4),
              uptime: Date.now() - (Math.random() * 86400000) // Random uptime up to 24h
            },
            risk: {
              dailyTradeCount: Math.floor(Math.random() * 20) + 5,
              dailyProfit: Math.random() * 2 + 0.5,
              consecutiveFailures: 0
            },
            walletBalance: (Math.random() * 10 + 5).toFixed(4),
            priceMonitor: this.demoProvider.getStats(),
            mode: 'demo'
          });
        } else if (this.apiService) {
          // Live API mode stats
          const apiStats = this.apiService.getStats();
          const tradingStats = this.apiService.getTradingStats();
          const riskStats = this.apiService.getRiskStats();
          const balance = await this.apiService.getWalletBalance();
          
          res.json({
            trading: tradingStats,
            risk: riskStats,
            walletBalance: balance,
            priceMonitor: apiStats,
            blockchain: apiStats.blockchain,
            mode: 'live_api'
          });
        } else {
          // Legacy live mode stats
          const stats = this.autoTrader?.getStats() || {};
          const riskStats = this.autoTrader?.getRiskStats() || {};
          const balance = await this.flashLoanExecutor?.getWalletBalance() || '0';
          
          res.json({
            trading: stats,
            risk: riskStats,
            walletBalance: balance,
            priceMonitor: this.priceMonitor?.getStats() || {},
            mode: 'live'
          });
        }
      } catch (error) {
        logger.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Control endpoints
    this.app.post('/api/start', async (req, res) => {
      try {
        if (this.isDemoMode) {
          logger.info('Demo mode: Simulating trading start');
          res.json({ message: 'Demo trading simulation started' });
        } else {
          if (!this.autoTrader) {
            return res.status(400).json({ error: 'Auto trader not initialized' });
          }
          
          await this.autoTrader.start();
          res.json({ message: 'Auto trader started' });
        }
      } catch (error) {
        logger.error('Error starting auto trader:', error);
        res.status(500).json({ error: 'Failed to start auto trader' });
      }
    });

    this.app.post('/api/stop', async (req, res) => {
      try {
        if (this.isDemoMode) {
          logger.info('Demo mode: Simulating trading stop');
          res.json({ message: 'Demo trading simulation stopped' });
        } else {
          if (!this.autoTrader) {
            return res.status(400).json({ error: 'Auto trader not initialized' });
          }
          
          await this.autoTrader.stop();
          res.json({ message: 'Auto trader stopped' });
        }
      } catch (error) {
        logger.error('Error stopping auto trader:', error);
        res.status(500).json({ error: 'Failed to stop auto trader' });
      }
    });

    this.app.post('/api/pause', (req, res) => {
      try {
        if (this.isDemoMode) {
          logger.info('Demo mode: Simulating trading pause');
          res.json({ message: 'Demo trading simulation paused' });
        } else {
          if (!this.autoTrader) {
            return res.status(400).json({ error: 'Auto trader not initialized' });
          }
          
          this.autoTrader.pauseTrading();
          res.json({ message: 'Trading paused' });
        }
      } catch (error) {
        logger.error('Error pausing trading:', error);
        res.status(500).json({ error: 'Failed to pause trading' });
      }
    });

    this.app.post('/api/resume', (req, res) => {
      try {
        if (this.isDemoMode) {
          logger.info('Demo mode: Simulating trading resume');
          res.json({ message: 'Demo trading simulation resumed' });
        } else {
          if (!this.autoTrader) {
            return res.status(400).json({ error: 'Auto trader not initialized' });
          }
          
          this.autoTrader.resumeTrading();
          res.json({ message: 'Trading resumed' });
        }
      } catch (error) {
        logger.error('Error resuming trading:', error);
        res.status(500).json({ error: 'Failed to resume trading' });
      }
    });

    // Enhanced API endpoints for Moralis and MetaMask features
    this.app.get('/api/gas-optimization', async (req, res) => {
      try {
        if (this.isDemoMode) {
          res.json({
            networks: [
              { network: 'mainnet', gasPrice: '20000000000', recommendation: 'standard' },
              { network: 'polygon', gasPrice: '30000000000', recommendation: 'fast' }
            ],
            mode: 'demo'
          });
        } else if (this.apiService) {
          const gasData = await this.apiService.metaMaskService?.getGasOptimization();
          res.json({ 
            networks: gasData ? Array.from(gasData.values()) : [],
            mode: 'live'
          });
        } else {
          res.status(503).json({ error: 'Gas optimization service not available' });
        }
      } catch (error) {
        logger.error('Error fetching gas optimization:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // New Infura/MetaMask MEV Protection endpoints
    this.app.get('/api/mev-gas-price/:network?', async (req, res) => {
      try {
        const network = req.params.network || 'mainnet';
        
        if (this.isDemoMode) {
          res.json({
            network,
            gasPrice: 20000000000,
            mevProtected: true,
            recommendations: {
              slow: 17000000000,
              standard: 20000000000,
              fast: 23000000000,
              mevProtected: 25000000000
            },
            mode: 'demo'
          });
        } else if (this.apiService?.metaMaskService) {
          const gasData = await this.apiService.metaMaskService.getMEVProtectedGasPrice(network);
          res.json({ ...gasData, mode: 'live' });
        } else {
          res.status(503).json({ error: 'MEV protection service not available' });
        }
      } catch (error) {
        logger.error('Error getting MEV-protected gas price:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/simulate-mev-transaction', async (req, res) => {
      try {
        const { txData, network = 'mainnet' } = req.body;
        
        if (this.isDemoMode) {
          res.json({
            success: true,
            gasEstimate: 21000,
            mevProtectedGasPrice: 25000000000,
            standardGasPrice: 20000000000,
            network,
            mode: 'demo'
          });
        } else if (this.apiService?.metaMaskService) {
          const simulation = await this.apiService.metaMaskService.simulateMEVProtectedTransaction(txData, network);
          res.json({ ...simulation, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Transaction simulation service not available' });
        }
      } catch (error) {
        logger.error('Error simulating MEV-protected transaction:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/infura-health', async (req, res) => {
      try {
        if (this.isDemoMode) {
          res.json({
            healthy: true,
            projectId: 'demo-project',
            mevProtection: true,
            mode: 'demo'
          });
        } else if (this.apiService?.metaMaskService) {
          const healthy = await this.apiService.metaMaskService.isHealthy();
          res.json({ 
            healthy,
            projectId: process.env.INFURA_PROJECT_ID?.substring(0, 8) + '...' || 'not-configured',
            mevProtection: !!process.env.INFURA_API_KEY_SECRET,
            mode: 'live' 
          });
        } else {
          res.status(503).json({ error: 'Infura health check not available' });
        }
      } catch (error) {
        logger.error('Error checking Infura health:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/network-health', async (req, res) => {
      try {
        if (this.isDemoMode) {
          res.json({
            overall: true,
            networks: {
              mainnet: { healthy: true, blockNumber: 18000000 },
              polygon: { healthy: true, blockNumber: 45000000 }
            },
            mode: 'demo'
          });
        } else if (this.apiService) {
          const health = await this.apiService.metaMaskService?.getNetworkHealth();
          res.json({ ...health, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Network health service not available' });
        }
      } catch (error) {
        logger.error('Error fetching network health:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/simulate-transaction', async (req, res) => {
      try {
        const { txData, network = 'mainnet' } = req.body;
        
        if (this.isDemoMode) {
          res.json({
            success: true,
            gasEstimate: '150000',
            totalCostEther: '0.003',
            mode: 'demo'
          });
        } else if (this.apiService) {
          const simulation = await this.apiService.metaMaskService?.simulateTransaction(txData, network);
          res.json({ ...simulation, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Transaction simulation not available' });
        }
      } catch (error) {
        logger.error('Error simulating transaction:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/optimal-network/:txType', async (req, res) => {
      try {
        const txType = req.params.txType as 'swap' | 'flashloan' | 'transfer';
        
        if (this.isDemoMode) {
          res.json({
            recommended: {
              network: 'polygon',
              estimatedCostEther: '0.001',
              congestion: 'low'
            },
            mode: 'demo'
          });
        } else if (this.apiService) {
          const optimal = await this.apiService.metaMaskService?.getOptimalNetwork(txType);
          res.json({ ...optimal, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Network optimization not available' });
        }
      } catch (error) {
        logger.error('Error finding optimal network:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/emergency-stop', async (req, res) => {
      try {
        if (this.isDemoMode) {
          logger.warn('Demo mode: Simulating emergency stop');
          res.json({ message: 'Demo emergency stop simulation executed' });
        } else {
          if (!this.autoTrader) {
            return res.status(400).json({ error: 'Auto trader not initialized' });
          }
          
          await this.autoTrader.emergencyStop();
          res.json({ message: 'Emergency stop executed' });
        }
      } catch (error) {
        logger.error('Error executing emergency stop:', error);
        res.status(500).json({ error: 'Failed to execute emergency stop' });
      }
    });

    // Moralis rate limit status endpoint
    this.app.get('/api/moralis/rate-limit', async (req, res) => {
      try {
        if (this.isDemoMode) {
          res.json({
            optimizedForFreeTier: true,
            nodeRequests: { current: 15, limit: 80, remaining: 65, percentUsed: 19 },
            apiRequests: { current: 234, limit: 1200, remaining: 966, percentUsed: 20 },
            supportedRpcChains: ['eth'],
            message: 'Demo mode: Simulated Moralis free tier optimization',
            mode: 'demo'
          });
        } else if (this.apiService) {
          // Get the Moralis service from the API service
          const moralisService = (this.apiService as any).moralisService;
          if (moralisService) {
            const rateLimitStatus = moralisService.getRateLimitStatus();
            res.json(rateLimitStatus);
          } else {
            res.status(503).json({ error: 'Moralis service not available' });
          }
        } else {
          res.status(503).json({ error: 'Moralis rate limit service not available' });
        }
      } catch (error) {
        logger.error('Error getting Moralis rate limit status:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Enhanced Infura Gas API endpoints
    this.app.get('/api/infura-gas/:network?', async (req, res) => {
      try {
        const network = req.params.network || 'mainnet';
        
        if (this.isDemoMode) {
          res.json({
            network,
            source: 'Demo Infura Gas API',
            suggestions: {
              low: { suggestedMaxFeePerGas: '15.2', minWaitTimeEstimate: 180000 },
              medium: { suggestedMaxFeePerGas: '18.5', minWaitTimeEstimate: 60000 },
              high: { suggestedMaxFeePerGas: '22.1', minWaitTimeEstimate: 30000 }
            },
            enhancedRecommendations: {
              slow: 15200000000,
              standard: 18500000000,
              fast: 22100000000,
              mevProtected: 26520000000,
              priority: 1850000000
            },
            networkCongestion: 45,
            mode: 'demo'
          });
        } else if (this.apiService?.metaMaskService) {
          const gasData = await this.apiService.metaMaskService.getInfuraGasRecommendations(network);
          res.json({ ...gasData, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Infura Gas API service not available' });
        }
      } catch (error) {
        logger.error('Error getting Infura Gas API data:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/comprehensive-gas/:network?', async (req, res) => {
      try {
        const network = req.params.network || 'mainnet';
        
        if (this.isDemoMode) {
          res.json({
            network,
            sources: {
              infuraGasApi: { available: true, confidence: 'high' },
              basicRpc: { available: true, confidence: 'medium' }
            },
            recommendations: {
              slow: 15200000000,
              standard: 18500000000,
              fast: 22100000000,
              mevProtected: 26520000000,
              priority: 1850000000
            },
            confirmationTimes: {
              slow: '3 minutes',
              standard: '1 minute', 
              fast: '30 seconds'
            },
            networkCongestion: 45,
            confidence: 'high',
            mode: 'demo'
          });
        } else if (this.apiService?.metaMaskService) {
          const analysis = await this.apiService.metaMaskService.getComprehensiveGasAnalysis(network);
          res.json({ ...analysis, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Comprehensive gas analysis not available' });
        }
      } catch (error) {
        logger.error('Error getting comprehensive gas analysis:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/arbitrage-optimal-gas/:network?', async (req, res) => {
      try {
        const network = req.params.network || 'mainnet';
        
        if (this.isDemoMode) {
          res.json({
            network,
            arbitrageOptimal: {
              gasPrice: 26520000000,
              maxFeePerGas: 26520000000,
              maxPriorityFeePerGas: 2652000000,
              estimatedConfirmationTime: '30 seconds'
            },
            networkCongestion: 45,
            confidence: 'high',
            sources: ['infuraGasApi', 'basicRpc'],
            mode: 'demo'
          });
        } else if (this.apiService?.metaMaskService) {
          const optimal = await this.apiService.metaMaskService.getArbitrageOptimalGas(network);
          res.json({ ...optimal, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Arbitrage gas optimization not available' });
        }
      } catch (error) {
        logger.error('Error getting arbitrage optimal gas:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Advanced DEX monitoring endpoints
    this.app.get('/api/dex/curve/:network?', async (req, res) => {
      try {
        const network = (req.params.network as 'ethereum' | 'arbitrum' | 'polygon') || 'ethereum';
        
        if (this.isDemoMode) {
          res.json({
            pools: [
              {
                id: '0x06364f10b501e868329afbc005b3492902d6c763',
                name: '3pool',
                symbol: '3Crv',
                totalLiquidity: '45000000',
                virtualPrice: '1.0234',
                coins: [
                  { symbol: 'DAI', balance: '15000000' },
                  { symbol: 'USDC', balance: '15000000' },
                  { symbol: 'USDT', balance: '15000000' }
                ]
              }
            ],
            network,
            mode: 'demo'
          });
        } else if (this.apiService) {
          const advancedDEXService = (this.apiService as any).advancedDEXService;
          if (advancedDEXService) {
            const pools = await advancedDEXService.getCurvePools(network);
            res.json({ pools, network, mode: 'live' });
          } else {
            res.status(503).json({ error: 'Curve service not available' });
          }
        } else {
          res.status(503).json({ error: 'Advanced DEX service not available' });
        }
      } catch (error) {
        logger.error('Error getting Curve pools:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/dex/balancer/:network?', async (req, res) => {
      try {
        const network = (req.params.network as 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base') || 'ethereum';
        
        if (this.isDemoMode) {
          res.json({
            pools: [
              {
                id: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
                address: '0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56',
                poolType: 'Weighted',
                totalLiquidity: '12500000',
                tokens: [
                  { symbol: 'BAL', balance: '8000000', weight: '0.8' },
                  { symbol: 'WETH', balance: '2500', weight: '0.2' }
                ]
              }
            ],
            network,
            mode: 'demo'
          });
        } else if (this.apiService) {
          const advancedDEXService = (this.apiService as any).advancedDEXService;
          if (advancedDEXService) {
            const pools = await advancedDEXService.getBalancerPools(network);
            res.json({ pools, network, mode: 'live' });
          } else {
            res.status(503).json({ error: 'Balancer service not available' });
          }
        } else {
          res.status(503).json({ error: 'Advanced DEX service not available' });
        }
      } catch (error) {
        logger.error('Error getting Balancer pools:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/dex/1inch-quote', async (req, res) => {
      try {
        const { fromToken, toTokens, amount, network = 'ethereum' } = req.query;
        
        if (!fromToken || !toTokens || !amount) {
          return res.status(400).json({ error: 'Missing required parameters: fromToken, toTokens, amount' });
        }
        
        if (this.isDemoMode) {
          res.json({
            quotes: [
              {
                fromToken,
                toToken: Array.isArray(toTokens) ? toTokens[0] : toTokens,
                srcAmount: amount,
                dstAmount: '2845.123456',
                protocols: ['Uniswap_V3', 'SushiSwap'],
                estimatedGas: '180000',
                network
              }
            ],
            mode: 'demo'
          });
        } else if (this.apiService) {
          const advancedDEXService = (this.apiService as any).advancedDEXService;
          if (advancedDEXService) {
            const tokenList = Array.isArray(toTokens) ? toTokens as string[] : [toTokens as string];
            const quotes = await advancedDEXService.getOneInchQuotes(
              fromToken as string,
              tokenList,
              amount as string,
              network as any
            );
            res.json({ quotes, network, mode: 'live' });
          } else {
            res.status(503).json({ error: '1inch service not available' });
          }
        } else {
          res.status(503).json({ error: 'Advanced DEX service not available' });
        }
      } catch (error) {
        logger.error('Error getting 1inch quotes:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/dex/pancakeswap/:network?', async (req, res) => {
      try {
        const network = (req.params.network as 'bsc' | 'ethereum') || 'bsc';
        
        if (this.isDemoMode) {
          res.json({
            pools: [
              {
                id: '0x0ed7e52944161450477ee417de9cd3a859b14fd0',
                token0: { symbol: 'WBNB', id: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' },
                token1: { symbol: 'BUSD', id: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' },
                reserve0: '450123.456',
                reserve1: '125000000.789',
                volumeUSD: '15000000'
              }
            ],
            network,
            mode: 'demo'
          });
        } else if (this.apiService) {
          const advancedDEXService = (this.apiService as any).advancedDEXService;
          if (advancedDEXService) {
            const pools = await advancedDEXService.getPancakeSwapPools(network);
            res.json({ pools, network, mode: 'live' });
          } else {
            res.status(503).json({ error: 'PancakeSwap service not available' });
          }
        } else {
          res.status(503).json({ error: 'Advanced DEX service not available' });
        }
      } catch (error) {
        logger.error('Error getting PancakeSwap pools:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/dex/cross-opportunities', async (req, res) => {
      try {
        if (this.isDemoMode) {
          res.json({
            opportunities: [
              {
                id: 'cross-dex-demo-1',
                type: 'cross-dex',
                tokenPair: 'WETH-USDC',
                profitPercentage: 2.34,
                buyFrom: { source: 'Curve Finance (ethereum)', price: 2845.12 },
                sellTo: { source: 'Balancer V2 (arbitrum)', price: 2911.78 },
                crossChain: true
              }
            ],
            mode: 'demo'
          });
        } else if (this.apiService) {
          const advancedDEXService = (this.apiService as any).advancedDEXService;
          if (advancedDEXService) {
            const opportunities = await advancedDEXService.findCrossDEXArbitrageOpportunities();
            res.json({ opportunities, mode: 'live' });
          } else {
            res.status(503).json({ error: 'Cross-DEX arbitrage service not available' });
          }
        } else {
          res.status(503).json({ error: 'Advanced DEX service not available' });
        }
      } catch (error) {
        logger.error('Error getting cross-DEX opportunities:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/dex/status', async (req, res) => {
      try {
        if (this.isDemoMode) {
          res.json({
            supported: {
              curve: { networks: ['ethereum', 'arbitrum', 'polygon'], status: 'active' },
              balancer: { networks: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'], status: 'active' },
              oneInch: { networks: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc'], status: 'rate-limited' },
              pancakeSwap: { networks: ['bsc', 'ethereum'], status: 'active' }
            },
            totalNetworksSupported: 8,
            mode: 'demo'
          });
        } else if (this.apiService) {
          const advancedDEXService = (this.apiService as any).advancedDEXService;
          if (advancedDEXService) {
            const status = advancedDEXService.getDEXStatus();
            res.json({ ...status, mode: 'live' });
          } else {
            res.status(503).json({ error: 'DEX status service not available' });
          }
        } else {
          res.status(503).json({ error: 'Advanced DEX service not available' });
        }
      } catch (error) {
        logger.error('Error getting DEX status:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Flash Loan Provider Management Endpoints
    this.app.get('/api/flashloan/providers/:network?', async (req, res) => {
      try {
        const network = req.params.network || 'ethereum';
        
        if (this.isDemoMode) {
          res.json({
            providers: [
              {
                name: 'Aave V3 Ethereum',
                protocol: 'aave-v3',
                network: 'ethereum',
                fees: 0.09,
                maxAmount: '1000000',
                supportedTokens: ['WETH', 'USDC', 'USDT', 'DAI'],
                reliability: 98,
                status: 'healthy'
              },
              {
                name: 'Balancer V2 Ethereum',
                protocol: 'balancer-v2',
                network: 'ethereum',
                fees: 0.0,
                maxAmount: '10000000',
                supportedTokens: ['WETH', 'USDC', 'USDT', 'DAI'],
                reliability: 95,
                status: 'healthy'
              }
            ],
            network,
            mode: 'demo'
          });
        } else if (this.flashLoanProviderService) {
          const providers = await this.flashLoanProviderService.getAvailableProviders(network, 'WETH');
          res.json({ providers, network, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Flash loan provider service not available' });
        }
      } catch (error) {
        logger.error('Error getting flash loan providers:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/flashloan/quote', async (req, res) => {
      try {
        const { network = 'ethereum', token = 'WETH', amount } = req.body;
        
        if (!amount) {
          return res.status(400).json({ error: 'Missing required parameter: amount' });
        }
        
        if (this.isDemoMode) {
          res.json({
            quotes: [
              {
                provider: 'Aave V3 Ethereum',
                amount,
                token,
                fee: '0.0009', // 0.09% of amount
                gasEstimate: 350000,
                totalCost: '0.007',
                executionTime: 12,
                success_rate: 98
              },
              {
                provider: 'Balancer V2 Ethereum',
                amount,
                token,
                fee: '0.0000',
                gasEstimate: 280000,
                totalCost: '0.0056',
                executionTime: 12,
                success_rate: 95
              }
            ],
            network,
            token,
            mode: 'demo'
          });
        } else if (this.flashLoanProviderService) {
          const quotes = await this.flashLoanProviderService.getFlashLoanQuotes(network, token, amount);
          res.json({ quotes, network, token, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Flash loan provider service not available' });
        }
      } catch (error) {
        logger.error('Error getting flash loan quotes:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/flashloan/providers/health/:network?', async (req, res) => {
      try {
        const network = req.params.network || 'ethereum';
        
        if (this.isDemoMode) {
          res.json({
            network,
            providersStatus: {
              'Aave V3 Ethereum': {
                status: 'healthy',
                liquidity: { available: true, estimatedMax: '1000000' },
                lastChecked: new Date().toISOString(),
                gasPrice: '20',
                responseTime: 0
              },
              'Balancer V2 Ethereum': {
                status: 'healthy',
                liquidity: { available: true, estimatedMax: '10000000' },
                lastChecked: new Date().toISOString(),
                gasPrice: '20',
                responseTime: 0
              }
            },
            mode: 'demo'
          });
        } else if (this.flashLoanProviderService) {
          const healthStatus = await this.flashLoanProviderService.monitorProviderHealth(network);
          res.json({ network, providersStatus: healthStatus, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Flash loan provider service not available' });
        }
      } catch (error) {
        logger.error('Error checking flash loan provider health:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/flashloan/stats', async (req, res) => {
      try {
        if (this.isDemoMode) {
          res.json({
            totalProviders: 5,
            byProtocol: { 'aave-v3': 4, 'balancer-v2': 3, 'dydx': 1, 'pancakeswap': 1 },
            byNetwork: { 'ethereum': 3, 'polygon': 1, 'arbitrum': 1, 'optimism': 1, 'bsc': 1 },
            averageFees: '0.06',
            supportedTokens: ['WETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'LINK', 'AAVE'],
            recommendedProviders: [
              { name: 'Aave V3 Ethereum', protocol: 'aave-v3', network: 'ethereum', reliability: 98 },
              { name: 'Aave V3 Polygon', protocol: 'aave-v3', network: 'polygon', reliability: 97 }
            ],
            mode: 'demo'
          });
        } else if (this.flashLoanProviderService) {
          const stats = await this.flashLoanProviderService.getProviderStats();
          res.json({ ...stats, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Flash loan provider service not available' });
        }
      } catch (error) {
        logger.error('Error getting flash loan provider stats:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Flash Loan Execution Management Endpoints
    this.app.get('/api/execution/opportunities/:networks?', async (req, res) => {
      try {
        const networksParam = req.params.networks;
        const networks = networksParam ? networksParam.split(',') : ['ethereum'];
        
        if (this.isDemoMode) {
          res.json({
            opportunities: [
              {
                id: 'demo_execution_1',
                type: 'cross-dex',
                network: 'ethereum',
                flashLoanProvider: 'Aave V3 Ethereum',
                borrowToken: 'WETH',
                borrowAmount: '10.0',
                profitEstimate: {
                  grossProfit: '0.456',
                  flashLoanFee: '0.009',
                  gasCost: '0.042',
                  netProfit: '0.405',
                  profitPercentage: 4.05
                },
                riskLevel: 'low',
                confidence: 92,
                executionTime: 18,
                validUntil: Date.now() + 180000
              }
            ],
            networks,
            mode: 'demo'
          });
        } else if (this.flashLoanExecutionService) {
          const opportunities = await this.flashLoanExecutionService.identifyExecutableOpportunities(networks);
          res.json({ opportunities, networks, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Flash loan execution service not available' });
        }
      } catch (error) {
        logger.error('Error identifying execution opportunities:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/execution/simulate', async (req, res) => {
      try {
        const { opportunityId } = req.body;
        
        if (!opportunityId) {
          return res.status(400).json({ error: 'Missing required parameter: opportunityId' });
        }
        
        if (this.isDemoMode) {
          res.json({
            success: true,
            simulatedProfit: '0.387',
            gasEstimate: 320000,
            risks: [],
            recommendations: ['Execute within next 2 minutes for optimal profit'],
            mode: 'demo'
          });
        } else if (this.flashLoanExecutionService) {
          const simulation = await this.flashLoanExecutionService.simulateExecution(opportunityId);
          res.json({ ...simulation, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Flash loan execution service not available' });
        }
      } catch (error) {
        logger.error('Error simulating execution:', error);
        res.status(500).json({ error: (error as Error).message || 'Internal server error' });
      }
    });

    this.app.post('/api/execution/prepare', async (req, res) => {
      try {
        const { opportunityId } = req.body;
        
        if (!opportunityId) {
          return res.status(400).json({ error: 'Missing required parameter: opportunityId' });
        }
        
        if (this.isDemoMode) {
          res.json({
            executionPlan: {
              flashLoanProvider: 'Aave V3 Ethereum',
              borrowAmount: '10.0',
              expectedNetProfit: '0.387',
              contractCalldata: '0x1234567890abcdef...',
              safetyChecks: {
                minProfitThreshold: 0.1,
                maxSlippage: 0.02,
                deadline: Date.now() + 300000
              }
            },
            contractParams: {
              flashLoanCalldata: '0x1234567890abcdef...',
              borrowAmount: '10.0',
              borrowToken: 'WETH',
              expectedMinProfit: 0.1
            },
            status: 'PREPARED_FOR_EXECUTION',
            mode: 'demo'
          });
        } else if (this.flashLoanExecutionService) {
          const preparation = await this.flashLoanExecutionService.prepareExecution(opportunityId);
          res.json({ ...preparation, status: 'PREPARED_FOR_EXECUTION', mode: 'live' });
        } else {
          res.status(503).json({ error: 'Flash loan execution service not available' });
        }
      } catch (error) {
        logger.error('Error preparing execution:', error);
        res.status(500).json({ error: (error as Error).message || 'Internal server error' });
      }
    });

    this.app.get('/api/execution/stats', async (req, res) => {
      try {
        if (this.isDemoMode) {
          res.json({
            flashLoanProviders: {
              totalProviders: 5,
              byProtocol: { 'aave-v3': 4, 'balancer-v2': 3, 'dydx': 1 },
              averageFees: '0.06',
              recommendedProviders: [
                { name: 'Aave V3 Ethereum', reliability: 98 },
                { name: 'Balancer V2 Ethereum', reliability: 95 }
              ]
            },
            riskParameters: {
              maxBorrowAmount: '100',
              minProfitThreshold: '0.01',
              maxSlippage: 0.02,
              maxGasPrice: '50'
            },
            executionHistory: {
              totalExecutions: 0,
              successRate: 0,
              averageProfit: '0',
              totalProfit: '0'
            },
            activeExecutions: 0,
            supportedNetworks: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc'],
            recommendedSetup: {
              priority: 'Deploy arbitrage execution smart contract',
              estimatedCost: '0.05-0.1 ETH for contract deployment',
              timeToSetup: '30-60 minutes for full deployment'
            },
            mode: 'demo'
          });
        } else if (this.flashLoanExecutionService) {
          const stats = await this.flashLoanExecutionService.getExecutionStats();
          res.json({ ...stats, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Flash loan execution service not available' });
        }
      } catch (error) {
        logger.error('Error getting execution stats:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/execution/monitor', async (req, res) => {
      try {
        if (this.isDemoMode) {
          res.json({
            activeExecutions: [],
            pendingOpportunities: [
              {
                id: 'pending_demo_1',
                type: 'cross-dex',
                profitPercentage: 3.21,
                validUntil: Date.now() + 120000
              }
            ],
            systemHealth: {
              flashLoanProviders: {
                'Aave V3 Ethereum': { status: 'healthy' },
                'Balancer V2 Ethereum': { status: 'healthy' }
              },
              gasConditions: {
                current: '22',
                threshold: '50',
                recommendation: 'Monitor gas prices for optimal execution timing'
              }
            },
            mode: 'demo'
          });
        } else if (this.flashLoanExecutionService) {
          const monitor = await this.flashLoanExecutionService.monitorExecutions();
          res.json({ ...monitor, mode: 'live' });
        } else {
          res.status(503).json({ error: 'Flash loan execution service not available' });
        }
      } catch (error) {
        logger.error('Error monitoring executions:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Serve static files with cache control for development
    this.app.use(express.static('public', {
      setHeaders: (res, path, stat) => {
        // Prevent caching in development
        if (process.env.NODE_ENV !== 'production') {
          res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.set('Pragma', 'no-cache');
          res.set('Expires', '0');
          res.set('Surrogate-Control', 'no-store');
        }
      }
    }));

    // Default route - serve the HTML interface
    this.app.get('/', (req, res) => {
      // Prevent caching for index.html
      if (process.env.NODE_ENV !== 'production') {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
      }
      res.sendFile('index.html', { root: './public' });
    });

    // API info route
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Flash Loan Arbitrage Bot API',
        version: '1.0.0',
        status: 'Running',
        endpoints: [
          'GET /health - Health check',
          'GET /api/opportunities - Current arbitrage opportunities',
          'GET /api/prices - Current token prices',
          'GET /api/stats - Trading statistics',
          'POST /api/start - Start auto trading',
          'POST /api/stop - Stop auto trading',
          'POST /api/pause - Pause trading',
          'POST /api/resume - Resume trading',
          'POST /api/emergency-stop - Emergency stop',
          'GET /api/flashloan/providers/:network - Flash loan providers',
          'POST /api/flashloan/quote - Get flash loan quotes',
          'GET /api/flashloan/providers/health/:network - Provider health check',
          'GET /api/execution/opportunities/:networks - Executable opportunities',
          'POST /api/execution/simulate - Simulate execution',
          'POST /api/execution/prepare - Prepare execution',
          'GET /api/execution/monitor - Monitor executions'
        ]
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, '0.0.0.0', () => {
        logger.success(`🚀 API server started on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (error: Error) => {
        logger.error('Server error:', error);
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('API server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}