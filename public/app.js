// Advanced Flash Loan Arbitrage System - Frontend Application
class ArbitrageApp {
    constructor() {
        this.baseURL = window.location.origin;
        this.refreshInterval = 30000; // 30 seconds
        this.charts = {};
        this.data = {
            opportunities: [],
            flashLoanProviders: {},
            dexStatus: {},
            executionStats: {},
            gasData: {}
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Advanced Arbitrage System');
        
        // Initial data load
        await this.loadSystemHealth();
        await this.loadDashboardMetrics();
        await this.loadOpportunities();
        await this.loadFlashLoanProviders();
        await this.loadDEXStatus();
        await this.loadExecutionStats();
        
        // Initialize charts
        this.initializeCharts();
        
        // Setup auto-refresh
        this.setupAutoRefresh();
        
        console.log('✅ System initialized successfully');
    }
    
    // System Health & Status
    async loadSystemHealth() {
        try {
            const response = await axios.get(`${this.baseURL}/health`);
            this.updateSystemStatus(response.data);
        } catch (error) {
            console.error('Error loading system health:', error);
            this.updateSystemStatus({ status: 'ERROR' });
        }
    }
    
    updateSystemStatus(health) {
        const apiStatus = document.getElementById('api-status');
        const flashLoanStatus = document.getElementById('flash-loan-status');
        const dexStatus = document.getElementById('dex-status');
        
        // API Status
        if (health.status === 'OK') {
            apiStatus.className = 'status-dot status-online';
        } else {
            apiStatus.className = 'status-dot status-error';
        }
        
        // Flash Loan Status (check components if available)
        if (health.components && health.components.services) {
            flashLoanStatus.className = health.components.services.flashLoanService ? 
                'status-dot status-online' : 'status-dot status-warning';
        } else {
            flashLoanStatus.className = 'status-dot status-online'; // Default to online
        }
        
        // DEX Status
        dexStatus.className = 'status-dot status-online'; // DEX monitoring is always active
    }
    
    // Dashboard Metrics
    async loadDashboardMetrics() {
        try {
            // Load opportunities
            const oppsResponse = await axios.get(`${this.baseURL}/api/opportunities`);
            const opportunities = oppsResponse.data.opportunities || [];
            
            // Update opportunities count
            document.getElementById('opportunities-count').textContent = opportunities.length;
            
            // Calculate total profit potential
            let totalProfit = 0;
            opportunities.forEach(opp => {
                if (opp.profit_percentage) {
                    totalProfit += opp.profit_percentage;
                }
            });
            
            document.getElementById('profit-potential').innerHTML = 
                `<span class="profit-positive">${totalProfit.toFixed(2)}%</span>`;
            
            // Networks active
            document.getElementById('networks-active').textContent = '8';
            
        } catch (error) {
            console.error('Error loading dashboard metrics:', error);
            document.getElementById('opportunities-count').textContent = '0';
            document.getElementById('profit-potential').textContent = '0%';
            document.getElementById('networks-active').textContent = '0';
        }
    }
    
    // Opportunities Management
    async loadOpportunities() {
        try {
            const response = await axios.get(`${this.baseURL}/api/opportunities`);
            const opportunities = response.data.opportunities || [];
            this.data.opportunities = opportunities;
            
            this.renderOpportunitiesTable(opportunities);
            await this.loadCrossDEXOpportunities();
            
        } catch (error) {
            console.error('Error loading opportunities:', error);
            document.getElementById('opportunities-table').innerHTML = 
                '<div class="error">Error loading opportunities</div>';
        }
    }
    
    async loadCrossDEXOpportunities() {
        try {
            const response = await axios.get(`${this.baseURL}/api/dex/cross-opportunities`);
            const crossDEXOpportunities = response.data.opportunities || [];
            
            this.renderCrossDEXOpportunities(crossDEXOpportunities);
            
        } catch (error) {
            console.error('Error loading cross-DEX opportunities:', error);
            document.getElementById('cross-dex-opportunities').innerHTML = 
                '<div class="error">Error loading cross-DEX opportunities</div>';
        }
    }
    
    renderOpportunitiesTable(opportunities) {
        const container = document.getElementById('opportunities-table');
        
        if (opportunities.length === 0) {
            container.innerHTML = '<div class="text-center">No opportunities found</div>';
            return;
        }
        
        let html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Token Pair</th>
                        <th>Protocol A</th>
                        <th>Protocol B</th>
                        <th>Price A</th>
                        <th>Price B</th>
                        <th>Profit %</th>
                        <th>Network</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        opportunities.forEach(opp => {
            const profitClass = opp.profit_percentage > 0 ? 'profit-positive' : 'profit-negative';
            html += `
                <tr>
                    <td><strong>${opp.token_a || 'N/A'} / ${opp.token_b || 'N/A'}</strong></td>
                    <td>${opp.protocol_a || opp.source_a || 'N/A'}</td>
                    <td>${opp.protocol_b || opp.source_b || 'N/A'}</td>
                    <td>$${parseFloat(opp.price_a || 0).toFixed(4)}</td>
                    <td>$${parseFloat(opp.price_b || 0).toFixed(4)}</td>
                    <td><span class="${profitClass}">${(opp.profit_percentage || 0).toFixed(2)}%</span></td>
                    <td><span class="network-badge network-${opp.network || 'ethereum'}">${opp.network || 'ethereum'}</span></td>
                    <td>
                        <button class="btn btn-sm" onclick="app.analyzeOpportunity('${opp.id || Math.random()}')">
                            <i class="fas fa-search"></i> Analyze
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    }
    
    renderCrossDEXOpportunities(opportunities) {
        const container = document.getElementById('cross-dex-opportunities');
        
        if (opportunities.length === 0) {
            container.innerHTML = '<div class="text-center">No cross-DEX opportunities found</div>';
            return;
        }
        
        let html = '<div class="grid gap-1rem">';
        
        opportunities.forEach(opp => {
            const profitClass = opp.profit_percentage > 1 ? 'badge-success' : 'badge-warning';
            html += `
                <div class="card" style="margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${opp.token_pair || opp.tokenPair || 'N/A'}</strong>
                            <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                Buy: ${opp.buyFrom?.source || opp.protocol_a || 'N/A'} → 
                                Sell: ${opp.sellTo?.source || opp.protocol_b || 'N/A'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span class="badge ${profitClass}">
                                ${(opp.profit_percentage || opp.profitPercentage || 0).toFixed(2)}%
                            </span>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                ${opp.crossChain ? 'Cross-Chain' : 'Same Chain'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    // Flash Loan Management
    async loadFlashLoanProviders(network = 'ethereum') {
        try {
            const response = await axios.get(`${this.baseURL}/api/flashloan/providers/${network}`);
            const providers = response.data.providers || [];
            this.data.flashLoanProviders[network] = providers;
            
            this.renderFlashLoanProviders(providers, network);
            
        } catch (error) {
            console.error('Error loading flash loan providers:', error);
            document.getElementById('flash-loan-providers').innerHTML = 
                '<div class="error">Error loading flash loan providers</div>';
        }
    }
    
    renderFlashLoanProviders(providers, network) {
        const container = document.getElementById('flash-loan-providers');
        
        if (providers.length === 0) {
            container.innerHTML = '<div class="text-center">No flash loan providers available</div>';
            return;
        }
        
        let html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Provider</th>
                        <th>Protocol</th>
                        <th>Fees</th>
                        <th>Max Amount</th>
                        <th>Reliability</th>
                        <th>Gas Estimate</th>
                        <th>Supported Tokens</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        providers.forEach(provider => {
            const reliabilityClass = provider.reliability > 95 ? 'reliability-high' : 
                                   provider.reliability > 90 ? 'reliability-medium' : 'reliability-low';
            
            html += `
                <tr>
                    <td><strong>${provider.name}</strong></td>
                    <td><span class="badge badge-success">${provider.protocol}</span></td>
                    <td>${provider.fees}%</td>
                    <td>${parseFloat(provider.maxAmount).toLocaleString()}</td>
                    <td><span class="${reliabilityClass}">${provider.reliability}%</span></td>
                    <td>${provider.gasEstimate?.toLocaleString() || 'N/A'}</td>
                    <td>
                        <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                            ${provider.supportedTokens.slice(0, 4).map(token => 
                                `<span class="badge badge-secondary">${token}</span>`
                            ).join('')}
                            ${provider.supportedTokens.length > 4 ? 
                                `<span class="badge badge-secondary">+${provider.supportedTokens.length - 4}</span>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    }
    
    async getFlashLoanQuotes() {
        const network = document.getElementById('quote-network').value;
        const token = document.getElementById('quote-token').value;
        const amount = document.getElementById('quote-amount').value;
        
        if (!amount || parseFloat(amount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        
        try {
            document.getElementById('flash-loan-quotes').innerHTML = 
                '<div class="loading"><div class="spinner"></div> Getting quotes...</div>';
            
            const response = await axios.post(`${this.baseURL}/api/flashloan/quote`, {
                network,
                token,
                amount
            });
            
            const quotes = response.data.quotes || [];
            this.renderFlashLoanQuotes(quotes);
            
        } catch (error) {
            console.error('Error getting flash loan quotes:', error);
            document.getElementById('flash-loan-quotes').innerHTML = 
                '<div class="error">Error getting quotes</div>';
        }
    }
    
    renderFlashLoanQuotes(quotes) {
        const container = document.getElementById('flash-loan-quotes');
        
        if (quotes.length === 0) {
            container.innerHTML = '<div class="text-center">No quotes available</div>';
            return;
        }
        
        let html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Provider</th>
                        <th>Fee</th>
                        <th>Gas Cost</th>
                        <th>Total Cost</th>
                        <th>Execution Time</th>
                        <th>Success Rate</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Sort quotes by total cost (ascending)
        quotes.sort((a, b) => parseFloat(a.totalCost) - parseFloat(b.totalCost));
        
        quotes.forEach((quote, index) => {
            const isRecommended = index === 0;
            html += `
                <tr ${isRecommended ? 'style="background: rgba(0, 245, 255, 0.05);"' : ''}>
                    <td>
                        <strong>${quote.provider}</strong>
                        ${isRecommended ? '<span class="badge badge-success" style="margin-left: 0.5rem;">BEST</span>' : ''}
                    </td>
                    <td>${parseFloat(quote.fee).toFixed(6)} ETH</td>
                    <td>${(parseFloat(quote.totalCost) - parseFloat(quote.fee)).toFixed(6)} ETH</td>
                    <td><strong>${parseFloat(quote.totalCost).toFixed(6)} ETH</strong></td>
                    <td>${quote.executionTime}s</td>
                    <td><span class="reliability-high">${quote.success_rate}%</span></td>
                    <td>
                        <button class="btn btn-sm ${isRecommended ? '' : 'btn-secondary'}" 
                                onclick="app.selectFlashLoanProvider('${quote.provider}')">
                            ${isRecommended ? 'Select' : 'Use This'}
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    }
    
    // DEX Monitoring
    async loadDEXStatus() {
        try {
            const response = await axios.get(`${this.baseURL}/api/dex/status`);
            const status = response.data;
            this.data.dexStatus = status;
            
            this.renderDEXStatus(status);
            await this.loadCurvePools();
            await this.loadBalancerPools();
            
        } catch (error) {
            console.error('Error loading DEX status:', error);
            document.getElementById('dex-status-grid').innerHTML = 
                '<div class="error">Error loading DEX status</div>';
        }
    }
    
    renderDEXStatus(status) {
        const container = document.getElementById('dex-status-grid');
        
        if (!status.supported) {
            container.innerHTML = '<div class="text-center">DEX status not available</div>';
            return;
        }
        
        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">';
        
        Object.entries(status.supported).forEach(([dex, info]) => {
            const statusClass = info.status === 'active' ? 'badge-success' : 
                              info.status === 'rate-limited' ? 'badge-warning' : 'badge-error';
            
            html += `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                        <h4 style="text-transform: capitalize; margin: 0;">${dex.replace('-', ' ')}</h4>
                        <span class="badge ${statusClass}">${info.status}</span>
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">
                        <div>Networks: ${info.networks.length}</div>
                        <div style="margin-top: 0.25rem;">
                            ${info.networks.map(net => `<span class="network-badge network-${net}">${net}</span>`).join(' ')}
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    async loadCurvePools(network = 'ethereum') {
        try {
            const response = await axios.get(`${this.baseURL}/api/dex/curve/${network}`);
            const pools = response.data.pools || [];
            
            this.renderCurvePools(pools);
            
        } catch (error) {
            console.error('Error loading Curve pools:', error);
            document.getElementById('curve-pools').innerHTML = 
                '<div class="text-center">Error loading Curve pools</div>';
        }
    }
    
    renderCurvePools(pools) {
        const container = document.getElementById('curve-pools');
        
        if (pools.length === 0) {
            container.innerHTML = '<div class="text-center">No Curve pools found</div>';
            return;
        }
        
        let html = '';
        pools.slice(0, 5).forEach(pool => {
            html += `
                <div style="padding: 0.75rem; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${pool.name || pool.symbol || 'Unknown Pool'}</strong>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">
                                ${pool.coins?.map(coin => coin.symbol).join(' / ') || 'N/A'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.875rem; font-weight: 600;">
                                $${parseFloat(pool.totalLiquidity || 0).toLocaleString()}
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">
                                vPrice: ${parseFloat(pool.virtualPrice || 1).toFixed(4)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        if (pools.length > 5) {
            html += `<div style="text-align: center; padding: 0.75rem; color: var(--text-secondary);">
                +${pools.length - 5} more pools
            </div>`;
        }
        
        container.innerHTML = html;
    }
    
    async loadBalancerPools(network = 'ethereum') {
        try {
            const response = await axios.get(`${this.baseURL}/api/dex/balancer/${network}`);
            const pools = response.data.pools || [];
            
            this.renderBalancerPools(pools);
            
        } catch (error) {
            console.error('Error loading Balancer pools:', error);
            document.getElementById('balancer-pools').innerHTML = 
                '<div class="text-center">Error loading Balancer pools</div>';
        }
    }
    
    renderBalancerPools(pools) {
        const container = document.getElementById('balancer-pools');
        
        if (pools.length === 0) {
            container.innerHTML = '<div class="text-center">No Balancer pools found</div>';
            return;
        }
        
        let html = '';
        pools.slice(0, 5).forEach(pool => {
            html += `
                <div style="padding: 0.75rem; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${pool.poolType || 'Pool'}</strong>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">
                                ${pool.tokens?.map(token => `${token.symbol}(${(token.weight * 100).toFixed(0)}%)`).join(' / ') || 'N/A'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.875rem; font-weight: 600;">
                                $${parseFloat(pool.totalLiquidity || 0).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        if (pools.length > 5) {
            html += `<div style="text-align: center; padding: 0.75rem; color: var(--text-secondary);">
                +${pools.length - 5} more pools
            </div>`;
        }
        
        container.innerHTML = html;
    }
    
    // Execution Engine
    async loadExecutionStats() {
        try {
            const response = await axios.get(`${this.baseURL}/api/execution/stats`);
            const stats = response.data;
            this.data.executionStats = stats;
            
            this.renderExecutionStats(stats);
            
        } catch (error) {
            console.error('Error loading execution stats:', error);
            document.getElementById('execution-stats').innerHTML = 
                '<div class="error">Error loading execution stats</div>';
        }
    }
    
    renderExecutionStats(stats) {
        const container = document.getElementById('execution-stats');
        
        const html = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div>
                    <h4 style="margin-bottom: 1rem;">Flash Loan Infrastructure</h4>
                    <div class="metric-grid" style="display: grid; gap: 1rem;">
                        <div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">
                                ${stats.flashLoanProviders?.totalProviders || 0}
                            </div>
                            <div style="color: var(--text-secondary); font-size: 0.875rem;">Total Providers</div>
                        </div>
                        <div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">
                                ${stats.supportedNetworks?.length || 0}
                            </div>
                            <div style="color: var(--text-secondary); font-size: 0.875rem;">Networks Supported</div>
                        </div>
                        <div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning);">
                                ${stats.flashLoanProviders?.averageFees || '0'}%
                            </div>
                            <div style="color: var(--text-secondary); font-size: 0.875rem;">Average Fees</div>
                        </div>
                        <div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--secondary);">
                                ${stats.executionHistory?.totalExecutions || 0}
                            </div>
                            <div style="color: var(--text-secondary); font-size: 0.875rem;">Total Executions</div>
                        </div>
                    </div>
                    
                    <h4 style="margin: 1.5rem 0 1rem 0;">Risk Parameters</h4>
                    <div style="font-size: 0.875rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span>Max Borrow Amount:</span>
                            <span style="font-weight: 600;">${stats.riskParameters?.maxBorrowAmount || 0} ETH</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span>Min Profit Threshold:</span>
                            <span style="font-weight: 600;">${stats.riskParameters?.minProfitThreshold || 0} ETH</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span>Max Slippage:</span>
                            <span style="font-weight: 600;">${((stats.riskParameters?.maxSlippage || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Max Gas Price:</span>
                            <span style="font-weight: 600;">${stats.riskParameters?.maxGasPrice || 0} gwei</span>
                        </div>
                    </div>
                </div>
                
                <div>
                    <h4 style="margin-bottom: 1rem;">Recommended Providers</h4>
                    <div style="space-y: 0.75rem;">
                        ${stats.flashLoanProviders?.recommendedProviders?.map(provider => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(255,255,255,0.02); border-radius: 6px; margin-bottom: 0.5rem;">
                                <div>
                                    <div style="font-weight: 600;">${provider.name}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-secondary);">
                                        ${provider.protocol} • ${provider.network}
                                    </div>
                                </div>
                                <span class="reliability-high">${provider.reliability}%</span>
                            </div>
                        `).join('') || '<div style="color: var(--text-secondary);">No providers available</div>'}
                    </div>
                    
                    ${stats.recommendedSetup ? `
                        <div style="margin-top: 2rem; padding: 1rem; background: rgba(255, 170, 0, 0.1); border-radius: 8px; border-left: 4px solid var(--warning);">
                            <h5 style="color: var(--warning); margin-bottom: 0.5rem;">Next Steps</h5>
                            <div style="font-size: 0.875rem;">
                                <div style="font-weight: 600; margin-bottom: 0.25rem;">${stats.recommendedSetup.priority}</div>
                                <div style="color: var(--text-secondary); margin-bottom: 0.25rem;">Cost: ${stats.recommendedSetup.estimatedCost}</div>
                                <div style="color: var(--text-secondary);">Time: ${stats.recommendedSetup.timeToSetup}</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    async findExecutableOpportunities() {
        try {
            document.getElementById('executable-opportunities').innerHTML = 
                '<div class="loading"><div class="spinner"></div> Scanning for executable opportunities...</div>';
            
            const response = await axios.get(`${this.baseURL}/api/execution/opportunities/ethereum,polygon,arbitrum`);
            const opportunities = response.data.opportunities || [];
            
            this.renderExecutableOpportunities(opportunities);
            
        } catch (error) {
            console.error('Error finding executable opportunities:', error);
            document.getElementById('executable-opportunities').innerHTML = 
                '<div class="error">Error finding executable opportunities</div>';
        }
    }
    
    renderExecutableOpportunities(opportunities) {
        const container = document.getElementById('executable-opportunities');
        
        if (opportunities.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <i class="fas fa-search" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                    <div style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">No Executable Opportunities Found</div>
                    <div style="color: var(--text-secondary);">The system is monitoring for profitable arbitrage opportunities that meet execution criteria.</div>
                </div>
            `;
            return;
        }
        
        let html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Opportunity</th>
                        <th>Flash Loan Provider</th>
                        <th>Borrow Amount</th>
                        <th>Net Profit</th>
                        <th>Risk Level</th>
                        <th>Confidence</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        opportunities.forEach(opp => {
            const riskClass = opp.riskLevel === 'low' ? 'badge-success' : 
                            opp.riskLevel === 'medium' ? 'badge-warning' : 'badge-error';
            
            html += `
                <tr>
                    <td>
                        <div><strong>${opp.tradePath?.tokens?.tokenA || 'N/A'} → ${opp.tradePath?.tokens?.tokenB || 'N/A'}</strong></div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">
                            ${opp.type} • <span class="network-badge network-${opp.network}">${opp.network}</span>
                        </div>
                    </td>
                    <td>${opp.flashLoanProvider}</td>
                    <td>${parseFloat(opp.borrowAmount).toFixed(4)} ${opp.borrowToken}</td>
                    <td>
                        <div class="profit-positive">${parseFloat(opp.profitEstimate.netProfit).toFixed(6)} ETH</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">
                            ${opp.profitEstimate.profitPercentage.toFixed(2)}%
                        </div>
                    </td>
                    <td><span class="badge ${riskClass}">${opp.riskLevel}</span></td>
                    <td>${opp.confidence}%</td>
                    <td>
                        <button class="btn btn-sm" onclick="app.simulateExecution('${opp.id}')">
                            <i class="fas fa-play"></i> Simulate
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    }
    
    // Charts Initialization
    initializeCharts() {
        this.initializeProfitChart();
        this.initializeNetworkChart();
        this.initializeGasChart();
    }
    
    initializeProfitChart() {
        const ctx = document.getElementById('profit-chart');
        if (!ctx) return;
        
        // Generate sample profit data over time
        const dates = [];
        const profits = [];
        for (let i = 23; i >= 0; i--) {
            const date = new Date();
            date.setHours(date.getHours() - i);
            dates.push(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
            profits.push(Math.random() * 5 + 0.5); // Random profit between 0.5% and 5.5%
        }
        
        this.charts.profit = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Profit Opportunities (%)',
                    data: profits,
                    borderColor: '#00f5ff',
                    backgroundColor: 'rgba(0, 245, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#a0a0a0' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    y: {
                        ticks: { color: '#a0a0a0' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });
    }
    
    initializeNetworkChart() {
        const ctx = document.getElementById('network-chart');
        if (!ctx) return;
        
        this.charts.network = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'BSC'],
                datasets: [{
                    data: [40, 25, 15, 12, 8],
                    backgroundColor: [
                        '#627eea',
                        '#8247e5',
                        '#1c96d8',
                        '#ff0420',
                        '#f3ba2f'
                    ],
                    borderWidth: 2,
                    borderColor: '#2a2a2a'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#ffffff',
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                }
            }
        });
    }
    
    initializeGasChart() {
        const ctx = document.getElementById('gas-chart');
        if (!ctx) return;
        
        // Generate sample gas price data
        const times = [];
        const gasData = [];
        for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setHours(date.getHours() - i * 2);
            times.push(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
            gasData.push(Math.random() * 30 + 15); // Random gas price between 15-45 gwei
        }
        
        this.charts.gas = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: times,
                datasets: [{
                    label: 'Gas Price (gwei)',
                    data: gasData,
                    backgroundColor: 'rgba(255, 170, 0, 0.7)',
                    borderColor: '#ffaa00',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#a0a0a0' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    y: {
                        ticks: { color: '#a0a0a0' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });
    }
    
    // Auto-refresh functionality
    setupAutoRefresh() {
        setInterval(async () => {
            await this.loadSystemHealth();
            await this.loadDashboardMetrics();
            
            // Only refresh current tab data
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab) {
                switch (activeTab.id) {
                    case 'opportunities':
                        await this.loadOpportunities();
                        break;
                    case 'flash-loans':
                        // Refresh current network providers
                        const network = document.getElementById('network-select').value;
                        await this.loadFlashLoanProviders(network);
                        break;
                    case 'dex-monitor':
                        await this.loadDEXStatus();
                        break;
                    case 'execution':
                        await this.loadExecutionStats();
                        break;
                }
            }
        }, this.refreshInterval);
    }
    
    // Action Methods
    async refreshOpportunities() {
        await this.loadOpportunities();
        await this.loadDashboardMetrics();
    }
    
    async analyzeOpportunity(opportunityId) {
        // Placeholder for opportunity analysis
        console.log('Analyzing opportunity:', opportunityId);
        alert('Opportunity analysis feature coming soon!');
    }
    
    async selectFlashLoanProvider(providerName) {
        console.log('Selected flash loan provider:', providerName);
        alert(`Selected ${providerName} as flash loan provider!`);
    }
    
    async simulateExecution(opportunityId) {
        try {
            const response = await axios.post(`${this.baseURL}/api/execution/simulate`, {
                opportunityId
            });
            
            const result = response.data;
            const message = result.success ? 
                `✅ Simulation Successful!\nProfit: ${result.simulatedProfit} ETH\nGas: ${result.gasEstimate}` :
                `❌ Simulation Failed!\nRisks: ${result.risks?.join(', ')}`;
                
            alert(message);
            
        } catch (error) {
            console.error('Error simulating execution:', error);
            alert('Error simulating execution');
        }
    }
}

// Global Tab Management
function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    // Load data for newly active tab if needed
    if (window.app) {
        switch (tabName) {
            case 'flash-loans':
                window.app.loadFlashLoanProviders();
                break;
            case 'dex-monitor':
                window.app.loadDEXStatus();
                break;
            case 'execution':
                window.app.findExecutableOpportunities();
                break;
            case 'opportunities':
                window.app.loadOpportunities();
                break;
        }
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ArbitrageApp();
});

// Global function for flash loan provider selection
window.loadFlashLoanProviders = () => {
    const network = document.getElementById('network-select').value;
    window.app.loadFlashLoanProviders(network);
};

// Global function for quote calculation
window.getFlashLoanQuotes = () => {
    window.app.getFlashLoanQuotes();
};

// Global function for opportunity refresh
window.refreshOpportunities = () => {
    window.app.refreshOpportunities();
};

// Global function for executable opportunities
window.findExecutableOpportunities = () => {
    window.app.findExecutableOpportunities();
};