# Sapinover Overnight Trading Analysis Dashboard v3.0

## Files
- `index.html` - Main dashboard page (dark theme with gold accents)
- `dashboard.js` - All JavaScript functionality
- `data.json` - 22,387 observations from Dec 1, 2025 - Jan 16, 2026
- `FullLogo_NoBuffer__1_.png` - Sapinover logo

## Features
1. **Executive Summary** - Hero stats, daily notional/volume charts, price continuity trends
2. **Daily Analysis** - Date picker, bar charts with 5-day MA, sector breakdown, sortable tables
3. **Market Structure** - Asset type distribution, sector analysis, ETF leverage breakdown
4. **Quadrant Analysis** - Interactive scatter plot (Plotly), position-level tables
5. **Data Explorer** - Full filtering, sorting, pagination, CSV export
6. **Methodology** - Calculation definitions, academic framework

## Key Improvements
- Sectors properly display ETF_Category for ETFs (no more "None")
- Winsorized view (1st/99th percentile) as default with toggle for full range
- Clean, readable scatter plot (not compressed by outliers)
- Dark theme with gold accents for institutional presentation
- Sortable columns throughout
- Export functionality

## Deployment

### GitHub Pages
1. Create new repository
2. Upload all 4 files to root
3. Settings → Pages → Branch: main, Folder: / (root)
4. Access at: https://USERNAME.github.io/REPO-NAME/

### Local Testing
```bash
python -m http.server 8000
# Open: http://localhost:8000/
```

## Data Update
To update with new data, regenerate `data.json` using the parquet processing script.
The JSON format uses lookup tables for compression (~2.4MB for 22K observations).

---
Generated: January 2026
Sapinover LLC - Market Microstructure Research
