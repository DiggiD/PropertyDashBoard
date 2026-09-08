/**
 * ChartRenderer Module
 * Advanced D3.js chart rendering and data visualization engine for the Property Expense Dashboard
 *
 * @class ChartRenderer
 *
 * Core Responsibilities:
 * - D3.js chart rendering and lifecycle management
 * - Interactive data visualizations (sankey diagrams for expense flow)
 * - Responsive chart layouts and animations
 * - Tooltip and legend management
 * - Chart event handling and user interactions
 *
 * Supported Chart Types:
 * - **Overview Charts**: Sankey diagrams for expense flow
 * - **Interactive Features**: Tooltips, click handlers, hover effects
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
 * // Render overview sankey diagram
 * await chartRenderer.renderOverviewSankey();
 *
 * // Handle chart resize
 * chartRenderer.resize();
 * ```
 */

import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import loggerJs from '../utils/Logger.js';

const logger = loggerJs as {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    logPerformance: (...args: any[]) => void;
};

type DataManagerPort = {
    on: (event: string, callback: (data?: any) => void) => void;
    getCurrentTimePeriod: () => unknown;
    getSelectedYear: () => unknown;
    getAggregatedSankeyData: (period?: any, year?: any) => {
        sources: Map<string, number> | Record<string, number>;
        propIncomes: Map<unknown, number>;
        propExpenses: Map<unknown, number>;
        hasIncome: boolean;
        catTotals: Map<string, number>;
        subTotals: Map<string, Map<string, number>>;
    };
    getProperties: () => Array<{ id: number; name?: string; [key: string]: any }>;
    getExpenseCategories: () => unknown[];
    hasData: (property: any, period?: any, year?: any) => boolean;
    clearSankeyCache: () => void;
};

type UIManagerPort = {
    getElement: (id: string) => HTMLElement | null;
    showLoadingState: (message?: string) => void;
    hideLoadingState: () => void;
};

type FormatterPort = {
    formatCurrency: (value: any) => string;
};

type ThemeManagerPort = {
    getColorTheme: () => {
        properties?: string[];
        categories?: string[];
        trends?: Record<string, string>;
    };
    getCurrentColorTheme: () => unknown;
};

type ChartConfig = {
    margins: { top: number; right: number; bottom: number; left: number };
    animations: { duration: number; ease: any };
    colors?: {
        properties: string[];
        categories: string[];
        trends: Record<string, string>;
    };
};


class ChartRenderer {
    dataManager: DataManagerPort;
    uiManager: UIManagerPort;
    formatter: FormatterPort;
    themeManager: ThemeManagerPort | null;
    chartConfig: ChartConfig;
    currentChart: any;
    tooltip: any;
    legends: Map<string, unknown>;
    sankeyData: any;
    state: {
        selected: any;
        highlighted: any;
        paths?: { nodes: any[]; links: any[] };
    };
    persistentPos: any;
    interactionState: string;
    rippleForces: Map<string, unknown>;
    hoverTimeout: ReturnType<typeof setTimeout> | null;
    resizeObserver: ResizeObserver | null;
    bboxCache: Map<string, unknown>;
    relatedIdsCache: Map<string, unknown>;
    debouncedRender: (...args: any[]) => unknown;
    debouncedRenderOverviewSankey: (...args: any[]) => unknown;
    isInitialized: boolean;
    isRendering: boolean;
    isRenderingOverview: boolean;
    chartContainer!: HTMLElement | null;
    lastWidth: number | undefined;
    zoomBehavior: any;
    persistentTooltip: any;

    constructor(
        dataManager: DataManagerPort,
        uiManager: UIManagerPort,
        formatter: FormatterPort,
        themeManager: ThemeManagerPort | null = null,
    ) {
        this.dataManager = dataManager;
        this.uiManager = uiManager;
        this.formatter = formatter;
        this.themeManager = themeManager;

        // Chart configuration
        this.chartConfig = {
            margins: { top: 10, right: 10, bottom: 10, left: 50 },
            animations: {
                duration: 750,
                ease: d3.easeCubicInOut,
            },
        };

        // Initialize colors from theme manager
        this.updateChartColors();

        // Listen for color theme changes
        if (!document._colorThemeListenerAdded) {
            document.addEventListener('colorThemeChange', this.handleColorThemeChange.bind(this));
            document._colorThemeListenerAdded = true;
        }

        // Listen for data changes
        if (this.dataManager) {
            this.dataManager.on('dataChange', this.handleDataChange.bind(this));
        }

        // Chart state
        this.currentChart = null;
        this.tooltip = null;
        this.legends = new Map();

        // Sankey state
        this.sankeyData = null;
        this.state = { selected: null, highlighted: null, paths: { nodes: [], links: [] } };
        this.persistentPos = null;

        // Interaction state
        this.interactionState = 'IDLE'; // 'IDLE' | 'RIPPLE_HOVER' | 'PINNED_SELECT'
        this.rippleForces = new Map(); // Cache custom forces
        this.hoverTimeout = null; // Debounce hover
        this.resizeObserver = null; // ResizeObserver instance
        this.bboxCache = new Map(); // Cache bbox computations
        this.relatedIdsCache = new Map(); // Memoize relatedIds per filterKey

        // Debounced render method for ResizeObserver
        this.debouncedRender = this.debounce(this.renderOverviewSankey.bind(this), 250);

        // Alias for tests
        this.debouncedRenderOverviewSankey = this.debouncedRender;

        // Initialization flag
        this.isInitialized = false;
        this.isRendering = false;
        this.isRenderingOverview = false;

        logger.info('CHART', 'ChartRenderer initialized');
    }

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func: (...args: any[]) => unknown, wait: number) {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        return (...args: any[]) => {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    throttle(func: (...args: any[]) => unknown, limit: number) {
        let inThrottle = false;
        return (...args: any[]) => {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => { inThrottle = false; }, limit);
            }
        };
    }

    /**
     * Initialize chart renderer
     */
    async initialize() {
        logger.info('CHART', 'Initializing chart renderer...');
        if (this.isInitialized) {
            logger.info('CHART', 'Already initialized, skipping');
            return;
        }
        // Cleanup old elements if exist
        d3.select('body').select('.chart-tooltip').remove();
        d3.select('#overviewChartContent svg').remove();  // Clear old SVG
        this.isInitialized = true;

        logger.info('CHART', 'Ensuring chart container is ready...');
        await this.uiManager.getElement('chart-container'); // Ensures ready before setupChartContainers
        logger.info('CHART', 'Creating tooltip...');
        this.createTooltip();
        logger.info('CHART', 'Setting up chart containers...');
        this.setupChartContainers();

        logger.info('CHART', 'Chart renderer initialized successfully');
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
            .style('max-width', '300px')
            .node();
    }

    /**
     * Setup chart containers
     */
    setupChartContainers() {
        try {
            const container = this.uiManager.getElement('chart-container');
            if (!container) {throw new Error('Chart container not found');}
            this.chartContainer = container; // Same for tooltip, etc.
            const ids = ['chart-container', 'tooltip'];
            ids.forEach(id => {
                const el = this.uiManager.getElement(id);
                if (el) {Object.assign(this, { [id]: el });}
            });

            // Setup chart containers for different views
            const containers = [
                'overviewChartContent',
            ];

            containers.forEach(containerId => {
                const container = this.uiManager.getElement(containerId);
                if (container) {
                    // Ensure container is ready for SVG
                    container.style.position = 'relative';
                    container.style.width = '100%';
                    container.style.height = '100%';
                } else {
                    logger.warn('CHART', `Container ${containerId} not found`);
                }
            });
        } catch(e) {
            logger.error('CHART', 'Setup failed', e);
            this.showError('UI setup error');
        }
    }

    /**
     * Render overview sankey diagram
     */
    async renderOverviewSankey() {
        if (this.isRendering) {return;}
        this.isRendering = true;

        const container = this.uiManager.getElement('overviewChartContent');
        if (!container) {
            this.isRendering = false;
            return;
        }
        container.innerHTML = '';
        this.uiManager.showLoadingState('Loading overview...');

        // Setup ResizeObserver for container-specific resizing
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.resizeObserver = new ResizeObserver(entries => {
            if (entries[0].contentRect.width !== this.lastWidth) {
                this.lastWidth = entries[0].contentRect.width;
                this.debouncedRender();
            }
        });
        this.resizeObserver.observe(container);

        try {
            logger.info('CHART', 'Rendering...');
            const period = this.dataManager.getCurrentTimePeriod();
            const year = this.dataManager.getSelectedYear();
            const aggregatedData = this.dataManager.getAggregatedSankeyData(period, year);

            if (aggregatedData.propExpenses.size === 0) {
                this.showOverviewPlaceholder(container);
                return;
            }

            const properties = this.dataManager.getProperties().filter(
                (p: any) => this.dataManager.hasData(p, period, year),
            );
            const categories = this.dataManager.getExpenseCategories();
            const { width, height } = this.getDimensions(container);

            let data;
            try {
                data = this.buildSankeyData(
                    properties,
                    aggregatedData.sources,
                    aggregatedData.propIncomes,
                    aggregatedData.propExpenses,
                    categories,
                    aggregatedData.hasIncome,
                    aggregatedData.catTotals,
                    aggregatedData.subTotals,
                    width,
                    height,
                );
            } catch (error) {
                logger.error('CHART', 'buildSankeyData error', error);
                this.showError('Failed to process chart data');
                this.showOverviewPlaceholder(container);
                return;
            }

            if (!data.nodes.length) {
                this.showOverviewPlaceholder(container);
                return;
            }

            this.createSankey(container, data);
            this.uiManager.hideLoadingState();
        } catch (error) {
            logger.error('CHART', 'Render error', error);
            this.showOverviewPlaceholder(container);
        } finally {
            this.isRendering = false;
            this.isRenderingOverview = false;
        }
    }

    /**
     * Render overview sankey diagram (alias for renderOverviewSankey)
     */
    renderOverviewSankeyDiagram() {
        this.renderOverviewSankey();
    }



    // Build DAG with D3 stratify for auto-hierarchy/sorting (~40 lines)
    buildSankeyData(
        properties: Array<{ id: number; name?: string; [key: string]: any }>,
        sources: Map<string, number> | Record<string, number>,
        propIncomes: Map<unknown, number>,
        propExpenses: Map<unknown, number>,
        categories: any[],
        hasIncome: boolean,
        catTotals: Map<string, number>,
        subTotals: Map<string, Map<string, number>>,
        width: number,
        height: number,
    ) {
        // Check for missing property expenses data
        if (!propExpenses) {
            logger.warn('CHART', 'Missing property expenses data');
            return { nodes: [{ name: 'Missing Expense Data', value: 0, isPlaceholder: true }], links: [], hasIncome: false };
        }

        const levelOffset = hasIncome ? 2 : 1;
        const validProperties = properties.filter((p: any) => p && typeof p.id === 'number');
        const nodes: any[] = [];
        const links: any[] = [];

        // L0-1: Income (if any)
        const sourceEntries = sources instanceof Map
            ? Array.from(sources.entries())
            : Object.entries(sources || {});
        if (hasIncome) {
            let sortKey = 0;
            sourceEntries.sort(([, a], [, b]) => Number(b) - Number(a)).forEach(([source, total]) => {
                if (total > 0) {
                    const id = `income-${source}`;
                    nodes.push({
                        id,
                        name: source.toUpperCase(),
                        type: 'income-source',
                        level: 0,
                        sortKey: sortKey++,
                        color: this.getColor('categories',
                            sortKey),
                        total,
                    });
                    logger.debug('CHART', `Added income source node: ${source.toUpperCase()}, value: ${total}`);
                }
            });
            nodes.push({
                id: 'earnings',
                name: 'EARNINGS',
                type: 'earnings',
                level: 1,
                sortKey: 0,
                color: '#059669',
                widthFactor: 2,
            });
            logger.debug('CHART', 'Added earnings node');
            sourceEntries.forEach(([source, total]) => {
                if (total > 0) {
                    links.push({
                        source: `income-${source}`,
                        target: 'earnings',
                        value: total,
                        type: 'income-to-earnings',
                    });
                    logger.debug('CHART', `Added income link: ${source} -> earnings, value: ${total}`);
                }
            });
        } else {
            nodes.push({
                id: 'dummy-source',
                name: '',
                type: 'dummy',
                level: 0,
                sortKey: -1,
                color: 'transparent',
                isDummy: true,
            });
        }

        // L2: Properties (sorted by expense)
        const sortedProps = validProperties.sort(
            (a: any, b: any) => (propExpenses.get(b.id) || 0) - (propExpenses.get(a.id) || 0),
        );
        let propKey = 0;
        sortedProps.forEach(prop => {
            const id = `prop-${prop.id}`;
            const total = propExpenses.get(prop.id);
            nodes.push({
                id,
                name: (prop.name || 'Unknown').toUpperCase(),
                type: 'property',
                level: levelOffset,
                sortKey: propKey++,
                color: this.getColor('properties',
                    propKey),
                total,
                propData: prop,
            });
            const src = hasIncome ? 'earnings' : 'dummy-source';
            links.push({
                source: src,
                target: id,
                value: Math.max(1,
                    propIncomes.get(prop.id) || 0),
                type: 'earnings-to-prop',
                property: prop.name,
            });
        });

        // L3: Expenses/Profit (wide)
        nodes.push({
            id: 'expenses',
            name: 'EXPENSES',
            type: 'expenses',
            level: levelOffset + 1,
            sortKey: 0,
            color: '#DC2626',
            widthFactor: 2,
        });
        if (hasIncome) {
            nodes.push({
                id: 'profit',
                name: 'PROFIT',
                type: 'profit',
                level: levelOffset + 1,
                sortKey: 1,
                color: '#059669',
                widthFactor: 2,
            });
        }
        sortedProps.forEach(prop => {
            const id = `prop-${prop.id}`;
            const exp = propExpenses.get(prop.id);
            const inc = propIncomes.get(prop.id) || 0;
            const profit = Math.max(0, inc - (exp || 0));
            links.push({
                source: id,
                target: 'expenses',
                value: exp || 0,
                type: 'prop-to-expenses',
                property: prop.name,
            });
            if (hasIncome && profit > 0) {
                links.push({
                    source: id,
                    target: 'profit',
                    value: profit,
                    type: 'prop-to-profit',
                    property: prop.name,
                });
            }
        });

        // L4-5: Cats/Subs via D3 stratify (use pre-computed totals)
        const totalExpenses = Object.values(Object.fromEntries(catTotals)).reduce((sum, v) => sum + v, 0) || 0;
        if (!totalExpenses) {
            logger.warn('CHART', 'No expense data available for stratification');
            return { nodes: [{ name: 'No Expenses', value: 0, isPlaceholder: true }], links: [], hasIncome: false };
        }

        // Explicit check for missing expenses data
        if (!propExpenses || propExpenses.size === 0) {
            logger.warn('CHART', 'Missing property expenses data');
            return { nodes: [{ name: 'Missing Expense Data', value: 0, isPlaceholder: true }], links: [], hasIncome: false };
        }

        const hierarchyArray: any[] = [{ name: 'expenses', value: totalExpenses, depth: 3 }];
        Object.entries(Object.fromEntries(catTotals)).forEach(([catName, catValue]) => {
            hierarchyArray.push({ name: catName, parent: 'expenses', value: catValue, depth: 4 });
        });
        (subTotals || new Map()).forEach((subs, catName) => {
            subs.forEach((subValue, subName) => {
                hierarchyArray.push({ name: subName, parent: catName, value: subValue, depth: 5 });
            });
        });
        hierarchyArray.slice(1).sort((a: any, b: any) => b.value - a.value);

        logger.debug('CHART', 'Stratify data:', hierarchyArray);

        let root;
        try {
            root = d3.stratify().id((d: any) => d.name).parentId((d: any) => d.parent)(hierarchyArray);
        } catch (error) {
            logger.error('CHART', 'Stratify error', error);
            return { nodes: [{ name: 'Data Processing Error', value: 0, isPlaceholder: true }], links: [], hasIncome: false };
        }
        const expenseNodes = root.descendants();

        // Add expense nodes to main nodes array
        expenseNodes.forEach((d: any) => {
            if (d.data.name !== 'expenses') { // Skip root, already added
                const level = d.depth === 1 ? levelOffset + 2 : levelOffset + 3;
                const type = d.depth === 1 ? 'category' : 'subcategory';
                const sortKey = d.depth === 1 ? Array.from(catTotals.keys()).indexOf(d.data.name) : 0;
                const color = this.getColor('categories', sortKey);
                nodes.push({
                    id: d.data.name,
                    name: d.data.name.toUpperCase(),
                    type,
                    level,
                    sortKey,
                    color,
                    total: d.data.value,
                    depth: d.depth,
                });
            }
        });

        // Add links from expenses to cats and cats to subs
        root.links().forEach((l: any) => {
            if (l.source.data.name === 'expenses') {
                links.push({
                    source: 'expenses',
                    target: l.target.data.name,
                    value: l.target.data.value,
                    type: 'expenses-to-cat',
                });
            } else {
                links.push({
                    source: l.source.data.name,
                    target: l.target.data.name,
                    value: l.target.data.value,
                    type: 'cat-to-sub',
                    category: l.source.data.name,
                });
            }
        });

        // D3 Sankey on stratified data
        let sankeyNodes, sankeyLinks;
        try {
            const sankeyResult = sankey()
                .nodeId((d: any) => d.id)
                .nodeWidth(15)
                .nodePadding(1)
                .extent([[50, 10], [width - 50, height - 50]])
                .iterations(12)({ nodes, links });
            sankeyNodes = sankeyResult.nodes;
            sankeyLinks = sankeyResult.links;
        } catch (error) {
            logger.error('CHART', 'D3 sankey error', error);
            return { nodes: [{ name: 'Sankey Processing Error', value: 0, isPlaceholder: true }], links: [], hasIncome };
        }

        // Filter visibles, assign positions
        const visibleNodes = sankeyNodes.filter((n: any) => {
            // Don't filter out income/expense nodes - they should always be visible
            if (n.type === 'income-source' || n.type === 'earnings' || n.type === 'expenses' || n.type === 'profit') {
                return true;
            }
            // For other nodes, ensure they have valid data
            return !n.isDummy && n.name?.trim() && n.value > 0;
        });

        const visibleLinks = sankeyLinks.filter((l: any) => {
            // Don't filter out income/expense related links
            if (l.type?.includes('income') || l.type?.includes('earnings') || l.type?.includes('expenses') || l.type?.includes('profit')) {
                return true;
            }
            // For other links, ensure they have valid targets and aren't dummy
            return !l.type?.includes('dummy') && l.target && !l.target.isDummy && l.value > 0;
        });

        logger.debug('CHART', `Visible nodes: ${visibleNodes.length}, Visible links: ${visibleLinks.length}`);

        // Debug: Log income/expense nodes specifically
        const incomeExpenseNodes = visibleNodes.filter((n: any) =>
            n.type === 'income-source' || n.type === 'earnings' || n.type === 'expenses' || n.type === 'profit',
        );
        logger.debug('CHART', 'Income/Expense nodes:', incomeExpenseNodes.map((n: any) => `${n.name}: ${n.value}`));

        visibleNodes.forEach((n: any) => {
            n.x0 ??= 0;
            n.y0 ??= 0;
            n.x1 = n.x0 + (n.width || 15);
            n.y1 = n.y0 + Math.max(10, n.y1 - n.y0);
        });
        visibleLinks.forEach((l: any) => {
            l.width = Math.max(0.5, l.width);
            try {
                l.path = sankeyLinkHorizontal()(l);
                logger.debug('CHART', `Link path generated: ${l.path ? 'success' : 'failed'}`);
            } catch (error) {
                logger.error('CHART', 'Error generating link path', error);
            }
        });

        // Scale wide nodes (Expenses spans props)
        const propLayer = visibleNodes.filter((n: any) => n.level === levelOffset);
        if (propLayer.length) {
            const minY = d3.min(propLayer, (d: any) => d.y0), maxY = d3.max(propLayer, (d: any) => d.y1);
            const expNode = visibleNodes.find((n: any) => n.id === 'expenses');
            if (expNode) { expNode.y0 = minY; expNode.y1 = maxY; }
        }

        return { nodes: visibleNodes, links: visibleLinks, hasIncome, sources };
    }



    // Render SVG with gradients/animations (~40 lines)
    createSankey(container: any, data: any) {
        const { width, height } = this.getDimensions(container);
        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('width', String(width));
        svgEl.setAttribute('height', String(height));
        svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
        container.appendChild(svgEl);

        let svg;
        try {
            svg = d3.select(svgEl)
                .attr('width', width)
                .attr('height', height)
                .attr('viewBox', `0 0 ${width} ${height}`)
                .on('click', (e: any) => {
                    if (e.target.tagName === 'svg') {this.clearRipple();}
                });
        } catch (error) {
            logger.warn('CHART', 'd3.select skipped', error);
            return;
        }

        try {
            this.zoomBehavior = d3.zoom();
            svg.call(this.zoomBehavior);
        } catch (error) {
            logger.warn('CHART', 'Zoom init skipped', error);
        }

        try {
        // Shared gradients (limit types)
            const defs = svg.append('defs');
            const types = [...new Set(data.links.map((l: any) => l.type))].slice(0, 8);
            types.forEach((type: any) => {
                const id = `grad-${type.replace(/[^a-z]/g, '')}`;
                const grad = defs.append('linearGradient').attr('id', id).attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '0%');
                grad.append('stop').attr('offset', '0%').attr('stop-color', this.getTypeColor(type, 'start'));
                grad.append('stop').attr('offset', '100%').attr('stop-color', this.getTypeColor(type, 'end'));
            });

            requestAnimationFrame(() => {
                try {
                    const linkG = svg.append('g').attr('class', 'links');

                    logger.debug('CHART', `Rendering links: ${data.links.length}`);
                    data.links.forEach((link: any, i: any) => {
                        logger.debug('CHART', `Link ${i}:`, {
                            source: link.source?.name || link.source,
                            target: link.target?.name || link.target,
                            path: link.path,
                            width: link.width,
                            type: link.type,
                        });
                    });

                    const linkSelection = linkG.selectAll('path').data(data.links);

                    linkSelection.enter().append('path')
                        .attr('d', (d: any) => {
                            logger.debug('CHART', `Link d attribute: ${d.path}`);
                            return d.path;
                        })
                        .attr('fill', 'none')
                        .attr('stroke', (d: any) => {
                            const gradientId = `grad-${d.type.replace(/[^a-z]/g, '')}`;
                            logger.debug('CHART', `Link stroke gradient: ${gradientId}`);
                            return `url(#${gradientId})`;
                        })
                        .attr('stroke-width', (d: any) => {
                            logger.debug('CHART', `Link stroke-width: ${d.width}`);
                            return d.width;
                        })
                        .style('opacity', 0)
                        .classed('link', true)
                        .attr('data-type', (d: any) => d.type)
                        .each(function(this: any, d: any) {
                            const pathLength = this.getTotalLength();
                            d.pathLength = pathLength;
                            logger.debug('CHART', `Link pathLength: ${pathLength}`);
                        })
                        .on('mouseover', this.throttle((e: any, d: any) => {
                            if (this.hoverTimeout) {clearTimeout(this.hoverTimeout);}
                            this.hoverTimeout = setTimeout(() => this.handleInteraction(e, d, 'link', false), 100);
                        }, 50))
                        .on('mouseout', this.throttle(() => {
                            if (this.hoverTimeout) {clearTimeout(this.hoverTimeout);}
                            this.hoverTimeout = setTimeout(() => this.onHoverOut(), 100);
                        }, 50))
                        .on('click', this.throttle((e: any, d: any) => this.handleInteraction(e, d, 'link', true), 100))
                        .transition()
                        .delay((d: any) => d.source.level * 200)
                        .duration(1000)
                        .ease(d3.easeCubicInOut)
                        .style('opacity', 0.4)
                        .attrTween('stroke-dasharray', (d: any) => {
                            const start = `0,${d.pathLength}`;
                            const end = `${d.pathLength},${d.pathLength}`;
                            return d3.interpolate(start, end);
                        });

                    linkSelection.exit().remove();

                    // Nodes: Pulse on load
                    const nodeG = svg.append('g').attr('class', 'nodes');
                    const nodeEnter = nodeG.selectAll('g').data(data.nodes).enter().append('g');
                    nodeEnter.append('rect')
                        .attr('x', (d: any) => d.x0).attr('y', (d: any) => d.y0).attr('height', (d: any) => d.y1 - d.y0)
                        .attr('width', (d: any) => d.x1 - d.x0).attr('stroke', '#fff')
                        .attr('stroke-width', 1).attr('rx', 3).style('cursor', 'pointer')
                        .classed('node', true)
                        .attr('data-type', (d: any) => d.type)
                        .on('mouseover', this.throttle((e: any, d: any) => {
                            if (this.hoverTimeout) {clearTimeout(this.hoverTimeout);}
                            this.hoverTimeout = setTimeout(() => this.handleInteraction(e, d, 'node', false), 100);
                        }, 50))
                        .on('mouseout', this.throttle(() => {
                            if (this.hoverTimeout) {clearTimeout(this.hoverTimeout);}
                            this.hoverTimeout = setTimeout(() => this.onHoverOut(), 100);
                        }, 50))
                        .on('click', this.throttle((e: any, d: any) => this.handleInteraction(e, d, 'node', true), 100))
                        .transition().duration(750).style('opacity', 1);
                    nodeEnter.append('text')
                        .attr('x', (d: any) => d.x0 > width / 2 ? d.x0 - 8 : d.x1 + 8)
                        .attr('y', (d: any) => (d.y0 + d.y1) / 2).attr('dy', '0.35em')
                        .attr('text-anchor', (d: any) => d.x0 > width / 2 ? 'end' : 'start')
                        .text((d: any) => d.name.length > 12 ? d.name.slice(0, 12) + '...' : d.name)
                        .style('font-size', '12px').style('fill', 'var(--color-text)');
                } catch (error) {
                    logger.warn('CHART', 'Sankey link draw skipped', error);
                }
            });

            // Store with simulation for traces (creative: force for fast neighbors)
            this.sankeyData = {
                svg,
                nodes: data.nodes,
                links: data.links,
                sim: d3.forceSimulation(data.nodes)
                    .force(
                        'link',
                        d3.forceLink(data.links).id((d: any) => d.index).distance(30),
                    )
                    .force('charge', d3.forceManyBody().strength(-50))
                    .force('center', d3.forceCenter(width / 2, height / 2))
                    .stop(), // Precompute positions for queries
            };
            this.state = { selected: null, highlighted: null };

            // Cache ripple forces post-render
            this.rippleForces = new Map();
            const pathForce = d3.forceLink(this.sankeyData.links)
                .id((d: any) => d.index)
                .distance((d: any) => 20 + d.value / 10);
            const nodeForce = d3.forceManyBody();
            nodeForce.path = pathForce;
            this.rippleForces.set('node', nodeForce);
            const linkForce = d3.forceManyBody();
            linkForce.path = pathForce;
            this.rippleForces.set('link', linkForce);

            // Build relation index for quick lookups (include income source keys)
            this.sankeyData.relationIndex = new Map();
            data.links.forEach((link: any) => {
                const keys = [link.source.name, link.target.name, link.property, link.category].filter(Boolean);
                keys.forEach(key => {
                    if (!this.sankeyData.relationIndex.has(key)) {this.sankeyData.relationIndex.set(key, new Set());}
                    this.sankeyData.relationIndex.get(key).add(link.source.id);
                    this.sankeyData.relationIndex.get(key).add(link.target.id);
                });
            });

            // Add income source keys to relationIndex for full ripples
            if (data.hasIncome) {
                Object.keys(data.sources).forEach(sourceName => {
                    const key = sourceName.toUpperCase();
                    if (!this.sankeyData.relationIndex.has(key)) {this.sankeyData.relationIndex.set(key, new Set());}
                    // Add all nodes connected to income sources
                    data.links.filter((l: any) => {
                        const name = sourceName.toUpperCase();
                        return l.source.name === name || l.target.name === name;
                    })
                        .forEach((l: any) => {
                            this.sankeyData.relationIndex.get(key).add(l.source.id);
                            this.sankeyData.relationIndex.get(key).add(l.target.id);
                        });
                });
            }

            this.repositionPersistentTooltip(); // If any
        } catch (error) {
            logger.warn('CHART', 'Sankey draw incomplete', error);
        }

        return svg;
    }

    getPathLength(pathNode: any) {
        return pathNode.getTotalLength();
    }

    // Unified interaction handler
    handleInteraction(event: any, item: any, type: any, isClick: any = false) {
        if (!this.sankeyData?.sim) {return;}
        const sim = this.sankeyData.sim;
        const nodes = sim.nodes();
        const links = this.sankeyData.links;
        const startNode = type === 'link' ? item.source : item;
        const filterKey = item.property || item.category || item.name; // For property/cat-specific ripples

        // Clear any existing hover timeout to prevent conflicts
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }

        // Memoize relatedIds per filterKey
        let relatedIds: any = this.relatedIdsCache.get(filterKey);
        if (!relatedIds) {
            relatedIds = this.sankeyData.relationIndex.get(filterKey) || new Set();
            this.relatedIdsCache.set(filterKey, relatedIds);
        }

        const forces: any = this.rippleForces.get(type);
        forces.filter = d3.forceManyBody().strength((d: any) => {
            const isRelated = relatedIds.has(d.id);
            return isRelated ? 0 : -20; // Reduce repulsion strength for better visibility
        });
        forces.ripple = d3.forceRadial(50, startNode.x, startNode.y).strength(0.1); // Circular ripple from start

        // State machine - improved logic
        if (isClick && this.interactionState === 'PINNED_SELECT' && this.isSameSelection(type, item)) {
            this.clearRipple();
            return;
        }

        // For clicks, enable full sim with improved alpha
        if (isClick) {
            sim.force('path', forces.path)
                .force('filter', forces.filter)
                .force('ripple', forces.ripple)
                .alpha(0.3)
                .alphaDecay(0.03)
                .restart();
        }

        // Update visuals immediately for better responsiveness
        this.updateRippleVisuals(nodes, links, relatedIds, false, isClick);

        // Update state
        this.interactionState = isClick ? 'PINNED_SELECT' : 'RIPPLE_HOVER';
        this.state[isClick ? 'selected' : 'highlighted'] = { type, item, startNode, filterKey, relatedIds: new Set(relatedIds) };

        // Show enhanced tooltip (SVG-based for sleekness)
        this.showRippleTooltip(event, item, type, isClick);

        // On click: Zoom to ripple bbox (elegant pan/zoom)
        if (isClick) {
            const rippleNodes = nodes.filter((n: any) => relatedIds.has(n.id));
            const key = JSON.stringify([...relatedIds].sort());
            let bbox = this.bboxCache.get(key);
            if (!bbox) {
                bbox = this.computeRippleBbox(rippleNodes);
                this.bboxCache.set(key, bbox);
            }
            this.zoomToBbox(bbox);
        }
    }



    // Declarative visual update (elegant: D3 transitions on sim positions)
    updateRippleVisuals(nodes: any, links: any, relatedIds: any, isFinal: any, isClick: any) {
        const relatedNodes = relatedIds ? nodes.filter((n: any) => relatedIds.has(n.id)) : [];
        const relatedLinks = relatedIds
            ? links.filter((l: any) => relatedIds.has(l.source.id) || relatedIds.has(l.target.id))
            : [];

        const t = this.sankeyData.svg.transition().duration(isFinal ? 500 : 300).ease(d3.easeCubicInOut);

        // Links: Animate to sim positions, opacity by relation
        this.sankeyData.svg.selectAll('.link')
            .data(links, (d: any) => d.index)
            .classed('related', (d: any) => relatedLinks.includes(d))
            .transition(t)
            .attr('d', isClick ? sankeyLinkHorizontal() : null)
            .style('opacity', (d: any) => {
                if (relatedLinks.includes(d)) {
                    // Related links should be fully visible but not too bright
                    return this.interactionState === 'PINNED_SELECT' ? 0.9 : 0.7;
                } else {
                    // Unrelated links should be dim but still visible
                    return this.interactionState === 'PINNED_SELECT' ? 0.3 : 0.5;
                }
            })
            .style('stroke-width', (d: any) => relatedLinks.includes(d) ? d.width * 1.2 : d.width);

        // Nodes: Scale/position with ripple, color tint
        this.sankeyData.svg.selectAll('.nodes rect')
            .data(nodes, (d: any) => d.index)
            .classed('related', (d: any) => relatedNodes.includes(d))
            .transition(t)
            .attr('width', (d: any) => (d.width || 15) * (relatedNodes.includes(d) ? 1.2 : 0.8))
            .attr('height', (d: any) => (d.height || 20) * (relatedNodes.includes(d) ? 1.2 : 0.8))
            .style('fill', (d: any) => relatedNodes.includes(d) ? this.adjustColorBrightness(d.color, 0.2) : d.color)
            .style('opacity', (d: any) => relatedNodes.includes(d) ? 1 : (this.interactionState === 'PINNED_SELECT' ? 0.1 : 0.6))
            .attr('x', isClick ? (d: any) => d.x - (d.width || 15)/2 : (d: any) => d.x0)
            .attr('y', isClick ? (d: any) => d.y - (d.height || 20)/2 : (d: any) => d.y0);
    }

    // Clear: Fade back to idle
    clearRipple() {
        // Clear any pending hover timeout
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }

        this.interactionState = 'IDLE';
        this.state.selected = this.state.highlighted = null;

        const sim = this.sankeyData.sim;
        sim.force('path', null).force('filter', null).force('ripple', null).alpha(0.1);

        // Reset visuals with proper timing
        this.updateRippleVisuals(sim.nodes(), this.sankeyData.links, null, true, false);

        this.hideTooltip();
        if (this.sankeyData.svg.call) {
            this.sankeyData.svg.call(this.zoomBehavior?.transform, d3.zoomIdentity); // Reset zoom
        }
    }

    // Add helper method for tooltip content (similar to current DOM formatting)
    formatTooltipContent(item: any, type: any) {
        const lines: string[] = [];
        if (type === 'node') {
            lines.push(item.name);
            if (item.total !== undefined) {
                lines.push(`${this.formatter.formatCurrency(item.total)}`);
            }
            if (item.type === 'property' && item.propData) {
                lines.push(`Property: ${item.propData.address || 'N/A'}`);
            } else if (item.type === 'category' || item.type === 'subcategory') {
                lines.push(`Category: ${item.type.toUpperCase()}`);
            }
        } else if (type === 'link') {
            lines.push(`${item.source?.name || 'Source'} → ${item.target?.name || 'Target'}`);
            lines.push(`${this.formatter.formatCurrency(item.value)} flow`);
            if (item.property) {lines.push(`Property: ${item.property}`);}
            if (item.category) {lines.push(`Category: ${item.category}`);}
        }
        return lines.map(line => ({ text: line, bold: line === lines[0] })); // First line bold
    }

    // Enhanced tooltip as SVG (sleek, no DOM jumps) - replace placeholder
    showRippleTooltip(event: any, item: any, type: any, persistent: any) {
    // Remove old
        this.sankeyData.svg.select('.ripple-tooltip').remove();

        const tooltipG = this.sankeyData.svg.append('g')
            .attr('class', 'ripple-tooltip')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .attr('transform', 'scale(0.5)'); // Start scaled for animation

        // Background rect (similar to current div styles)
        const bgRect = tooltipG.append('rect')
            .attr('fill', 'var(--color-surface)')
            .attr('stroke', 'var(--color-border)')
            .attr('stroke-width', 1)
            .attr('rx', 4)
            .attr('filter', persistent ? 'url(#glow)' : null); // Creative glow on persistent

        // Add glow filter if persistent (in defs if not exists)
        if (persistent) {
            const defs = this.sankeyData.svg.select('defs');
            if (defs.select('#glow').empty()) {
                const glow = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
                glow.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'coloredBlur');
                const feMerge = glow.append('feMerge');
                feMerge.append('feMergeNode').attr('in', 'coloredBlur');
                feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
            }
        }

        // Foreign object for text with max-width (SVG text doesn't support max-width)
        const foreignObject = tooltipG.append('foreignObject')
            .attr('x', 12)
            .attr('y', 8)
            .attr('width', 280)
            .attr('height', 100); // Estimate height

        const div = foreignObject.append('xhtml:div')
            .style('max-width', '280px')
            .style('font-size', 'var(--font-size-sm, 12px)')
            .style('font-family', 'var(--font-family, sans-serif)')
            .style('color', 'var(--color-text)')
            .style('line-height', '1.2em')
            .style('word-wrap', 'break-word');

        // Generate content
        const contentLines = this.formatTooltipContent(item, type);
        const htmlContent = contentLines.map(line => line.bold ? `<b>${line.text}</b>` : line.text).join('<br>');
        div.html(htmlContent);

        // Size rect to fit (use estimated size)
        bgRect.attr('x', 4).attr('y', 4)
            .attr('width', 280 + 16).attr('height', contentLines.length * 16 + 8)
            .attr('box-shadow', 'var(--shadow-lg)'); // Note: SVG shadow via CSS or filter

        // Position near pointer (similar to current absolute pos)
        const [x, y] = d3.pointer(event, this.sankeyData.svg.node());
        const anchorX = x + 10;
        const anchorY = y - 10;
        tooltipG.attr('transform', `translate(${anchorX}, ${anchorY})`);

        // Animate in (sleek scale + opacity, like current fade)
        tooltipG.transition()
            .duration(200)
            .ease(d3.easeBackOut)
            .style('opacity', 1)
            .attr('transform', `translate(${anchorX}, ${anchorY}) scale(1)`);

        if (persistent) {
            this.persistentTooltip = tooltipG;
            this.persistentPos = [anchorX, anchorY];
        }
    }

    // Update hideTooltip to handle SVG (add after clearRipple)
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.opacity = '0';
        }
        if (this.persistentTooltip) {
            try {
                this.persistentTooltip.transition().duration(200).style('opacity', 0).remove();
            } catch (_error) {
                // Fallback for mock environments where transition methods may not be fully implemented
                try {
                    this.persistentTooltip.style('opacity', 0).remove();
                } catch (_fallbackError) {
                    // Last resort fallback - just null out the tooltip
                    logger.warn('CHART', 'Could not properly hide persistent tooltip, clearing reference');
                }
            }
            this.persistentTooltip = null;
            this.persistentPos = null;
        }
    }

    // Update repositionPersistentTooltip (if exists, or add) to handle SVG
    repositionPersistentTooltip() {
        if (this.persistentTooltip && this.persistentPos) {
            const [x, y] = this.persistentPos;
            this.persistentTooltip.transition().duration(150)
                .attr('transform', `translate(${x}, ${y}) scale(1)`);
        }
    }

    // In createSankey defs, ensure vars are accessible (SVG supports CSS vars via style)

    // Zoom to bbox (add D3.zoom)
    zoomToBbox(bbox: any) {
        const k = Math.min(this.sankeyData.svg.attr('width') / (bbox[1][0] - bbox[0][0]),
            this.sankeyData.svg.attr('height') / (bbox[1][1] - bbox[0][1]));
        const tx = (this.sankeyData.svg.attr('width') - k * (bbox[1][0] + bbox[0][0])) / 2;
        const ty = (this.sankeyData.svg.attr('height') - k * (bbox[1][1] + bbox[0][1])) / 2;

        // Ensure zoomBehavior.transform exists before using it
        if (this.zoomBehavior && this.zoomBehavior.transform) {
            this.sankeyData.svg.transition().call(
                this.zoomBehavior.transform,
                d3.zoomIdentity.translate(tx, ty).scale(k),
            );
        } else {
            // Fallback for mock environments
            this.sankeyData.svg.transition().call(d3.zoomIdentity.translate(tx, ty).scale(k));
        }
    }

    /**
     * Get color from theme
     * @param {string} type - Color type ('properties' or 'categories')
     * @param {number} index - Color index
     * @returns {string} Color string
     */
    getColor(type: any, index: any) {
        const palette = this.chartConfig.colors as any;
        const colors = palette[type] || palette.categories;
        return colors[index % colors.length];
    }

    /**
     * Get type color for gradients
     * @param {string} type - Link type
     * @param {string} position - 'start' or 'end'
     * @returns {string} Color string
     */
    getTypeColor(type: any, position: any) {
        const baseColor = this.getColor('categories', 0);
        if (position === 'start') {return baseColor;}
        return this.adjustColorBrightness(baseColor, -0.2);
    }

    /**
     * Get container dimensions
     * @param {HTMLElement} container - Container element
     * @returns {Object} Width and height
     */
    getDimensions(container: any) {
        const rect = container.getBoundingClientRect();
        return {
            width: rect.width || 800,
            height: rect.height || 600,
        };
    }

    /**
     * Check if selection is the same
     * @param {string} type - Selection type
     * @param {Object} item - Selected item
     * @returns {boolean} Whether selection is the same
     */
    isSameSelection(type: any, item: any) {
        const current = this.state.selected;
        return !!(current && current.type === type && current.item === item);
    }

    /**
     * Handle hover out
     */
    onHoverOut() {
        if (this.interactionState === 'RIPPLE_HOVER') {
            this.clearRipple();
        }
    }

    /**
     * Compute ripple bounding box
     * @param {Array} nodes - Ripple nodes
     * @returns {Array} Bounding box [[x0,y0], [x1,y1]]
     */
    computeRippleBbox(nodes: any) {
        if (!nodes.length) {return [[0,0], [100,100]];}
        const x0 = d3.min(nodes, (d: any) => d.x0);
        const y0 = d3.min(nodes, (d: any) => d.y0);
        const x1 = d3.max(nodes, (d: any) => d.x1);
        const y1 = d3.max(nodes, (d: any) => d.y1);
        if (isNaN(x0) || isNaN(y0) || isNaN(x1) || isNaN(y1)) {return [[0,0], [100,100]];}
        return [[x0, y0], [x1, y1]];
    }

    /**
     * Show overview placeholder
     */
    showOverviewPlaceholder(container: any) {
        container.innerHTML = `
            <div class="coming-soon">
                <div class="coming-soon-icon">📊</div>
                <h3>No Data Available</h3>
                <p>Add some properties and expenses to see the beautiful sankey diagram visualization.</p>
            </div>
        `;

        this.uiManager.hideLoadingState();
        this.isRendering = false;
    }

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message: any) {
        const errorElement = this.uiManager.getElement('error-placeholder');
        if (errorElement) {
            errorElement.textContent = `Error: ${message}`;
            errorElement.style.display = 'block';
            logger.error('CHART', 'Error displayed', message);
        } else {
            logger.error('CHART', 'Error placeholder not found, logging error', message);
        }
    }

    /**
     * Set theme manager reference
     * @param {ThemeManager} themeManager - Theme manager instance
     */
    setThemeManager(themeManager: any) {
        this.themeManager = themeManager;
        this.updateChartColors();
        logger.info('CHART', 'Theme manager set');
    }

    /**
     * Update chart colors from theme manager
     */
    updateChartColors() {
        if (!this.themeManager) {
            return;
        }

        const chartColors = this.themeManager.getColorTheme();
        const fallbackPalette = [
            '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454',
            '#13343B', '#ECEBD5', '#33808D', '#C0152F', '#A84B2F',
        ];
        this.chartConfig.colors = {
            properties: chartColors.properties || fallbackPalette,
            categories: chartColors.categories || fallbackPalette,
            trends: chartColors.trends || {
                increasing: '#10B981',
                decreasing: '#EF4444',
                stable: '#6B7280',
            },
        };

        // Set CSS vars for node colors
        document.documentElement.style.setProperty('--color-node-income', this.chartConfig.colors.categories[0]);
        document.documentElement.style.setProperty('--color-node-property', this.chartConfig.colors.properties[0]);
        document.documentElement.style.setProperty('--color-node-expenses', '#DC2626');
        document.documentElement.style.setProperty('--color-node-profit', '#059669');
        document.documentElement.style.setProperty('--color-node-earnings', '#059669');
        document.documentElement.style.setProperty('--color-node-category', this.chartConfig.colors.categories[0]);
        document.documentElement.style.setProperty('--color-node-subcategory', this.chartConfig.colors.categories[1]);

        logger.debug('CHART', 'Updated chart colors from theme:', this.themeManager.getCurrentColorTheme());
    }

    /**
     * Handle data change event
     */
    handleDataChange(_data: any) {
        logger.info('CHART', 'Data changed, re-rendering sankey');
        // Clear cached data and re-render
        if (this.dataManager) {
            this.dataManager.clearSankeyCache();
        }
        // Invalidate memoized relatedIds cache
        this.relatedIdsCache.clear();
        this.renderOverviewSankey();
    }

    /**
     * Handle color theme change event
     */
    handleColorThemeChange(_event: any) {
        logger.info('CHART', 'Color theme changed, updating chart colors');
        this.updateChartColors();

        // Update existing chart elements without full re-render
        if (this.sankeyData) {
            // Update link strokes
            this.sankeyData.svg.selectAll('.link').attr('stroke', (d: any) => `url(#grad-${d.type.replace(/[^a-z]/g, '')})`);
            // Update text color
            this.sankeyData.svg.selectAll('.nodes text').style('fill', 'var(--color-text)');
        }

        // Reposition persistent tooltip
        this.repositionPersistentTooltip();

        // Debounced re-render for theme changes
        this.debouncedRender();
    }

    /**
     * Adjust color brightness for gradient variations
     * @param {string} color - Hex color string
     * @param {number} factor - Brightness factor (0.1 = 10% brighter, -0.1 = 10% darker)
     * @returns {string} Adjusted hex color
     */
    adjustColorBrightness(color: any, factor: any) {
        // Remove # if present
        color = color.replace(/^#/, '');

        // Parse RGB components
        const r = parseInt(color.substr(0, 2), 16);
        const g = parseInt(color.substr(2, 2), 16);
        const b = parseInt(color.substr(4, 2), 16);

        // Adjust brightness
        const adjust = (component: number) => {
            const val = component * (1 + factor);
            return Math.min(255, Math.max(0, Math.round(val)));
        };

        const newR = adjust(r);
        const newG = adjust(g);
        const newB = adjust(b);

        // Convert back to hex
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Remove theme change listener
        if (document._colorThemeListenerAdded) {
            document.removeEventListener('colorThemeChange', this.handleColorThemeChange.bind(this));
            document._colorThemeListenerAdded = false;
        }

        this.legends.clear();
        this.sankeyData = null;
        this.state = { selected: null, highlighted: null, paths: { nodes: [], links: [] } };
        this.persistentPos = null;
        logger.info('CHART', 'Chart renderer cleaned up');
    }

    /**
     * Debug chart information
     */
    debug() {
        logger.debug('CHART', '=== CHART RENDERER INFO ===');
        logger.debug('CHART', 'Current chart:', this.currentChart);
        logger.debug('CHART', 'Tooltip available:', !!this.tooltip);
        logger.debug('CHART', 'Legends count:', this.legends.size);
        logger.debug('CHART', 'Chart config:', this.chartConfig);
        logger.debug('CHART', 'Selected state:', this.state);
        logger.debug('CHART', 'Sankey data available:', !!this.sankeyData);
        logger.debug('CHART', 'Current color theme:', this.themeManager ? this.themeManager.getCurrentColorTheme() : 'N/A');
        logger.debug('CHART', '=== END DEBUG ===');
    }
}  // Closing brace for class ChartRenderer

// Export for use in other modules
export default ChartRenderer;

declare global {
    interface Document {
        _colorThemeListenerAdded?: boolean;
    }
    interface Window {
        ChartRenderer: typeof ChartRenderer;
    }
}

if (typeof window !== 'undefined') {
    window.ChartRenderer = ChartRenderer;
}
