#!/usr/bin/env node

import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { APIServer } from './api/server';

// Load environment variables
dotenv.config();

class FlashLoanBot {
  private apiServer: APIServer;

  constructor() {
    this.validateEnvironment();
    this.apiServer = new APIServer(parseInt(process.env.PORT || '3000'));
  }

  private validateEnvironment(): void {
    const requiredEnvVars = [
      'RPC_URL_MAINNET'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.error('Missing required environment variables:', missingVars);
      logger.info('Please copy .env.example to .env and configure the required values');
      process.exit(1);
    }

    if (!process.env.PRIVATE_KEY) {
      logger.warn('PRIVATE_KEY not set - flash loan execution will be disabled');
      logger.warn('The bot will run in monitoring mode only');
    }

    logger.info('Environment validation passed');
  }

  async start(): Promise<void> {
    try {
      logger.info('🚀 Starting Flash Loan Arbitrage Bot...');
      
      // Start API server
      await this.apiServer.start();
      
      logger.success('✅ Flash Loan Arbitrage Bot is running!');
      logger.info('Available endpoints:');
      logger.info('  • Health: GET /health');
      logger.info('  • Opportunities: GET /api/opportunities');
      logger.info('  • Prices: GET /api/prices');
      logger.info('  • Statistics: GET /api/stats');
      logger.info('  • Start Trading: POST /api/start');
      logger.info('  • Stop Trading: POST /api/stop');
      
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    logger.info('🛑 Shutting down Flash Loan Arbitrage Bot...');
    
    try {
      await this.apiServer.stop();
      logger.success('✅ Bot shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}

// Initialize and start the bot
const bot = new FlashLoanBot();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await bot.stop();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at promise:', String(promise));
  logger.error('Reason:', reason);
  process.exit(1);
});

// Start the bot
if (require.main === module) {
  bot.start().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export default FlashLoanBot;