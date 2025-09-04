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
          'POST /api/emergency-stop - Emergency stop'
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