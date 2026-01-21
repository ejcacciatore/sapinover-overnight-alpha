// Sapinover Overnight Trading Analysis Dashboard v3.0
// Built for institutional-grade market microstructure research

// ============================================================================
// GLOBAL STATE
// ============================================================================

let DATA = null;
let FILTERED_DATA = [];
let LOOKUP = null;
let META = null;

// View states
let CURRENT_TAB = 'summary';
let USE_WINSORIZED = true;
let SELECTED_DATE = null;

// Explorer state
let EXPLORER_PAGE = 1;
let EXPLORER_SORT = { column: 'notional', ascending: false };
let EXPLORER_FILTERS = { symbol: '', sector: 'all', assetType: 'all', gapDirection: 'all' };
const ROWS_PER_PAGE = 50;

// Chart instances (for cleanup)
let chartInstances = {};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    // Setup tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Load data
    await loadData();
});

async function loadData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('Failed to load data.json');
        
        const json = await response.json();
        
        META = json.meta;
        LOOKUP = json.lookup;
        
        // Process raw data into usable objects
        DATA = json.data.map(row => ({
            symbol: LOOKUP.symbols[row[0]],
            company: LOOKUP.companies[row[1]],
            date: LOOKUP.dates[row[2]],
            assetType: row[3] === 1 ? 'ETF' : 'Stock',
            sector: LOOKUP.sectors[row[4]],
            notional: row[5],
            volume: row[6],
            executions: row[7],
            vwap: row[8],
            priorClose: row[9],
            nextOpen: row[10],
            nextClose: row[11],
            timingDiff: row[12],
            timingDiffW: row[13],
            refGap: row[14],
            refGapW: row[15],
            totalGap: row[16],
            gapDirection: row[17] === 1 ? 'UP' : 'DOWN',
            dirConsistency: row[18] === 1,
            isOutlier: row[19] === 1,
            marketCap: row[20],
            leverageMult: row[21]
        }));
        
        FILTERED_DATA = [...DATA];
        SELECTED_DATE = LOOKUP.dates[LOOKUP.dates.length - 1]; // Most recent
        
        // Update header
        document.getElementById('dateRangeDisplay').textContent = 
            `${META.dateRange[0]} to ${META.dateRange[1]} (${META.tradingDays} days)`;
        document.getElementById('generatedDisplay').textContent = 
            `Generated: ${META.generated}`;
        document.getElementById('footerYear').textContent = 
            new Date().getFullYear();
        
        // Build the dashboard
        buildDashboard();
        
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('mainContent').innerHTML = `
            <div class="card" style="text-align: center; padding: 3rem;">
                <h3 style="color: var(--danger); margin-bottom: 1rem;">Error Loading Data</h3>
                <p style="color: var(--text-secondary);">
                    Could not load data.json. Make sure the file is in the same directory as index.html.
                </p>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 1rem;">
                    Error: ${error.message}
                </p>
            </div>
        `;
    }
}

function buildDashboard() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <!-- Filter Panel -->
        <div class="filter-panel">
            <div class="filter-group">
                <label>Asset Type</label>
                <select id="filterAssetType" onchange="applyFilters()">
                    <option value="all">All Types</option>
                    <option value="Stock">Stocks Only</option>
                    <option value="ETF">ETFs Only</option>
                </select>
            </div>
            <div class="filter-group">
                <label>Sector</label>
                <select id="filterSector" onchange="applyFilters()">
                    <option value="all">All Sectors</option>
                </select>
            </div>
            <div class="filter-group">
                <label>Min Notional ($K)</label>
                <input type="number" id="filterNotional" value="0" min="0" step="100" onchange="applyFilters()">
            </div>
            <div class="filter-group">
                <label>Data View</label>
                <div class="toggle-group">
                    <button class="toggle-btn active" id="btnWinsorized" onclick="setWinsorized(true)">Winsorized</button>
                    <button class="toggle-btn" id="btnFullRange" onclick="setWinsorized(false)">Full Range</button>
                </div>
            </div>
        </div>
        
        <!-- Tab Contents -->
        <div class="tab-content active" id="tab-summary"></div>
        <div class="tab-content" id="tab-daily"></div>
        <div class="tab-content" id="tab-structure"></div>
        <div class="tab-content" id="tab-quadrant"></div>
        <div class="tab-content" id="tab-explorer"></div>
        <div class="tab-content" id="tab-methodology"></div>
    `;
    
    // Populate sector filter
    populateSectorFilter();
    
    // Render initial tab
    renderCurrentTab();
}

function populateSectorFilter() {
    const sectors = [...new Set(FILTERED_DATA.map(d => d.sector))].sort();
    const select = document.getElementById('filterSector');
    
    sectors.forEach(s => {
        if (s && s !== 'Unknown') {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s.length > 30 ? s.substring(0, 30) + '...' : s;
            select.appendChild(opt);
        }
    });
}

// ============================================================================
// FILTERING & VIEW CONTROLS
// ============================================================================

function applyFilters() {
    const assetType = document.getElementById('filterAssetType').value;
    const sector = document.getElementById('filterSector').value;
    const minNotional = parseFloat(document.getElementById('filterNotional').value) * 1000 || 0;
    
    FILTERED_DATA = DATA.filter(d => {
        if (assetType !== 'all' && d.assetType !== assetType) return false;
        if (sector !== 'all' && d.sector !== sector) return false;
        if (d.notional < minNotional) return false;
        return true;
    });
    
    EXPLORER_PAGE = 1;
    renderCurrentTab();
}

function setWinsorized(winsorized) {
    USE_WINSORIZED = winsorized;
    document.getElementById('btnWinsorized').classList.toggle('active', winsorized);
    document.getElementById('btnFullRange').classList.toggle('active', !winsorized);
    renderCurrentTab();
}

function switchTab(tabId) {
    CURRENT_TAB = tabId;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
    
    renderCurrentTab();
}

function renderCurrentTab() {
    // Destroy old charts
    Object.values(chartInstances).forEach(chart => {
        if (chart && chart.destroy) chart.destroy();
    });
    chartInstances = {};
    
    switch(CURRENT_TAB) {
        case 'summary': renderSummaryTab(); break;
        case 'daily': renderDailyTab(); break;
        case 'structure': renderStructureTab(); break;
        case 'quadrant': renderQuadrantTab(); break;
        case 'explorer': renderExplorerTab(); break;
        case 'methodology': renderMethodologyTab(); break;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatNumber(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return num.toLocaleString('en-US', { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
    });
}

function formatCurrency(num, compact = false) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    
    if (compact) {
        if (Math.abs(num) >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
        if (Math.abs(num) >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
        if (Math.abs(num) >= 1e3) return '$' + (num / 1e3).toFixed(0) + 'K';
    }
    return '$' + formatNumber(num);
}

function formatBps(num, showSign = false) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    const sign = showSign && num > 0 ? '+' : '';
    return sign + num.toFixed(1) + ' bps';
}

function formatPercent(num, decimals = 1) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return num.toFixed(decimals) + '%';
}

function getTimingDiff(d) {
    return USE_WINSORIZED ? d.timingDiffW : d.timingDiff;
}

function getRefGap(d) {
    return USE_WINSORIZED ? d.refGapW : d.refGap;
}

function getQuadrant(d) {
    const td = getTimingDiff(d);
    const rg = getRefGap(d);
    
    if (rg >= 0 && td >= 0) return 'Q1';
    if (rg < 0 && td >= 0) return 'Q2';
    if (rg < 0 && td < 0) return 'Q3';
    return 'Q4';
}

function getQuadrantInfo(q) {
    const info = {
        'Q1': { name: 'Momentum', color: '#34d399', desc: 'Positive gap, positive timing' },
        'Q2': { name: 'Mean Reversion', color: '#fbbf24', desc: 'Negative gap, positive timing' },
        'Q3': { name: 'Protection', color: '#f87171', desc: 'Negative gap, negative timing' },
        'Q4': { name: 'Top Tick', color: '#a78bfa', desc: 'Positive gap, negative timing' }
    };
    return info[q] || { name: 'Unknown', color: '#666', desc: '' };
}

function getValueClass(value) {
    if (value === null || value === undefined) return '';
    return value >= 0 ? 'positive' : 'negative';
}

// ============================================================================
// TAB 1: EXECUTIVE SUMMARY
// ============================================================================

function renderSummaryTab() {
    const container = document.getElementById('tab-summary');
    
    // Calculate summary stats
    const totalNotional = FILTERED_DATA.reduce((sum, d) => sum + d.notional, 0);
    const totalVolume = FILTERED_DATA.reduce((sum, d) => sum + d.volume, 0);
    const avgTimingDiff = FILTERED_DATA.reduce((sum, d) => sum + getTimingDiff(d), 0) / FILTERED_DATA.length;
    const avgRefGap = FILTERED_DATA.reduce((sum, d) => sum + getRefGap(d), 0) / FILTERED_DATA.length;
    const dirConsistencyRate = FILTERED_DATA.filter(d => d.dirConsistency).length / FILTERED_DATA.length * 100;
    const uniqueSymbols = new Set(FILTERED_DATA.map(d => d.symbol)).size;
    const dailyAvgNotional = totalNotional / META.tradingDays;
    
    container.innerHTML = `
        <!-- Hero Section -->
        <div class="hero">
            <h2>Overnight ATS <span>Market Microstructure</span> Analysis</h2>
            <p class="hero-subtitle">
                Quantitative analysis of ${formatNumber(FILTERED_DATA.length)} overnight equity trading observations 
                across ${META.tradingDays} sessions, representing ${formatCurrency(totalNotional, true)} in institutional flow.
            </p>
            <div class="hero-stats">
                <div class="hero-stat">
                    <div class="hero-stat-value">${formatCurrency(totalNotional, true)}</div>
                    <div class="hero-stat-label">Total Notional</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat-value">${formatNumber(FILTERED_DATA.length)}</div>
                    <div class="hero-stat-label">Observations</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat-value">${uniqueSymbols}</div>
                    <div class="hero-stat-label">Unique Symbols</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat-value">${formatPercent(dirConsistencyRate)}</div>
                    <div class="hero-stat-label">Price Continuity</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat-value">${formatCurrency(dailyAvgNotional, true)}</div>
                    <div class="hero-stat-label">Daily Average</div>
                </div>
            </div>
        </div>
        
        <!-- Daily Flow Charts -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Daily Trading Flow</h3>
                <span class="section-subtitle">Notional volume and share activity by session</span>
            </div>
            <div class="chart-grid">
                <div class="card">
                    <h4 class="card-title">Daily Notional & Volume</h4>
                    <div class="chart-container" id="summaryDailyChart"></div>
                </div>
                <div class="card">
                    <h4 class="card-title">Price Continuity Rate</h4>
                    <div class="chart-container" id="summaryConsistencyChart"></div>
                </div>
            </div>
        </section>
        
        <!-- Key Metrics -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Performance Metrics</h3>
            </div>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value ${getValueClass(avgTimingDiff)}">${formatBps(avgTimingDiff, true)}</div>
                    <div class="metric-label">Avg Timing Differential</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value ${getValueClass(avgRefGap)}">${formatBps(avgRefGap, true)}</div>
                    <div class="metric-label">Avg Reference Gap</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${formatNumber(totalVolume / 1e6, 1)}M</div>
                    <div class="metric-label">Total Shares</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${formatNumber(FILTERED_DATA.reduce((sum, d) => sum + d.executions, 0))}</div>
                    <div class="metric-label">Total Executions</div>
                </div>
            </div>
        </section>
        
        <!-- Asset Breakdown -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Asset Class Breakdown</h3>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Asset Type</th>
                            <th>Observations</th>
                            <th>Notional</th>
                            <th>% of Total</th>
                            <th>Avg Timing Diff</th>
                            <th>Continuity Rate</th>
                        </tr>
                    </thead>
                    <tbody id="summaryAssetTable"></tbody>
                </table>
            </div>
        </section>
        
        <!-- Position Size Tiers -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Position Size Analysis</h3>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Size Tier</th>
                            <th>Observations</th>
                            <th>Notional</th>
                            <th>% of Total</th>
                            <th>Avg Size</th>
                            <th>Continuity Rate</th>
                        </tr>
                    </thead>
                    <tbody id="summarySizeTable"></tbody>
                </table>
            </div>
            <div class="highlight-box">
                <h4>Institutional Flow Concentration</h4>
                <p id="summaryHighlight"></p>
            </div>
        </section>
        
        <!-- Disclaimer -->
        <div class="disclaimer">
            <div class="disclaimer-title">Disclaimer</div>
            <p>
                This analysis is provided for informational purposes only and represents independent market
                microstructure research prepared by Sapinover LLC. Past trading activity is not indicative of future
                liquidity or execution quality. This material does not constitute investment advice, trading
                recommendations, or solicitation to buy or sell securities. "Price Continuity" measures the rate at which
                overnight execution prices fall between the prior close and next-day open in the direction of the overnight gap.
            </p>
        </div>
    `;
    
    renderSummaryCharts();
    renderSummaryTables();
}

function renderSummaryCharts() {
    // Aggregate by date
    const dailyStats = {};
    LOOKUP.dates.forEach(d => {
        dailyStats[d] = { notional: 0, volume: 0, count: 0, consistent: 0 };
    });
    
    FILTERED_DATA.forEach(d => {
        dailyStats[d.date].notional += d.notional;
        dailyStats[d.date].volume += d.volume;
        dailyStats[d.date].count++;
        if (d.dirConsistency) dailyStats[d.date].consistent++;
    });
    
    const dates = LOOKUP.dates;
    const labels = dates.map(d => d.substring(5)); // MM-DD format
    const notionalData = dates.map(d => dailyStats[d].notional / 1e9);
    const volumeData = dates.map(d => dailyStats[d].volume / 1e6 / 25); // Scaled for visual
    const consistencyData = dates.map(d => 
        dailyStats[d].count > 0 ? (dailyStats[d].consistent / dailyStats[d].count) * 100 : 0
    );
    
    // Daily Notional & Volume Chart
    const ctx1 = document.createElement('canvas');
    document.getElementById('summaryDailyChart').appendChild(ctx1);
    
    chartInstances.dailyChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Notional ($B)',
                    data: notionalData,
                    backgroundColor: 'rgba(201, 162, 39, 0.85)',
                    borderColor: 'rgba(201, 162, 39, 1)',
                    borderWidth: 1,
                    borderRadius: 3,
                    order: 2
                },
                {
                    label: 'Volume (M÷25)',
                    data: volumeData,
                    backgroundColor: 'rgba(79, 139, 249, 0.7)',
                    borderColor: 'rgba(79, 139, 249, 1)',
                    borderWidth: 1,
                    borderRadius: 3,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#9ca3b4', boxWidth: 12, padding: 15 }
                }
            },
            scales: {
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: 'rgba(156, 163, 180, 0.1)' },
                    ticks: { color: '#6b7280' },
                    title: { display: true, text: 'Notional ($B) + Scaled Volume', color: '#6b7280' }
                },
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: '#6b7280', maxRotation: 45, font: { size: 10 } }
                }
            }
        }
    });
    
    // Price Continuity Chart
    const ctx2 = document.createElement('canvas');
    document.getElementById('summaryConsistencyChart').appendChild(ctx2);
    
    // Calculate 5-day moving average
    const ma5 = consistencyData.map((val, idx) => {
        if (idx < 4) return null;
        const sum = consistencyData.slice(idx - 4, idx + 1).reduce((a, b) => a + b, 0);
        return sum / 5;
    });
    
    chartInstances.consistencyChart = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Daily Rate',
                    data: consistencyData,
                    borderColor: '#34d399',
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#34d399'
                },
                {
                    label: '5-Day MA',
                    data: ma5,
                    borderColor: '#c9a227',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#9ca3b4', boxWidth: 12, padding: 15 }
                }
            },
            scales: {
                y: {
                    min: 50,
                    max: 100,
                    grid: { color: 'rgba(156, 163, 180, 0.1)' },
                    ticks: { color: '#6b7280', callback: v => v + '%' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#6b7280', maxRotation: 45, font: { size: 10 } }
                }
            }
        }
    });
}

function renderSummaryTables() {
    const totalNotional = FILTERED_DATA.reduce((sum, d) => sum + d.notional, 0);
    
    // Asset Type Breakdown
    const assetStats = {};
    FILTERED_DATA.forEach(d => {
        if (!assetStats[d.assetType]) {
            assetStats[d.assetType] = { count: 0, notional: 0, timingSum: 0, consistent: 0 };
        }
        assetStats[d.assetType].count++;
        assetStats[d.assetType].notional += d.notional;
        assetStats[d.assetType].timingSum += getTimingDiff(d);
        if (d.dirConsistency) assetStats[d.assetType].consistent++;
    });
    
    const assetTableBody = document.getElementById('summaryAssetTable');
    assetTableBody.innerHTML = Object.entries(assetStats)
        .sort((a, b) => b[1].notional - a[1].notional)
        .map(([type, stats]) => {
            const avgTiming = stats.timingSum / stats.count;
            const contRate = (stats.consistent / stats.count) * 100;
            return `
                <tr>
                    <td style="font-weight: 600;">${type}</td>
                    <td>${formatNumber(stats.count)}</td>
                    <td class="mono">${formatCurrency(stats.notional, true)}</td>
                    <td>${formatPercent(stats.notional / totalNotional * 100)}</td>
                    <td class="${getValueClass(avgTiming)} mono">${formatBps(avgTiming, true)}</td>
                    <td class="positive">${formatPercent(contRate)}</td>
                </tr>
            `;
        }).join('');
    
    // Position Size Tiers
    const sizeTiers = [
        { label: '≥ $10M', min: 10e6 },
        { label: '≥ $5M', min: 5e6 },
        { label: '≥ $1M', min: 1e6 },
        { label: '≥ $500K', min: 500e3 },
        { label: '≥ $100K', min: 100e3 },
        { label: '< $100K', min: 0 }
    ];
    
    const sizeTableBody = document.getElementById('summarySizeTable');
    let prevMin = Infinity;
    
    sizeTableBody.innerHTML = sizeTiers.map(tier => {
        const tierData = FILTERED_DATA.filter(d => d.notional >= tier.min && d.notional < prevMin);
        prevMin = tier.min;
        
        const tierNotional = tierData.reduce((sum, d) => sum + d.notional, 0);
        const tierConsistent = tierData.filter(d => d.dirConsistency).length;
        const avgSize = tierData.length > 0 ? tierNotional / tierData.length : 0;
        const contRate = tierData.length > 0 ? (tierConsistent / tierData.length) * 100 : 0;
        
        return `
            <tr>
                <td style="font-weight: 600;">${tier.label}</td>
                <td>${formatNumber(tierData.length)}</td>
                <td class="mono">${formatCurrency(tierNotional, true)}</td>
                <td>${formatPercent(tierNotional / totalNotional * 100)}</td>
                <td class="mono">${formatCurrency(avgSize, true)}</td>
                <td class="positive">${formatPercent(contRate)}</td>
            </tr>
        `;
    }).join('');
    
    // Highlight box
    const over1M = FILTERED_DATA.filter(d => d.notional >= 1e6);
    const over1MNotional = over1M.reduce((sum, d) => sum + d.notional, 0);
    const avgBlockSize = over1M.length > 0 ? over1MNotional / over1M.length : 0;
    
    document.getElementById('summaryHighlight').textContent = 
        `${formatPercent(over1MNotional / totalNotional * 100)} of notional derives from ${formatNumber(over1M.length)} ` +
        `observations ≥$1M with average block size of ${formatCurrency(avgBlockSize, true)}. ` +
        `Institutional-grade flow dominates overnight ATS activity.`;
}

// ============================================================================
// TAB 2: DAILY ANALYSIS
// ============================================================================

function renderDailyTab() {
    const container = document.getElementById('tab-daily');
    
    container.innerHTML = `
        <div class="date-selector">
            <label>Select Trading Date:</label>
            <select id="dailyDateSelect" onchange="updateDailyDate(this.value)">
                ${LOOKUP.dates.slice().reverse().map(d => 
                    `<option value="${d}" ${d === SELECTED_DATE ? 'selected' : ''}>${d}</option>`
                ).join('')}
            </select>
        </div>
        
        <!-- Daily Stats -->
        <div class="metrics-grid" id="dailyMetrics"></div>
        
        <!-- Daily Charts -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Daily Trends</h3>
                <span class="section-subtitle">Timing differential and notional with 5-day moving average</span>
            </div>
            <div class="chart-grid">
                <div class="card">
                    <h4 class="card-title">Timing Differential Trend</h4>
                    <div class="chart-container" id="dailyTimingChart"></div>
                </div>
                <div class="card">
                    <h4 class="card-title">Daily Notional Volume</h4>
                    <div class="chart-container" id="dailyNotionalChart"></div>
                </div>
            </div>
        </section>
        
        <!-- Sector Breakdown for Selected Date -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Sector Performance</h3>
                <span class="section-subtitle" id="dailySectorSubtitle">--</span>
            </div>
            <div class="chart-grid">
                <div class="card">
                    <h4 class="card-title">Sector Notional Distribution</h4>
                    <div class="chart-container" id="dailySectorChart"></div>
                </div>
                <div class="card">
                    <h4 class="card-title">Timing Differential Distribution</h4>
                    <div class="chart-container" id="dailyHistogram"></div>
                </div>
            </div>
        </section>
        
        <!-- Top Positions Table -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Top Positions</h3>
                <span class="section-subtitle" id="dailyTableSubtitle">--</span>
            </div>
            <div class="table-container">
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th class="sortable" onclick="sortDailyTable('symbol')">Symbol</th>
                                <th>Company</th>
                                <th>Type</th>
                                <th>Sector</th>
                                <th class="sortable" onclick="sortDailyTable('notional')">Notional</th>
                                <th class="sortable" onclick="sortDailyTable('timingDiff')">Timing Diff</th>
                                <th class="sortable" onclick="sortDailyTable('refGap')">Ref Gap</th>
                                <th>Gap Dir</th>
                                <th>Continuity</th>
                            </tr>
                        </thead>
                        <tbody id="dailyTableBody"></tbody>
                    </table>
                </div>
            </div>
        </section>
    `;
    
    updateDailyDate(SELECTED_DATE);
    renderDailyTrendCharts();
}

let dailySortColumn = 'notional';
let dailySortAsc = false;

function updateDailyDate(date) {
    SELECTED_DATE = date;
    
    const dayData = FILTERED_DATA.filter(d => d.date === date);
    
    // Update metrics
    const totalNotional = dayData.reduce((sum, d) => sum + d.notional, 0);
    const totalVolume = dayData.reduce((sum, d) => sum + d.volume, 0);
    const avgTimingDiff = dayData.length > 0 ? 
        dayData.reduce((sum, d) => sum + getTimingDiff(d), 0) / dayData.length : 0;
    const dirConsistencyRate = dayData.length > 0 ?
        dayData.filter(d => d.dirConsistency).length / dayData.length * 100 : 0;
    
    document.getElementById('dailyMetrics').innerHTML = `
        <div class="metric-card">
            <div class="metric-value">${formatCurrency(totalNotional, true)}</div>
            <div class="metric-label">Daily Notional</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${formatNumber(dayData.length)}</div>
            <div class="metric-label">Observations</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${formatNumber(totalVolume / 1e6, 1)}M</div>
            <div class="metric-label">Shares Traded</div>
        </div>
        <div class="metric-card">
            <div class="metric-value ${getValueClass(avgTimingDiff)}">${formatBps(avgTimingDiff, true)}</div>
            <div class="metric-label">Avg Timing Diff</div>
        </div>
        <div class="metric-card">
            <div class="metric-value positive">${formatPercent(dirConsistencyRate)}</div>
            <div class="metric-label">Price Continuity</div>
        </div>
    `;
    
    document.getElementById('dailySectorSubtitle').textContent = `For ${date}`;
    document.getElementById('dailyTableSubtitle').textContent = `Top 50 by notional for ${date}`;
    
    renderDailySectorChart(dayData);
    renderDailyHistogram(dayData);
    renderDailyTable(dayData);
}

function renderDailyTrendCharts() {
    // Aggregate by date
    const dailyStats = LOOKUP.dates.map(date => {
        const dayData = FILTERED_DATA.filter(d => d.date === date);
        return {
            date: date,
            notional: dayData.reduce((sum, d) => sum + d.notional, 0),
            avgTiming: dayData.length > 0 ? 
                dayData.reduce((sum, d) => sum + getTimingDiff(d), 0) / dayData.length : 0,
            count: dayData.length
        };
    });
    
    const labels = dailyStats.map(d => d.date.substring(5));
    const timingData = dailyStats.map(d => d.avgTiming);
    const notionalData = dailyStats.map(d => d.notional / 1e9);
    
    // Calculate 5-day MA
    const timingMA = timingData.map((val, idx) => {
        if (idx < 4) return null;
        return timingData.slice(idx - 4, idx + 1).reduce((a, b) => a + b, 0) / 5;
    });
    
    const notionalMA = notionalData.map((val, idx) => {
        if (idx < 4) return null;
        return notionalData.slice(idx - 4, idx + 1).reduce((a, b) => a + b, 0) / 5;
    });
    
    // Timing Differential Trend
    const ctx1 = document.createElement('canvas');
    document.getElementById('dailyTimingChart').innerHTML = '';
    document.getElementById('dailyTimingChart').appendChild(ctx1);
    
    chartInstances.dailyTimingChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Daily Avg',
                    data: timingData,
                    backgroundColor: timingData.map(v => v >= 0 ? 'rgba(52, 211, 153, 0.7)' : 'rgba(248, 113, 113, 0.7)'),
                    borderColor: timingData.map(v => v >= 0 ? '#34d399' : '#f87171'),
                    borderWidth: 1,
                    borderRadius: 3
                },
                {
                    type: 'line',
                    label: '5-Day MA',
                    data: timingMA,
                    borderColor: '#c9a227',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { color: '#9ca3b4', boxWidth: 12 } }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(156, 163, 180, 0.1)' },
                    ticks: { color: '#6b7280', callback: v => v + ' bps' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#6b7280', maxRotation: 45, font: { size: 10 } }
                }
            }
        }
    });
    
    // Notional Volume Trend
    const ctx2 = document.createElement('canvas');
    document.getElementById('dailyNotionalChart').innerHTML = '';
    document.getElementById('dailyNotionalChart').appendChild(ctx2);
    
    chartInstances.dailyNotionalChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Daily Notional',
                    data: notionalData,
                    backgroundColor: 'rgba(201, 162, 39, 0.7)',
                    borderColor: '#c9a227',
                    borderWidth: 1,
                    borderRadius: 3
                },
                {
                    type: 'line',
                    label: '5-Day MA',
                    data: notionalMA,
                    borderColor: '#4f8bf9',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { color: '#9ca3b4', boxWidth: 12 } }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(156, 163, 180, 0.1)' },
                    ticks: { color: '#6b7280', callback: v => '$' + v + 'B' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#6b7280', maxRotation: 45, font: { size: 10 } }
                }
            }
        }
    });
}

function renderDailySectorChart(dayData) {
    const sectorStats = {};
    dayData.forEach(d => {
        const sector = d.sector.length > 20 ? d.sector.substring(0, 20) + '...' : d.sector;
        if (!sectorStats[sector]) sectorStats[sector] = 0;
        sectorStats[sector] += d.notional;
    });
    
    const sorted = Object.entries(sectorStats).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    const ctx = document.createElement('canvas');
    document.getElementById('dailySectorChart').innerHTML = '';
    document.getElementById('dailySectorChart').appendChild(ctx);
    
    chartInstances.dailySectorChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(s => s[0]),
            datasets: [{
                data: sorted.map(s => s[1] / 1e6),
                backgroundColor: 'rgba(201, 162, 39, 0.7)',
                borderColor: '#c9a227',
                borderWidth: 1,
                borderRadius: 3
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { color: 'rgba(156, 163, 180, 0.1)' },
                    ticks: { color: '#6b7280', callback: v => '$' + v + 'M' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#9ca3b4', font: { size: 11 } }
                }
            }
        }
    });
}

function renderDailyHistogram(dayData) {
    const timingVals = dayData.map(d => getTimingDiff(d));
    
    // Create bins
    const binSize = 50;
    const min = Math.floor(Math.min(...timingVals) / binSize) * binSize;
    const max = Math.ceil(Math.max(...timingVals) / binSize) * binSize;
    
    const bins = {};
    for (let i = min; i <= max; i += binSize) {
        bins[i] = 0;
    }
    
    timingVals.forEach(v => {
        const bin = Math.floor(v / binSize) * binSize;
        if (bins[bin] !== undefined) bins[bin]++;
    });
    
    const ctx = document.createElement('canvas');
    document.getElementById('dailyHistogram').innerHTML = '';
    document.getElementById('dailyHistogram').appendChild(ctx);
    
    const binLabels = Object.keys(bins).map(Number).sort((a, b) => a - b);
    
    chartInstances.dailyHistogram = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels.map(b => b + ' bps'),
            datasets: [{
                data: binLabels.map(b => bins[b]),
                backgroundColor: binLabels.map(b => b >= 0 ? 'rgba(52, 211, 153, 0.7)' : 'rgba(248, 113, 113, 0.7)'),
                borderColor: binLabels.map(b => b >= 0 ? '#34d399' : '#f87171'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    grid: { color: 'rgba(156, 163, 180, 0.1)' },
                    ticks: { color: '#6b7280' },
                    title: { display: true, text: 'Observations', color: '#6b7280' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#6b7280', maxRotation: 45, font: { size: 9 } }
                }
            }
        }
    });
}

function renderDailyTable(dayData) {
    // Sort
    let sorted = [...dayData];
    sorted.sort((a, b) => {
        let aVal, bVal;
        switch(dailySortColumn) {
            case 'symbol': aVal = a.symbol; bVal = b.symbol; break;
            case 'notional': aVal = a.notional; bVal = b.notional; break;
            case 'timingDiff': aVal = getTimingDiff(a); bVal = getTimingDiff(b); break;
            case 'refGap': aVal = getRefGap(a); bVal = getRefGap(b); break;
            default: aVal = a.notional; bVal = b.notional;
        }
        if (typeof aVal === 'string') {
            return dailySortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return dailySortAsc ? aVal - bVal : bVal - aVal;
    });
    
    sorted = sorted.slice(0, 50);
    
    const tbody = document.getElementById('dailyTableBody');
    tbody.innerHTML = sorted.map(d => `
        <tr onclick="showPositionModal('${d.symbol}', '${d.date}')">
            <td class="symbol">${d.symbol}</td>
            <td class="company" title="${d.company}">${d.company.substring(0, 25)}</td>
            <td>${d.assetType}</td>
            <td class="muted">${d.sector.substring(0, 15)}</td>
            <td class="mono">${formatCurrency(d.notional, true)}</td>
            <td class="mono ${getValueClass(getTimingDiff(d))}">${formatBps(getTimingDiff(d), true)}</td>
            <td class="mono ${getValueClass(getRefGap(d))}">${formatBps(getRefGap(d), true)}</td>
            <td>${d.gapDirection}</td>
            <td>${d.dirConsistency ? '<span class="positive">✓</span>' : '<span class="negative">✗</span>'}</td>
        </tr>
    `).join('');
}

function sortDailyTable(column) {
    if (dailySortColumn === column) {
        dailySortAsc = !dailySortAsc;
    } else {
        dailySortColumn = column;
        dailySortAsc = false;
    }
    
    const dayData = FILTERED_DATA.filter(d => d.date === SELECTED_DATE);
    renderDailyTable(dayData);
}

// ============================================================================
// TAB 3: MARKET STRUCTURE
// ============================================================================

function renderStructureTab() {
    const container = document.getElementById('tab-structure');
    
    container.innerHTML = `
        <!-- Asset Type Distribution -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Asset Type Distribution</h3>
            </div>
            <div class="chart-grid">
                <div class="card">
                    <h4 class="card-title">Notional by Asset Type</h4>
                    <div class="chart-container" id="structureAssetChart"></div>
                </div>
                <div class="card">
                    <h4 class="card-title">Observation Count by Asset Type</h4>
                    <div class="chart-container" id="structureAssetCountChart"></div>
                </div>
            </div>
        </section>
        
        <!-- Sector Breakdown -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Sector Analysis</h3>
                <span class="section-subtitle">Top 15 sectors by notional</span>
            </div>
            <div class="chart-grid single">
                <div class="card">
                    <div class="chart-container large" id="structureSectorChart"></div>
                </div>
            </div>
        </section>
        
        <!-- Leverage Analysis (ETFs) -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">ETF Leverage Analysis</h3>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Leverage Multiple</th>
                            <th>Observations</th>
                            <th>Notional</th>
                            <th>Avg Timing Diff</th>
                            <th>Avg Ref Gap</th>
                            <th>Continuity Rate</th>
                        </tr>
                    </thead>
                    <tbody id="structureLeverageTable"></tbody>
                </table>
            </div>
        </section>
        
        <!-- Sector Performance Table -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Sector Performance Comparison</h3>
            </div>
            <div class="table-container">
                <div class="table-scroll" style="max-height: 400px;">
                    <table>
                        <thead>
                            <tr>
                                <th>Sector</th>
                                <th>Observations</th>
                                <th>Notional</th>
                                <th>Avg Timing Diff</th>
                                <th>Continuity Rate</th>
                            </tr>
                        </thead>
                        <tbody id="structureSectorTable"></tbody>
                    </table>
                </div>
            </div>
        </section>
    `;
    
    renderStructureCharts();
    renderStructureTables();
}

function renderStructureCharts() {
    // Asset Type pie charts
    const stockData = FILTERED_DATA.filter(d => d.assetType === 'Stock');
    const etfData = FILTERED_DATA.filter(d => d.assetType === 'ETF');
    
    const stockNotional = stockData.reduce((sum, d) => sum + d.notional, 0);
    const etfNotional = etfData.reduce((sum, d) => sum + d.notional, 0);
    
    // Notional pie
    const ctx1 = document.createElement('canvas');
    document.getElementById('structureAssetChart').appendChild(ctx1);
    
    chartInstances.assetPie1 = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['Stocks', 'ETFs'],
            datasets: [{
                data: [stockNotional, etfNotional],
                backgroundColor: ['#34d399', '#c9a227'],
                borderColor: ['#059669', '#a68b1f'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3b4', padding: 20 }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const total = stockNotional + etfNotional;
                            const pct = (ctx.raw / total * 100).toFixed(1);
                            return `${ctx.label}: ${formatCurrency(ctx.raw, true)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Count pie
    const ctx2 = document.createElement('canvas');
    document.getElementById('structureAssetCountChart').appendChild(ctx2);
    
    chartInstances.assetPie2 = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Stocks', 'ETFs'],
            datasets: [{
                data: [stockData.length, etfData.length],
                backgroundColor: ['#34d399', '#c9a227'],
                borderColor: ['#059669', '#a68b1f'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3b4', padding: 20 }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const total = stockData.length + etfData.length;
                            const pct = (ctx.raw / total * 100).toFixed(1);
                            return `${ctx.label}: ${formatNumber(ctx.raw)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Sector horizontal bar
    const sectorStats = {};
    FILTERED_DATA.forEach(d => {
        if (!sectorStats[d.sector]) {
            sectorStats[d.sector] = { notional: 0, count: 0, timingSum: 0 };
        }
        sectorStats[d.sector].notional += d.notional;
        sectorStats[d.sector].count++;
        sectorStats[d.sector].timingSum += getTimingDiff(d);
    });
    
    const topSectors = Object.entries(sectorStats)
        .sort((a, b) => b[1].notional - a[1].notional)
        .slice(0, 15);
    
    const ctx3 = document.createElement('canvas');
    document.getElementById('structureSectorChart').appendChild(ctx3);
    
    chartInstances.sectorBar = new Chart(ctx3, {
        type: 'bar',
        data: {
            labels: topSectors.map(s => s[0].length > 25 ? s[0].substring(0, 25) + '...' : s[0]),
            datasets: [{
                label: 'Notional ($M)',
                data: topSectors.map(s => s[1].notional / 1e6),
                backgroundColor: 'rgba(201, 162, 39, 0.7)',
                borderColor: '#c9a227',
                borderWidth: 1,
                borderRadius: 3
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(156, 163, 180, 0.1)' },
                    ticks: { color: '#6b7280', callback: v => '$' + v + 'M' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#9ca3b4', font: { size: 11 } }
                }
            }
        }
    });
}

function renderStructureTables() {
    // Leverage Analysis
    const etfData = FILTERED_DATA.filter(d => d.assetType === 'ETF');
    const leverageStats = {};
    
    etfData.forEach(d => {
        const lev = d.leverageMult || '1x';
        if (!leverageStats[lev]) {
            leverageStats[lev] = { count: 0, notional: 0, timingSum: 0, refGapSum: 0, consistent: 0 };
        }
        leverageStats[lev].count++;
        leverageStats[lev].notional += d.notional;
        leverageStats[lev].timingSum += getTimingDiff(d);
        leverageStats[lev].refGapSum += getRefGap(d);
        if (d.dirConsistency) leverageStats[lev].consistent++;
    });
    
    const leverageOrder = ['-3x', '-2x', '-1x', '1x', '2x', '3x'];
    const sortedLeverage = Object.entries(leverageStats).sort((a, b) => {
        const aIdx = leverageOrder.indexOf(a[0]);
        const bIdx = leverageOrder.indexOf(b[0]);
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });
    
    document.getElementById('structureLeverageTable').innerHTML = sortedLeverage.map(([lev, stats]) => {
        const avgTiming = stats.timingSum / stats.count;
        const avgRefGap = stats.refGapSum / stats.count;
        const contRate = stats.consistent / stats.count * 100;
        return `
            <tr>
                <td style="font-weight: 600;">${lev}</td>
                <td>${formatNumber(stats.count)}</td>
                <td class="mono">${formatCurrency(stats.notional, true)}</td>
                <td class="mono ${getValueClass(avgTiming)}">${formatBps(avgTiming, true)}</td>
                <td class="mono ${getValueClass(avgRefGap)}">${formatBps(avgRefGap, true)}</td>
                <td class="positive">${formatPercent(contRate)}</td>
            </tr>
        `;
    }).join('');
    
    // Sector Performance Table
    const sectorStats = {};
    FILTERED_DATA.forEach(d => {
        if (!sectorStats[d.sector]) {
            sectorStats[d.sector] = { count: 0, notional: 0, timingSum: 0, consistent: 0 };
        }
        sectorStats[d.sector].count++;
        sectorStats[d.sector].notional += d.notional;
        sectorStats[d.sector].timingSum += getTimingDiff(d);
        if (d.dirConsistency) sectorStats[d.sector].consistent++;
    });
    
    const sortedSectors = Object.entries(sectorStats).sort((a, b) => b[1].notional - a[1].notional);
    
    document.getElementById('structureSectorTable').innerHTML = sortedSectors.map(([sector, stats]) => {
        const avgTiming = stats.timingSum / stats.count;
        const contRate = stats.consistent / stats.count * 100;
        return `
            <tr>
                <td style="font-weight: 500;">${sector.substring(0, 30)}</td>
                <td>${formatNumber(stats.count)}</td>
                <td class="mono">${formatCurrency(stats.notional, true)}</td>
                <td class="mono ${getValueClass(avgTiming)}">${formatBps(avgTiming, true)}</td>
                <td class="positive">${formatPercent(contRate)}</td>
            </tr>
        `;
    }).join('');
}

// ============================================================================
// TAB 4: QUADRANT ANALYSIS
// ============================================================================

function renderQuadrantTab() {
    const container = document.getElementById('tab-quadrant');
    
    // Calculate quadrant stats
    const quadrants = { Q1: [], Q2: [], Q3: [], Q4: [] };
    FILTERED_DATA.forEach(d => {
        quadrants[getQuadrant(d)].push(d);
    });
    
    container.innerHTML = `
        <!-- Quadrant Counts -->
        <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr);">
            ${['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
                const info = getQuadrantInfo(q);
                return `
                    <div class="metric-card">
                        <div class="metric-value" style="color: ${info.color};">${formatNumber(quadrants[q].length)}</div>
                        <div class="metric-label">${q}: ${info.name}</div>
                    </div>
                `;
            }).join('')}
        </div>
        
        <!-- Quadrant Scatter Plot -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Quadrant Analysis</h3>
                <span class="section-subtitle">Timing Differential vs Reference Gap ${USE_WINSORIZED ? '(Winsorized)' : '(Full Range)'}</span>
            </div>
            <div class="card">
                <div id="quadrantScatter" style="height: 500px;"></div>
                <div class="legend">
                    <div class="legend-item"><div class="legend-dot" style="background: #34d399;"></div> Q1: Momentum</div>
                    <div class="legend-item"><div class="legend-dot" style="background: #fbbf24;"></div> Q2: Mean Reversion</div>
                    <div class="legend-item"><div class="legend-dot" style="background: #f87171;"></div> Q3: Protection</div>
                    <div class="legend-item"><div class="legend-dot" style="background: #a78bfa;"></div> Q4: Top Tick</div>
                </div>
            </div>
        </section>
        
        <!-- Quadrant Performance Table -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Quadrant Performance Summary</h3>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Quadrant</th>
                            <th>Description</th>
                            <th>Observations</th>
                            <th>Notional</th>
                            <th>Avg Timing Diff</th>
                            <th>Avg Ref Gap</th>
                            <th>Continuity Rate</th>
                        </tr>
                    </thead>
                    <tbody id="quadrantSummaryTable"></tbody>
                </table>
            </div>
        </section>
        
        <!-- Top Positions by Quadrant -->
        <section class="section">
            <div class="section-header">
                <div class="section-marker"></div>
                <h3 class="section-title">Position-Level Analysis</h3>
                <span class="section-subtitle">Top 100 positions by absolute timing differential</span>
            </div>
            <div class="table-container">
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Symbol</th>
                                <th>Company</th>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Notional</th>
                                <th>Timing Diff</th>
                                <th>Ref Gap</th>
                                <th>VS Open</th>
                                <th>VS Close</th>
                                <th>Quadrant</th>
                                <th>Dir</th>
                            </tr>
                        </thead>
                        <tbody id="quadrantPositionTable"></tbody>
                    </table>
                </div>
            </div>
        </section>
    `;
    
    renderQuadrantScatter();
    renderQuadrantTables(quadrants);
}

function renderQuadrantScatter() {
    const traces = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
        const info = getQuadrantInfo(q);
        const quadData = FILTERED_DATA.filter(d => getQuadrant(d) === q);
        
        return {
            x: quadData.map(d => getRefGap(d)),
            y: quadData.map(d => getTimingDiff(d)),
            mode: 'markers',
            type: 'scatter',
            name: `${q}: ${info.name}`,
            marker: {
                color: info.color,
                size: quadData.map(d => Math.sqrt(d.notional / 1e6) * 3 + 4),
                opacity: 0.6,
                line: { color: 'rgba(255,255,255,0.3)', width: 1 }
            },
            text: quadData.map(d => 
                `<b>${d.symbol}</b><br>${d.company.substring(0, 30)}<br>` +
                `Notional: ${formatCurrency(d.notional, true)}<br>` +
                `Timing: ${formatBps(getTimingDiff(d), true)}<br>` +
                `Ref Gap: ${formatBps(getRefGap(d), true)}<br>` +
                `Date: ${d.date}`
            ),
            hovertemplate: '%{text}<extra></extra>',
            customdata: quadData.map(d => ({ symbol: d.symbol, date: d.date }))
        };
    });
    
    const layout = {
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { family: 'Inter, sans-serif', color: '#9ca3b4' },
        xaxis: {
            title: { text: 'Reference Gap (bps)', font: { size: 12 } },
            zeroline: true,
            zerolinewidth: 2,
            zerolinecolor: 'rgba(201, 162, 39, 0.5)',
            gridcolor: 'rgba(156, 163, 180, 0.1)',
            tickfont: { size: 10 }
        },
        yaxis: {
            title: { text: 'Timing Differential (bps)', font: { size: 12 } },
            zeroline: true,
            zerolinewidth: 2,
            zerolinecolor: 'rgba(201, 162, 39, 0.5)',
            gridcolor: 'rgba(156, 163, 180, 0.1)',
            tickfont: { size: 10 }
        },
        showlegend: false,
        hovermode: 'closest',
        margin: { t: 20, r: 20, b: 50, l: 60 }
    };
    
    Plotly.newPlot('quadrantScatter', traces, layout, { responsive: true });
    
    // Add click handler
    document.getElementById('quadrantScatter').on('plotly_click', function(data) {
        const point = data.points[0];
        if (point.customdata) {
            showPositionModal(point.customdata.symbol, point.customdata.date);
        }
    });
}

function renderQuadrantTables(quadrants) {
    // Summary table
    const summaryBody = document.getElementById('quadrantSummaryTable');
    summaryBody.innerHTML = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
        const info = getQuadrantInfo(q);
        const data = quadrants[q];
        const notional = data.reduce((sum, d) => sum + d.notional, 0);
        const avgTiming = data.length > 0 ? data.reduce((sum, d) => sum + getTimingDiff(d), 0) / data.length : 0;
        const avgRefGap = data.length > 0 ? data.reduce((sum, d) => sum + getRefGap(d), 0) / data.length : 0;
        const contRate = data.length > 0 ? data.filter(d => d.dirConsistency).length / data.length * 100 : 0;
        
        return `
            <tr>
                <td><span class="quad-badge ${q.toLowerCase()}">${q}</span></td>
                <td style="color: ${info.color};">${info.name}</td>
                <td>${formatNumber(data.length)}</td>
                <td class="mono">${formatCurrency(notional, true)}</td>
                <td class="mono ${getValueClass(avgTiming)}">${formatBps(avgTiming, true)}</td>
                <td class="mono ${getValueClass(avgRefGap)}">${formatBps(avgRefGap, true)}</td>
                <td>${formatPercent(contRate)}</td>
            </tr>
        `;
    }).join('');
    
    // Position table - top 100 by absolute timing diff
    const sorted = [...FILTERED_DATA]
        .sort((a, b) => Math.abs(getTimingDiff(b)) - Math.abs(getTimingDiff(a)))
        .slice(0, 100);
    
    const positionBody = document.getElementById('quadrantPositionTable');
    positionBody.innerHTML = sorted.map(d => {
        const q = getQuadrant(d);
        const vsOpen = d.vwap && d.nextOpen ? ((d.nextOpen - d.vwap) / d.vwap) * 10000 : null;
        const vsClose = d.vwap && d.nextClose ? ((d.nextClose - d.vwap) / d.vwap) * 10000 : null;
        
        return `
            <tr onclick="showPositionModal('${d.symbol}', '${d.date}')">
                <td class="symbol">${d.symbol}</td>
                <td class="company" title="${d.company}">${d.company.substring(0, 20)}</td>
                <td class="muted">${d.date.substring(5)}</td>
                <td>${d.assetType}</td>
                <td class="mono">${formatCurrency(d.notional, true)}</td>
                <td class="mono ${getValueClass(getTimingDiff(d))}">${formatBps(getTimingDiff(d), true)}</td>
                <td class="mono ${getValueClass(getRefGap(d))}">${formatBps(getRefGap(d), true)}</td>
                <td class="mono ${getValueClass(vsOpen)}">${vsOpen !== null ? formatBps(vsOpen, true) : '-'}</td>
                <td class="mono ${getValueClass(vsClose)}">${vsClose !== null ? formatBps(vsClose, true) : '-'}</td>
                <td><span class="quad-badge ${q.toLowerCase()}">${q}</span></td>
                <td>${d.dirConsistency ? '<span class="positive">✓</span>' : '<span class="negative">✗</span>'}</td>
            </tr>
        `;
    }).join('');
}

// ============================================================================
// TAB 5: DATA EXPLORER
// ============================================================================

function renderExplorerTab() {
    const container = document.getElementById('tab-explorer');
    
    container.innerHTML = `
        <!-- Explorer Filters -->
        <div class="filter-panel">
            <div class="filter-group">
                <label>Symbol Search</label>
                <input type="text" id="explorerSymbol" placeholder="Enter symbol..." 
                    oninput="updateExplorerFilters()">
            </div>
            <div class="filter-group">
                <label>Gap Direction</label>
                <select id="explorerGapDir" onchange="updateExplorerFilters()">
                    <option value="all">All</option>
                    <option value="UP">Gap Up</option>
                    <option value="DOWN">Gap Down</option>
                </select>
            </div>
            <div class="filter-group" style="align-self: flex-end;">
                <button class="btn-export" onclick="exportExplorerCSV()">
                    <i class="fas fa-download"></i> Export CSV
                </button>
            </div>
        </div>
        
        <div class="result-count" id="explorerResultCount">--</div>
        
        <div class="table-container">
            <div class="table-scroll" style="max-height: 600px;">
                <table>
                    <thead>
                        <tr>
                            <th class="sortable" onclick="sortExplorer('symbol')">Symbol</th>
                            <th>Company</th>
                            <th class="sortable" onclick="sortExplorer('date')">Date</th>
                            <th>Type</th>
                            <th>Sector</th>
                            <th class="sortable" onclick="sortExplorer('notional')">Notional</th>
                            <th class="sortable" onclick="sortExplorer('timingDiff')">Timing Diff</th>
                            <th class="sortable" onclick="sortExplorer('refGap')">Ref Gap</th>
                            <th>Gap Dir</th>
                            <th>Dir</th>
                        </tr>
                    </thead>
                    <tbody id="explorerTableBody"></tbody>
                </table>
            </div>
            <div class="pagination" id="explorerPagination"></div>
        </div>
    `;
    
    renderExplorerTable();
}

function updateExplorerFilters() {
    EXPLORER_FILTERS.symbol = document.getElementById('explorerSymbol').value.toUpperCase();
    EXPLORER_FILTERS.gapDirection = document.getElementById('explorerGapDir').value;
    EXPLORER_PAGE = 1;
    renderExplorerTable();
}

function getFilteredExplorerData() {
    return FILTERED_DATA.filter(d => {
        if (EXPLORER_FILTERS.symbol && !d.symbol.includes(EXPLORER_FILTERS.symbol)) return false;
        if (EXPLORER_FILTERS.gapDirection !== 'all' && d.gapDirection !== EXPLORER_FILTERS.gapDirection) return false;
        return true;
    });
}

function renderExplorerTable() {
    let data = getFilteredExplorerData();
    
    // Sort
    data.sort((a, b) => {
        let aVal, bVal;
        switch(EXPLORER_SORT.column) {
            case 'symbol': aVal = a.symbol; bVal = b.symbol; break;
            case 'date': aVal = a.date; bVal = b.date; break;
            case 'notional': aVal = a.notional; bVal = b.notional; break;
            case 'timingDiff': aVal = getTimingDiff(a); bVal = getTimingDiff(b); break;
            case 'refGap': aVal = getRefGap(a); bVal = getRefGap(b); break;
            default: aVal = a.notional; bVal = b.notional;
        }
        if (typeof aVal === 'string') {
            return EXPLORER_SORT.ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return EXPLORER_SORT.ascending ? aVal - bVal : bVal - aVal;
    });
    
    // Paginate
    const totalPages = Math.ceil(data.length / ROWS_PER_PAGE);
    const start = (EXPLORER_PAGE - 1) * ROWS_PER_PAGE;
    const pageData = data.slice(start, start + ROWS_PER_PAGE);
    
    // Update result count
    document.getElementById('explorerResultCount').innerHTML = 
        `Showing <strong>${start + 1}-${Math.min(start + ROWS_PER_PAGE, data.length)}</strong> of <strong>${formatNumber(data.length)}</strong> observations`;
    
    // Render table
    const tbody = document.getElementById('explorerTableBody');
    tbody.innerHTML = pageData.map(d => `
        <tr onclick="showPositionModal('${d.symbol}', '${d.date}')">
            <td class="symbol">${d.symbol}</td>
            <td class="company" title="${d.company}">${d.company.substring(0, 25)}</td>
            <td class="muted">${d.date}</td>
            <td>${d.assetType}</td>
            <td class="muted">${d.sector.substring(0, 15)}</td>
            <td class="mono">${formatCurrency(d.notional, true)}</td>
            <td class="mono ${getValueClass(getTimingDiff(d))}">${formatBps(getTimingDiff(d), true)}</td>
            <td class="mono ${getValueClass(getRefGap(d))}">${formatBps(getRefGap(d), true)}</td>
            <td>${d.gapDirection}</td>
            <td>${d.dirConsistency ? '<span class="positive">✓</span>' : '<span class="negative">✗</span>'}</td>
        </tr>
    `).join('');
    
    // Render pagination
    const paginationDiv = document.getElementById('explorerPagination');
    paginationDiv.innerHTML = `
        <button onclick="explorerPage(1)" ${EXPLORER_PAGE === 1 ? 'disabled' : ''}>First</button>
        <button onclick="explorerPage(${EXPLORER_PAGE - 1})" ${EXPLORER_PAGE === 1 ? 'disabled' : ''}>Prev</button>
        <span>Page ${EXPLORER_PAGE} of ${totalPages}</span>
        <button onclick="explorerPage(${EXPLORER_PAGE + 1})" ${EXPLORER_PAGE === totalPages ? 'disabled' : ''}>Next</button>
        <button onclick="explorerPage(${totalPages})" ${EXPLORER_PAGE === totalPages ? 'disabled' : ''}>Last</button>
    `;
    
    // Update sort indicators
    document.querySelectorAll('#tab-explorer th.sortable').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
    });
    const sortedTh = document.querySelector(`#tab-explorer th[onclick="sortExplorer('${EXPLORER_SORT.column}')"]`);
    if (sortedTh) {
        sortedTh.classList.add(EXPLORER_SORT.ascending ? 'sorted-asc' : 'sorted-desc');
    }
}

function sortExplorer(column) {
    if (EXPLORER_SORT.column === column) {
        EXPLORER_SORT.ascending = !EXPLORER_SORT.ascending;
    } else {
        EXPLORER_SORT.column = column;
        EXPLORER_SORT.ascending = column === 'symbol' || column === 'date';
    }
    renderExplorerTable();
}

function explorerPage(page) {
    EXPLORER_PAGE = page;
    renderExplorerTable();
}

function exportExplorerCSV() {
    const data = getFilteredExplorerData();
    
    const headers = ['Symbol', 'Company', 'Date', 'Asset Type', 'Sector', 'Notional', 
        'Timing Differential (bps)', 'Reference Gap (bps)', 'Gap Direction', 'Directional Consistency'];
    
    const rows = data.map(d => [
        d.symbol,
        `"${d.company.replace(/"/g, '""')}"`,
        d.date,
        d.assetType,
        `"${d.sector.replace(/"/g, '""')}"`,
        d.notional.toFixed(2),
        getTimingDiff(d).toFixed(2),
        getRefGap(d).toFixed(2),
        d.gapDirection,
        d.dirConsistency ? 'Yes' : 'No'
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sapinover_overnight_data_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================================
// TAB 6: METHODOLOGY
// ============================================================================

function renderMethodologyTab() {
    const container = document.getElementById('tab-methodology');
    
    container.innerHTML = `
        <div class="methodology-content">
            <h3>Research Framework</h3>
            <p>
                This analysis follows the overnight equity return decomposition framework established by 
                Lou, Polk & Skouras (2019) in "A Tug of War: Overnight Versus Intraday Expected Returns" 
                published in the <em>Journal of Financial Economics</em>.
            </p>
            
            <h3>Key Metrics</h3>
            
            <p><strong>Reference Gap (bps)</strong></p>
            <p>
                The price movement from prior market close to overnight VWAP, representing the 
                portion of the overnight gap captured at execution:
            </p>
            <div class="formula-box">
                Reference Gap = ((VWAP - Prior Close) / Prior Close) × 10,000
            </div>
            
            <p><strong>Timing Differential (bps)</strong></p>
            <p>
                The price movement from overnight VWAP to next-day market open, representing 
                execution timing relative to the opening auction:
            </p>
            <div class="formula-box">
                Timing Differential = ((Next Open - VWAP) / VWAP) × 10,000
            </div>
            
            <p><strong>Total Overnight Gap (bps)</strong></p>
            <p>
                The complete overnight price movement from prior close to next-day open:
            </p>
            <div class="formula-box">
                Total Gap = ((Next Open - Prior Close) / Prior Close) × 10,000
            </div>
            
            <p><strong>Price Continuity Rate</strong></p>
            <p>
                The percentage of observations where the overnight execution price (VWAP) falls 
                between the prior close and next-day open in the direction of the overnight gap. 
                This measures execution quality relative to the overnight drift.
            </p>
            
            <h3>Quadrant Classification</h3>
            <ul>
                <li><strong>Q1 (Momentum):</strong> Positive Reference Gap, Positive Timing Differential</li>
                <li><strong>Q2 (Mean Reversion):</strong> Negative Reference Gap, Positive Timing Differential</li>
                <li><strong>Q3 (Protection):</strong> Negative Reference Gap, Negative Timing Differential</li>
                <li><strong>Q4 (Top Tick):</strong> Positive Reference Gap, Negative Timing Differential</li>
            </ul>
            
            <h3>Data Processing</h3>
            <p>
                Observations are filtered to institutional-scale positions (≥$50K notional). 
                ETF classifications are derived from category patterns. Sectors for stocks 
                are sourced from market data providers; ETFs display their category classification 
                instead.
            </p>
            
            <p><strong>Winsorization</strong></p>
            <p>
                To prevent extreme outliers from distorting visualizations, metrics are winsorized 
                at the 1st and 99th percentiles for chart display. The current bounds are:
            </p>
            <ul>
                <li>Timing Differential: ${formatBps(META.winsor.td[0])} to ${formatBps(META.winsor.td[1])}</li>
                <li>Reference Gap: ${formatBps(META.winsor.rg[0])} to ${formatBps(META.winsor.rg[1])}</li>
            </ul>
            <p>
                True (non-winsorized) values are always displayed in tables and position details. 
                Use the "Full Range" toggle to view charts with complete data distribution.
            </p>
            
            <h3>Data Sources</h3>
            <ul>
                <li>Overnight trading data: BlueOcean ATS Market Data Statistics</li>
                <li>Market reference prices: Public market data via financial APIs</li>
                <li>Symbol classifications: Pattern detection and market data enrichment</li>
            </ul>
        </div>
        
        <div class="disclaimer">
            <div class="disclaimer-title">Disclaimer</div>
            <p>
                This analysis is provided for informational purposes only and represents independent 
                market microstructure research prepared by Sapinover LLC. Past trading activity is not 
                indicative of future liquidity or execution quality. This material does not constitute 
                investment advice, trading recommendations, or solicitation to buy or sell securities. 
                All analysis uses publicly available data and academically established methodologies.
            </p>
        </div>
    `;
}

// ============================================================================
// MODAL FUNCTIONALITY
// ============================================================================

function showPositionModal(symbol, date) {
    const d = FILTERED_DATA.find(row => row.symbol === symbol && row.date === date);
    if (!d) return;
    
    const q = getQuadrant(d);
    const qInfo = getQuadrantInfo(q);
    
    const vsOpen = d.vwap && d.nextOpen ? ((d.nextOpen - d.vwap) / d.vwap) * 10000 : null;
    const vsClose = d.vwap && d.nextClose ? ((d.nextClose - d.vwap) / d.vwap) * 10000 : null;
    
    document.getElementById('modalSymbol').textContent = d.symbol;
    document.getElementById('modalCompany').textContent = d.company;
    
    document.getElementById('modalBody').innerHTML = `
        <div class="modal-grid">
            <div class="modal-stat">
                <strong>Notional</strong>
                <div class="val">${formatCurrency(d.notional, true)}</div>
            </div>
            <div class="modal-stat">
                <strong>Volume</strong>
                <div class="val">${formatNumber(d.volume)}</div>
            </div>
            <div class="modal-stat">
                <strong>Executions</strong>
                <div class="val">${formatNumber(d.executions)}</div>
            </div>
            <div class="modal-stat">
                <strong>Timing Diff</strong>
                <div class="val ${getValueClass(d.timingDiff)}">${formatBps(d.timingDiff, true)}</div>
            </div>
            <div class="modal-stat">
                <strong>Reference Gap</strong>
                <div class="val ${getValueClass(d.refGap)}">${formatBps(d.refGap, true)}</div>
            </div>
            <div class="modal-stat">
                <strong>Quadrant</strong>
                <div class="val" style="color: ${qInfo.color};">${q}: ${qInfo.name}</div>
            </div>
        </div>
        
        <div class="modal-section">
            <h4>Pricing Data</h4>
            <div class="modal-section-grid">
                <span><strong>Prior Close:</strong> ${d.priorClose ? '$' + d.priorClose.toFixed(2) : '-'}</span>
                <span><strong>VWAP:</strong> ${d.vwap ? '$' + d.vwap.toFixed(4) : '-'}</span>
                <span><strong>Next Open:</strong> ${d.nextOpen ? '$' + d.nextOpen.toFixed(2) : '-'}</span>
                <span><strong>Next Close:</strong> ${d.nextClose ? '$' + d.nextClose.toFixed(2) : '-'}</span>
            </div>
        </div>
        
        <div class="modal-section">
            <h4>Performance Metrics</h4>
            <div class="modal-section-grid">
                <span><strong>Total Overnight Gap:</strong> <span class="${getValueClass(d.totalGap)}">${formatBps(d.totalGap, true)}</span></span>
                <span><strong>Gap Direction:</strong> ${d.gapDirection}</span>
                <span><strong>VS Next Open:</strong> <span class="${getValueClass(vsOpen)}">${vsOpen !== null ? formatBps(vsOpen, true) : '-'}</span></span>
                <span><strong>VS Next Close:</strong> <span class="${getValueClass(vsClose)}">${vsClose !== null ? formatBps(vsClose, true) : '-'}</span></span>
                <span><strong>Price Continuity:</strong> ${d.dirConsistency ? '<span class="positive">✓ Yes</span>' : '<span class="negative">✗ No</span>'}</span>
                <span><strong>Outlier Flag:</strong> ${d.isOutlier ? '<span class="negative">Yes</span>' : 'No'}</span>
            </div>
        </div>
        
        <div class="modal-section">
            <h4>Position Details</h4>
            <div class="modal-section-grid">
                <span><strong>Asset Type:</strong> ${d.assetType}</span>
                <span><strong>Sector:</strong> ${d.sector}</span>
                <span><strong>Trade Date:</strong> ${d.date}</span>
                <span><strong>Leverage:</strong> ${d.leverageMult}</span>
                ${d.marketCap ? `<span><strong>Market Cap:</strong> $${d.marketCap.toFixed(1)}B</span>` : ''}
            </div>
        </div>
    `;
    
    document.getElementById('positionModal').classList.add('active');
}

function closeModal() {
    document.getElementById('positionModal').classList.remove('active');
}

// Close modal on outside click
document.getElementById('positionModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

// Close modal on escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
});
