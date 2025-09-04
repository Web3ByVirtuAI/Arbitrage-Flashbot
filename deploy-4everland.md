# Deploy Flash Loan Bot Frontend to 4everland

## 🎯 Hybrid Architecture Deployment

Since 4everland doesn't support persistent Node.js processes, we'll deploy only the frontend dashboard to 4everland while running the trading bot on a VPS.

### **Architecture Overview:**
```
┌─────────────────┐    API Calls    ┌─────────────────┐
│   4EVERLAND     │◄─────────────►│   VPS/Cloud     │
│   (Frontend)    │   HTTPS/WSS    │   (Backend)     │
├─────────────────┤                ├─────────────────┤
│ Modern Web UI   │                │ Trading Bot     │
│ Real-time Data  │                │ API Server      │
│ Trading Controls│                │ Flash Loans     │
│ Static Assets   │                │ Opportunity     │
└─────────────────┘                └─────────────────┘
```

## 📦 Frontend-Only Build for 4everland

### Step 1: Create Static Frontend Build

```bash
# Create a frontend-only version
mkdir -p frontend-4everland
cp -r public/* frontend-4everland/

# Create index.html with API endpoint configuration
cat > frontend-4everland/config.js << 'EOF'
// Configuration for 4everland deployment
window.FLASHBOT_CONFIG = {
    // Replace with your VPS API endpoint
    API_BASE_URL: 'https://your-vps-domain.com:3000',
    
    // Or use your VPS IP
    // API_BASE_URL: 'https://YOUR_VPS_IP:3000',
    
    // WebSocket endpoint for real-time data
    WS_ENDPOINT: 'wss://your-vps-domain.com:3000',
    
    // Update intervals
    REFRESH_INTERVAL: 5000, // 5 seconds
    
    // UI Configuration
    THEME: 'dark',
    SHOW_ADVANCED_CONTROLS: true
};
EOF
```

### Step 2: Update Frontend to Use External API

Create a modified index.html that connects to your VPS backend:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flash Loan Arbitrage Bot - Remote Dashboard</title>
    
    <!-- Same styling as before -->
    <style>
        /* Include all the modern CSS from our existing index.html */
        /* ... (copy all CSS from public/index.html) ... */
        
        /* Additional styles for remote connection */
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 600;
            z-index: 1000;
        }
        
        .connected {
            background: rgba(16, 185, 129, 0.2);
            color: #10b981;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }
        
        .disconnected {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }
    </style>
    
    <!-- Load configuration -->
    <script src="config.js"></script>
</head>
<body>
    <!-- Connection Status -->
    <div id="connection-status" class="connection-status disconnected">
        🔴 Connecting to Bot...
    </div>
    
    <!-- Same UI as before -->
    <!-- ... (copy all HTML from public/index.html) ... -->
    
    <script>
        // Enhanced JavaScript with remote API connection
        const API_BASE_URL = window.FLASHBOT_CONFIG?.API_BASE_URL || 'http://localhost:3000';
        const WS_ENDPOINT = window.FLASHBOT_CONFIG?.WS_ENDPOINT || 'ws://localhost:3000';
        
        // Connection management
        let isConnected = false;
        
        function updateConnectionStatus(connected) {
            isConnected = connected;
            const statusEl = document.getElementById('connection-status');
            
            if (connected) {
                statusEl.className = 'connection-status connected';
                statusEl.textContent = '🟢 Connected to Bot';
            } else {
                statusEl.className = 'connection-status disconnected';  
                statusEl.textContent = '🔴 Bot Offline';
            }
        }
        
        // Enhanced API calls with error handling
        async function apiCall(endpoint, options = {}) {
            try {
                const response = await axios({
                    url: `${API_BASE_URL}${endpoint}`,
                    timeout: 10000,
                    ...options
                });
                
                if (!isConnected) updateConnectionStatus(true);
                return response;
            } catch (error) {
                updateConnectionStatus(false);
                console.error('API call failed:', error);
                throw error;
            }
        }
        
        // Update all existing functions to use apiCall
        async function startTrading() {
            try {
                await apiCall('/api/start', { method: 'POST' });
                showAlert('Trading started successfully!', 'success');
            } catch (error) {
                showAlert('Failed to start trading: Bot may be offline', 'error');
            }
        }
        
        async function loadOpportunities() {
            try {
                const response = await apiCall('/api/opportunities');
                const opportunities = response.data.opportunities || [];
                
                // Update table (same logic as before)
                updateOpportunitiesTable(opportunities);
            } catch (error) {
                const tableBody = document.getElementById('opportunities-table-body');
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 2rem; color: #ef4444;">
                            ❌ Cannot connect to trading bot
                        </td>
                    </tr>
                `;
            }
        }
        
        // Add all other functions from the original index.html
        // ... (copy all JavaScript functions) ...
        
        // Initialize with connection check
        async function initialize() {
            try {
                await apiCall('/health');
                updateConnectionStatus(true);
                await loadStats();
                await loadOpportunities();
                
                // Auto-refresh
                setInterval(loadOpportunities, 5000);
                setInterval(loadStats, 10000);
                
            } catch (error) {
                updateConnectionStatus(false);
                showAlert('Cannot connect to trading bot. Please check if bot is running.', 'error');
            }
        }
        
        document.addEventListener('DOMContentLoaded', initialize);
    </script>
</body>
</html>
```

## 🚀 Deploy to 4everland

### Step 1: Prepare Files
```bash
# Create deployment package
mkdir flashbot-frontend
cp frontend-4everland/* flashbot-frontend/

# Create deployment configuration
cat > flashbot-frontend/4everland.json << 'EOF'
{
  "name": "flashbot-dashboard",
  "build": {
    "outputDir": "./",
    "framework": "vanilla"
  },
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
EOF
```

### Step 2: Deploy via 4everland Dashboard
1. Go to https://dashboard.4everland.org/
2. Connect your GitHub account
3. Create new project
4. Upload the `flashbot-frontend` directory
5. Configure custom domain (optional)

### Step 3: Configure CORS on Backend
Update your VPS backend to allow 4everland origin:

```javascript
// In your API server (src/api/server.ts)
app.use(cors({
  origin: [
    'https://your-4everland-domain.4everland.app',
    'https://your-custom-domain.com',
    'http://localhost:3000' // for development
  ],
  credentials: true
}));
```

## ⚙️ Backend VPS Setup

Deploy the actual trading bot to a VPS:

```bash
# On your VPS
git clone YOUR_REPOSITORY_URL flashbot-backend
cd flashbot-backend
./scripts/setup-production.sh

# Configure environment
cp .env.production.example .env
# Edit .env with your settings

# Start the bot
./start-production.sh

# Enable HTTPS (recommended)
sudo certbot --nginx -d your-domain.com
```

## 🔒 Security Considerations

### API Security
```bash
# In .env on VPS
ENABLE_API_AUTH=true
API_SECRET_KEY=your-secret-key
CORS_ORIGINS=https://your-4everland-domain.4everland.app

# Rate limiting
API_RATE_LIMIT=60
```

### Firewall Configuration  
```bash
# On VPS
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 3000/tcp    # API (or use reverse proxy)
sudo ufw enable
```

## 📊 Benefits of Hybrid Architecture

✅ **Decentralized Frontend**: Censorship-resistant dashboard on IPFS
✅ **High-Performance Backend**: Low-latency trading on optimized VPS  
✅ **Global Access**: Frontend accessible from anywhere
✅ **Security**: Trading logic isolated on secure VPS
✅ **Scalability**: Can scale frontend and backend independently

## 💰 Cost Analysis

| Component | Platform | Cost | Purpose |
|-----------|----------|------|---------|
| Frontend | 4everland | $0-10/month | Dashboard UI |
| Backend | Trading VPS | $30-100/month | Trading logic |
| **Total** | **Hybrid** | **$30-110/month** | **Complete system** |

## 🚀 Next Steps

1. **Deploy Backend to VPS** first (full trading functionality)
2. **Test thoroughly** with the web interface  
3. **Create frontend-only version** for 4everland
4. **Deploy to 4everland** and test remote connection
5. **Configure HTTPS and security** for production

This hybrid approach gives you the best of both worlds: decentralized frontend hosting with high-performance trading execution!