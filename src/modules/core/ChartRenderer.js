/**
 * ChartRenderer Module
 * Advanced D3.js chart rendering and data visualization engine for the Property Expense Dashboard
 *
 * @class ChartRenderer
 *
 * Core Responsibilities:
 * - D3.js chart rendering and lifecycle management
 * - Interactive data visualizations (sankey, bar, line charts)
 * - Responsive chart layouts and animations
 * - Tooltip and legend management
 * - Chart event handling and user interactions
 *
 * Supported Chart Types:
 * - **Overview Charts**: Stacked bar charts, sankey diagrams for expense flow
 * - **Trend Analysis**: Line charts for quarterly/yearly expense trends
 * - **Comparison Charts**: Property-to-property expense comparisons
 * - **Category Charts**: Expense breakdown by category
 * - **Interactive Features**: Tooltips, legends, click handlers, hover effects
 *
 * Key Features:
 * - Responsive design with automatic resizing
 * - Smooth animations and transitions
 * - Accessible color schemes and contrast
 * - Performance optimized rendering
 * - Comprehensive error handling
 * - Modular tooltip system
 *
 * Dependencies:
 * - D3.js: Chart rendering and data visualization
 * - DataManager: Data source and filtering
 * - UIManager: DOM manipulation and UI state
 * - Formatter: Number and currency formatting
 *
 * @example
 * ```javascript
 * const chartRenderer = new ChartRenderer(dataManager, uiManager, formatter);
 * await chartRenderer.initialize();
 *
 * // Render expense chart based on current view
 * await chartRenderer.renderExpenseChart();
 *
 * // Render overview sankey diagram
 * await chartRenderer.renderOverviewSankey();
 *
 * // Handle chart resize
 * chartRenderer.resize();
 * ```
 */

class ChartRenderer {
    constructor(dataManager, uiManager, formatter) {
        this.dataManager = dataManager;
        this.uiManager = uiManager;
        this.formatter = formatter;

        // Chart configuration
        this.chartConfig = {
            margins: { top: 40, right: 80, bottom: 60, left: 160 },
            colors: {
                properties: ['#1FB8CD', '#FFC185', '#B4413C'],
                categories: ['#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B', '#ECEBD5', '#33808D', '#C0152F', '#A84B2F'],
                trends: {
                    increasing: '#10B981',
                    decreasing: '#EF4444',
                    stable: '#6B7280',
                },
            },
            animations: {
                duration: 750,
                ease: d3.easeCubicInOut,
            },
        };

        // Chart state
        this.currentChart = null;
        this.tooltip = null;
        this.legends = new Map();

        console.log('🔧 [CHART] ChartRenderer initialized');
    }

    /**
     * Initialize chart renderer
     */
    async initialize() {
        this.createTooltip();
        this.setupChartContainers();

        console.log('🔧 [CHART] Chart renderer initialized');
    }

    /**
     * Create tooltip element
     */
    createTooltip() {
        // Remove existing tooltip if it exists
        d3.select('body').select('.chart-tooltip').remove();

        this.tooltip = d3.select('body')
            .append('div')
            .attr('class', 'chart-tooltip')
            .style('position', 'absolute')
            .style('opacity', 0)
            .style('pointer-events', 'none')
            .style('background', 'var(--color-surface)')
            .style('border', '1px solid var(--color-border)')
            .style('border-radius', 'var(--radius-base)')
            .style('padding', 'var(--space-12)')
            .style('box-shadow', 'var(--shadow-lg)')
            .style('font-size', 'var(--font-size-sm)')
            .style('color', 'var(--color-text)')
            .style('z-index', 1000)
            .style('max-width', '300px');
    }

    /**
     * Setup chart containers
     */
    setupChartContainers() {
        // Ensure chart containers exist
        const expenseChart = this.uiManager.getElement('expenseChart');
        const overviewChart = this.uiManager.getElement('overviewChart');

        if (expenseChart) {
            expenseChart.style.position = 'relative';
        }

        if (overviewChart) {
            overviewChart.style.position = 'relative';
        }
    }

    /**
     * Render expense chart based on current view
     */
    async renderExpenseChart() {
        const chartContainer = this.uiManager.getElement('expensesChartContent');
        if (!chartContainer) {
            console.error('🔧 [CHART] Expense chart container not found');
            return;
        }

        // Clear existing chart
        d3.select(chartContainer).selectAll('*').remove();

        const view = this.dataManager.getCurrentView();
        const timePeriod = this.dataManager.getCurrentTimePeriod();

        console.log(`🔧 [CHART] Rendering expense chart: ${view} (${timePeriod})`);

        try {
            this.uiManager.showLoadingState('Rendering chart...');

            switch (view) {
                case 'overview':
                    await this.renderOverviewChart(chartContainer);
                    break;
                case 'trends':
                    await this.renderTrendsChart(chartContainer);
                    break;
                case 'comparison':
                    await this.renderComparisonChart(chartContainer);
                    break;
                case 'categories':
                    await this.renderCategoriesChart(chartContainer);
                    break;
                default:
                    await this.renderOverviewChart(chartContainer);
            }

            this.uiManager.hideLoadingState();
        } catch (error) {
            console.error('🔧 [CHART] Error rendering expense chart:', error);
            this.uiManager.showError('Failed to render chart', 'Chart Rendering Error');
        }
    }

    /**
     * Render overview chart (stacked bars)
     */
    async renderOverviewChart(container) {
        const properties = this.dataManager.getProperties();
        const categories = this.dataManager.getExpenseCategories();

        if (properties.length === 0) {
            this.uiManager.showEmptyState('No properties to display');
            return;
        }

        const margin = this.chartConfig.margins;
        const width = container.clientWidth - margin.left - margin.right;
        const height = Math.max(400, properties.length * 60) - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Calculate scales
        const xScale = d3.scaleLinear()
            .domain([0, d3.max(properties, p => {
                const data = this.dataManager.getCurrentPeriodData(p);
                return data.total;
            })])
            .range([0, width]);

        const yScale = d3.scaleBand()
            .domain(properties.map(p => p.name))
            .range([0, height])
            .padding(0.3);

        // Render stacked bars
        properties.forEach((property, propertyIndex) => {
            const propertyData = this.dataManager.getCurrentPeriodData(property);
            let currentX = 0;

            const yPosition = yScale(property.name);

            // Property label
            svg.append('text')
                .attr('class', 'property-label')
                .attr('x', -10)
                .attr('y', yPosition + yScale.bandwidth() / 2)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'middle')
                .style('font-weight', 'bold')
                .style('fill', this.chartConfig.colors.properties[propertyIndex % this.chartConfig.colors.properties.length])
                .text(property.name)
                .style('cursor', 'pointer')
                .on('click', () => this.handlePropertyClick(property));

            // Create stacked segments
            categories.forEach((category, categoryIndex) => {
                const value = propertyData.expenses[category] || 0;
                if (value === 0) {return;}

                const segmentWidth = xScale(value);
                const color = this.chartConfig.colors.categories[categoryIndex % this.chartConfig.colors.categories.length];

                // Create segment
                const segment = svg.append('rect')
                    .attr('class', 'expense-segment')
                    .attr('x', currentX)
                    .attr('y', yPosition)
                    .attr('width', segmentWidth)
                    .attr('height', yScale.bandwidth())
                    .attr('fill', color)
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 1)
                    .style('cursor', 'pointer')
                    .on('mouseover', (event) => this.showTooltip(event, {
                        title: `${property.name} - ${category}`,
                        value: this.formatter.formatCurrency(value),
                        percentage: this.formatter.formatPercentageOfTotal(value, propertyData.total),
                    }))
                    .on('mouseout', () => this.hideTooltip())
                    .on('click', () => this.handleCategoryClick(category, propertyData.expenses));

                currentX += segmentWidth;
            });

            // Add total value label
            svg.append('text')
                .attr('class', 'total-label')
                .attr('x', currentX + 10)
                .attr('y', yPosition + yScale.bandwidth() / 2)
                .attr('dominant-baseline', 'middle')
                .style('font-size', 'var(--font-size-sm)')
                .style('font-weight', 'bold')
                .style('fill', 'var(--color-text-secondary)')
                .text(this.formatter.formatCurrency(propertyData.total));
        });

        // Add axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d => this.formatter.formatAxisLabel(d)))
            .style('font-size', 'var(--font-size-sm)');

        // Add title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', -margin.top / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', 'var(--font-size-lg)')
            .style('font-weight', 'bold')
            .text('Property Expense Overview');

        // Add legend
        this.addLegend(svg, width, height + 40, categories);
    }

    /**
     * Render trends chart
     */
    async renderTrendsChart(container) {
        const timePeriod = this.dataManager.getCurrentTimePeriod();

        switch (timePeriod) {
            case 'all':
                await this.renderQuarterlyTrends(container, 'All Time Quarterly Trends');
                break;
            case 'quarter':
                await this.renderQuarterlyTrends(container, 'Quarter-over-Quarter Trends');
                break;
            case 'month':
                await this.renderMonthlyTrends(container);
                break;
            case 'year':
                await this.renderYearlyTrends(container);
                break;
            default:
                await this.renderQuarterlyTrends(container);
        }
    }

    /**
     * Render quarterly trends
     */
    async renderQuarterlyTrends(container, title = 'Quarterly Expense Trends') {
        const quarterlyData = this.getQuarterlyData();

        if (quarterlyData.length === 0) {
            this.uiManager.showEmptyState('No quarterly data available');
            return;
        }

        const margin = this.chartConfig.margins;
        const width = container.clientWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const xScale = d3.scaleBand()
            .domain(quarterlyData.map(d => d.quarter))
            .range([0, width])
            .padding(0.1);

        const maxTotal = d3.max(quarterlyData, d => d.total);
        const yScale = d3.scaleLinear()
            .domain([0, maxTotal])
            .range([height, 0]);

        // Add axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale))
            .selectAll('text')
            .style('text-anchor', 'middle');

        svg.append('g')
            .call(d3.axisLeft(yScale).tickFormat(d => this.formatter.formatAxisLabel(d)));

        // Add trend line
        const line = d3.line()
            .x(d => xScale(d.quarter) + xScale.bandwidth() / 2)
            .y(d => yScale(d.total))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(quarterlyData)
            .attr('fill', 'none')
            .attr('stroke', this.chartConfig.colors.properties[0])
            .attr('stroke-width', 3)
            .attr('d', line);

        // Add data points
        svg.selectAll('.trend-point')
            .data(quarterlyData)
            .enter()
            .append('circle')
            .attr('class', 'trend-point')
            .attr('cx', d => xScale(d.quarter) + xScale.bandwidth() / 2)
            .attr('cy', d => yScale(d.total))
            .attr('r', 6)
            .attr('fill', this.chartConfig.colors.properties[0])
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .on('mouseover', (event, d) => this.showTooltip(event, {
                title: d.quarter,
                value: this.formatter.formatCurrency(d.total),
            }))
            .on('mouseout', () => this.hideTooltip());

        // Add trend analysis
        if (quarterlyData.length >= 2) {
            const firstQuarter = quarterlyData[0];
            const lastQuarter = quarterlyData[quarterlyData.length - 1];
            const change = lastQuarter.total - firstQuarter.total;
            const changePercent = firstQuarter.total > 0 ? (change / firstQuarter.total) * 100 : 0;

            svg.append('text')
                .attr('x', width / 2)
                .attr('y', 20)
                .attr('text-anchor', 'middle')
                .style('font-size', 'var(--font-size-sm)')
                .style('fill', change >= 0 ? this.chartConfig.colors.trends.increasing : this.chartConfig.colors.trends.decreasing)
                .text(`Trend: ${change >= 0 ? '+' : ''}${changePercent.toFixed(1)}% over ${quarterlyData.length} quarters`);
        }

        // Add title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', -15)
            .attr('text-anchor', 'middle')
            .style('font-size', 'var(--font-size-xl)')
            .style('font-weight', 'bold')
            .text(title);
    }

    /**
     * Render monthly trends
     */
    async renderMonthlyTrends(container) {
        const quarterlyData = this.getQuarterlyData();
        const monthlyData = [];

        quarterlyData.forEach(q => {
            const quarter = q.quarter;
            const quarterTotal = q.total;
            const monthlyTotal = quarterTotal / 3;

            for (let month = 1; month <= 3; month++) {
                const monthName = quarter.replace('Q', 'M') + month;
                monthlyData.push({
                    month: monthName,
                    total: monthlyTotal,
                    quarter,
                });
            }
        });

        if (monthlyData.length === 0) {
            this.uiManager.showEmptyState('No monthly data available');
            return;
        }

        const margin = { ...this.chartConfig.margins, bottom: 80 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const xScale = d3.scalePoint()
            .domain(monthlyData.map(d => d.month))
            .range([0, width])
            .padding(0.1);

        const maxTotal = d3.max(monthlyData, d => d.total);
        const yScale = d3.scaleLinear()
            .domain([0, maxTotal])
            .range([height, 0]);

        // Add axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale))
            .selectAll('text')
            .style('text-anchor', 'middle')
            .style('font-size', 'var(--font-size-xs)')
            .attr('transform', 'rotate(-45)')
            .attr('dx', '-10px')
            .attr('dy', '5px');

        svg.append('g')
            .call(d3.axisLeft(yScale).tickFormat(d => this.formatter.formatAxisLabel(d)));

        // Add monthly trend line
        const line = d3.line()
            .x(d => xScale(d.month))
            .y(d => yScale(d.total))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(monthlyData)
            .attr('fill', 'none')
            .attr('stroke', this.chartConfig.colors.properties[0])
            .attr('stroke-width', 3)
            .attr('d', line);

        // Add data points
        svg.selectAll('.monthly-point')
            .data(monthlyData)
            .enter()
            .append('circle')
            .attr('class', 'monthly-point')
            .attr('cx', d => xScale(d.month))
            .attr('cy', d => yScale(d.total))
            .attr('r', 5)
            .attr('fill', this.chartConfig.colors.properties[0])
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .on('mouseover', (event, d) => this.showTooltip(event, {
                title: `${d.month} (${d.quarter})`,
                value: this.formatter.formatCurrency(d.total),
            }))
            .on('mouseout', () => this.hideTooltip());

        // Add quarterly reference lines
        quarterlyData.forEach((q, i) => {
            const quarterStart = monthlyData[i * 3];
            const quarterEnd = monthlyData[Math.min((i + 1) * 3 - 1, monthlyData.length - 1)];

            if (quarterStart && quarterEnd) {
                svg.append('line')
                    .attr('x1', xScale(quarterStart.month))
                    .attr('y1', height + 20)
                    .attr('x2', xScale(quarterEnd.month))
                    .attr('y2', height + 20)
                    .attr('stroke', 'var(--color-border)')
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '2,2');

                svg.append('text')
                    .attr('x', (xScale(quarterStart.month) + xScale(quarterEnd.month)) / 2)
                    .attr('y', height + 35)
                    .attr('text-anchor', 'middle')
                    .style('font-size', 'var(--font-size-xs)')
                    .style('fill', 'var(--color-text-secondary)')
                    .text(q.quarter);
            }
        });

        // Add trend analysis
        if (monthlyData.length >= 2) {
            const firstMonth = monthlyData[0];
            const lastMonth = monthlyData[monthlyData.length - 1];
            const change = lastMonth.total - firstMonth.total;
            const changePercent = firstMonth.total > 0 ? (change / firstMonth.total) * 100 : 0;

            svg.append('text')
                .attr('x', width / 2)
                .attr('y', 20)
                .attr('text-anchor', 'middle')
                .style('font-size', 'var(--font-size-sm)')
                .style('fill', change >= 0 ? this.chartConfig.colors.trends.increasing : this.chartConfig.colors.trends.decreasing)
                .text(`Monthly Trend: ${change >= 0 ? '+' : ''}${changePercent.toFixed(1)}% over ${monthlyData.length} months`);
        }

        // Add title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', -15)
            .attr('text-anchor', 'middle')
            .style('font-size', 'var(--font-size-xl)')
            .style('font-weight', 'bold')
            .text('Monthly Expense Trends (Estimated)');
    }

    /**
     * Render yearly trends
     */
    async renderYearlyTrends(container) {
        const yearlyData = this.getYearlyData();

        if (yearlyData.length === 0) {
            this.uiManager.showEmptyState('No yearly data available');
            return;
        }

        const margin = this.chartConfig.margins;
        const width = container.clientWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const xScale = d3.scalePoint()
            .domain(yearlyData.map(d => d.year))
            .range([0, width])
            .padding(0.1);

        const maxTotal = d3.max(yearlyData, d => d.total);
        const yScale = d3.scaleLinear()
            .domain([0, maxTotal])
            .range([height, 0]);

        // Add axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale));

        svg.append('g')
            .call(d3.axisLeft(yScale).tickFormat(d => this.formatter.formatAxisLabel(d)));

        // Add yearly trend line
        const line = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.total))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(yearlyData)
            .attr('fill', 'none')
            .attr('stroke', this.chartConfig.colors.properties[0])
            .attr('stroke-width', 3)
            .attr('d', line);

        // Add data points
        svg.selectAll('.yearly-point')
            .data(yearlyData)
            .enter()
            .append('circle')
            .attr('class', 'yearly-point')
            .attr('cx', d => xScale(d.year))
            .attr('cy', d => yScale(d.total))
            .attr('r', 6)
            .attr('fill', this.chartConfig.colors.properties[0])
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .on('mouseover', (event, d) => this.showTooltip(event, {
                title: d.year,
                value: this.formatter.formatCurrency(d.total),
                quarters: `${d.quarters} quarters`,
            }))
            .on('mouseout', () => this.hideTooltip());

        // Add year-over-year change annotations
        if (yearlyData.length >= 2) {
            const firstYear = yearlyData[0];
            const lastYear = yearlyData[yearlyData.length - 1];
            const change = lastYear.total - firstYear.total;
            const changePercent = firstYear.total > 0 ? (change / firstYear.total) * 100 : 0;

            svg.append('text')
                .attr('x', width / 2)
                .attr('y', 20)
                .attr('text-anchor', 'middle')
                .style('font-size', 'var(--font-size-sm)')
                .style('fill', change >= 0 ? this.chartConfig.colors.trends.increasing : this.chartConfig.colors.trends.decreasing)
                .text(`Year-over-Year: ${change >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`);

            // Add individual year changes
            yearlyData.forEach((year, index) => {
                if (index > 0) {
                    const prevYear = yearlyData[index - 1];
                    const yearChange = ((year.total - prevYear.total) / prevYear.total) * 100;

                    svg.append('text')
                        .attr('x', xScale(year.year))
                        .attr('y', yScale(year.total) - 10)
                        .attr('text-anchor', 'middle')
                        .style('font-size', 'var(--font-size-xs)')
                        .style('fill', yearChange >= 0 ? this.chartConfig.colors.trends.increasing : this.chartConfig.colors.trends.decreasing)
                        .text(`${yearChange >= 0 ? '+' : ''}${yearChange.toFixed(1)}%`);
                }
            });
        }

        // Add title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', -15)
            .attr('text-anchor', 'middle')
            .style('font-size', 'var(--font-size-xl)')
            .style('font-weight', 'bold')
            .text('Year-over-Year Expense Trends');
    }

    /**
     * Render comparison chart
     */
    async renderComparisonChart(container) {
        const properties = this.dataManager.getProperties();

        if (properties.length === 0) {
            this.uiManager.showEmptyState('No properties to compare');
            return;
        }

        const margin = this.chartConfig.margins;
        const width = container.clientWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const propertyData = properties.map(property => {
            const data = this.dataManager.getCurrentPeriodData(property);
            return {
                name: property.name,
                total: data.total,
                id: property.id,
            };
        });

        const xScale = d3.scaleBand()
            .domain(propertyData.map(d => d.name))
            .range([0, width])
            .padding(0.3);

        const maxTotal = d3.max(propertyData, d => d.total);
        const yScale = d3.scaleLinear()
            .domain([0, maxTotal])
            .range([height, 0]);

        // Add axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale));

        svg.append('g')
            .call(d3.axisLeft(yScale).tickFormat(d => this.formatter.formatAxisLabel(d)));

        // Add bars
        svg.selectAll('.comparison-bar')
            .data(propertyData)
            .enter()
            .append('rect')
            .attr('class', 'comparison-bar')
            .attr('x', d => xScale(d.name))
            .attr('y', d => yScale(d.total))
            .attr('width', xScale.bandwidth())
            .attr('height', d => height - yScale(d.total))
            .attr('fill', (d, i) => this.chartConfig.colors.properties[i % this.chartConfig.colors.properties.length])
            .attr('rx', 4)
            .on('mouseover', (event, d) => this.showTooltip(event, {
                title: d.name,
                value: this.formatter.formatCurrency(d.total),
            }))
            .on('mouseout', () => this.hideTooltip())
            .on('click', (event, d) => this.handlePropertyClick(properties.find(p => p.id === d.id)));

        // Add value labels
        svg.selectAll('.bar-label')
            .data(propertyData)
            .enter()
            .append('text')
            .attr('class', 'bar-label')
            .attr('x', d => xScale(d.name) + xScale.bandwidth() / 2)
            .attr('y', d => yScale(d.total) - 5)
            .attr('text-anchor', 'middle')
            .style('font-size', 'var(--font-size-sm)')
            .style('fill', 'var(--color-text)')
            .text(d => this.formatter.formatCurrency(d.total, true));

        // Add title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', -15)
            .attr('text-anchor', 'middle')
            .style('font-size', 'var(--font-size-xl)')
            .style('font-weight', 'bold')
            .text('Property Expense Comparison');
    }

    /**
     * Render categories chart
     */
    async renderCategoriesChart(container) {
        const categories = this.dataManager.getExpenseCategories();
        const categoryTotals = {};

        // Calculate category totals
        this.dataManager.getProperties().forEach(property => {
            const data = this.dataManager.getCurrentPeriodData(property);
            Object.entries(data.expenses).forEach(([category, amount]) => {
                categoryTotals[category] = (categoryTotals[category] || 0) + amount;
            });
        });

        const categoryData = Object.entries(categoryTotals)
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total);

        if (categoryData.length === 0) {
            this.uiManager.showEmptyState('No category data available');
            return;
        }

        const margin = this.chartConfig.margins;
        const width = container.clientWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const xScale = d3.scaleBand()
            .domain(categoryData.map(d => d.category))
            .range([0, width])
            .padding(0.3);

        const maxTotal = d3.max(categoryData, d => d.total);
        const yScale = d3.scaleLinear()
            .domain([0, maxTotal])
            .range([height, 0]);

        // Add axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale))
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');

        svg.append('g')
            .call(d3.axisLeft(yScale).tickFormat(d => this.formatter.formatAxisLabel(d)));

        // Add bars
        svg.selectAll('.category-bar')
            .data(categoryData)
            .enter()
            .append('rect')
            .attr('class', 'category-bar')
            .attr('x', d => xScale(d.category))
            .attr('y', d => yScale(d.total))
            .attr('width', xScale.bandwidth())
            .attr('height', d => height - yScale(d.total))
            .attr('fill', (d, i) => this.chartConfig.colors.categories[i % this.chartConfig.colors.categories.length])
            .attr('rx', 4)
            .on('mouseover', (event, d) => this.showTooltip(event, {
                title: d.category,
                value: this.formatter.formatCurrency(d.total),
            }))
            .on('mouseout', () => this.hideTooltip())
            .on('click', (event, d) => this.handleCategoryClick(d.category, categoryTotals));

        // Add title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', -15)
            .attr('text-anchor', 'middle')
            .style('font-size', 'var(--font-size-xl)')
            .style('font-weight', 'bold')
            .text('Expense Categories Overview');
    }

    /**
     * Render overview sankey diagram
     */
    async renderOverviewSankey() {
        const container = this.uiManager.getElement('overviewChartContent');
        if (!container) {
            console.error('🔧 [CHART] Overview chart container not found');
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        try {
            this.uiManager.showLoadingState('Loading overview...');

            const sankeyData = this.prepareSankeyData();

            if (!sankeyData || sankeyData.nodes.length === 0) {
                this.showOverviewPlaceholder(container);
                return;
            }

            this.createSankeyDiagram(container, sankeyData);
            this.uiManager.hideLoadingState();

        } catch (error) {
            console.error('🔧 [CHART] Error rendering sankey:', error);
            this.showOverviewPlaceholder(container);
        }
    }

    /**
     * Prepare data for sankey diagram
     */
    prepareSankeyData() {
        const properties = this.dataManager.getProperties();
        const categories = this.dataManager.getExpenseCategories();

        if (!properties || properties.length === 0) {
            console.log('🔧 [CHART] No data available for sankey');
            return null;
        }

        const nodes = [];
        const links = [];
        let nodeIndex = 0;
        const nodeMap = new Map();

        // Add property nodes
        properties.forEach((property, index) => {
            const nodeId = `property-${property.id}`;
            nodeMap.set(nodeId, nodeIndex);
            nodes.push({
                id: nodeId,
                name: property.name,
                type: 'property',
                color: this.chartConfig.colors.properties[index % this.chartConfig.colors.properties.length],
            });
            nodeIndex++;
        });

        // Add category nodes and subcategory nodes
        categories.forEach((category, categoryIndex) => {
            const nodeId = `category-${categoryIndex}`;
            nodeMap.set(nodeId, nodeIndex);
            nodes.push({
                id: nodeId,
                name: category,
                type: 'category',
                color: this.chartConfig.colors.categories[categoryIndex % this.chartConfig.colors.categories.length],
            });
            nodeIndex++;

            // Add subcategory nodes for hierarchical categories
            if (category === 'Utilities') {
                ['Electricity', 'Water', 'Gas'].forEach(sub => {
                    const subNodeId = `sub-${category}-${sub}`;
                    nodeMap.set(subNodeId, nodeIndex);
                    nodes.push({
                        id: subNodeId,
                        name: sub,
                        type: 'subcategory',
                        color: this.chartConfig.colors.categories[categoryIndex % this.chartConfig.colors.categories.length],
                    });
                    nodeIndex++;
                });
            } else if (category === 'Maintenance') {
                ['Cleaning', 'Repairs', 'Landscaping'].forEach(sub => {
                    const subNodeId = `sub-${category}-${sub}`;
                    nodeMap.set(subNodeId, nodeIndex);
                    nodes.push({
                        id: subNodeId,
                        name: sub,
                        type: 'subcategory',
                        color: this.chartConfig.colors.categories[categoryIndex % this.chartConfig.colors.categories.length],
                    });
                    nodeIndex++;
                });
            }
        });

        // Create links from properties to categories/subcategories
        properties.forEach(property => {
            const propertyData = this.dataManager.getCurrentPeriodData(property, null, true);

            categories.forEach((category, categoryIndex) => {
                const expenseData = propertyData.expenses[category];

                if (typeof expenseData === 'object' && expenseData !== null) {
                    // Hierarchical category with subcategories
                    let categoryTotal = 0;
                    Object.entries(expenseData).forEach(([subCategory, value]) => {
                        if (value > 0) {
                            const subNodeId = `sub-${category}-${subCategory}`;
                            links.push({
                                source: nodeMap.get(`property-${property.id}`),
                                target: nodeMap.get(subNodeId),
                                value,
                                property: property.name,
                                category: subCategory,
                            });
                            categoryTotal += value;
                        }
                    });

                    // Link from subcategories to main category
                    if (categoryTotal > 0) {
                        Object.entries(expenseData).forEach(([subCategory, value]) => {
                            if (value > 0) {
                                const subNodeId = `sub-${category}-${subCategory}`;
                                links.push({
                                    source: nodeMap.get(subNodeId),
                                    target: nodeMap.get(`category-${categoryIndex}`),
                                    value,
                                    property: property.name,
                                    category: subCategory,
                                });
                            }
                        });
                    }
                } else {
                    // Flat category
                    const value = expenseData || 0;
                    if (value > 0) {
                        links.push({
                            source: nodeMap.get(`property-${property.id}`),
                            target: nodeMap.get(`category-${categoryIndex}`),
                            value,
                            property: property.name,
                            category,
                        });
                    }
                }
            });
        });

        return { nodes, links };
    }

    /**
     * Create sankey diagram
     */
    createSankeyDiagram(container, data) {
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Clear container
        container.innerHTML = '';

        // Validate data
        if (!data || !data.nodes || !data.links || data.nodes.length === 0) {
            console.error('🔧 [CHART] Invalid sankey data');
            this.showOverviewPlaceholder(container);
            return;
        }

        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`)
            .style('background', 'transparent');

        // Check if d3.sankey is available
        if (typeof d3.sankey === 'undefined') {
            console.error('🔧 [CHART] D3 Sankey plugin not loaded');
            this.showOverviewPlaceholder(container);
            return;
        }

        try {
            // Create sankey layout
            const sankey = d3.sankey()
                .nodeWidth(20)
                .nodePadding(10)
                .extent([[20, 20], [width - 20, height - 20]]);

            // Process data
            const sankeyData = sankey({
                nodes: data.nodes.map(d => ({ ...d })),
                links: data.links.map(d => ({ ...d })),
            });

            // Validate sankey output
            if (!sankeyData.nodes || !sankeyData.links) {
                throw new Error('Sankey layout failed');
            }

            const { nodes, links } = sankeyData;

            // Draw links
            svg.append('g')
                .attr('class', 'sankey-links')
                .selectAll('path')
                .data(links)
                .enter()
                .append('path')
                .attr('d', d3.sankeyLinkHorizontal())
                .attr('stroke', d => d.source.color)
                .attr('stroke-width', d => Math.max(1, d.width || 1))
                .attr('fill', 'none')
                .attr('opacity', 0.6)
                .on('mouseover', (event, d) => this.showTooltip(event, {
                    title: `${d.property} → ${d.category}`,
                    value: this.formatter.formatCurrency(d.value),
                }))
                .on('mouseout', () => this.hideTooltip());

            // Draw nodes
            const node = svg.append('g')
                .attr('class', 'sankey-nodes')
                .selectAll('rect')
                .data(nodes)
                .enter()
                .append('g');

            node.append('rect')
                .attr('x', d => d.x0)
                .attr('y', d => d.y0)
                .attr('height', d => d.y1 - d.y0)
                .attr('width', d => d.x1 - d.x0)
                .attr('fill', d => d.color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1)
                .attr('rx', 4);

            // Add node labels
            node.append('text')
                .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
                .attr('y', d => (d.y0 + d.y1) / 2)
                .attr('dy', '0.35em')
                .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
                .style('font-size', 'var(--font-size-sm)')
                .style('fill', 'var(--color-text)')
                .text(d => d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name);

        } catch (error) {
            console.error('🔧 [CHART] Error creating sankey diagram:', error);
            this.showOverviewPlaceholder(container);
        }
    }

    /**
     * Show overview placeholder
     */
    showOverviewPlaceholder(container) {
        container.innerHTML = `
            <div class="coming-soon">
                <div class="coming-soon-icon">📊</div>
                <h3>No Data Available</h3>
                <p>Add some properties and expenses to see the beautiful sankey diagram visualization.</p>
            </div>
        `;

        this.uiManager.hideLoadingState();
    }

    /**
     * Get quarterly data for trends
     */
    getQuarterlyData() {
        const properties = this.dataManager.getProperties();
        const quarters = new Set();

        // Collect all quarters
        properties.forEach(property => {
            if (property.quarterlyData) {
                Object.keys(property.quarterlyData).forEach(quarter => {
                    quarters.add(quarter);
                });
            }
        });

        // Sort quarters chronologically
        const sortedQuarters = Array.from(quarters).sort((a, b) => {
            const yearA = parseInt(a.split(' ')[1]);
            const yearB = parseInt(b.split(' ')[1]);
            const quarterA = a.split(' ')[0];
            const quarterB = b.split(' ')[0];

            if (yearA !== yearB) {return yearA - yearB;}

            const quarterOrder = { 'Q1': 1, 'Q2': 2, 'Q3': 3, 'Q4': 4 };
            return quarterOrder[quarterA] - quarterOrder[quarterB];
        });

        // Aggregate data by quarter
        return sortedQuarters.map(quarter => {
            let total = 0;
            properties.forEach(property => {
                const quarterData = property.quarterlyData?.[quarter];
                if (quarterData) {
                    total += quarterData.total || 0;
                }
            });
            return { quarter, total };
        });
    }

    /**
     * Get yearly data for trends
     */
    getYearlyData() {
        const yearlyData = {};

        this.dataManager.getProperties().forEach(property => {
            if (property.quarterlyData) {
                Object.entries(property.quarterlyData).forEach(([quarter, data]) => {
                    const year = quarter.split(' ')[1];
                    if (!yearlyData[year]) {
                        yearlyData[year] = { total: 0, quarters: 0 };
                    }
                    yearlyData[year].total += data.total || 0;
                    yearlyData[year].quarters += 1;
                });
            }
        });

        // Convert to array and sort by year
        return Object.entries(yearlyData)
            .map(([year, data]) => ({ year, ...data }))
            .sort((a, b) => parseInt(a.year) - parseInt(b.year));
    }

    /**
     * Add legend to chart
     */
    addLegend(svg, width, startY, categories) {
        const legendItems = categories.map((category, index) => ({
            name: category,
            color: this.chartConfig.colors.categories[index % this.chartConfig.colors.categories.length],
        }));

        const legendItemHeight = 20;
        const itemsPerRow = Math.floor(width / 150);
        const rows = Math.ceil(legendItems.length / itemsPerRow);

        legendItems.forEach((item, index) => {
            const row = Math.floor(index / itemsPerRow);
            const col = index % itemsPerRow;
            const x = col * 150;
            const y = startY + row * legendItemHeight;

            // Legend color box
            svg.append('rect')
                .attr('x', x)
                .attr('y', y)
                .attr('width', 12)
                .attr('height', 12)
                .attr('fill', item.color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);

            // Legend text
            svg.append('text')
                .attr('x', x + 18)
                .attr('y', y + 6)
                .attr('dominant-baseline', 'middle')
                .style('font-size', 'var(--font-size-xs)')
                .style('fill', 'var(--color-text-secondary)')
                .text(item.name.length > 12 ? item.name.substring(0, 12) + '...' : item.name);
        });
    }

    /**
     * Show tooltip
     */
    showTooltip(event, data) {
        if (!this.tooltip) {return;}

        let content = '';
        if (typeof data === 'string') {
            content = data;
        } else {
            content = `<strong>${data.title}</strong><br/>${data.value}`;
            if (data.percentage) {content += `<br/>${data.percentage}`;}
            if (data.quarters) {content += `<br/>${data.quarters}`;}
        }

        this.tooltip
            .style('opacity', 1)
            .html(content)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style('opacity', 0);
        }
    }

    /**
     * Handle property click
     */
    handlePropertyClick(property) {
        // This will trigger the detail panel through the main app
        console.log('🔧 [CHART] Property clicked:', property.name);
        // Implementation will be handled by the main app controller
    }

    /**
     * Handle category click
     */
    handleCategoryClick(category, categoryTotals) {
        // This will trigger the detail panel through the main app
        console.log('🔧 [CHART] Category clicked:', category);
        // Implementation will be handled by the main app controller
    }

    /**
     * Resize chart
     */
    resize() {
        // Re-render current chart
        if (this.currentChart) {
            this.renderExpenseChart();
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }

        this.legends.clear();
        console.log('🔧 [CHART] Chart renderer cleaned up');
    }

    /**
     * Debug chart information
     */
    debug() {
        console.log('🔧 [CHART DEBUG] === CHART RENDERER INFO ===');
        console.log('🔧 [CHART DEBUG] Current chart:', this.currentChart);
        console.log('🔧 [CHART DEBUG] Tooltip available:', !!this.tooltip);
        console.log('🔧 [CHART DEBUG] Legends count:', this.legends.size);
        console.log('🔧 [CHART DEBUG] Chart config:', this.chartConfig);
        console.log('🔧 [CHART DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartRenderer;
} else {
    window.ChartRenderer = ChartRenderer;
}
