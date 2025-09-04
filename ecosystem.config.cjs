module.exports = {
  apps: [
    {
      name: 'flash-loan-bot',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'opportunity-scanner',
      script: 'dist/scanner.js',
      env: {
        NODE_ENV: 'development'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '300M',
      error_file: './logs/scanner-error.log',
      out_file: './logs/scanner-out.log',
      log_file: './logs/scanner-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s'
    }
  ]
};