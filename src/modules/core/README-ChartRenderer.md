# ChartRenderer Module

## Overview

The **ChartRenderer** is the advanced data visualization engine for the Property Expense Dashboard. It provides comprehensive D3.js chart rendering capabilities with interactive features, responsive design, and smooth animations. The module handles all chart types including sankey diagrams, bar charts, line charts, and trend analysis visualizations.

## Architecture

### Core Responsibilities

- **D3.js Integration**: Complete chart rendering and lifecycle management
- **Interactive Visualizations**: Tooltips, legends, click handlers, and hover effects
- **Responsive Design**: Automatic chart resizing and mobile optimization
- **Animation System**: Smooth transitions and performance-optimized animations
- **Multi-Chart Support**: Overview, trends, comparison, and category charts

### Key Features

- **Multiple Chart Types**: Sankey diagrams, stacked bars, line charts, trend analysis
- **Interactive Elements**: Tooltips, legends, click handlers, hover states
- **Responsive Layout**: Automatic scaling and mobile-friendly design
- **Performance Optimization**: Efficient rendering and memory management
- **Accessibility**: ARIA labels, keyboard navigation, color contrast compliance
- **Error Handling**: Graceful fallbacks and comprehensive error recovery

## Supported Chart Types

### 1. Overview Charts

- **Stacked Bar Charts**: Property expense breakdown by category
- **Sankey Diagrams**: Flow visualization from properties to expense categories
- **Interactive Segments**: Clickable bars with detailed tooltips

### 2. Trend Analysis Charts

- **Quarterly Trends**: Line charts showing expense patterns over quarters
- **Yearly Trends**: Year-over-year comparison with change indicators
- **Monthly Trends**: Detailed monthly expense analysis (estimated)

### 3. Comparison Charts

- **Property Comparison**: Side-by-side expense comparison across properties
- **Category Breakdown**: Expense distribution by category
- **Interactive Bars**: Clickable elements with detailed information

### 4. Category Charts

- **Category Overview**: Bar chart showing expenses by category
- **Top Categories**: Highlighting highest expense categories
- **Category Trends**: Category-specific trend analysis

## API Reference

### Constructor

```javascript
const chartRenderer = new ChartRenderer(dataManager, uiManager, formatter);
```

**Parameters:**

- `dataManager` (DataManager): Data source for chart data
- `uiManager` (UIManager): UI management for DOM operations
- `formatter` (Formatter): Data formatting utilities

### Core Methods

#### Chart Rendering

```javascript
// Initialize chart renderer
await chartRenderer.initialize();

// Render expense chart based on current view
await chartRenderer.renderExpenseChart();

// Render overview sankey diagram
await chartRenderer.renderOverviewSankey();

// Handle window resize
chartRenderer.resize();
```

#### Chart Types

```javascript
// Render specific chart types
await chartRenderer.renderOverviewChart(container);
await chartRenderer.renderTrendsChart(container);
await chartRenderer.renderComparisonChart(container);
await chartRenderer.renderCategoriesChart(container);
```

#### Trend Analysis

```javascript
// Render trend charts
await chartRenderer.renderQuarterlyTrends(container, "Custom Title");
await chartRenderer.renderYearlyTrends(container);
await chartRenderer.renderMonthlyTrends(container);
```

#### Interactive Features

```javascript
// Show tooltip
chartRenderer.showTooltip(event, {
    title: "Property Name",
    value: "$5,000",
    percentage: "25% of total"
});

// Hide tooltip
chartRenderer.hideTooltip();

// Handle chart interactions
chartRenderer.handlePropertyClick(property);
chartRenderer.handleCategoryClick(category, categoryTotals);
```

## Configuration

### Chart Configuration

```javascript
// Default chart configuration
const chartConfig = {
    margins: { top: 40, right: 40, bottom: 60, left: 80 },
    colors: {
        properties: ['#1FB8CD', '#FFC185', '#B4413C'],
        categories: ['#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454'],
        trends: {
            increasing: '#10B981',
            decreasing: '#EF4444',
            stable: '#6B7280'
        }
    },
    animations: {
        duration: 750,
        ease: d3.easeCubicInOut
    }
};
```

### Tooltip System

```javascript
// Tooltip configuration
const tooltipConfig = {
    position: 'absolute',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-base)',
    padding: 'var(--space-12)',
    boxShadow: 'var(--shadow-lg)',
    fontSize: 'var(--font-size-sm)',
    maxWidth: '300px',
    zIndex: 1000
};
```

## Data Flow

### Chart Data Preparation

```javascript
// Sankey diagram data preparation
const sankeyData = chartRenderer.prepareSankeyData();
// Returns: {
//   nodes: [{ id, name, type, color }, ...],
//   links: [{ source, target, value, property, category }, ...]
// }

// Quarterly trend data
const quarterlyData = chartRenderer.getQuarterlyData();
// Returns: [{ quarter: "Q1 2024", total: 15000 }, ...]

// Yearly trend data
const yearlyData = chartRenderer.getYearlyData();
// Returns: [{ year: "2024", total: 60000, quarters: 4 }, ...]
```

### Chart Rendering Pipeline

1. **Data Preparation**: Extract and format data for visualization
2. **Scale Calculation**: Determine chart dimensions and axis scales
3. **SVG Creation**: Generate SVG elements and containers
4. **Element Rendering**: Draw chart elements (bars, lines, nodes)
5. **Interaction Setup**: Add event handlers and tooltips
6. **Animation**: Apply smooth transitions and effects
7. **Cleanup**: Remove unused elements and optimize memory

## Interactive Features

### Tooltips

```javascript
// Automatic tooltip generation
chartRenderer.showTooltip(event, {
    title: "Downtown Office - Maintenance",
    value: "$5,000",
    percentage: "25% of property expenses"
});
```

### Click Handlers

```javascript
// Property click handling
chartRenderer.handlePropertyClick(property);
// Triggers: Detail panel, filtering, highlighting

// Category click handling
chartRenderer.handleCategoryClick(category, categoryTotals);
// Triggers: Category details, filtering, focus
```

### Hover Effects

- **Element Highlighting**: Visual feedback on hover
- **Tooltip Display**: Contextual information on hover
- **Legend Interaction**: Category highlighting on legend hover

## Responsive Design

### Automatic Scaling

```javascript
// Responsive chart dimensions
const dimensions = chartRenderer.calculateDimensions(container);
// Returns: { width, height, margins }

// Mobile optimization
if (isMobile) {
    chartConfig.margins = { top: 20, right: 20, bottom: 40, left: 60 };
    chartConfig.fontSize = 'var(--font-size-xs)';
}
```

### Breakpoint Handling

- **Desktop**: Full feature set with detailed tooltips
- **Tablet**: Optimized layouts with touch-friendly interactions
- **Mobile**: Simplified views with essential information only

## Performance Optimization

### Rendering Optimization

- **Virtual Scrolling**: Large dataset handling
- **Debounced Updates**: Prevent excessive re-rendering
- **Memory Management**: Proper cleanup of SVG elements
- **Lazy Loading**: Charts rendered on-demand

### Animation Performance

```javascript
// Optimized animations
const optimizedAnimation = {
    duration: isLowPerformance ? 300 : 750,
    easing: d3.easeCubicInOut,
    frameRate: 60
};
```

## Error Handling

### Chart Rendering Errors

```javascript
try {
    await chartRenderer.renderExpenseChart();
} catch (error) {
    console.error('Chart rendering failed:', error);
    chartRenderer.showErrorState(container, error);
}
```

### Data Validation

```javascript
// Validate chart data before rendering
if (!data || data.length === 0) {
    chartRenderer.showEmptyState(container, 'No data available');
    return;
}
```

### Fallback States

- **Empty State**: No data available message
- **Error State**: Rendering failure with retry option
- **Loading State**: Progress indicator during rendering

## Accessibility

### ARIA Support

```javascript
// Accessible chart elements
svg.attr('role', 'img')
   .attr('aria-label', 'Property expense overview chart')
   .attr('aria-describedby', 'chart-description');

// Accessible tooltips
tooltip.attr('role', 'tooltip')
       .attr('aria-live', 'polite');
```

### Keyboard Navigation

- **Tab Navigation**: Focusable chart elements
- **Enter/Space**: Activate chart interactions
- **Arrow Keys**: Navigate between data points
- **Escape**: Close tooltips and modals

### Color Contrast

- **WCAG Compliance**: Minimum contrast ratios met
- **Color Blind Support**: Multiple color schemes available
- **High Contrast Mode**: Enhanced visibility for accessibility

## Integration Points

### Dependencies

- **D3.js**: Core charting library (d3.sankey, d3.scale, etc.)
- **DataManager**: Data source and filtering
- **UIManager**: DOM manipulation and UI state
- **Formatter**: Number and currency formatting

### Module Integration

```javascript
// Integration with other modules
class ChartRenderer {
    constructor(dataManager, uiManager, formatter) {
        this.dataManager = dataManager;
        this.uiManager = uiManager;
        this.formatter = formatter;
    }

    // Methods that integrate with other modules
    async renderExpenseChart() {
        const view = this.dataManager.getCurrentView();
        const timePeriod = this.dataManager.getCurrentTimePeriod();
        const container = this.uiManager.getElement('expensesChartContent');

        // Render based on current state
        // ...
    }
}
```

## Testing

### Unit Tests

```javascript
describe('ChartRenderer', () => {
    test('should render overview chart successfully', async () => {
        const container = document.createElement('div');
        await chartRenderer.renderOverviewChart(container);

        expect(container.querySelector('svg')).toBeTruthy();
        expect(container.querySelectorAll('.expense-segment')).toBeTruthy();
    });

    test('should handle empty data gracefully', async () => {
        const container = document.createElement('div');
        await chartRenderer.renderTrendsChart(container);

        expect(container.textContent).toContain('No data available');
    });
});
```

### Integration Tests

- **Cross-browser Testing**: Chrome, Firefox, Safari, Edge
- **Mobile Testing**: iOS Safari, Android Chrome
- **Performance Testing**: Large dataset rendering
- **Accessibility Testing**: Screen reader compatibility

## Usage Examples

### Basic Chart Rendering

```javascript
// Initialize and render overview chart
const chartRenderer = new ChartRenderer(dataManager, uiManager, formatter);
await chartRenderer.initialize();

const container = document.getElementById('chart-container');
await chartRenderer.renderOverviewChart(container);
```

### Advanced Chart Configuration

```javascript
// Custom chart configuration
chartRenderer.chartConfig.colors.properties = ['#FF6B6B', '#4ECDC4', '#45B7D1'];
chartRenderer.chartConfig.animations.duration = 1000;

// Render with custom settings
await chartRenderer.renderTrendsChart(container, 'Custom Trend Analysis');
```

### Interactive Chart Handling

```javascript
// Handle chart interactions
chartRenderer.handlePropertyClick = (property) => {
    console.log('Property clicked:', property.name);
    // Show property details
    uiManager.showPropertyDetails(property);
};

chartRenderer.handleCategoryClick = (category, totals) => {
    console.log('Category clicked:', category);
    // Filter data by category
    dataManager.setCategoryFilter(category);
};
```

## Troubleshooting

### Common Issues

1. **Charts Not Rendering**
   - Check D3.js library loading
   - Verify container element exists
   - Check for JavaScript errors in console

2. **Performance Issues**
   - Reduce dataset size for large data
   - Check animation settings
   - Monitor memory usage

3. **Responsive Issues**
   - Verify CSS viewport settings
   - Check container dimensions
   - Test on different screen sizes

### Debug Information

```javascript
// Enable debug logging
chartRenderer.debug();

// Get chart statistics
console.log('Chart Statistics:', {
    currentChart: chartRenderer.currentChart,
    tooltipAvailable: !!chartRenderer.tooltip,
    legendsCount: chartRenderer.legends.size,
    chartConfig: chartRenderer.chartConfig
});
```

## Future Enhancements

### Planned Features

- **3D Charts**: Three-dimensional data visualization
- **Real-time Updates**: Live chart updates with streaming data
- **Advanced Animations**: Complex transition effects
- **Chart Export**: PNG, SVG, PDF export capabilities
- **Collaborative Features**: Shared chart annotations

### API Extensions

- **Custom Chart Types**: User-defined chart configurations
- **Chart Templates**: Pre-built chart configurations
- **Data Connectors**: Integration with external data sources
- **Chart Themes**: Customizable visual themes

## Browser Support

### Supported Browsers

- **Chrome**: 80+ (full feature support)
- **Firefox**: 75+ (full feature support)
- **Safari**: 13+ (full feature support)
- **Edge**: 80+ (full feature support)
- **Mobile Safari**: iOS 13+ (optimized support)
- **Android Chrome**: 80+ (optimized support)

### Fallback Support

- **Legacy Browsers**: Graceful degradation to basic charts
- **No JavaScript**: Static chart images as fallback
- **Print Styles**: Optimized for print media

## Performance Metrics

### Rendering Performance

- **Initial Load**: < 500ms for typical datasets
- **Chart Updates**: < 100ms for data changes
- **Resize Handling**: < 50ms for window resize
- **Memory Usage**: < 50MB for large datasets

### Optimization Targets

- **60 FPS**: Smooth animations and interactions
- **< 100KB**: Compressed chart library size
- **< 3s**: Initial page load with charts
- **< 1s**: Chart switching and updates
