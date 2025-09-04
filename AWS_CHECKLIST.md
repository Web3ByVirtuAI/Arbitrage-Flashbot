# AWS EC2 Deployment Checklist
## Flash Loan Arbitrage Bot - Production Deployment

### Pre-Deployment Preparation ✅

#### AWS Account Setup
- [ ] Create AWS account and complete verification
- [ ] Enable MFA (Multi-Factor Authentication)
- [ ] Set up billing alerts for free tier monitoring
- [ ] Create IAM user with EC2 permissions (optional but recommended)

#### Wallet and Trading Setup
- [ ] Generate trading wallet with `node scripts/setup-wallet.js`
- [ ] Fund wallet with minimum 0.1 ETH (recommended 0.5 ETH)
- [ ] Obtain Alchemy API key from https://www.alchemy.com/
- [ ] Obtain Infura project ID from https://infura.io/
- [ ] Test RPC endpoints for connectivity

#### Security Preparation
- [ ] Generate strong JWT secret (32+ characters)
- [ ] Create secure admin password
- [ ] Prepare domain name (optional for SSL)

### AWS EC2 Instance Setup ✅

#### Instance Configuration
- [ ] Launch t2.micro instance (Free Tier Eligible)
- [ ] Select Ubuntu Server 22.04 LTS AMI
- [ ] Configure 30GB gp2 storage
- [ ] Create and download key pair (.pem file)
- [ ] Set appropriate security group rules:
  - [ ] SSH (22): Your IP only
  - [ ] HTTP (80): 0.0.0.0/0
  - [ ] HTTPS (443): 0.0.0.0/0
  - [ ] Custom (3000): Your IP (development)

#### Initial Connection
- [ ] Connect via SSH: `ssh -i "key.pem" ubuntu@EC2-IP`
- [ ] Update system: `sudo apt update && sudo apt upgrade -y`
- [ ] Verify instance specs: `free -h && df -h && nproc`

### Automated Setup Process ✅

#### Upload Project Files
```bash
# Option 1: Clone from GitHub
git clone https://github.com/YOUR-USERNAME/flash-loan-arbitrage-bot.git
cd flash-loan-arbitrage-bot

# Option 2: Upload via SCP
scp -i "key.pem" -r ./webapp ubuntu@EC2-IP:~/flash-loan-arbitrage-bot
```

#### Run Setup Script
```bash
cd flash-loan-arbitrage-bot
chmod +x scripts/setup-aws-production.sh
./scripts/setup-aws-production.sh
```

#### Verify Installation
- [ ] Node.js 18.x installed: `node --version`
- [ ] PM2 installed: `pm2 --version`
- [ ] Nginx installed: `sudo nginx -t`
- [ ] Project dependencies: `npm list --depth=0`

### Configuration ✅

#### Environment Setup
- [ ] Copy AWS environment template: `cp .env.aws.example .env.production`
- [ ] Configure wallet settings:
  ```bash
  PRIVATE_KEY=your_actual_private_key
  PUBLIC_ADDRESS=your_wallet_address
  ```
- [ ] Configure RPC endpoints:
  ```bash
  ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR-KEY
  BACKUP_RPC_URL=https://mainnet.infura.io/v3/YOUR-PROJECT-ID
  ```
- [ ] Set security credentials:
  ```bash
  JWT_SECRET=your_32_char_minimum_secret
  ADMIN_PASSWORD=your_secure_password
  ```
- [ ] Secure environment file: `chmod 600 .env.production`

#### System Configuration
- [ ] Verify swap space: `free -h` (should show 1GB swap)
- [ ] Check firewall: `sudo ufw status`
- [ ] Verify Nginx configuration: `sudo nginx -t`
- [ ] Test PM2 startup: `pm2 startup`

### Bot Deployment ✅

#### Start Production Bot
```bash
# Start the bot
./start-bot.sh

# Verify status
pm2 status
pm2 logs flash-loan-bot --lines 20
```

#### Health Checks
- [ ] API health: `curl http://localhost:3000/api/health`
- [ ] Web interface: `curl http://localhost:3000`
- [ ] Trading status: `curl http://localhost:3000/api/stats`

#### External Access
- [ ] Get public IP: `curl http://checkip.amazonaws.com`
- [ ] Test external access: `http://YOUR-EC2-IP:3000`
- [ ] Verify all UI buttons and functionality

### SSL Setup (Optional) ✅

#### Domain Configuration
- [ ] Point domain A record to EC2 public IP
- [ ] Verify DNS propagation: `nslookup your-domain.com`

#### Let's Encrypt Certificate
```bash
# Install certificate
sudo certbot --nginx -d your-domain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

#### HTTPS Verification
- [ ] Test HTTPS access: `https://your-domain.com`
- [ ] Verify certificate: Check browser padlock icon
- [ ] Test auto-redirect HTTP → HTTPS

### Monitoring Setup ✅

#### System Monitoring
- [ ] Run monitoring script: `./monitor.sh`
- [ ] Check CPU credits (T2 micro specific):
  ```bash
  # Install AWS CLI if needed
  sudo apt install awscli
  aws configure  # Optional
  ```
- [ ] Set up CloudWatch monitoring (optional)

#### Application Monitoring
- [ ] PM2 monitoring: `pm2 monit`
- [ ] Log monitoring: `pm2 logs flash-loan-bot --follow`
- [ ] Trading performance: Check web dashboard

#### Backup Verification
- [ ] Test backup script: `./backup.sh`
- [ ] Verify cron job: `crontab -l`
- [ ] Check backup directory: `ls -la ~/backups/`

### Production Testing ✅

#### Functional Testing
- [ ] **UI Functionality**: Test all buttons and status indicators
- [ ] **Price Scanning**: Verify real-time price updates
- [ ] **Opportunity Detection**: Check arbitrage opportunity finder
- [ ] **Trade Simulation**: Test with small amounts first
- [ ] **Error Handling**: Verify graceful failure modes
- [ ] **Performance**: Monitor response times and resource usage

#### Security Testing
- [ ] Admin panel access control
- [ ] API rate limiting functionality
- [ ] Firewall rules verification
- [ ] SSL certificate validation (if applicable)

### Post-Deployment ✅

#### Documentation
- [ ] Update README.md with production URLs
- [ ] Document configuration changes
- [ ] Create operational runbook
- [ ] Update deployment notes

#### Performance Optimization
- [ ] Monitor CPU credit usage for T2 micro
- [ ] Optimize scan intervals based on performance
- [ ] Adjust memory limits for PM2 processes
- [ ] Fine-tune cache settings

#### Scaling Preparation
- [ ] Monitor free tier usage limits
- [ ] Plan for instance upgrade path
- [ ] Consider load balancer setup for high availability
- [ ] Prepare database migration strategy

### Maintenance Schedule ✅

#### Daily Tasks
- [ ] Check bot status: `pm2 status`
- [ ] Review trading logs
- [ ] Monitor wallet balance
- [ ] Check system resources: `./monitor.sh`

#### Weekly Tasks
- [ ] Review trading performance
- [ ] Update system packages: `sudo apt update && sudo apt upgrade`
- [ ] Clean old log files
- [ ] Verify backup integrity

#### Monthly Tasks
- [ ] Review AWS billing for free tier usage
- [ ] Update dependencies: `npm audit && npm update`
- [ ] Security updates and patches
- [ ] Performance optimization review

### Cost Management ✅

#### Free Tier Monitoring
- [ ] **EC2 Usage**: 750 hours/month (24/7 = 744 hours ✓)
- [ ] **EBS Storage**: 30GB limit
- [ ] **Data Transfer**: 15GB/month limit
- [ ] Set up billing alerts in AWS Console

#### Cost Optimization
- [ ] Stop instance during maintenance windows
- [ ] Monitor data transfer usage
- [ ] Clean up old snapshots and AMIs
- [ ] Use AWS Cost Explorer for tracking

### Troubleshooting Guide ✅

#### Common Issues
1. **Out of Memory**:
   ```bash
   # Check memory usage
   free -h
   # Increase swap if needed
   sudo fallocate -l 2G /swapfile2
   ```

2. **CPU Credit Exhaustion**:
   ```bash
   # Monitor CPU credits
   aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUCreditBalance
   # Reduce scan intervals temporarily
   ```

3. **Network Issues**:
   ```bash
   # Check security groups
   # Verify RPC endpoint connectivity
   curl -X POST -H "Content-Type: application/json" --data '{"method":"eth_blockNumber","params":[],"id":1,"jsonrpc":"2.0"}' YOUR_RPC_URL
   ```

4. **SSL Certificate Issues**:
   ```bash
   # Renew certificate
   sudo certbot renew
   # Check certificate expiry
   sudo certbot certificates
   ```

### Support Resources ✅

#### AWS Resources
- AWS Free Tier FAQ: https://aws.amazon.com/free/faqs/
- EC2 Documentation: https://docs.aws.amazon.com/ec2/
- AWS Support: Basic support included with free tier

#### Bot Resources
- GitHub Repository: https://github.com/YOUR-USERNAME/flash-loan-arbitrage-bot
- Trading Documentation: See README.md
- API Documentation: http://YOUR-EC2-IP:3000/api/docs

---

## Quick Commands Reference

```bash
# Start bot
./start-bot.sh

# Stop bot
./stop-bot.sh

# Check status
pm2 status
./monitor.sh

# View logs
pm2 logs flash-loan-bot --follow

# Restart bot
pm2 restart flash-loan-bot

# Update code
git pull origin main
npm install
pm2 restart flash-loan-bot

# Backup
./backup.sh

# System maintenance
sudo apt update && sudo apt upgrade -y
pm2 update
```

**🚀 Your Flash Loan Arbitrage Bot is now running on AWS EC2 Free Tier!**

**Production URL**: `http://YOUR-EC2-PUBLIC-IP:3000`
**Expected Costs**: $0/month (within free tier limits)
**Performance**: Optimized for T2 micro (1GB RAM, variable CPU)