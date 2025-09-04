# AWS EC2 Deployment Guide for Flash Loan Arbitrage Bot

## Overview
Deploy your flash loan arbitrage bot on AWS EC2 using the **Free Tier** resources. This guide leverages AWS's generous free tier offering of 750 hours per month of T2 micro instances.

## AWS Free Tier Benefits
- **EC2 T2 Micro Instance**: 750 hours/month (24/7 for entire month)
- **Storage**: 30GB of EBS General Purpose (SSD) storage
- **Data Transfer**: 15GB of bandwidth out aggregated across all AWS services
- **Duration**: 12 months from AWS account creation
- **CPU Credits**: T2 micro provides baseline performance with burst capability

## Prerequisites

### 1. AWS Account Setup
1. Create AWS account at https://aws.amazon.com/
2. Complete identity verification process
3. Add payment method (required but won't be charged under free tier limits)
4. Enable MFA (Multi-Factor Authentication) for security

### 2. Required Information
- **Trading Wallet**: Private key and address
- **RPC URLs**: Ethereum mainnet endpoints (Alchemy/Infura)
- **DEX Router Addresses**: Uniswap V2/V3, SushiSwap contracts
- **Flash Loan Provider**: Aave V3 pool address
- **Domain Name** (optional): For custom domain setup

## Step 1: Launch EC2 Instance

### Instance Configuration
```bash
# Instance Details
Instance Type: t2.micro (Free Tier Eligible)
AMI: Ubuntu Server 22.04 LTS
Storage: 30GB gp2 (General Purpose SSD)
Architecture: x86_64
```

### Security Group Setup
Create security group with following rules:
```bash
# Inbound Rules
SSH (22): Your IP address only
HTTP (80): 0.0.0.0/0 (for web interface)
HTTPS (443): 0.0.0.0/0 (for SSL)
Custom TCP (3000): Your IP (for development)

# Outbound Rules
All Traffic: 0.0.0.0/0 (required for API calls)
```

### Key Pair Creation
```bash
# Generate new key pair
Key pair name: flash-loan-bot-key
Key pair type: RSA
Private key file format: .pem

# Download and secure the key
chmod 400 flash-loan-bot-key.pem
```

## Step 2: Connect to EC2 Instance

### SSH Connection
```bash
# Connect to your instance
ssh -i "flash-loan-bot-key.pem" ubuntu@YOUR-EC2-PUBLIC-IP

# Update system
sudo apt update && sudo apt upgrade -y
```

## Step 3: Install Dependencies

### Node.js and NPM
```bash
# Install Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x
```

### PM2 Process Manager
```bash
# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 startup script
pm2 startup
# Follow the generated command instructions
```

### Git and Development Tools
```bash
# Install essential tools
sudo apt install -y git curl wget unzip build-essential

# Configure git (replace with your details)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Step 4: Deploy Flash Loan Bot

### Clone Repository
```bash
# Clone your bot repository
git clone https://github.com/YOUR-USERNAME/flash-loan-arbitrage-bot.git
cd flash-loan-arbitrage-bot

# Or upload your local code
# scp -i "flash-loan-bot-key.pem" -r ./webapp ubuntu@YOUR-EC2-PUBLIC-IP:~/
```

### Install Dependencies
```bash
# Install project dependencies
npm install

# Build the project
npm run build
```

### Environment Configuration
```bash
# Create production environment file
cp .env.production.example .env.production

# Edit configuration (use nano or vim)
sudo nano .env.production
```

### Production Environment Variables
```bash
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Trading Configuration
PRIVATE_KEY=your_wallet_private_key_here
PUBLIC_ADDRESS=your_wallet_address_here
NETWORK=mainnet
CHAIN_ID=1

# RPC Configuration
ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR-API-KEY
BACKUP_RPC_URL=https://mainnet.infura.io/v3/YOUR-PROJECT-ID

# DEX Router Addresses
UNISWAP_V2_ROUTER=0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
UNISWAP_V3_ROUTER=0xE592427A0AEce92De3Edee1F18E0157C05861564
SUSHISWAP_ROUTER=0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F

# Flash Loan Configuration
AAVE_POOL_ADDRESS=0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
MIN_PROFIT_THRESHOLD=0.01
GAS_PRICE_LIMIT=50
SLIPPAGE_TOLERANCE=0.5

# Security
JWT_SECRET=your_super_secure_jwt_secret_here
ADMIN_PASSWORD=your_secure_admin_password
API_RATE_LIMIT=100

# Monitoring
ENABLE_LOGGING=true
LOG_LEVEL=info
ENABLE_TELEGRAM_ALERTS=false
```

## Step 5: Setup SSL Certificate (Optional)

### Install Certbot
```bash
# Install Certbot for Let's Encrypt SSL
sudo apt install -y certbot python3-certbot-nginx

# Install Nginx
sudo apt install -y nginx

# Configure Nginx reverse proxy
sudo nano /etc/nginx/sites-available/flash-loan-bot
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name YOUR-DOMAIN.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable SSL
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/flash-loan-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d YOUR-DOMAIN.com
```

## Step 6: Launch Production Bot

### Setup Wallet
```bash
# Generate trading wallet (if needed)
node scripts/setup-wallet.js

# Fund wallet with ETH for gas fees
# Minimum 0.1 ETH recommended for testing
```

### Start Production Server
```bash
# Set proper file permissions
chmod +x start-production.sh stop-production.sh

# Start the bot with PM2
./start-production.sh

# Check status
pm2 status
pm2 logs flash-loan-bot --lines 50
```

## Step 7: Monitoring and Maintenance

### System Monitoring
```bash
# Check system resources
htop
df -h  # Disk usage
free -h  # Memory usage

# Monitor bot logs
pm2 logs flash-loan-bot --follow

# Check trading performance
curl http://localhost:3000/api/stats
```

### Automated Backups
```bash
# Create backup script
cat > ~/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf ~/backups/bot-backup-$DATE.tar.gz ~/flash-loan-arbitrage-bot
find ~/backups -name "bot-backup-*.tar.gz" -mtime +7 -delete
EOF

chmod +x ~/backup.sh

# Setup cron job for daily backups
crontab -e
# Add: 0 2 * * * /home/ubuntu/backup.sh
```

### Performance Optimization
```bash
# Optimize PM2 for T2 micro
pm2 start ecosystem.config.cjs --max-memory-restart 300M

# Monitor CPU credits (important for T2 micro)
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUCreditBalance \
  --dimensions Name=InstanceId,Value=YOUR-INSTANCE-ID \
  --start-time 2023-01-01T00:00:00Z \
  --end-time 2023-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average
```

## Step 8: Cost Management

### Free Tier Monitoring
```bash
# Stay within free tier limits:
# - 750 hours/month T2 micro (24/7 = 744 hours)
# - 30GB EBS storage
# - 15GB data transfer out

# Monitor usage in AWS Console:
# - Billing & Cost Management
# - Free Tier usage alerts
# - CloudWatch metrics
```

### Cost Optimization Tips
1. **Instance Management**: Stop instance when not trading
2. **Storage Cleanup**: Regular log rotation and cleanup
3. **Data Transfer**: Monitor API calls and responses
4. **Snapshots**: Create EBS snapshots before major changes

## Security Best Practices

### Instance Security
```bash
# Update security packages
sudo apt update && sudo apt upgrade -y

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force enable

# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart ssh
```

### Application Security
```bash
# Secure environment files
chmod 600 .env.production

# Setup fail2ban for SSH protection
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## Troubleshooting

### Common Issues
1. **Out of Memory**: T2 micro has 1GB RAM
   ```bash
   # Add swap space
   sudo fallocate -l 1G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

2. **CPU Credit Exhaustion**: Monitor and optimize
   ```bash
   # Check CPU credits
   aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUCreditBalance
   
   # Optimize Node.js
   pm2 start app.js --node-args="--max-old-space-size=512"
   ```

3. **Network Connectivity**: Check security groups and NACLs
   ```bash
   # Test connectivity
   curl -I http://localhost:3000
   netstat -tlnp | grep :3000
   ```

### Support Resources
- AWS Free Tier FAQ: https://aws.amazon.com/free/faqs/
- EC2 Documentation: https://docs.aws.amazon.com/ec2/
- AWS Support: Basic support included with free tier

## Expected Performance

### T2 Micro Specifications
- **vCPUs**: 1 vCPU (variable performance)
- **Memory**: 1 GiB
- **Network**: Low to Moderate
- **CPU Credits**: Baseline 10% utilization with burst capability

### Trading Bot Performance
- **Concurrent Scans**: 50-100 token pairs
- **Response Time**: 100-500ms API responses  
- **Memory Usage**: 200-400MB typical
- **CPU Usage**: 5-15% baseline, bursts to 100%

### Scaling Considerations
- **Vertical Scaling**: Upgrade to t2.small/medium as needed
- **Horizontal Scaling**: Use Application Load Balancer for multiple instances
- **Database**: Consider RDS free tier for persistent data

## Next Steps
1. Monitor free tier usage in AWS Console
2. Set up CloudWatch alarms for resource utilization
3. Configure automated trading strategies
4. Implement profit withdrawal mechanisms
5. Scale up to paid instances for production trading

Your flash loan arbitrage bot is now running on AWS EC2 Free Tier! 🚀

---

**Total Setup Cost**: $0/month (within free tier limits)
**Expected Setup Time**: 2-3 hours
**Production Ready**: Yes, with monitoring and security measures