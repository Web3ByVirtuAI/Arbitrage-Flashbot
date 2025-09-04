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
      
      // Initialize core components
      this.opportunityFinder = new OpportunityFinder(this.provider);
      this.priceMonitor = new PriceMonitor();
      
      // Initialize flash loan executor (requires private key)
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        logger.warn('No private key provided, flash loan executor will not be functional');
      } else {
        this.flashLoanExecutor = new FlashLoanExecutor(this.provider, privateKey);
      }
      
      // Initialize auto trader
      if (this.flashLoanExecutor) {
        this.autoTrader = new AutoTrader(
          this.opportunityFinder,
          this.flashLoanExecutor,
          this.priceMonitor
        );
      }
      
      logger.info('API server components initialized');
    } catch (error) {
      logger.error('Failed to initialize components:', error);
      throw error;
    }
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        components: this.autoTrader?.getSystemHealth() || {}
      };
      res.json(health);
    });

    // API Routes
    this.app.get('/api/opportunities', (req, res) => {
      try {
        const opportunities = this.opportunityFinder?.getOpportunities() || [];
        res.json({ opportunities });
      } catch (error) {
        logger.error('Error fetching opportunities:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/prices', (req, res) => {
      try {
        const prices = this.priceMonitor?.getAllPrices() || new Map();
        const priceArray = Array.from(prices.entries()).map(([, data]) => data);
        res.json({ prices: priceArray });
      } catch (error) {
        logger.error('Error fetching prices:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/stats', async (req, res) => {
      try {
        const stats = this.autoTrader?.getStats() || {};
        const riskStats = this.autoTrader?.getRiskStats() || {};
        const balance = await this.flashLoanExecutor?.getWalletBalance() || '0';
        
        res.json({
          trading: stats,
          risk: riskStats,
          walletBalance: balance,
          priceMonitor: this.priceMonitor?.getStats() || {}
        });
      } catch (error) {
        logger.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Control endpoints
    this.app.post('/api/start', async (req, res) => {
      try {
        if (!this.autoTrader) {
          return res.status(400).json({ error: 'Auto trader not initialized' });
        }
        
        await this.autoTrader.start();
        res.json({ message: 'Auto trader started' });
      } catch (error) {
        logger.error('Error starting auto trader:', error);
        res.status(500).json({ error: 'Failed to start auto trader' });
      }
    });

    this.app.post('/api/stop', async (req, res) => {
      try {
        if (!this.autoTrader) {
          return res.status(400).json({ error: 'Auto trader not initialized' });
        }
        
        await this.autoTrader.stop();
        res.json({ message: 'Auto trader stopped' });
      } catch (error) {
        logger.error('Error stopping auto trader:', error);
        res.status(500).json({ error: 'Failed to stop auto trader' });
      }
    });

    this.app.post('/api/pause', (req, res) => {
      try {
        if (!this.autoTrader) {
          return res.status(400).json({ error: 'Auto trader not initialized' });
        }
        
        this.autoTrader.pauseTrading();
        res.json({ message: 'Trading paused' });
      } catch (error) {
        logger.error('Error pausing trading:', error);
        res.status(500).json({ error: 'Failed to pause trading' });
      }
    });

    this.app.post('/api/resume', (req, res) => {
      try {
        if (!this.autoTrader) {
          return res.status(400).json({ error: 'Auto trader not initialized' });
        }
        
        this.autoTrader.resumeTrading();
        res.json({ message: 'Trading resumed' });
      } catch (error) {
        logger.error('Error resuming trading:', error);
        res.status(500).json({ error: 'Failed to resume trading' });
      }
    });

    this.app.post('/api/emergency-stop', async (req, res) => {
      try {
        if (!this.autoTrader) {
          return res.status(400).json({ error: 'Auto trader not initialized' });
        }
        
        await this.autoTrader.emergencyStop();
        res.json({ message: 'Emergency stop executed' });
      } catch (error) {
        logger.error('Error executing emergency stop:', error);
        res.status(500).json({ error: 'Failed to execute emergency stop' });
      }
    });

    // Serve static files (if any)
    this.app.use(express.static('public'));

    // Default route
    this.app.get('/', (req, res) => {
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