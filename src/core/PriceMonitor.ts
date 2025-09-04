import WebSocket from 'ws';
import axios from 'axios';
import { logger } from '../utils/logger';
import { TOKENS } from '../config/constants';

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  timestamp: number;
  source: string;
  chain?: string; // Optional chain identifier for multi-chain support
}

export interface WebSocketPriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

export class PriceMonitor {
  private wsConnections: Map<string, WebSocket> = new Map();
  private priceData: Map<string, PriceData> = new Map();
  private callbacks: ((update: WebSocketPriceUpdate) => void)[] = [];
  private isMonitoring: boolean = false;

  constructor() {
    this.setupPriceStreams();
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Price monitoring is already active');
      return;
    }

    this.isMonitoring = true;
    logger.info('📊 Starting price monitoring...');

    try {
      // Initialize REST API data
      await this.fetchInitialPrices();
      
      // Start WebSocket connections
      await this.connectToWebSockets();
      
      logger.success('Price monitoring started successfully');
    } catch (error) {
      logger.error('Failed to start price monitoring:', error);
      this.isMonitoring = false;
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    
    // Close all WebSocket connections
    for (const [source, ws] of this.wsConnections) {
      ws.close();
      logger.info(`Closed WebSocket connection to ${source}`);
    }
    
    this.wsConnections.clear();
    logger.info('⏹️  Price monitoring stopped');
  }

  private async fetchInitialPrices(): Promise<void> {
    try {
      // Fetch from CoinGecko API
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'ethereum,bitcoin,usd-coin,tether,dai',
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_24hr_vol: true
        }
      });

      const data = response.data;
      const timestamp = Date.now();

      // Map to our token symbols
      const tokenMapping: { [key: string]: string } = {
        'ethereum': 'WETH',
        'bitcoin': 'WBTC',
        'usd-coin': 'USDC',
        'tether': 'USDT',
        'dai': 'DAI'
      };

      for (const [coinId, priceInfo] of Object.entries(data as any)) {
        const symbol = tokenMapping[coinId];
        if (symbol && priceInfo && typeof priceInfo === 'object') {
          const info = priceInfo as any;
          this.priceData.set(symbol, {
            symbol,
            price: info.usd || 0,
            change24h: info.usd_24h_change || 0,
            volume24h: info.usd_24h_vol || 0,
            timestamp,
            source: 'CoinGecko'
          });
        }
      }

      logger.info(`Fetched initial prices for ${this.priceData.size} tokens`);
    } catch (error) {
      logger.error('Failed to fetch initial prices:', error);
    }
  }

  private async connectToWebSockets(): Promise<void> {
    // Connect to Binance WebSocket (free tier)
    await this.connectToBinance();
    
    // Connect to CoinGecko WebSocket (if available)
    // await this.connectToCoinGecko();
    
    // Add more WebSocket connections as needed
  }

  private async connectToBinance(): Promise<void> {
    try {
      const symbols = ['ETHUSDT', 'BTCUSDT', 'ADAUSDT']; // Add more as needed
      const streams = symbols.map(symbol => `${symbol.toLowerCase()}@ticker`).join('/');
      const wsUrl = `wss://stream.binance.com:9443/ws/${streams}`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        logger.info('Connected to Binance WebSocket');
        this.wsConnections.set('binance', ws);
      });
      
      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          this.handleBinanceMessage(parsed);
        } catch (error) {
          logger.debug('Error parsing Binance message:', error);
        }
      });
      
      ws.on('error', (error: any) => {
        logger.error('Binance WebSocket error:', error);
      });
      
      ws.on('close', () => {
        logger.warn('Binance WebSocket connection closed');
        this.wsConnections.delete('binance');
        
        // Reconnect after delay if still monitoring
        if (this.isMonitoring) {
          setTimeout(() => this.connectToBinance(), 5000);
        }
      });
    } catch (error) {
      logger.error('Failed to connect to Binance WebSocket:', error);
    }
  }

  private handleBinanceMessage(data: any): void {
    if (data.e === '24hrTicker') {
      const symbol = this.mapBinanceSymbol(data.s);
      if (symbol) {
        const priceUpdate: WebSocketPriceUpdate = {
          symbol,
          price: parseFloat(data.c), // Current price
          timestamp: Date.now()
        };

        // Update internal price data
        const existing = this.priceData.get(symbol);
        this.priceData.set(symbol, {
          symbol,
          price: priceUpdate.price,
          change24h: parseFloat(data.P), // 24h price change percent
          volume24h: parseFloat(data.v), // 24h volume
          timestamp: priceUpdate.timestamp,
          source: 'Binance'
        });

        // Notify subscribers
        this.notifyPriceUpdate(priceUpdate);
      }
    }
  }

  private mapBinanceSymbol(binanceSymbol: string): string | null {
    const mapping: { [key: string]: string } = {
      'ETHUSDT': 'WETH',
      'BTCUSDT': 'WBTC',
      'ADAUSDT': 'ADA',
      // Add more mappings as needed
    };
    
    return mapping[binanceSymbol] || null;
  }

  private notifyPriceUpdate(update: WebSocketPriceUpdate): void {
    for (const callback of this.callbacks) {
      try {
        callback(update);
      } catch (error) {
        logger.error('Error in price update callback:', error);
      }
    }
  }

  public onPriceUpdate(callback: (update: WebSocketPriceUpdate) => void): void {
    this.callbacks.push(callback);
  }

  public getPrice(symbol: string): PriceData | null {
    return this.priceData.get(symbol) || null;
  }

  public getAllPrices(): Map<string, PriceData> {
    return new Map(this.priceData);
  }

  public getPriceChanges(): { [symbol: string]: number } {
    const changes: { [symbol: string]: number } = {};
    for (const [symbol, data] of this.priceData) {
      changes[symbol] = data.change24h;
    }
    return changes;
  }

  private setupPriceStreams(): void {
    // Setup periodic price fetching as backup
    setInterval(() => {
      if (this.isMonitoring && this.wsConnections.size === 0) {
        logger.warn('No WebSocket connections active, fetching via REST API');
        this.fetchInitialPrices();
      }
    }, 30000); // Every 30 seconds
  }

  // Method to get historical price data (for backtesting)
  async getHistoricalPrices(symbol: string, days: number = 7): Promise<any[]> {
    try {
      const coinId = this.getCoinGeckoId(symbol);
      if (!coinId) return [];

      const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`, {
        params: {
          vs_currency: 'usd',
          days,
          interval: days > 1 ? 'hourly' : 'minutely'
        }
      });

      return response.data.prices.map(([timestamp, price]: [number, number]) => ({
        timestamp,
        price,
        symbol
      }));
    } catch (error) {
      logger.error(`Failed to fetch historical prices for ${symbol}:`, error);
      return [];
    }
  }

  private getCoinGeckoId(symbol: string): string | null {
    const mapping: { [key: string]: string } = {
      'WETH': 'ethereum',
      'WBTC': 'bitcoin',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'dai'
    };
    
    return mapping[symbol] || null;
  }

  // Get price spread between exchanges
  public getPriceSpread(symbol: string): number {
    // This would compare prices from different sources
    // For now, return 0 as placeholder
    return 0;
  }

  // Check if price monitoring is healthy
  public isHealthy(): boolean {
    return this.isMonitoring && (this.wsConnections.size > 0 || this.priceData.size > 0);
  }

  // Get monitoring statistics
  public getStats(): any {
    return {
      isMonitoring: this.isMonitoring,
      wsConnections: this.wsConnections.size,
      trackedTokens: this.priceData.size,
      subscribers: this.callbacks.length,
      lastUpdate: Math.max(...Array.from(this.priceData.values()).map(p => p.timestamp))
    };
  }
}