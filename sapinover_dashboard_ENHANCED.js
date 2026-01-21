// Sapinover Overnight Trading Analysis Dashboard v2.1 - ENHANCED
// Enhanced Tab 5 (Quadrant Analysis), Tab 7 (Data Explorer with Pricing), Tab 2 (Moving Averages)

let DATA = null;
let FILTERED_DATA = null;
let AGGREGATED_DATA = null;
let CURRENT_TAB = 'tab1';
let QUADRANT_MODE = 'zero';
let CURRENT_PAGE = 1;
let EXPLORER_SORT = { column: null, ascending: true };
let EXPLORER_FILTERS = { symbol: '', dateFrom: '', dateTo: '', gapDirection: 'all' };
const ROWS_PER_PAGE = 50;

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
        
        // FIX: Invert timing differential (formula was backwards)
        const timingDifferential = row[5] * -1;
        
        // FIX: Handle ETF sectors (index 13+ should use ETF category)
        let sector = rawData.dimensions.sectors[sectorIdx];
        if (symbolInfo[2] === 'ETF' && sectorIdx >= 13) {
            const etfCatIdx = sectorIdx - 13;
            if (etfCatIdx < rawData.dimensions.etf_categories.length) {
                sector = rawData.dimensions.etf_categories[etfCatIdx];
            }
        }
        
        return {
            symbol: row[0],
            companyName: symbolInfo[0],
            assetType: symbolInfo[2],
            sector: sector,
            date: row[1],
            notional: row[2],
            volume: row[3],
            executions: row[4],
            timingDifferential: timingDifferential,
            referenceGap: row[6],
            priorClose: row[7],
            vwap: row[8],
            nextOpen: row[9],
            nextClose: row[10],
            directionalConsistency: row[11] === 1 ? '✓' : '✗'
        };
    });
}

function populateFilters() {
    const assetTypes = [...new Set(FILTERED_DATA.map(d => d.assetType))].sort();
    const sectors = [...new Set(FILTERED_DATA.map(d => d.sector))].filter(s => s).sort();
    
    const assetSelect = document.getElementById('filterAsset');
    assetTypes.forEach(type => {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        assetSelect.appendChild(opt);
    });
    
    const sectorSelect = document.getElementById('filterSector');
    sectors.forEach(sec => {
        const opt = document.createElement('option');
        opt.value = sec;
        opt.textContent = sec;
        sectorSelect.appendChild(opt);
    });
}

function applyFilters() {
    const assetType = document.getElementById('filterAsset').value;
    const sector = document.getElementById('filterSector').value;
    const minNotional = parseFloat(document.getElementById('filterNotional').value) * 1e6;
    
    FILTERED_DATA = processData(DATA).filter(row => {
        if (assetType !== 'all' && row.assetType !== assetType) return false;
        if (sector !== 'all' && row.sector !== sector) return false;
        if (row.notional < minNotional) return false;
        return true;
    });
    
    renderCurrentTab();
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================

function switchTab(tabId) {
    document.querySelectorAll('.tab-button').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.tab-button[onclick="switchTab('${tabId}')"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
    
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
    }
}

// ============================================================================
// TAB 1: SUMMARY STATISTICS
// ============================================================================

function renderTab1_Summary() {
    const totalNotional = FILTERED_DATA.reduce((sum, d) => sum + d.notional, 0);
    const totalVolume = FILTERED_DATA.reduce((sum, d) => sum + d.volume, 0);
    const avgDifferential = FILTERED_DATA.reduce((sum, d) => sum + d.timingDifferential, 0) / FILTERED_DATA.length;
    const consistencyRate = (FILTERED_DATA.filter(d => d.directionalConsistency === '✓').length / FILTERED_DATA.length) * 100;
    
    document.getElementById('statNotional').textContent = `$${(totalNotional / 1e9).toFixed(2)}B`;
    document.getElementById('statObservations').textContent = FILTERED_DATA.length.toLocaleString();
    document.getElementById('statVolume').textContent = (totalVolume / 1e6).toFixed(1) + 'M';
    document.getElementById('statAvgDiff').textContent = avgDifferential.toFixed(1) + ' bps';
    document.getElementById('statConsistency').textContent = consistencyRate.toFixed(1) + '%';
    
    const uniqueSymbols = new Set(FILTERED_DATA.map(d => d.symbol)).size;
    const dates = [...new Set(FILTERED_DATA.map(d => d.date))].sort();
    document.getElementById('statSymbols').textContent = uniqueSymbols.toLocaleString();
    document.getElementById('statDates').textContent = dates.length;
}

// ============================================================================
// TAB 2: DAILY ANALYSIS (WITH 5-DAY MOVING AVERAGES)
// ============================================================================

function renderTab2_Daily() {
    const dateSelect = document.getElementById('dailyDateSelect');
    if (dateSelect.options.length === 0) {
        const dates = [...new Set(FILTERED_DATA.map(d => d.date))].sort().reverse();
        dates.forEach(date => {
            const opt = document.createElement('option');
            opt.value = date;
            opt.textContent = date;
            dateSelect.appendChild(opt);
        });
    }
    
    const selectedDate = dateSelect.value || dateSelect.options[0].value;
    renderDailyData(selectedDate);
}

function renderDailyData(date) {
    const dailyData = FILTERED_DATA.filter(d => d.date === date);
    
    const totalNotional = dailyData.reduce((sum, d) => sum + d.notional, 0);
    const avgDifferential = dailyData.reduce((sum, d) => sum + d.timingDifferential, 0) / dailyData.length;
    
    document.getElementById('dailyNotional').textContent = `$${(totalNotional / 1e6).toFixed(1)}M`;
    document.getElementById('dailyObservations').textContent = dailyData.length.toLocaleString();
    document.getElementById('dailyVolume').textContent = (dailyData.reduce((sum, d) => sum + d.volume, 0) / 1e6).toFixed(1) + 'M';
    document.getElementById('dailyAvgDiff').textContent = avgDifferential.toFixed(1) + ' bps';
    
    renderDailySectorChart(dailyData);
    renderDailyHistogram(dailyData);
    renderDailyTrendsWithMA();
    renderDailyTable(dailyData);
}

function renderDailyTrendsWithMA() {
    // Calculate daily aggregates
    const dates = [...new Set(FILTERED_DATA.map(d => d.date))].sort();
    
    const dailyStats = dates.map(date => {
        const dayData = FILTERED_DATA.filter(d => d.date === date);
        return {
            date: date,
            avgDifferential: dayData.reduce((sum, d) => sum + d.timingDifferential, 0) / dayData.length,
            totalNotional: dayData.reduce((sum, d) => sum + d.notional, 0)
        };
    });
    
    // Calculate 5-day moving averages
    const calcMA = (arr, period) => {
        return arr.map((val, idx) => {
            if (idx < period - 1) return null;
            const sum = arr.slice(idx - period + 1, idx + 1).reduce((a, b) => a + b, 0);
            return sum / period;
        });
    };
    
    const diffMA = calcMA(dailyStats.map(d => d.avgDifferential), 5);
    const notionalMA = calcMA(dailyStats.map(d => d.totalNotional), 5);
    
    // Timing Differential Trend
    const traceDiff = {
        x: dailyStats.map(d => d.date),
        y: dailyStats.map(d => d.avgDifferential),
        name: 'Daily Avg',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#1A1A1A', width: 2 },
        marker: { size: 6 }
    };
    
    const traceDiffMA = {
        x: dailyStats.map(d => d.date),
        y: diffMA,
        name: '5-Day MA',
        type: 'scatter',
        mode: 'lines',
        line: { color: '#D4AF37', width: 2, dash: 'dot' }
    };
    
    const layoutDiff = {
        title: 'Daily Average Timing Differential Trend',
        xaxis: { title: 'Date' },
        yaxis: { title: 'Avg Timing Differential (bps)' },
        showlegend: true,
        hovermode: 'x unified'
    };
    
    Plotly.newPlot('dailyTrendChart', [traceDiff, traceDiffMA], layoutDiff, { responsive: true });
    
    // Notional Trend
    const traceNotional = {
        x: dailyStats.map(d => d.date),
        y: dailyStats.map(d => d.totalNotional / 1e6),
        name: 'Daily Total',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#1A1A1A', width: 2 },
        marker: { size: 6 }
    };
    
    const traceNotionalMA = {
        x: dailyStats.map(d => d.date),
        y: notionalMA.map(val => val ? val / 1e6 : null),
        name: '5-Day MA',
        type: 'scatter',
        mode: 'lines',
        line: { color: '#D4AF37', width: 2, dash: 'dot' }
    };
    
    const layoutNotional = {
        title: 'Daily Notional Volume Trend',
        xaxis: { title: 'Date' },
        yaxis: { title: 'Total Notional ($M)' },
        showlegend: true,
        hovermode: 'x unified'
    };
    
    Plotly.newPlot('dailyNotionalChart', [traceNotional, traceNotionalMA], layoutNotional, { responsive: true });
}

function renderDailySectorChart(dailyData) {
    const sectorData = {};
    dailyData.forEach(d => {
        const sector = d.sector || 'Unknown';
        sectorData[sector] = (sectorData[sector] || 0) + d.notional;
    });
    
    const trace = {
        labels: Object.keys(sectorData),
        values: Object.values(sectorData),
        type: 'pie',
        marker: { colors: ['#1A1A1A', '#D4AF37', '#666666', '#999999', '#CCCCCC'] }
    };
    
    const layout = {
        title: 'Sector Distribution by Notional',
        showlegend: true
    };
    
    Plotly.newPlot('dailySectorChart', [trace], layout, { responsive: true });
}

function renderDailyHistogram(dailyData) {
    const trace = {
        x: dailyData.map(d => d.timingDifferential),
        type: 'histogram',
        nbinsx: 30,
        marker: { color: '#1A1A1A' }
    };
    
    const layout = {
        title: 'Timing Differential Distribution',
        xaxis: { title: 'Timing Differential (bps)' },
        yaxis: { title: 'Count' }
    };
    
    Plotly.newPlot('dailyHistogram', [trace], layout, { responsive: true });
}

function renderDailyTable(dailyData) {
    const tbody = document.getElementById('dailyTableBody');
    tbody.innerHTML = '';
    
    dailyData.slice(0, 50).forEach(row => {
        const tr = document.createElement('tr');
        tr.onclick = () => showPositionModal(row);
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
            <td>${row.symbol}</td>
            <td>${row.companyName ? row.companyName.substring(0, 30) : '-'}</td>
            <td>${row.assetType}</td>
            <td>$${(row.notional / 1e6).toFixed(2)}M</td>
            <td>${(row.volume / 1000).toFixed(0)}K</td>
            <td class="${row.timingDifferential >= 0 ? 'positive' : 'negative'}">
                ${row.timingDifferential.toFixed(1)} bps
            </td>
            <td>${row.directionalConsistency}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================================================
// TAB 3: AGGREGATE ANALYSIS
// ============================================================================

function renderTab3_Aggregate() {
    AGGREGATED_DATA = aggregateBySymbol(FILTERED_DATA);
    
    document.getElementById('aggUniqueSymbols').textContent = AGGREGATED_DATA.length.toLocaleString();
    
    const avgWeightedDiff = AGGREGATED_DATA.reduce((sum, d) => sum + d.weightedAlpha, 0) / AGGREGATED_DATA.length;
    document.getElementById('aggWeightedAvg').textContent = avgWeightedDiff.toFixed(1) + ' bps';
    
    const topSymbol = AGGREGATED_DATA.reduce((max, d) => d.totalNotional > max.totalNotional ? d : max);
    document.getElementById('aggTopSymbol').textContent = `${topSymbol.symbol} ($${(topSymbol.totalNotional / 1e6).toFixed(1)}M)`;
    
    const avgDays = AGGREGATED_DATA.reduce((sum, d) => sum + d.tradingDays, 0) / AGGREGATED_DATA.length;
    document.getElementById('aggAvgDays').textContent = avgDays.toFixed(1);
    
    renderAggregateChart();
    renderAggregatePerformanceChart();
    renderAggregateTable(1);
}

function aggregateBySymbol(data) {
    const grouped = {};
    
    data.forEach(row => {
        if (!grouped[row.symbol]) {
            grouped[row.symbol] = {
                symbol: row.symbol,
                companyName: row.companyName,
                assetType: row.assetType,
                sector: row.sector,
                totalNotional: 0,
                totalVolume: 0,
                weightedDiffSum: 0,
                observations: 0,
                tradingDays: 0,
                continuityCount: 0,
                dates: new Set()
            };
        }
        
        const g = grouped[row.symbol];
        g.totalNotional += row.notional;
        g.totalVolume += row.volume;
        g.weightedDiffSum += row.timingDifferential * row.notional;
        g.observations += 1;
        g.dates.add(row.date);
        if (row.directionalConsistency === '✓') g.continuityCount++;
    });
    
    return Object.values(grouped).map(g => ({
        ...g,
        tradingDays: g.dates.size,
        weightedAlpha: g.weightedDiffSum / g.totalNotional,
        continuityRate: (g.continuityCount / g.observations) * 100
    })).sort((a, b) => b.totalNotional - a.totalNotional);
}

function renderAggregateChart() {
    const dates = [...new Set(FILTERED_DATA.map(d => d.date))].sort();
    const dailyNotional = dates.map(date => {
        return FILTERED_DATA.filter(d => d.date === date).reduce((sum, d) => sum + d.notional, 0);
    });
    
    const trace = {
        x: dates,
        y: dailyNotional.map(n => n / 1e6),
        type: 'bar',
        marker: { color: '#1A1A1A' }
    };
    
    const layout = {
        title: 'Daily Aggregate Notional',
        xaxis: { title: 'Date' },
        yaxis: { title: 'Notional ($M)' }
    };
    
    Plotly.newPlot('aggregateChart', [trace], layout, { responsive: true });
}

function renderAggregatePerformanceChart() {
    const filtered = AGGREGATED_DATA.filter(d => d.tradingDays >= 3);
    const top20 = filtered.sort((a, b) => b.weightedAlpha - a.weightedAlpha).slice(0, 20);
    
    const trace = {
        x: top20.map(d => d.weightedAlpha),
        y: top20.map(d => d.symbol),
        type: 'bar',
        orientation: 'h',
        marker: { color: '#1A1A1A' }
    };
    
    const layout = {
        title: 'Top 20 Symbols by Weighted Alpha (≥3 Days)',
        xaxis: { title: 'Weighted Timing Differential (bps)' },
        yaxis: { autorange: 'reversed' },
        margin: { l: 100 }
    };
    
    Plotly.newPlot('aggregatePerformanceChart', [trace], layout, { responsive: true });
}

function renderAggregateTable(page) {
    CURRENT_PAGE = page;
    const tbody = document.getElementById('aggregateTableBody');
    tbody.innerHTML = '';
    
    const searchTerm = (document.getElementById('aggSearch')?.value || '').toLowerCase();
    let filtered = AGGREGATED_DATA.filter(d => 
        d.symbol.toLowerCase().includes(searchTerm) ||
        (d.companyName && d.companyName.toLowerCase().includes(searchTerm))
    );
    
    const start = (page - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    const pageData = filtered.slice(start, end);
    
    pageData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.symbol}</td>
            <td>${row.companyName ? row.companyName.substring(0, 30) : '-'}</td>
            <td>${row.tradingDays}</td>
            <td>$${(row.totalNotional / 1e6).toFixed(2)}M</td>
            <td class="${row.weightedAlpha >= 0 ? 'positive' : 'negative'}">
                ${row.weightedAlpha.toFixed(1)} bps
            </td>
            <td>${row.continuityRate.toFixed(1)}%</td>
        `;
        tbody.appendChild(tr);
    });
    
    renderPagination('aggregatePagination', filtered.length, page, renderAggregateTable);
}

function exportAggregateCSV() {
    const headers = ['Symbol', 'Company Name', 'Trading Days', 'Total Notional', 'Weighted Alpha (bps)', 'Continuity Rate'];
    const rows = AGGREGATED_DATA.map(d => [
        d.symbol,
        d.companyName || '',
        d.tradingDays,
        d.totalNotional.toFixed(2),
        d.weightedAlpha.toFixed(2),
        d.continuityRate.toFixed(2)
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aggregate_analysis.csv';
    a.click();
}

// ============================================================================
// TAB 4: DISTRIBUTION ANALYSIS
// ============================================================================

function renderTab4_Distribution() {
    renderAssetTypePie();
    renderSectorBar();
    renderETFCategoryBar();
    renderPositionSizeDistribution();
}

function renderAssetTypePie() {
    const assetData = {};
    FILTERED_DATA.forEach(d => {
        assetData[d.assetType] = (assetData[d.assetType] || 0) + d.notional;
    });
    
    const trace = {
        labels: Object.keys(assetData),
        values: Object.values(assetData),
        type: 'pie',
        marker: { colors: ['#1A1A1A', '#D4AF37', '#666666'] }
    };
    
    const layout = {
        title: 'Asset Type Distribution (by Notional)',
        showlegend: true
    };
    
    Plotly.newPlot('assetTypeChart', [trace], layout, { responsive: true });
}

function renderSectorBar() {
    const stockData = FILTERED_DATA.filter(d => d.assetType === 'Stock');
    const sectorData = {};
    
    stockData.forEach(d => {
        const sector = d.sector || 'Unknown';
        sectorData[sector] = (sectorData[sector] || 0) + d.notional;
    });
    
    const sorted = Object.entries(sectorData).sort((a, b) => b[1] - a[1]).slice(0, 15);
    
    const trace = {
        x: sorted.map(s => s[1] / 1e6),
        y: sorted.map(s => s[0]),
        type: 'bar',
        orientation: 'h',
        marker: { color: '#1A1A1A' }
    };
    
    const layout = {
        title: 'Top 15 Stock Sectors by Notional',
        xaxis: { title: 'Notional ($M)' },
        yaxis: { autorange: 'reversed' },
        margin: { l: 150 }
    };
    
    Plotly.newPlot('sectorChart', [trace], layout, { responsive: true });
}

function renderETFCategoryBar() {
    const etfData = FILTERED_DATA.filter(d => d.assetType === 'ETF');
    const catData = {};
    
    etfData.forEach(d => {
        const cat = d.sector || 'Unknown';
        catData[cat] = (catData[cat] || 0) + d.notional;
    });
    
    const sorted = Object.entries(catData).sort((a, b) => b[1] - a[1]).slice(0, 15);
    
    const trace = {
        x: sorted.map(s => s[1] / 1e6),
        y: sorted.map(s => s[0]),
        type: 'bar',
        orientation: 'h',
        marker: { color: '#D4AF37' }
    };
    
    const layout = {
        title: 'Top 15 ETF Categories by Notional',
        xaxis: { title: 'Notional ($M)' },
        yaxis: { autorange: 'reversed' },
        margin: { l: 150 }
    };
    
    Plotly.newPlot('etfCategoryChart', [trace], layout, { responsive: true });
}

function renderPositionSizeDistribution() {
    const buckets = {
        '<$100K': 0,
        '$100K-$500K': 0,
        '$500K-$1M': 0,
        '$1M-$5M': 0,
        '>$5M': 0
    };
    
    FILTERED_DATA.forEach(d => {
        const notional = d.notional;
        if (notional < 100000) buckets['<$100K']++;
        else if (notional < 500000) buckets['$100K-$500K']++;
        else if (notional < 1000000) buckets['$500K-$1M']++;
        else if (notional < 5000000) buckets['$1M-$5M']++;
        else buckets['>$5M']++;
    });
    
    const trace = {
        x: Object.keys(buckets),
        y: Object.values(buckets),
        type: 'bar',
        marker: { color: '#1A1A1A' }
    };
    
    const layout = {
        title: 'Position Size Distribution',
        xaxis: { title: 'Position Size' },
        yaxis: { title: 'Count' }
    };
    
    Plotly.newPlot('positionSizeChart', [trace], layout, { responsive: true });
}

// ============================================================================
// TAB 5: DIFFERENTIAL METRICS (ENHANCED WITH POSITION-LEVEL ANALYSIS)
// ============================================================================

function renderTab5_DifferentialMetrics() {
    renderQuadrantScatterEnhanced();
    renderQuadrantTables();
}

function renderQuadrantScatterEnhanced() {
    const q1 = [], q2 = [], q3 = [], q4 = [];
    
    FILTERED_DATA.forEach(d => {
        const point = {
            x: d.referenceGap,
            y: d.timingDifferential,
            symbol: d.symbol,
            notional: d.notional,
            size: Math.sqrt(d.notional / 1e6) * 3,
            company: d.companyName,
            date: d.date
        };
        
        const refGap = d.referenceGap;
        const timingDiff = d.timingDifferential;
        
        if (QUADRANT_MODE === 'zero') {
            if (refGap >= 0 && timingDiff >= 0) q1.push(point);
            else if (refGap < 0 && timingDiff >= 0) q2.push(point);
            else if (refGap < 0 && timingDiff < 0) q3.push(point);
            else q4.push(point);
        } else {
            const refThreshold = 10, diffThreshold = 5;
            if (refGap >= refThreshold && timingDiff >= diffThreshold) q1.push(point);
            else if (refGap < -refThreshold && timingDiff >= diffThreshold) q2.push(point);
            else if (refGap < -refThreshold && timingDiff < -diffThreshold) q3.push(point);
            else if (refGap >= refThreshold && timingDiff < -diffThreshold) q4.push(point);
        }
    });
    
    document.getElementById('q1Count').textContent = q1.length;
    document.getElementById('q2Count').textContent = q2.length;
    document.getElementById('q3Count').textContent = q3.length;
    document.getElementById('q4Count').textContent = q4.length;
    
    const createTrace = (data, name, color) => ({
        x: data.map(p => p.x),
        y: data.map(p => p.y),
        mode: 'markers',
        type: 'scatter',
        name: name,
        marker: {
            size: data.map(p => p.size),
            color: color,
            line: { color: 'rgba(0,0,0,0.2)', width: 1 }
        },
        text: data.map(p => 
            `<b>${p.symbol}</b><br>` +
            `${p.company ? p.company.substring(0, 30) : ''}<br>` +
            `Notional: $${(p.notional / 1e6).toFixed(1)}M<br>` +
            `Ref Gap: ${p.x.toFixed(1)} bps<br>` +
            `Timing Diff: ${p.y.toFixed(1)} bps<br>` +
            `Date: ${p.date}`
        ),
        hovertemplate: '%{text}<extra></extra>',
        customdata: data.map(p => p.symbol)
    });
    
    const traces = [
        createTrace(q1, 'Q1: Momentum', '#059669'),
        createTrace(q2, 'Q2: Mean Reversion', '#D97706'),
        createTrace(q3, 'Q3: Protection', '#DC2626'),
        createTrace(q4, 'Q4: Top Tick', '#7C3AED')
    ];
    
    const layout = {
        title: {
            text: 'Quadrant Analysis: Timing Differential vs Reference Gap',
            font: { size: 18, family: 'Source Sans 3' }
        },
        xaxis: {
            title: 'Reference Gap (bps)',
            zeroline: true,
            zerolinewidth: 2,
            zerolinecolor: '#999'
        },
        yaxis: {
            title: 'Timing Differential (bps)',
            zeroline: true,
            zerolinewidth: 2,
            zerolinecolor: '#999'
        },
        hovermode: 'closest',
        showlegend: true,
        legend: { orientation: 'h', y: -0.15 }
    };
    
    const config = { responsive: true };
    
    Plotly.newPlot('quadrantScatter', traces, layout, config);
    
    // Add click handler for modal
    document.getElementById('quadrantScatter').on('plotly_click', function(data) {
        const symbol = data.points[0].customdata;
        const position = FILTERED_DATA.find(d => d.symbol === symbol && 
            Math.abs(d.referenceGap - data.points[0].x) < 0.01 &&
            Math.abs(d.timingDifferential - data.points[0].y) < 0.01
        );
        if (position) showPositionModalEnhanced(position);
    });
}

function renderQuadrantTables() {
    const container = document.getElementById('quadrantTables');
    container.innerHTML = '<h3 style="margin: 30px 0 20px 0; font-family: Cormorant Garamond; font-size: 24px;">Position-Level Analysis</h3>';
    
    // Create comprehensive table
    const table = document.createElement('table');
    table.className = 'quadrant-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th onclick="sortQuadrantTable('symbol')">SYMBOL</th>
                <th onclick="sortQuadrantTable('name')">NAME</th>
                <th onclick="sortQuadrantTable('type')">TYPE</th>
                <th onclick="sortQuadrantTable('sector')">SECTOR</th>
                <th onclick="sortQuadrantTable('notional')">NOTIONAL</th>
                <th onclick="sortQuadrantTable('timingDiff')">TIMING DIFF (bps)</th>
                <th onclick="sortQuadrantTable('refGap')">REF GAP (bps)</th>
                <th onclick="sortQuadrantTable('vsOpen')">VS OPEN (bps)</th>
                <th onclick="sortQuadrantTable('vsClose')">VS CLOSE (bps)</th>
                <th onclick="sortQuadrantTable('quad')">QUAD</th>
                <th>DIR</th>
            </tr>
        </thead>
        <tbody id="quadrantTableBody"></tbody>
    `;
    
    container.appendChild(table);
    
    // Populate table (top 100 by absolute timing differential)
    const tbody = document.getElementById('quadrantTableBody');
    const sorted = [...FILTERED_DATA].sort((a, b) => 
        Math.abs(b.timingDifferential) - Math.abs(a.timingDifferential)
    ).slice(0, 100);
    
    sorted.forEach(row => {
        const quadrant = getQuadrant(row);
        const quadColors = {
            'Q1': '#059669',
            'Q2': '#D97706',
            'Q3': '#DC2626',
            'Q4': '#7C3AED'
        };
        
        const vsOpen = ((row.nextOpen - row.vwap) / row.vwap) * 10000;
        const vsClose = ((row.nextClose - row.vwap) / row.vwap) * 10000;
        
        const tr = document.createElement('tr');
        tr.onclick = () => showPositionModalEnhanced(row);
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
            <td style="font-weight: 600;">${row.symbol}</td>
            <td style="color: #666;">${row.companyName ? row.companyName.substring(0, 20) : '-'}</td>
            <td>${row.assetType}</td>
            <td>${row.sector ? row.sector.substring(0, 12) : '-'}</td>
            <td style="text-align: right;">$${(row.notional / 1e6).toFixed(1)}M</td>
            <td class="${row.timingDifferential >= 0 ? 'positive' : 'negative'}" style="text-align: right; font-weight: 600;">
                ${row.timingDifferential.toFixed(0)}
            </td>
            <td class="${row.referenceGap >= 0 ? 'positive' : 'negative'}" style="text-align: right;">
                ${row.referenceGap.toFixed(0)}
            </td>
            <td class="${vsOpen >= 0 ? 'positive' : 'negative'}" style="text-align: right;">
                ${vsOpen.toFixed(0)}
            </td>
            <td class="${vsClose >= 0 ? 'positive' : 'negative'}" style="text-align: right;">
                ${vsClose.toFixed(0)}
            </td>
            <td style="color: ${quadColors[quadrant]}; font-weight: 700; text-align: center;">
                ${quadrant}
            </td>
            <td style="text-align: center;">${row.directionalConsistency}</td>
        `;
        tbody.appendChild(tr);
    });
}

function sortQuadrantTable(column) {
    // Stub for sorting - could implement full sorting logic
    console.log('Sort by:', column);
}

function getQuadrant(row) {
    const refGap = row.referenceGap;
    const timingDiff = row.timingDifferential;
    
    if (QUADRANT_MODE === 'zero') {
        if (refGap >= 0 && timingDiff >= 0) return 'Q1';
        if (refGap < 0 && timingDiff >= 0) return 'Q2';
        if (refGap < 0 && timingDiff < 0) return 'Q3';
        return 'Q4';
    } else {
        const refThreshold = 10, diffThreshold = 5;
        if (refGap >= refThreshold && timingDiff >= diffThreshold) return 'Q1';
        if (refGap < -refThreshold && timingDiff >= diffThreshold) return 'Q2';
        if (refGap < -refThreshold && timingDiff < -diffThreshold) return 'Q3';
        if (refGap >= refThreshold && timingDiff < -diffThreshold) return 'Q4';
        return '-';
    }
}

function setQuadrantMode(mode) {
    QUADRANT_MODE = mode;
    document.querySelectorAll('.mode-toggle button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    renderTab5_DifferentialMetrics();
}

// ============================================================================
// TAB 6: STATISTICAL ANALYSIS
// ============================================================================

function renderTab6_Statistical() {
    renderCorrelationHeatmap();
    renderNotionalScatter();
    renderSectorBoxPlots();
}

function renderCorrelationHeatmap() {
    const metrics = ['notional', 'volume', 'referenceGap', 'timingDifferential', 'executions'];
    const labels = ['Notional', 'Volume', 'Ref Gap', 'Timing Diff', 'Executions'];
    
    const matrix = metrics.map(m1 => 
        metrics.map(m2 => calculateCorrelation(FILTERED_DATA, m1, m2))
    );
    
    const trace = {
        z: matrix,
        x: labels,
        y: labels,
        type: 'heatmap',
        colorscale: 'RdBu',
        zmid: 0,
        colorbar: { title: 'Correlation' }
    };
    
    const layout = {
        title: 'Correlation Matrix',
        xaxis: { side: 'bottom' },
        yaxis: { autorange: 'reversed' }
    };
    
    Plotly.newPlot('correlationHeatmap', [trace], layout, { responsive: true });
}

function calculateCorrelation(data, metric1, metric2) {
    const x = data.map(d => d[metric1]);
    const y = data.map(d => d[metric2]);
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
}

function renderNotionalScatter() {
    const topSectors = [...new Set(FILTERED_DATA.map(d => d.sector))]
        .map(sec => ({
            sector: sec,
            count: FILTERED_DATA.filter(d => d.sector === sec).length
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(s => s.sector);
    
    const colors = ['#1A1A1A', '#D4AF37', '#666666', '#999999', '#CCCCCC'];
    
    const traces = topSectors.map((sector, i) => {
        const sectorData = FILTERED_DATA.filter(d => d.sector === sector);
        return {
            x: sectorData.map(d => d.notional / 1e6),
            y: sectorData.map(d => d.timingDifferential),
            mode: 'markers',
            type: 'scatter',
            name: sector,
            marker: { color: colors[i], size: 6 }
        };
    });
    
    const layout = {
        title: 'Notional vs Timing Differential (Top 5 Sectors)',
        xaxis: { title: 'Notional ($M)' },
        yaxis: { title: 'Timing Differential (bps)' },
        showlegend: true
    };
    
    Plotly.newPlot('notionalScatter', traces, layout, { responsive: true });
}

function renderSectorBoxPlots() {
    const topSectors = [...new Set(FILTERED_DATA.map(d => d.sector))]
        .map(sec => ({
            sector: sec,
            count: FILTERED_DATA.filter(d => d.sector === sec).length
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(s => s.sector);
    
    const traces = topSectors.map(sector => {
        const sectorData = FILTERED_DATA.filter(d => d.sector === sector);
        return {
            y: sectorData.map(d => d.timingDifferential),
            type: 'box',
            name: sector,
            boxmean: 'sd'
        };
    });
    
    const layout = {
        title: 'Timing Differential Distribution by Sector',
        yaxis: { title: 'Timing Differential (bps)' },
        showlegend: false
    };
    
    Plotly.newPlot('sectorBoxPlots', traces, layout, { responsive: true });
}

// ============================================================================
// TAB 7: DATA EXPLORER (ENHANCED WITH PRICING & SORTING/FILTERING)
// ============================================================================

function renderTab7_DataExplorer() {
    // Render filter controls
    renderExplorerFilters();
    renderDataExplorer();
}

function renderExplorerFilters() {
    const filterHTML = `
        <div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap;">
            <div>
                <label>Symbol:</label>
                <input type="text" id="explorerSymbolFilter" placeholder="Search symbol..." 
                    onchange="updateExplorerFilters()" style="padding: 5px; width: 150px;">
            </div>
            <div>
                <label>Date From:</label>
                <input type="date" id="explorerDateFrom" onchange="updateExplorerFilters()" 
                    style="padding: 5px;">
            </div>
            <div>
                <label>Date To:</label>
                <input type="date" id="explorerDateTo" onchange="updateExplorerFilters()" 
                    style="padding: 5px;">
            </div>
            <div>
                <label>Gap Direction:</label>
                <select id="explorerGapFilter" onchange="updateExplorerFilters()" 
                    style="padding: 5px;">
                    <option value="all">All</option>
                    <option value="positive">Positive (≥0)</option>
                    <option value="negative">Negative (<0)</option>
                </select>
            </div>
            <button onclick="resetExplorerFilters()" 
                style="padding: 5px 15px; background: #666; color: white; border: none; cursor: pointer;">
                Reset Filters
            </button>
        </div>
    `;
    
    const container = document.getElementById('explorerFilters');
    if (container) container.innerHTML = filterHTML;
}

function updateExplorerFilters() {
    EXPLORER_FILTERS.symbol = (document.getElementById('explorerSymbolFilter')?.value || '').toUpperCase();
    EXPLORER_FILTERS.dateFrom = document.getElementById('explorerDateFrom')?.value || '';
    EXPLORER_FILTERS.dateTo = document.getElementById('explorerDateTo')?.value || '';
    EXPLORER_FILTERS.gapDirection = document.getElementById('explorerGapFilter')?.value || 'all';
    
    renderDataExplorer();
}

function resetExplorerFilters() {
    EXPLORER_FILTERS = { symbol: '', dateFrom: '', dateTo: '', gapDirection: 'all' };
    if (document.getElementById('explorerSymbolFilter')) document.getElementById('explorerSymbolFilter').value = '';
    if (document.getElementById('explorerDateFrom')) document.getElementById('explorerDateFrom').value = '';
    if (document.getElementById('explorerDateTo')) document.getElementById('explorerDateTo').value = '';
    if (document.getElementById('explorerGapFilter')) document.getElementById('explorerGapFilter').value = 'all';
    renderDataExplorer();
}

function renderDataExplorer() {
    // Apply filters
    let filtered = FILTERED_DATA.filter(row => {
        if (EXPLORER_FILTERS.symbol && !row.symbol.includes(EXPLORER_FILTERS.symbol)) return false;
        if (EXPLORER_FILTERS.dateFrom && row.date < EXPLORER_FILTERS.dateFrom) return false;
        if (EXPLORER_FILTERS.dateTo && row.date > EXPLORER_FILTERS.dateTo) return false;
        if (EXPLORER_FILTERS.gapDirection === 'positive' && row.referenceGap < 0) return false;
        if (EXPLORER_FILTERS.gapDirection === 'negative' && row.referenceGap >= 0) return false;
        return true;
    });
    
    // Apply sorting
    if (EXPLORER_SORT.column) {
        filtered = sortExplorerData(filtered, EXPLORER_SORT.column, EXPLORER_SORT.ascending);
    }
    
    const tbody = document.getElementById('explorerTableBody');
    tbody.innerHTML = '';
    
    const start = (CURRENT_PAGE - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    const pageData = filtered.slice(start, end);
    
    pageData.forEach(row => {
        const tr = document.createElement('tr');
        tr.onclick = () => showPositionModalEnhanced(row);
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
            <td>${row.symbol}</td>
            <td>${row.companyName ? row.companyName.substring(0, 25) : '-'}</td>
            <td>${row.date}</td>
            <td>${row.assetType}</td>
            <td style="text-align: right;">$${(row.notional / 1e6).toFixed(2)}M</td>
            <td style="text-align: right;">${(row.volume / 1000).toFixed(0)}K</td>
            <td class="${row.timingDifferential >= 0 ? 'positive' : 'negative'}" style="text-align: right;">
                ${row.timingDifferential.toFixed(1)} bps
            </td>
            <td class="${row.referenceGap >= 0 ? 'positive' : 'negative'}" style="text-align: right;">
                ${row.referenceGap.toFixed(1)} bps
            </td>
            <td style="text-align: center;">${row.directionalConsistency}</td>
            <td><button class="view-btn">View</button></td>
        `;
        
        const viewBtn = tr.querySelector('.view-btn');
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            showPositionModalEnhanced(row);
        };
        
        tbody.appendChild(tr);
    });
    
    renderPagination('explorerPagination', filtered.length, CURRENT_PAGE, (page) => {
        CURRENT_PAGE = page;
        renderDataExplorer();
    });
    
    // Update result count
    document.getElementById('explorerResultCount').textContent = 
        `Showing ${pageData.length} of ${filtered.length.toLocaleString()} observations`;
}

function sortExplorer(column) {
    if (EXPLORER_SORT.column === column) {
        EXPLORER_SORT.ascending = !EXPLORER_SORT.ascending;
    } else {
        EXPLORER_SORT.column = column;
        EXPLORER_SORT.ascending = true;
    }
    renderDataExplorer();
}

function sortExplorerData(data, column, ascending) {
    const sorted = [...data].sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        
        if (typeof aVal === 'string') {
            return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        
        return ascending ? aVal - bVal : bVal - aVal;
    });
    
    return sorted;
}

// ============================================================================
// ENHANCED POSITION MODAL (WITH PRICING DATA)
// ============================================================================

function showPositionModalEnhanced(row) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.onclick = () => modal.remove();
    
    const vsOpen = ((row.nextOpen - row.vwap) / row.vwap) * 10000;
    const vsClose = ((row.nextClose - row.vwap) / row.vwap) * 10000;
    const quadrant = getQuadrant(row);
    
    modal.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
                <div>
                    <h2 style="margin: 0; font-family: Cormorant Garamond; font-size: 28px;">${row.symbol}</h2>
                    <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">${row.companyName || 'N/A'}</p>
                </div>
                <button onclick="this.closest('.modal').remove()" 
                    style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 25px;">
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">ASSET TYPE</div>
                    <div style="font-weight: 600; font-size: 16px;">${row.assetType}</div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">SECTOR</div>
                    <div style="font-weight: 600; font-size: 16px;">${row.sector || '-'}</div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">DATE</div>
                    <div style="font-weight: 600; font-size: 16px;">${row.date}</div>
                </div>
            </div>
            
            <h3 style="margin: 25px 0 15px 0; font-family: Cormorant Garamond; font-size: 20px; border-bottom: 2px solid #1A1A1A; padding-bottom: 8px;">Position Details</h3>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">NOTIONAL</div>
                    <div style="font-weight: 600; font-size: 18px;">$${(row.notional / 1e6).toFixed(2)}M</div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">VOLUME</div>
                    <div style="font-weight: 600; font-size: 18px;">${(row.volume / 1000).toFixed(0)}K shares</div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">EXECUTIONS</div>
                    <div style="font-weight: 600; font-size: 18px;">${row.executions}</div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">DIRECTIONAL CONSISTENCY</div>
                    <div style="font-weight: 600; font-size: 18px;">${row.directionalConsistency}</div>
                </div>
            </div>
            
            <h3 style="margin: 25px 0 15px 0; font-family: Cormorant Garamond; font-size: 20px; border-bottom: 2px solid #1A1A1A; padding-bottom: 8px;">Pricing Data</h3>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">PRIOR CLOSE</div>
                    <div style="font-weight: 600; font-size: 18px;">$${row.priorClose.toFixed(2)}</div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">VWAP</div>
                    <div style="font-weight: 600; font-size: 18px;">$${row.vwap.toFixed(2)}</div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">NEXT OPEN</div>
                    <div style="font-weight: 600; font-size: 18px;">$${row.nextOpen.toFixed(2)}</div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">NEXT CLOSE</div>
                    <div style="font-weight: 600; font-size: 18px;">$${row.nextClose.toFixed(2)}</div>
                </div>
            </div>
            
            <h3 style="margin: 25px 0 15px 0; font-family: Cormorant Garamond; font-size: 20px; border-bottom: 2px solid #1A1A1A; padding-bottom: 8px;">Performance Metrics</h3>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">REFERENCE GAP</div>
                    <div class="${row.referenceGap >= 0 ? 'positive' : 'negative'}" style="font-weight: 600; font-size: 18px;">
                        ${row.referenceGap.toFixed(1)} bps
                    </div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">TIMING DIFFERENTIAL</div>
                    <div class="${row.timingDifferential >= 0 ? 'positive' : 'negative'}" style="font-weight: 600; font-size: 18px;">
                        ${row.timingDifferential.toFixed(1)} bps
                    </div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">VS NEXT OPEN</div>
                    <div class="${vsOpen >= 0 ? 'positive' : 'negative'}" style="font-weight: 600; font-size: 18px;">
                        ${vsOpen.toFixed(1)} bps
                    </div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">VS NEXT CLOSE</div>
                    <div class="${vsClose >= 0 ? 'positive' : 'negative'}" style="font-weight: 600; font-size: 18px;">
                        ${vsClose.toFixed(1)} bps
                    </div>
                </div>
                <div>
                    <div style="color: #666; font-size: 12px; margin-bottom: 5px;">QUADRANT</div>
                    <div style="font-weight: 700; font-size: 18px; color: ${
                        quadrant === 'Q1' ? '#059669' :
                        quadrant === 'Q2' ? '#D97706' :
                        quadrant === 'Q3' ? '#DC2626' :
                        quadrant === 'Q4' ? '#7C3AED' : '#666'
                    };">
                        ${quadrant}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function showPositionModal(row) {
    showPositionModalEnhanced(row);
}

// ============================================================================
// PAGINATION HELPER
// ============================================================================

function renderPagination(containerId, totalRows, currentPage, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination">';
    
    if (currentPage > 1) {
        html += `<button onclick="(${callback})(1)">First</button>`;
        html += `<button onclick="(${callback})(${currentPage - 1})">Prev</button>`;
    }
    
    html += `<span>Page ${currentPage} of ${totalPages}</span>`;
    
    if (currentPage < totalPages) {
        html += `<button onclick="(${callback})(${currentPage + 1})">Next</button>`;
        html += `<button onclick="(${callback})(${totalPages})">Last</button>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// ============================================================================
// TAB HTML BUILDERS
// ============================================================================

function buildAllTabs() {
    document.getElementById('tab1').innerHTML = buildTab1HTML();
    document.getElementById('tab2').innerHTML = buildTab2HTML();
    document.getElementById('tab3').innerHTML = buildTab3HTML();
    document.getElementById('tab4').innerHTML = buildTab4HTML();
    document.getElementById('tab5').innerHTML = buildTab5HTML();
    document.getElementById('tab6').innerHTML = buildTab6HTML();
    document.getElementById('tab7').innerHTML = buildTab7HTML();
}

function buildTab1HTML() {
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Notional</div>
                <div class="stat-value" id="statNotional">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Observations</div>
                <div class="stat-value" id="statObservations">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Volume</div>
                <div class="stat-value" id="statVolume">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Timing Differential</div>
                <div class="stat-value" id="statAvgDiff">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Directional Consistency</div>
                <div class="stat-value" id="statConsistency">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Unique Symbols</div>
                <div class="stat-value" id="statSymbols">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Trading Days</div>
                <div class="stat-value" id="statDates">-</div>
            </div>
        </div>
    `;
}

function buildTab2HTML() {
    return `
        <div style="margin-bottom: 20px;">
            <label>Select Date:</label>
            <select id="dailyDateSelect" onchange="renderDailyData(this.value)" style="padding: 8px; margin-left: 10px;">
            </select>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Daily Notional</div>
                <div class="stat-value" id="dailyNotional">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Observations</div>
                <div class="stat-value" id="dailyObservations">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Volume</div>
                <div class="stat-value" id="dailyVolume">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Differential</div>
                <div class="stat-value" id="dailyAvgDiff">-</div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
            <div id="dailyTrendChart"></div>
            <div id="dailyNotionalChart"></div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
            <div id="dailySectorChart"></div>
            <div id="dailyHistogram"></div>
        </div>
        
        <h3>Daily Positions (Top 50)</h3>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Company Name</th>
                        <th>Type</th>
                        <th>Notional</th>
                        <th>Volume</th>
                        <th>Timing Differential</th>
                        <th>Dir</th>
                    </tr>
                </thead>
                <tbody id="dailyTableBody"></tbody>
            </table>
        </div>
    `;
}

function buildTab3HTML() {
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Unique Symbols</div>
                <div class="stat-value" id="aggUniqueSymbols">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Weighted Avg Differential</div>
                <div class="stat-value" id="aggWeightedAvg">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Top Symbol by Notional</div>
                <div class="stat-value" id="aggTopSymbol">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Trading Days</div>
                <div class="stat-value" id="aggAvgDays">-</div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
            <div id="aggregateChart"></div>
            <div id="aggregatePerformanceChart"></div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin: 30px 0 15px 0;">
            <h3>Symbol-Level Aggregation</h3>
            <div>
                <input type="text" id="aggSearch" placeholder="Search symbols..." 
                    onkeyup="renderAggregateTable(1)" style="padding: 8px; margin-right: 10px;">
                <button onclick="exportAggregateCSV()" class="btn-primary">Export CSV</button>
            </div>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Company Name</th>
                        <th>Trading Days</th>
                        <th>Total Notional</th>
                        <th>Weighted Alpha (bps)</th>
                        <th>Continuity Rate</th>
                    </tr>
                </thead>
                <tbody id="aggregateTableBody"></tbody>
            </table>
        </div>
        <div id="aggregatePagination"></div>
    `;
}

function buildTab4HTML() {
    return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
            <div id="assetTypeChart"></div>
            <div id="positionSizeChart"></div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div id="sectorChart"></div>
            <div id="etfCategoryChart"></div>
        </div>
    `;
}

function buildTab5HTML() {
    return `
        <div class="mode-toggle" style="margin-bottom: 20px;">
            <button class="active" onclick="setQuadrantMode('zero')">Zero-Based</button>
            <button onclick="setQuadrantMode('threshold')">Threshold (±10/±5 bps)</button>
        </div>
        
        <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
            <div class="stat-card">
                <div class="stat-label">Q1: Momentum</div>
                <div class="stat-value" id="q1Count" style="color: #059669;">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Q2: Mean Reversion</div>
                <div class="stat-value" id="q2Count" style="color: #D97706;">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Q3: Protection</div>
                <div class="stat-value" id="q3Count" style="color: #DC2626;">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Q4: Top Tick</div>
                <div class="stat-value" id="q4Count" style="color: #7C3AED;">-</div>
            </div>
        </div>
        
        <div id="quadrantScatter" style="margin: 30px 0;"></div>
        
        <div id="quadrantTables"></div>
    `;
}

function buildTab6HTML() {
    return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
            <div id="correlationHeatmap"></div>
            <div id="notionalScatter"></div>
        </div>
        
        <div id="sectorBoxPlots"></div>
    `;
}

function buildTab7HTML() {
    return `
        <div id="explorerFilters"></div>
        
        <div style="margin-bottom: 15px;">
            <span id="explorerResultCount" style="font-weight: 600;">-</span>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th onclick="sortExplorer('symbol')" style="cursor: pointer;">Symbol ↕</th>
                        <th>Company Name</th>
                        <th onclick="sortExplorer('date')" style="cursor: pointer;">Date ↕</th>
                        <th>Type</th>
                        <th onclick="sortExplorer('notional')" style="cursor: pointer;">Notional ↕</th>
                        <th>Volume</th>
                        <th onclick="sortExplorer('timingDifferential')" style="cursor: pointer;">Timing Diff ↕</th>
                        <th onclick="sortExplorer('referenceGap')" style="cursor: pointer;">Ref Gap ↕</th>
                        <th>Dir</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="explorerTableBody"></tbody>
            </table>
        </div>
        <div id="explorerPagination"></div>
    `;
}
