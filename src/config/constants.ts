export const NETWORK_CONFIG = {
  ETHEREUM: {
    chainId: 1,
    rpcUrl: process.env.RPC_URL_MAINNET || 'https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY',
    blockTime: 12000, // 12 seconds
    gasLimit: 500000,
  },
  POLYGON: {
    chainId: 137,
    rpcUrl: process.env.RPC_URL_POLYGON || 'https://polygon-mainnet.alchemyapi.io/v2/YOUR_API_KEY',
    blockTime: 2000, // 2 seconds
    gasLimit: 500000,
  },
  BSC: {
    chainId: 56,
    rpcUrl: process.env.RPC_URL_BSC || 'https://bsc-dataseed.binance.org/',
    blockTime: 3000, // 3 seconds
    gasLimit: 500000,
  },
  ARBITRUM: {
    chainId: 42161,
    rpcUrl: process.env.RPC_URL_ARBITRUM || 'https://arb1.arbitrum.io/rpc',
    blockTime: 1000, // 1 second
    gasLimit: 1000000,
  }
};

export const DEX_CONFIG = {
  UNISWAP_V2: {
    name: 'Uniswap V2',
    router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    fee: 0.003, // 0.3%
  },
  UNISWAP_V3: {
    name: 'Uniswap V3',
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    fees: [0.0005, 0.003, 0.01], // 0.05%, 0.3%, 1%
  },
  SUSHISWAP: {
    name: 'SushiSwap',
    router: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    factory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
    fee: 0.003, // 0.3%
  },
  PANCAKESWAP: {
    name: 'PancakeSwap',
    router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    fee: 0.0025, // 0.25%
  }
};

export const FLASH_LOAN_PROVIDERS = {
  AAVE: {
    name: 'AAVE',
    poolAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    fee: 0.0009, // 0.09%
  },
  BALANCER: {
    name: 'Balancer',
    vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    fee: 0.0005, // 0.05%
  },
  DYDX: {
    name: 'dYdX',
    soloAddress: '0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e',
    fee: 0, // No fee
  }
};

export const TOKENS = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC: '0xA0b86a33E6417c13C812C72De3FE58dD2C5d1D65',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
};

export const BOT_CONFIG = {
  MIN_PROFIT_THRESHOLD: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.01'),
  MAX_SLIPPAGE: parseFloat(process.env.MAX_SLIPPAGE || '0.005'),
  GAS_PRICE_GWEI: parseInt(process.env.GAS_PRICE_GWEI || '20'),
  MAX_GAS_LIMIT: parseInt(process.env.MAX_GAS_LIMIT || '500000'),
  OPPORTUNITY_SCAN_INTERVAL: parseInt(process.env.OPPORTUNITY_SCAN_INTERVAL || '1000'),
  MAX_CONCURRENT_TRADES: 3,
  RISK_MANAGEMENT: {
    MAX_TRADE_SIZE: 10, // ETH
    STOP_LOSS: 0.05, // 5%
    MAX_DAILY_TRADES: 100,
  }
};