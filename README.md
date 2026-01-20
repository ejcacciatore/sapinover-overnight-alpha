# Sapinover Research - Overnight Alpha Analysis Dashboard

**Independent Market Microstructure Research on BlueOcean ATS**

![Sapinover Research](logo.png)

## Overview

This interactive dashboard analyzes overnight equity trading patterns from BlueOcean Alternative Trading System (ATS), examining alpha capture efficiency across 18 trading days from November-December 2025.

### Key Metrics
- **$40.6 Billion** Total Notional Volume
- **13,967** Trading Observations  
- **1,908** Unique Symbols
- **18** Trading Days Analyzed

## Features

### 📊 Interactive Analytics
- **Overview Tab**: Daily volume trends with notional-weighted alpha overlay
- **Alpha Analysis Tab**: Scatter plot visualization by quadrant, distribution histograms
- **Breakdown Tab**: Sector treemaps, top symbols, leverage performance
- **Data Explorer Tab**: Full sortable/filterable table with CSV export

### 🔍 Advanced Filtering
- Date selection (single day or custom range)
- Asset type (Stocks vs ETFs)
- Sector and ETF category filters
- Leverage multiple (1x, 2x, 3x, Inverse)
- Alpha performance (positive/negative)
- Symbol search

### 📈 Aggregation
All multi-day views use **notional-weighted averages** for alpha metrics, providing institutional-grade analysis that properly weights larger positions.

## Files

```
sapinover-dashboard/
├── index.html    # Main dashboard (self-contained)
├── data.json     # Trading data (0.9 MB, compact format)
├── logo.png      # Sapinover brand logo
└── README.md     # This file
```

## Deployment

### GitHub Pages
1. Create a new repository on GitHub
2. Upload all files from this directory
3. Go to Settings → Pages → Source: "main" branch
4. Your dashboard will be live at `https://[username].github.io/[repo-name]/`

### Local Testing
Simply open `index.html` in any modern browser. The dashboard loads data from `data.json` in the same directory.

## Adding New Data

To add new trading days:

1. Process new daily data through the BlueOcean enrichment pipeline
2. Merge with Symbol Master for metadata
3. Regenerate `data.json` using the compact format:
   - Symbol lookup table for deduplication
   - Sector/Category indices
   - Compact row arrays

The dashboard automatically detects the date range from the data and updates all visualizations.

## Data Schema

### Compact JSON Structure
```json
{
  "meta": {
    "generated": "2026-01-19 23:40:06",
    "date_range": ["2025-11-04", "2025-12-31"],
    "trading_days": 18,
    "total_observations": 13967,
    "total_notional": 40557409803,
    "unique_symbols": 1908,
    "dates": ["2025-11-04", "2025-12-01", ...]
  },
  "sectors": ["Basic Materials", "Communication Services", ...],
  "etf_categories": ["Bank Loan", "China Region", ...],
  "symbols": [
    ["AAPL", "Apple Inc.", "Stock", 10, 0, "1x"],
    ...
  ],
  "data": [
    [0, "2025-11-04", 1500000, 5000, 25, 45.2, 23.1, 1, "UP"],
    ...
  ]
}
```

## Research Framework

Based on Lou, Polk & Skouras (2019) "A tug of war: Overnight versus intraday expected returns" examining how equity returns concentrate disproportionately in overnight sessions.

### Key Concepts
- **Overnight Continuity**: Percentage of positions where gap direction persists
- **Captured Alpha**: Alpha realized through execution timing
- **Uncaptured Alpha**: Market gap that could have been captured with optimal execution
- **Quadrants**: Q1-Q4 classification based on gap direction and capture success

## Disclaimer

This analysis constitutes independent research on market microstructure and execution quality. It is not investment advice, and no investment recommendations are made or implied. Past performance does not guarantee future results.

Sapinover LLC is retained by BlueOcean ATS for market microstructure research and receives a flat monthly fee. For investment decisions, consult a registered investment advisor.

---

**Sapinover LLC** | Independent Market Microstructure Research  
*Forward Thinking, Transparent Actions*
