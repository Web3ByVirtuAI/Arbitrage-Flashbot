#!/bin/bash

# =====================================================
# FLASH LOAN ARBITRAGE BOT - SECURITY HARDENING SCRIPT
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🔒 Flash Loan Arbitrage Bot - Security Hardening"
echo "==============================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_error "This script should not be run as root for security reasons"
   exit 1
fi

# 1. File Permissions Hardening
log_info "Hardening file permissions..."

# Secure environment files
if [ -f .env ]; then
    chmod 600 .env
    log_success "Environment file permissions secured (600)"
else
    log_warning "No .env file found - create one from .env.production.example"
fi

if [ -f .env.production.example ]; then
    chmod 644 .env.production.example
fi

# Secure script files
chmod 700 scripts/
chmod +x scripts/*.sh scripts/*.js
log_success "Script permissions secured"

# Secure log directory
if [ -d logs ]; then
    chmod 750 logs/
    log_success "Log directory permissions secured"
fi

# Secure config directory
if [ -d config ]; then
    chmod 750 config/
    log_success "Config directory permissions secured"
fi

# 2. Environment Variable Validation
log_info "Validating environment configuration..."

if [ -f .env ]; then
    source .env
    
    # Check for placeholder values
    PLACEHOLDER_VARS=()
    
    if [[ "$PRIVATE_KEY" == *"YOUR_"* ]] || [[ "$PRIVATE_KEY" == "your_private_key_here" ]]; then
        PLACEHOLDER_VARS+=("PRIVATE_KEY")
    fi
    
    if [[ "$RPC_URL_MAINNET" == *"YOUR_"* ]]; then
        PLACEHOLDER_VARS+=("RPC_URL_MAINNET")
    fi
    
    if [ ${#PLACEHOLDER_VARS[@]} -gt 0 ]; then
        log_error "Found placeholder values in environment variables:"
        for var in "${PLACEHOLDER_VARS[@]}"; do
            echo "  - $var"
        done
        log_error "Please update these values in .env file"
        exit 1
    fi
    
    log_success "Environment variables validated"
else
    log_warning "No .env file found for validation"
fi

# 3. Network Security Configuration
log_info "Configuring network security..."

# Create IP whitelist configuration
cat > config/ip-whitelist.conf << 'EOF'
# IP Whitelist for API Access
# Add trusted IPs here (one per line)
127.0.0.1
::1

# Example: Add your VPS management IP
# 203.0.113.1

# Example: Add office/home IP for monitoring
# 198.51.100.1
EOF

log_success "IP whitelist configuration created"

# Create rate limiting configuration
cat > config/rate-limits.conf << 'EOF'
# Rate Limiting Configuration
# Format: endpoint=requests_per_minute

# API endpoints
/api/opportunities=60
/api/prices=60
/api/stats=30
/api/start=5
/api/stop=5
/api/pause=5
/api/emergency-stop=10

# Default rate limit
default=100
EOF

log_success "Rate limiting configuration created"

# 4. Logging Security
log_info "Securing logging configuration..."

# Create secure logging configuration
cat > config/logging.conf << 'EOF'
{
  "level": "info",
  "timestamp": true,
  "sanitizeKeys": [
    "privateKey",
    "private_key",
    "PRIVATE_KEY",
    "password",
    "secret",
    "token",
    "apiKey",
    "api_key"
  ],
  "maxFiles": 30,
  "maxSize": "100MB",
  "compress": true
}
EOF

log_success "Secure logging configuration created"

# 5. Backup Security
log_info "Setting up secure backup configuration..."

# Create backup encryption script
cat > scripts/secure-backup.sh << 'EOF'
#!/bin/bash

# Secure backup with encryption
BACKUP_DIR="backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="flashbot_backup_$DATE"
PASSPHRASE_FILE="$HOME/.flashbot_backup_key"

echo "🔐 Creating encrypted backup..."

# Generate backup passphrase if not exists
if [ ! -f "$PASSPHRASE_FILE" ]; then
    openssl rand -base64 32 > "$PASSPHRASE_FILE"
    chmod 600 "$PASSPHRASE_FILE"
    echo "🔑 Backup passphrase generated at $PASSPHRASE_FILE"
fi

# Create tar archive
tar -czf "$BACKUP_DIR/$BACKUP_FILE.tar.gz" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='logs/*.log' \
    --exclude='.git' \
    --exclude='backups' \
    .

# Encrypt the backup
gpg --batch --yes --passphrase-file "$PASSPHRASE_FILE" \
    --symmetric --cipher-algo AES256 \
    --output "$BACKUP_DIR/$BACKUP_FILE.tar.gz.gpg" \
    "$BACKUP_DIR/$BACKUP_FILE.tar.gz"

# Remove unencrypted backup
rm "$BACKUP_DIR/$BACKUP_FILE.tar.gz"

echo "✅ Encrypted backup created: $BACKUP_DIR/$BACKUP_FILE.tar.gz.gpg"

# Cleanup old encrypted backups (keep last 10)
cd "$BACKUP_DIR"
ls -t flashbot_backup_*.tar.gz.gpg | tail -n +11 | xargs -r rm --
cd ..

echo "🧹 Old backups cleaned up"
EOF

chmod +x scripts/secure-backup.sh
log_success "Secure backup script created"

# 6. Process Security
log_info "Configuring process security..."

# Create systemd service with security features
cat > flashbot-secure.service << 'EOF'
[Unit]
Description=Flash Loan Arbitrage Bot (Secure)
After=network.target
Wants=network-online.target

[Service]
Type=forking
User=flashbot
Group=flashbot
WorkingDirectory=/home/flashbot/webapp

# Security features
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/home/flashbot/webapp/logs /home/flashbot/webapp/backups
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictRealtime=yes
SystemCallArchitectures=native

# Resource limits
LimitNOFILE=4096
LimitNPROC=100
MemoryMax=2G

# Environment
Environment=NODE_ENV=production
EnvironmentFile=/home/flashbot/webapp/.env

# Execution
ExecStart=/home/flashbot/webapp/start-production.sh
ExecStop=/home/flashbot/webapp/stop-production.sh
Restart=on-failure
RestartSec=10
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

log_success "Secure systemd service created"

# 7. Firewall Configuration
log_info "Creating firewall configuration..."

cat > scripts/configure-firewall.sh << 'EOF'
#!/bin/bash

echo "🔥 Configuring firewall for Flash Loan Bot..."

# Enable UFW if not already enabled
sudo ufw --force enable

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (adjust port if needed)
sudo ufw allow ssh
sudo ufw allow 22/tcp

# Allow bot API port (only from specific IPs if needed)
# Uncomment and modify as needed:
# sudo ufw allow from YOUR_MANAGEMENT_IP to any port 3000
# For now, allow from localhost only
sudo ufw allow from 127.0.0.1 to any port 3000

# Allow HTTPS outbound (for API calls)
sudo ufw allow out 443/tcp
sudo ufw allow out 80/tcp

# Allow DNS
sudo ufw allow out 53

# Log dropped packets
sudo ufw logging on

echo "✅ Firewall configured"
echo "Current status:"
sudo ufw status verbose
EOF

chmod +x scripts/configure-firewall.sh
log_success "Firewall configuration script created"

# 8. Monitoring and Alerting Security
log_info "Setting up security monitoring..."

cat > scripts/security-monitor.sh << 'EOF'
#!/bin/bash

# Security monitoring script
LOG_FILE="logs/security.log"

# Function to log security events
log_security() {
    echo "$(date -Iseconds) [SECURITY] $1" >> "$LOG_FILE"
}

# Check for suspicious activity
check_failed_logins() {
    FAILED_COUNT=$(grep "authentication failure" /var/log/auth.log 2>/dev/null | grep "$(date '+%b %d')" | wc -l)
    if [ "$FAILED_COUNT" -gt 10 ]; then
        log_security "HIGH: $FAILED_COUNT failed login attempts today"
        echo "⚠️  Warning: $FAILED_COUNT failed login attempts detected"
    fi
}

# Check disk space
check_disk_space() {
    DISK_USAGE=$(df . | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 90 ]; then
        log_security "HIGH: Disk space usage at ${DISK_USAGE}%"
        echo "⚠️  Warning: Low disk space (${DISK_USAGE}% used)"
    fi
}

# Check process integrity
check_processes() {
    if ! pgrep -f "flashbot-main" > /dev/null; then
        log_security "HIGH: Main bot process not running"
        echo "❌ Main bot process is not running!"
    fi
}

# Check log file sizes
check_log_sizes() {
    MAX_SIZE=100000000  # 100MB
    for log_file in logs/*.log; do
        if [ -f "$log_file" ]; then
            SIZE=$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null)
            if [ "$SIZE" -gt "$MAX_SIZE" ]; then
                log_security "MEDIUM: Log file $log_file is large (${SIZE} bytes)"
            fi
        fi
    done
}

# Run checks
echo "🔍 Running security checks..."
check_failed_logins
check_disk_space
check_processes
check_log_sizes

echo "✅ Security monitoring complete"
EOF

chmod +x scripts/security-monitor.sh
log_success "Security monitoring script created"

# 9. Create security checklist
log_info "Creating security checklist..."

cat > SECURITY-CHECKLIST.md << 'EOF'
# 🔒 Security Checklist for Flash Loan Arbitrage Bot

## Pre-Deployment Security Check

### Environment Security
- [ ] Environment file (.env) has 600 permissions
- [ ] No placeholder values in .env file
- [ ] Private key is for dedicated trading wallet only
- [ ] Environment variables don't contain sensitive data in logs

### Server Security
- [ ] Running as non-root user
- [ ] Firewall is configured and enabled
- [ ] SSH keys are used (no password authentication)
- [ ] System is updated to latest packages
- [ ] Fail2ban or similar is installed

### Application Security
- [ ] Demo mode tested before live deployment
- [ ] Rate limiting is enabled on API endpoints
- [ ] API authentication is configured
- [ ] Logs are configured to not expose sensitive data
- [ ] Backup encryption is enabled

### Network Security
- [ ] API port is not exposed to internet (or has IP whitelist)
- [ ] HTTPS is used for external API calls
- [ ] RPC endpoints use secure connections
- [ ] No hardcoded secrets in source code

### Monitoring Security
- [ ] Security monitoring script is scheduled
- [ ] Log rotation is configured
- [ ] Disk space monitoring is enabled
- [ ] Process monitoring is active
- [ ] Alert system is configured

### Operational Security
- [ ] Backup recovery has been tested
- [ ] Emergency stop procedures are documented
- [ ] Access credentials are stored securely
- [ ] Two-factor authentication is enabled where possible
- [ ] Regular security reviews are scheduled

## Daily Security Tasks
- Check security monitoring results
- Review unusual log entries
- Verify backup integrity
- Monitor system resources
- Check for failed authentication attempts

## Weekly Security Tasks
- Update system packages
- Rotate log files
- Test backup recovery
- Review access logs
- Update firewall rules if needed

## Monthly Security Tasks
- Rotate API keys
- Security audit of configurations
- Review and update IP whitelists
- Test emergency procedures
- Update security documentation
EOF

log_success "Security checklist created"

# 10. Final security report
echo ""
log_success "🎉 Security hardening completed!"
echo ""
log_info "📋 Next Steps:"
echo "1. Review and run: ./scripts/configure-firewall.sh"
echo "2. Set up log monitoring: crontab -e"
echo "   */15 * * * * /path/to/webapp/scripts/security-monitor.sh"
echo "3. Review SECURITY-CHECKLIST.md"
echo "4. Test all security features before going live"
echo ""
log_warning "⚠️  Important:"
echo "- Keep your .env file secure and backed up"
echo "- Regularly rotate API keys and passwords"
echo "- Monitor logs for suspicious activity"
echo "- Test emergency procedures regularly"