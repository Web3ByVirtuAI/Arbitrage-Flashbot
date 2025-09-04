import axios from 'axios';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';

/**
 * MetaMask/Infura API Service  
 * Enhanced RPC, transaction simulation, and gas optimization
 */
export class MetaMaskService {
  private infuraProjectId: string;
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private cache: Map<string, { data: any, timestamp: number }> = new Map();
  private cacheTimeout = 15000; // 15 seconds for gas data

  // Network configurations for MetaMask/Infura
  private networks = {
    mainnet: {
      name: 'Ethereum Mainnet',
      rpcUrl: 'https://mainnet.infura.io/v3/',
      chainId: 1,
      currency: 'ETH'
    },
    polygon: {
      name: 'Polygon Mainnet', 
      rpcUrl: 'https://polygon-mainnet.infura.io/v3/',
      chainId: 137,
      currency: 'MATIC'
    },
    arbitrum: {
      name: 'Arbitrum One',
      rpcUrl: 'https://arbitrum-mainnet.infura.io/v3/',
      chainId: 42161,
      currency: 'ETH'
    },
    optimism: {
      name: 'Optimism Mainnet',
      rpcUrl: 'https://optimism-mainnet.infura.io/v3/',
      chainId: 10,
      currency: 'ETH'
    }
  };

  constructor() {
    this.infuraProjectId = process.env.INFURA_PROJECT_ID || '';
    if (!this.infuraProjectId) {
      logger.warn('Infura Project ID not configured - MetaMask features limited');
      return;
    }

    this.initializeProviders();
  }

  /**
   * Initialize RPC providers for all supported networks
   */
  private initializeProviders(): void {
    Object.entries(this.networks).forEach(([network, config]) => {
      try {
        const rpcUrl = `${config.rpcUrl}${this.infuraProjectId}`;
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        this.providers.set(network, provider);
        logger.info(`✅ MetaMask provider initialized for ${config.name}`);
      } catch (error) {
        logger.error(`❌ Failed to initialize ${config.name} provider:`, error);
      }
    });

    logger.success(`🦊 MetaMask service initialized with ${this.providers.size} networks`);
  }

  /**
   * Get optimized gas prices across all networks
   */
  async getGasOptimization(): Promise<Map<string, any>> {
    const gasData = new Map();

    for (const [network, provider] of this.providers) {
      try {
        const cacheKey = `gas_${network}`;
        const cached = this.getCached(cacheKey);
        if (cached) {
          gasData.set(network, cached);
          continue;
        }

        const [feeData, blockData] = await Promise.all([
          provider.getFeeData(),
          provider.getBlock('latest')
        ]);

        const networkConfig = this.networks[network as keyof typeof this.networks];
        const gasInfo = {
          network: networkConfig.name,
          chainId: networkConfig.chainId,
          currency: networkConfig.currency,
          gasPrice: feeData.gasPrice?.toString() || '0',
          maxFeePerGas: feeData.maxFeePerGas?.toString() || '0',
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || '0',
          blockNumber: blockData?.number || 0,
          blockGasUsed: blockData?.gasUsed?.toString() || '0',
          blockGasLimit: blockData?.gasLimit?.toString() || '0',
          baseFeePerGas: blockData?.baseFeePerGas?.toString() || '0',
          timestamp: Date.now()
        };

        // Calculate gas recommendations
        const baseGas = BigInt(gasInfo.gasPrice);
        (gasInfo as any).recommendations = {
          slow: (baseGas * BigInt(80) / BigInt(100)).toString(),    // 80% of base
          standard: gasInfo.gasPrice,                                // Base price
          fast: (baseGas * BigInt(120) / BigInt(100)).toString(),   // 120% of base
          fastest: (baseGas * BigInt(150) / BigInt(100)).toString() // 150% of base
        };

        this.setCache(cacheKey, gasInfo);
        gasData.set(network, gasInfo);

      } catch (error) {
        logger.error(`Error getting gas data for ${network}:`, error);
      }
    }

    return gasData;
  }

  /**
   * Simulate transaction execution before sending
   */
  async simulateTransaction(txData: any, network: string = 'mainnet'): Promise<any> {
    const provider = this.providers.get(network);
    if (!provider) {
      throw new Error(`Provider not available for network: ${network}`);
    }

    try {
      // Use eth_estimateGas for transaction simulation
      const gasEstimate = await provider.estimateGas({
        to: txData.to,
        from: txData.from,
        data: txData.data,
        value: txData.value || '0'
      });

      // Get current gas price for cost calculation
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(0);
      const totalCost = gasEstimate * gasPrice;

      return {
        success: true,
        gasEstimate: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        totalCostWei: totalCost.toString(),
        totalCostEther: ethers.formatEther(totalCost),
        network: this.networks[network as keyof typeof this.networks].name,
        timestamp: Date.now()
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        reason: error.reason || 'Transaction simulation failed',
        network: this.networks[network as keyof typeof this.networks].name,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get optimal network for transaction based on gas costs
   */
  async getOptimalNetwork(transactionType: 'swap' | 'flashloan' | 'transfer' = 'swap'): Promise<any> {
    const gasData = await this.getGasOptimization();
    const networkOptions = [];

    for (const [network, data] of gasData) {
      const gasPrice = BigInt(data.gasPrice);
      const networkConfig = this.networks[network as keyof typeof this.networks];

      // Estimate gas usage based on transaction type
      let estimatedGasUnits = BigInt(21000); // Basic transfer
      switch (transactionType) {
        case 'swap':
          estimatedGasUnits = BigInt(150000); // DEX swap
          break;
        case 'flashloan':
          estimatedGasUnits = BigInt(400000); // Flash loan execution
          break;
      }

      const totalCost = gasPrice * estimatedGasUnits;
      
      networkOptions.push({
        network,
        name: networkConfig.name,
        chainId: networkConfig.chainId,
        currency: networkConfig.currency,
        gasPrice: data.gasPrice,
        estimatedCost: totalCost.toString(),
        estimatedCostEther: ethers.formatEther(totalCost),
        blockNumber: data.blockNumber,
        congestion: this.calculateCongestion(data),
        score: this.calculateNetworkScore(data, totalCost)
      });
    }

    // Sort by score (lower cost + lower congestion = higher score)
    networkOptions.sort((a, b) => b.score - a.score);

    return {
      recommended: networkOptions[0],
      alternatives: networkOptions.slice(1),
      transactionType,
      timestamp: Date.now()
    };
  }

  /**
   * Get real-time network health across all chains
   */
  async getNetworkHealth(): Promise<any> {
    const healthData = {
      overall: true,
      networks: {},
      timestamp: Date.now()
    };

    for (const [network, provider] of this.providers) {
      try {
        const [blockNumber, gasPrice] = await Promise.all([
          provider.getBlockNumber(),
          provider.getFeeData()
        ]);

        const networkConfig = this.networks[network as keyof typeof this.networks];
        (healthData.networks as any)[network] = {
          name: networkConfig.name,
          chainId: networkConfig.chainId,
          healthy: true,
          blockNumber,
          gasPrice: gasPrice.gasPrice?.toString() || '0',
          latency: Date.now() // Could implement actual latency measurement
        };

      } catch (error) {
        (healthData.networks as any)[network] = {
          name: this.networks[network as keyof typeof this.networks].name,
          healthy: false,
          error: (error as Error).message
        };
        healthData.overall = false;
      }
    }

    return healthData;
  }

  /**
   * Get transaction history and analytics for address
   */
  async getTransactionAnalytics(address: string, network: string = 'mainnet'): Promise<any> {
    if (!this.infuraProjectId) return null;

    try {
      // Use Infura's enhanced API for transaction data
      const response = await axios.get(
        `https://${network}.infura.io/v3/${this.infuraProjectId}`,
        {
          data: {
            jsonrpc: '2.0',
            method: 'eth_getTransactionCount',
            params: [address, 'latest'],
            id: 1
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const txCount = parseInt(response.data.result, 16);
      
      return {
        address,
        network,
        totalTransactions: txCount,
        estimatedValue: 'Requires additional API integration',
        gasUsed: 'Requires transaction history scan',
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error(`Error getting transaction analytics for ${address}:`, error);
      return null;
    }
  }

  // Helper methods
  private calculateCongestion(gasData: any): 'low' | 'medium' | 'high' {
    const gasPrice = BigInt(gasData.gasPrice);
    const baseFee = BigInt(gasData.baseFeePerGas || '0');
    
    if (baseFee === BigInt(0)) return 'medium';
    
    const ratio = Number(gasPrice * BigInt(100) / baseFee);
    
    if (ratio < 110) return 'low';
    if (ratio < 150) return 'medium';
    return 'high';
  }

  private calculateNetworkScore(gasData: any, estimatedCost: bigint): number {
    // Lower cost = higher score, lower congestion = higher score
    const costScore = 1000000 / Number(estimatedCost / BigInt(1000000000000)); // Normalize
    const congestionPenalty = this.calculateCongestion(gasData) === 'high' ? 0.5 : 
                              this.calculateCongestion(gasData) === 'medium' ? 0.8 : 1.0;
    
    return costScore * congestionPenalty;
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
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    if (!this.infuraProjectId || this.providers.size === 0) return false;
    
    try {
      const mainnetProvider = this.providers.get('mainnet');
      if (!mainnetProvider) return false;
      
      const blockNumber = await mainnetProvider.getBlockNumber();
      return blockNumber > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get supported networks
   */
  getSupportedNetworks(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider for specific network
   */
  getProvider(network: string): ethers.JsonRpcProvider | null {
    return this.providers.get(network) || null;
  }
}