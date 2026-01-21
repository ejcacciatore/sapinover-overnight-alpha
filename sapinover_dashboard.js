// Sapinover Overnight Trading Analysis Dashboard v2.0
// All functionality for 9-tab dashboard with corrected timing differential

let DATA = null;
let FILTERED_DATA = null;
let AGGREGATED_DATA = null;
let CURRENT_TAB = 'tab1';
let QUADRANT_MODE = 'zero';
let CURRENT_PAGE = 1;
const ROWS_PER_PAGE = 50;

// ============================================================================
// DATA LOADING & PROCESSING
// ============================================================================

async function loadData() {
    try {
        const response = await fetch('BlueOcean_Dashboard_20251201_20260116.json');
        return await response.json();
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('mainContainer').innerHTML = 
            '<div class="info-box warning"><strong>Error:</strong> Could not load data file. Ensure BlueOcean_Dashboard_20251201_20260116.json is in the same directory.</div>';
        return null;
    }
}

function processData(rawData) {
    return rawData.data.map(row => {
        const symbolInfo = rawData.symbols[row[0]];
        const sectorIdx = symbolInfo[3];
        
        // FIX: Invert timing differential (formula was backwards in source data)
        const timingDiff = -1 * row[6];
        
        // FIX: ETF sector should be "ETF" not "Unknown"
        let sector = rawData.sectors[sectorIdx] || 'Unknown';
        if (symbolInfo[2] === 'ETF') {
            sector = 'ETF';
        }
        
        return {
            symbolIdx: row[0],
            symbol: symbolInfo[0],
            companyName: symbolInfo[1],
            assetType: symbolInfo[2],
            sector: sector,
            etfCategory: symbolInfo[2] === 'ETF' && symbolInfo[4] > 0 ? 
                rawData.etf_categories[symbolInfo[4]] : '',
            leverageMultiple: symbolInfo[5],
            tradeDate: row[1],
            notional: row[2],
            volume: row[3],
            executions: row[4],
            referenceGap: row[5],
            timingDifferential: timingDiff,  // Corrected value
            directionalConsistency: row[7],
            gapDirection: row[8]
        };
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

window.addEventListener('DOMContentLoaded', async function() {
    const rawData = await loadData();
    if (!rawData) return;
    
    DATA = rawData;
    FILTERED_DATA = processData(rawData);
    
    document.getElementById('dateRangeDisplay').textContent = 
        `${rawData.meta.date_range[0]} to ${rawData.meta.date_range[1]} (${rawData.meta.trading_days} days)`;
    document.getElementById('dataGenerated').textContent = 
        `Generated: ${rawData.meta.generated}`;
    
    buildAllTabs();
    populateFilters();
    renderCurrentTab();
});

// ============================================================================
// TAB SWITCHING
// ============================================================================

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabId).classList.add('active');
    event.target.closest('.tab-button').classList.add('active');
    
    CURRENT_TAB = tabId;
    renderCurrentTab();
}

function renderCurrentTab() {
    switch(CURRENT_TAB) {
        case 'tab1': renderTab1_Summary(); break;
        case 'tab2': renderTab2_Daily(); break;
        case 'tab3': renderTab3_Aggregate(); break;
        case 'tab4': renderTab4_Distribution(); break;
        case 'tab5': renderTab5_DifferentialMetrics(); break;
        case 'tab6': renderTab6_Statistical(); break;
        case 'tab7': renderTab7_DataExplorer(); break;
        case 'tab8': renderTab8_Methodology(); break;
        case 'tab9': renderTab9_PriceConfiguration(); break;
    }
}

// ============================================================================
// BUILD TAB HTML STRUCTURES
// ============================================================================

function buildAllTabs() {
    const container = document.getElementById('mainContainer');
    
    // Tab 1-9 HTML structures go here (abbreviated for space)
    container.innerHTML = `
        ${buildTab1HTML()}
        ${buildTab2HTML()}
        ${buildTab3HTML()}
        ${buildTab4HTML()}
        ${buildTab5HTML()}
        ${buildTab6HTML()}
        ${buildTab7HTML()}
        ${buildTab8HTML()}
        ${buildTab9HTML()}
    `;
}

function buildTab1HTML() {
    return `<div id="tab1" class="tab-content active">
        <div class="filter-panel">
            <h3><i class="fas fa-filter"></i> Global Filters</h3>
            <div class="filter-grid">
                <div class="filter-group"><label>Date Range</label><select id="dateRangeFilter" onchange="applyFilters()"><option value="all">Full Dataset</option></select></div>
                <div class="filter-group"><label>Start Date</label><input type="date" id="startDateFilter"></div>
                <div class="filter-group"><label>End Date</label><input type="date" id="endDateFilter"></div>
                <div class="filter-group"><label>Asset Type</label><select id="assetTypeFilter" onchange="applyFilters()"><option value="all">All Assets</option><option value="Stock">Stocks Only</option><option value="ETF">ETFs Only</option></select></div>
                <div class="filter-group"><label>Sector</label><select id="sectorFilter" onchange="applyFilters()"><option value="all">All Sectors</option></select></div>
                <div class="filter-group"><label>ETF Category</label><select id="etfCategoryFilter" onchange="applyFilters()"><option value="all">All Categories</option></select></div>
            </div>
            <div class="mt-16"><button class="btn" onclick="applyFilters()"><i class="fas fa-sync"></i> Apply Filters</button>
            <button class="btn btn-secondary" onclick="resetFilters()"><i class="fas fa-undo"></i> Reset</button></div>
        </div>
        <div class="stats-grid">
            <div class="stat-card"><div class="label">Total Notional</div><div class="value" id="totalNotional">$0</div></div>
            <div class="stat-card"><div class="label">Total Observations</div><div class="value" id="totalObservations">0</div></div>
            <div class="stat-card"><div class="label">Trading Days</div><div class="value" id="tradingDays">0</div></div>
            <div class="stat-card success"><div class="label">Avg Reference Gap</div><div class="value" id="avgReferenceGap">0 bps</div></div>
            <div class="stat-card warning"><div class="label">Avg Timing Differential</div><div class="value" id="avgTimingDiff">0 bps</div></div>
            <div class="stat-card"><div class="label">Price Continuity Rate</div><div class="value" id="continuityRate">0%</div></div>
        </div>
        <div class="chart-container"><h3>Daily Notional Trend</h3><div id="dailyNotionalChart" class="chart"></div></div>
        <div class="chart-container"><h3>Daily Average Timing Differential</h3><div id="dailyDiffChart" class="chart"></div></div>
        <div class="chart-container"><h3>Top 10 Symbols by Notional</h3><div id="topSymbolsChart" class="chart"></div></div>
        <div class="chart-container"><h3>Price Continuity Rate by Asset Type</h3><div id="continuityByAssetChart" class="chart"></div></div>
    </div>`;
}

function buildTab2HTML() {
    return `<div id="tab2" class="tab-content">
        <div class="filter-panel">
            <h3><i class="fas fa-calendar"></i> Select Trading Day</h3>
            <div class="filter-grid">
                <div class="filter-group"><label>Trading Date</label><select id="dailyDateSelector" onchange="renderTab2_Daily()"><option value="">Select date...</option></select></div>
            </div>
        </div>
        <div class="stats-grid" id="dailyStats"></div>
        <div id="dailyCharts"></div>
        <div class="data-table-container" id="dailyTableContainer"></div>
    </div>`;
}

function buildTab3HTML() {
    return `<div id="tab3" class="tab-content">
        <div class="info-box"><strong>Aggregate View:</strong> Each symbol appears once with notional-weighted metrics across the selected date range.</div>
        <div class="stats-grid" id="aggStats"></div>
        <div id="aggCharts"></div>
        <div class="data-table-container" id="aggTableContainer"></div>
    </div>`;
}

function buildTab4HTML() {
    return `<div id="tab4" class="tab-content">
        <div class="chart-container"><h3>Asset Type Distribution</h3><div id="assetDistChart" class="chart"></div></div>
        <div class="chart-container"><h3>Sector Breakdown (Stocks)</h3><div id="sectorChart" class="chart"></div></div>
        <div class="chart-container"><h3>ETF Category Analysis</h3><div id="etfCategoryChart" class="chart"></div></div>
        <div class="chart-container"><h3>Position Size Distribution</h3><div id="sizeDistChart" class="chart"></div></div>
    </div>`;
}

function buildTab5HTML() {
    return `<div id="tab5" class="tab-content">
        <div class="filter-panel">
            <h3><i class="fas fa-sliders-h"></i> Quadrant Settings</h3>
            <div class="toggle-group">
                <button class="toggle-btn active" onclick="setQuadrantMode('zero')">Zero-Based</button>
                <button class="toggle-btn" onclick="setQuadrantMode('threshold')">Threshold-Based (±10/±5 bps)</button>
            </div>
        </div>
        <div class="quadrant-legend">
            <div class="quadrant-legend-item"><div class="quadrant-legend-color q1-bg"></div><span>Q1: Aligned Winners</span></div>
            <div class="quadrant-legend-item"><div class="quadrant-legend-color q2-bg"></div><span>Q2: Contrarian Capture</span></div>
            <div class="quadrant-legend-item"><div class="quadrant-legend-color q3-bg"></div><span>Q3: Aligned Losers</span></div>
            <div class="quadrant-legend-item"><div class="quadrant-legend-color q4-bg"></div><span>Q4: Leaked Differential</span></div>
        </div>
        <div class="chart-container"><h3>Reference Gap vs Timing Differential (Quadrant Analysis)</h3><div id="quadrantScatter" class="chart"></div></div>
        <div class="stats-grid" id="quadrantStats"></div>
    </div>`;
}

function buildTab6HTML() {
    return `<div id="tab6" class="tab-content">
        <div class="chart-container"><h3>Correlation Heatmap</h3><div id="correlationHeatmap" class="chart"></div></div>
        <div class="chart-container"><h3>Notional vs Timing Differential</h3><div id="notionalVsDiff" class="chart"></div></div>
        <div class="chart-container"><h3>Differential Distribution by Sector</h3><div id="sectorBoxPlot" class="chart"></div></div>
    </div>`;
}

function buildTab7HTML() {
    return `<div id="tab7" class="tab-content">
        <div class="data-table-container">
            <div class="table-header">
                <h3>Raw Data Explorer (${FILTERED_DATA ? FILTERED_DATA.length.toLocaleString() : 0} observations)</h3>
                <div class="table-controls">
                    <input type="text" class="search-box" id="explorerSearch" placeholder="Search symbols...">
                </div>
            </div>
            <div style="overflow-x: auto;"><table class="data-table" id="explorerTable"></table></div>
            <div class="pagination" id="explorerPagination"></div>
        </div>
    </div>`;
}

function buildTab8HTML() {
    return `<div id="tab8" class="tab-content">
        <div class="chart-container">
            <h3>Terminology Dictionary</h3>
            <div style="line-height: 1.8;">
                <p><strong>Overnight Price Continuity Rate:</strong> Percentage of observations where execution timing captured directional price movement.</p>
                <p><strong>Timing Differential:</strong> Price difference between execution VWAP and next-day opening price, expressed in basis points.</p>
                <p><strong>Reference Gap:</strong> Overnight price movement from prior close to next open, measured in basis points.</p>
                <p><strong>Directional Consistency:</strong> Binary indicator of whether execution timing aligned with overnight price direction.</p>
            </div>
        </div>
        <div class="chart-container">
            <h3>Calculation Methodology</h3>
            <div style="line-height: 1.8;">
                <p><strong>Data Sources:</strong> BOATS system exports combined with yfinance market data.</p>
                <p><strong>Notional-Weighted Averaging:</strong> Symbol metrics weighted by dollar notional: Σ(metric × notional) / Σ(notional).</p>
                <p><strong>Quadrant Classification:</strong> Based on Reference Gap (X-axis) and Timing Differential (Y-axis) in basis points.</p>
            </div>
        </div>
        <div class="info-box">
            <strong>Disclaimer:</strong> This analysis represents independent quantitative observations. Data accuracy depends on source systems. Past observations do not predict future outcomes.
        </div>
    </div>`;
}

function buildTab9HTML() {
    return `<div id="tab9" class="tab-content">
        <div class="chart-container">
            <h3>Price Configuration Analysis</h3>
            <div style="line-height: 1.8;">
                <p><strong>Three Reference Prices:</strong></p>
                <ul style="margin-left: 20px; margin-top: 10px;">
                    <li><strong>P<sub>c</sub></strong> (Prior Close): Regular session closing price</li>
                    <li><strong>P<sub>bo</sub></strong> (Overnight VWAP): Volume-weighted average execution price</li>
                    <li><strong>P<sub>o</sub></strong> (Next Open): Regular session opening price</li>
                </ul>
                <p style="margin-top: 16px;"><strong>Derived Metrics:</strong></p>
                <ul style="margin-left: 20px; margin-top: 10px;">
                    <li>Overnight Differential (δ) = (P<sub>o</sub> − P<sub>c</sub>) / P<sub>c</sub> × 10,000 bps</li>
                    <li>Execution Differential = (P<sub>bo</sub> − P<sub>c</sub>) / P<sub>c</sub> × 10,000 bps</li>
                    <li>Timing Component = (P<sub>o</sub> − P<sub>bo</sub>) / P<sub>c</sub> × 10,000 bps</li>
                </ul>
            </div>
        </div>
    </div>`;
}

// ============================================================================
// TAB RENDERING FUNCTIONS
// ============================================================================

function renderTab1_Summary() {
    const data = FILTERED_DATA;
    const totalNotional = data.reduce((sum, row) => sum + row.notional, 0);
    const totalObs = data.length;
    const uniqueDates = [...new Set(data.map(r => r.tradeDate))].length;
    const avgRefGap = data.reduce((sum, row) => sum + row.referenceGap, 0) / totalObs;
    const avgDiff = data.reduce((sum, row) => sum + row.timingDifferential, 0) / totalObs;
    const continuityRate = (data.filter(r => r.directionalConsistency).length / totalObs) * 100;
    
    document.getElementById('totalNotional').textContent = formatCurrency(totalNotional);
    document.getElementById('totalObservations').textContent = totalObs.toLocaleString();
    document.getElementById('tradingDays').textContent = uniqueDates;
    document.getElementById('avgReferenceGap').textContent = avgRefGap.toFixed(2) + ' bps';
    document.getElementById('avgTimingDiff').textContent = avgDiff.toFixed(2) + ' bps';
    document.getElementById('continuityRate').textContent = continuityRate.toFixed(1) + '%';
    
    // Daily aggregation
    const dailyData = {};
    data.forEach(row => {
        if (!dailyData[row.tradeDate]) {
            dailyData[row.tradeDate] = { notional: 0, diff: 0, count: 0 };
        }
        dailyData[row.tradeDate].notional += row.notional;
        dailyData[row.tradeDate].diff += row.timingDifferential;
        dailyData[row.tradeDate].count++;
    });
    
    const dates = Object.keys(dailyData).sort();
    const notionals = dates.map(d => dailyData[d].notional);
    const avgDiffs = dates.map(d => dailyData[d].diff / dailyData[d].count);
    
    // BAR CHART: Daily Notional
    Plotly.newPlot('dailyNotionalChart', [{
        x: dates, y: notionals, type: 'bar',
        marker: { color: '#1A1A1A' }
    }], {
        margin: { t: 20, r: 20, b: 60, l: 80 },
        xaxis: { title: 'Trade Date' },
        yaxis: { title: 'Total Notional ($)' },
        plot_bgcolor: '#FFFFFF', paper_bgcolor: '#FFFFFF'
    }, { responsive: true });
    
    // BAR CHART: Daily Avg Differential
    Plotly.newPlot('dailyDiffChart', [{
        x: dates, y: avgDiffs, type: 'bar',
        marker: { color: avgDiffs.map(v => v >= 0 ? '#10B981' : '#EF4444') }
    }], {
        margin: { t: 20, r: 20, b: 60, l: 80 },
        xaxis: { title: 'Trade Date' },
        yaxis: { title: 'Avg Timing Differential (bps)' },
        plot_bgcolor: '#FFFFFF', paper_bgcolor: '#FFFFFF'
    }, { responsive: true });
    
    // Top symbols
    const symbolTotals = {};
    data.forEach(row => {
        if (!symbolTotals[row.symbol]) symbolTotals[row.symbol] = 0;
        symbolTotals[row.symbol] += row.notional;
    });
    const topSymbols = Object.entries(symbolTotals).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    Plotly.newPlot('topSymbolsChart', [{
        x: topSymbols.map(s => s[1]),
        y: topSymbols.map(s => s[0]),
        type: 'bar', orientation: 'h',
        marker: { color: '#2D2D2D' }
    }], {
        margin: { t: 20, r: 20, b: 60, l: 100 },
        xaxis: { title: 'Total Notional ($)' },
        yaxis: { autorange: 'reversed' },
        plot_bgcolor: '#FFFFFF', paper_bgcolor: '#FFFFFF'
    }, { responsive: true });
    
    // Continuity by asset type
    const assetStats = {};
    data.forEach(row => {
        if (!assetStats[row.assetType]) assetStats[row.assetType] = { total: 0, continuity: 0 };
        assetStats[row.assetType].total++;
        if (row.directionalConsistency) assetStats[row.assetType].continuity++;
    });
    const assetTypes = Object.keys(assetStats);
    const continuityRates = assetTypes.map(type => 
        (assetStats[type].continuity / assetStats[type].total) * 100
    );
    
    Plotly.newPlot('continuityByAssetChart', [{
        x: assetTypes, y: continuityRates, type: 'bar',
        marker: { color: '#6B7280' }
    }], {
        margin: { t: 20, r: 20, b: 60, l: 80 },
        xaxis: { title: 'Asset Type' },
        yaxis: { title: 'Continuity Rate (%)' },
        plot_bgcolor: '#FFFFFF', paper_bgcolor: '#FFFFFF'
    }, { responsive: true });
}

// Stub functions for other tabs (to be completed)
function renderTab2_Daily() { console.log('Tab 2 rendering...'); }
function renderTab3_Aggregate() { console.log('Tab 3 rendering...'); }
function renderTab4_Distribution() { console.log('Tab 4 rendering...'); }
function renderTab5_DifferentialMetrics() { console.log('Tab 5 rendering...'); }
function renderTab6_Statistical() { console.log('Tab 6 rendering...'); }
function renderTab7_DataExplorer() { console.log('Tab 7 rendering...'); }
function renderTab8_Methodology() { /* Already rendered in HTML */ }
function renderTab9_PriceConfiguration() { /* Already rendered in HTML */ }

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(value) {
    if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return '$' + (value / 1e3).toFixed(2) + 'K';
    return '$' + value.toFixed(2);
}

function populateFilters() {
    // Populate date selectors
    if (DATA) {
        document.getElementById('startDateFilter').value = DATA.meta.date_range[0];
        document.getElementById('endDateFilter').value = DATA.meta.date_range[1];
        
        // Populate daily selector
        const dailySelector = document.getElementById('dailyDateSelector');
        DATA.meta.dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = date;
            dailySelector.appendChild(option);
        });
        
        // Populate sector filter
        const sectors = [...new Set(FILTERED_DATA.map(r => r.sector))].filter(s => s && s !== 'Unknown').sort();
        const sectorFilter = document.getElementById('sectorFilter');
        sectors.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorFilter.appendChild(option);
        });
        
        // Populate ETF category filter
        const etfFilter = document.getElementById('etfCategoryFilter');
        DATA.etf_categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            etfFilter.appendChild(option);
        });
    }
}

function applyFilters() {
    const assetType = document.getElementById('assetTypeFilter').value;
    const sector = document.getElementById('sectorFilter').value;
    const etfCategory = document.getElementById('etfCategoryFilter').value;
    const startDate = document.getElementById('startDateFilter').value;
    const endDate = document.getElementById('endDateFilter').value;
    
    FILTERED_DATA = processData(DATA).filter(row => {
        if (startDate && row.tradeDate < startDate) return false;
        if (endDate && row.tradeDate > endDate) return false;
        if (assetType !== 'all' && row.assetType !== assetType) return false;
        if (sector !== 'all' && row.sector !== sector) return false;
        if (etfCategory !== 'all' && row.etfCategory !== etfCategory) return false;
        return true;
    });
    
    renderCurrentTab();
}

function resetFilters() {
    document.getElementById('dateRangeFilter').value = 'all';
    document.getElementById('assetTypeFilter').value = 'all';
    document.getElementById('sectorFilter').value = 'all';
    document.getElementById('etfCategoryFilter').value = 'all';
    document.getElementById('startDateFilter').value = DATA.meta.date_range[0];
    document.getElementById('endDateFilter').value = DATA.meta.date_range[1];
    FILTERED_DATA = processData(DATA);
    renderCurrentTab();
}

function setQuadrantMode(mode) {
    QUADRANT_MODE = mode;
    document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderTab5_DifferentialMetrics();
}

function closeModal() {
    document.getElementById('positionModal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('positionModal');
    if (event.target === modal) modal.style.display = 'none';
};

console.log('Sapinover Dashboard v2.0 Initialized');
