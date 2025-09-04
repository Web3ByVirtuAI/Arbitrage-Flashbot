#!/bin/bash

# =====================================================
# FLASH LOAN ARBITRAGE BOT - PRODUCTION READINESS CHECK
# =====================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
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

log_bold() {
    echo -e "${BOLD}$1${NC}"
}

# Global counters
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

check_status() {
    if [ $? -eq 0 ]; then
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

echo ""
log_bold "🚀 FLASH LOAN ARBITRAGE BOT - PRODUCTION READINESS CHECK"
log_bold "========================================================"
echo ""

# 1. Environment Check
log_info "🔍 Checking Environment Configuration..."
echo ""

if [ -f .env ]; then
    log_success "Environment file exists"
    check_status
    
    # Check file permissions
    PERM=$(stat -c "%a" .env 2>/dev/null || stat -f "%A" .env 2>/dev/null)
    if [[ "$PERM" == *"600"* ]]; then
        log_success "Environment file has secure permissions"
        check_status
    else
        log_error "Environment file permissions are not secure (current: $PERM, required: 600)"
        check_status && false
    fi
    
    # Source environment and check key variables
    source .env
    
    if [ -n "$PRIVATE_KEY" ] && [[ "$PRIVATE_KEY" != *"YOUR_"* ]]; then
        log_success "Private key is configured"
        check_status
    else
        log_error "Private key is not properly configured"
        check_status && false
    fi
    
    if [ -n "$RPC_URL_MAINNET" ] && [[ "$RPC_URL_MAINNET" != *"YOUR_"* ]]; then
        log_success "RPC URL is configured"
        check_status
    else
        log_error "RPC URL is not properly configured"
        check_status && false
    fi
    
else
    log_error "Environment file (.env) not found"
    check_status && false
fi

# 2. Dependencies Check
echo ""
log_info "📦 Checking Dependencies..."
echo ""

if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version | cut -c2-)
    log_success "Node.js installed (version $NODE_VERSION)"
    check_status
    
    REQUIRED_VERSION="18.0.0"
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then 
        log_success "Node.js version is compatible"
        check_status
    else
        log_error "Node.js version $NODE_VERSION is too old (required: $REQUIRED_VERSION+)"
        check_status && false
    fi
else
    log_error "Node.js not found"
    check_status && false
fi

if [ -d node_modules ]; then
    log_success "Node modules are installed"
    check_status
else
    log_error "Node modules not found - run 'npm install'"
    check_status && false
fi

if [ -d dist ]; then
    log_success "Project is built"
    check_status
else
    log_error "Project not built - run 'npm run build'"
    check_status && false
fi

# 3. Configuration Files Check
echo ""
log_info "⚙️  Checking Configuration Files..."
echo ""

CONFIG_FILES=(
    "package.json"
    "ecosystem.config.cjs"
    "tsconfig.json"
)

for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "$file exists"
        check_status
    else
        log_error "$file missing"
        check_status && false
    fi
done

# 4. Directory Structure Check
echo ""
log_info "📁 Checking Directory Structure..."
echo ""

REQUIRED_DIRS=(
    "src"
    "public"
    "scripts"
    "logs"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        log_success "$dir/ directory exists"
        check_status
    else
        log_error "$dir/ directory missing"
        check_status && false
    fi
done

# 5. Script Permissions Check
echo ""
log_info "🔧 Checking Script Permissions..."
echo ""

SCRIPTS=(
    "scripts/setup-production.sh"
    "scripts/setup-wallet.js"
    "scripts/test-production.js"
    "scripts/security-hardening.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -x "$script" ]; then
        log_success "$script is executable"
        check_status
    else
        log_warning "$script is not executable - fixing..."
        chmod +x "$script" 2>/dev/null && log_success "Fixed permissions for $script" || log_error "Could not fix permissions for $script"
        WARNINGS=$((WARNINGS + 1))
    fi
done

# 6. Production Files Check
echo ""
log_info "🏭 Checking Production Files..."
echo ""

PROD_FILES=(
    ".env.production.example"
    "DEPLOYMENT.md"
    "start-production.sh"
    "stop-production.sh"
)

for file in "${PROD_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "$file exists"
        check_status
    else
        log_warning "$file missing - may need to run setup-production.sh"
        WARNINGS=$((WARNINGS + 1))
    fi
done

# 7. Security Check
echo ""
log_info "🔒 Security Assessment..."
echo ""

# Check if demo mode is enabled
if [ -n "$DEMO_MODE" ] && [ "$DEMO_MODE" = "true" ]; then
    log_success "Demo mode is enabled (safe for testing)"
    check_status
else
    log_warning "Demo mode is disabled - will execute real trades!"
    WARNINGS=$((WARNINGS + 1))
fi

# Check for security files
if [ -f "SECURITY-CHECKLIST.md" ]; then
    log_success "Security checklist is available"
    check_status
else
    log_warning "Security checklist missing - run security-hardening.sh"
    WARNINGS=$((WARNINGS + 1))
fi

# 8. Service Check
echo ""
log_info "🔄 Checking Service Status..."
echo ""

if command -v pm2 >/dev/null 2>&1; then
    log_success "PM2 is installed"
    check_status
    
    PM2_STATUS=$(pm2 jlist 2>/dev/null | grep -c "flashbot" || echo "0")
    if [ "$PM2_STATUS" -gt 0 ]; then
        log_success "Bot processes are running in PM2"
        check_status
    else
        log_warning "Bot processes not running - start with ./start-production.sh"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    log_error "PM2 not installed - required for production"
    check_status && false
fi

# 9. Network Connectivity Test
echo ""
log_info "🌐 Testing Network Connectivity..."
echo ""

if [ -n "$RPC_URL_MAINNET" ]; then
    # Extract hostname from RPC URL for ping test
    HOSTNAME=$(echo "$RPC_URL_MAINNET" | sed -E 's|^https?://([^/]+).*|\1|')
    
    if ping -c 1 -W 3 "$HOSTNAME" >/dev/null 2>&1; then
        log_success "Network connectivity to RPC provider OK"
        check_status
    else
        log_warning "Cannot reach RPC provider - check network/DNS"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    log_warning "RPC URL not configured - skipping network test"
    WARNINGS=$((WARNINGS + 1))
fi

# 10. Final Assessment
echo ""
log_bold "📊 PRODUCTION READINESS ASSESSMENT"
log_bold "=================================="
echo ""

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED))
SUCCESS_RATE=0

if [ $TOTAL_CHECKS -gt 0 ]; then
    SUCCESS_RATE=$(( (CHECKS_PASSED * 100) / TOTAL_CHECKS ))
fi

echo -e "✅ Checks Passed:    ${GREEN}$CHECKS_PASSED${NC}"
echo -e "❌ Checks Failed:    ${RED}$CHECKS_FAILED${NC}"
echo -e "⚠️  Warnings:        ${YELLOW}$WARNINGS${NC}"
echo -e "📈 Success Rate:     ${BOLD}$SUCCESS_RATE%${NC}"
echo ""

# Determine readiness status
if [ $CHECKS_FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        log_bold "🎉 PRODUCTION READY!"
        echo ""
        log_success "Your Flash Loan Arbitrage Bot is fully configured and ready for production deployment."
        echo ""
        log_info "🚀 Quick Start Commands:"
        echo "  ./start-production.sh    - Start the bot"
        echo "  ./scripts/monitor.sh     - Monitor performance"
        echo "  pm2 logs                 - View live logs"
        echo "  pm2 monit                - Real-time monitoring"
        echo ""
        log_info "🔗 Web Interface: http://localhost:3000"
        echo ""
    else
        log_bold "⚠️  PRODUCTION READY WITH WARNINGS"
        echo ""
        log_warning "Your bot is ready but please review the warnings above."
        log_info "Consider addressing warnings before full production deployment."
        echo ""
    fi
else
    log_bold "❌ NOT READY FOR PRODUCTION"
    echo ""
    log_error "Please fix the failed checks above before deploying to production."
    echo ""
    log_info "🔧 Common fixes:"
    echo "  1. Run: npm install && npm run build"
    echo "  2. Configure .env file properly"
    echo "  3. Run: ./scripts/setup-production.sh"
    echo "  4. Install PM2: npm install -g pm2"
    echo ""
    exit 1
fi

# Recommendations based on configuration
echo ""
log_bold "💡 RECOMMENDATIONS"
log_bold "=================="
echo ""

if [ -n "$DEMO_MODE" ] && [ "$DEMO_MODE" = "true" ]; then
    log_info "🎯 Currently in DEMO mode - perfect for testing!"
    log_info "   When ready for live trading, set DEMO_MODE=false in .env"
fi

if [ -n "$MAX_TRADE_SIZE" ] && [ "$MAX_TRADE_SIZE" -gt 1000 ]; then
    log_info "💰 Large trade size detected ($MAX_TRADE_SIZE)"
    log_info "   Consider starting with smaller amounts for initial testing"
fi

log_info "📚 Documentation:"
log_info "   • DEPLOYMENT.md - Complete deployment guide"
log_info "   • SECURITY-CHECKLIST.md - Security best practices"
log_info "   • README.md - Usage instructions and features"

echo ""
log_success "✨ Production readiness check completed!"