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

class ChartRenderer {
    constructor(dataManager, uiManager, formatter, themeManager) {
        this.dataManager = dataManager;
        this.uiManager = uiManager;
        this.formatter = formatter;
        this.themeManager = themeManager;

        // Chart configuration
        this.chartConfig = {
            margins: { top: 40, right: 80, bottom: 60, left: 160 },
            animations: {
                duration: 750,
                ease: d3.easeCubicInOut,
            },
        };

        // Initialize colors from theme manager
        this.updateChartColors();

        // Listen for color theme changes
        document.addEventListener('colorThemeChange', this.handleColorThemeChange.bind(this));

        // Chart state
        this.currentChart = null;
        this.tooltip = null;
        this.legends = new Map();

        // Sankey interaction state
        this.selectedFlow = null;
        this.highlightedFlow = null;
        this.selectedFlowMousePosition = null;
        this.selectedNode = null;
        this.selectedNodeMousePosition = null;

        console.log('[CHART] ChartRenderer initialized');
    }

    /**
     * Initialize chart renderer
     */
    async initialize() {
        this.createTooltip();
        this.setupChartContainers();

        console.log('[CHART] Chart renderer initialized');
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
        // Setup chart containers for different views
        const containers = [
            'overviewChartContent'
        ];

        containers.forEach(containerId => {
            const container = this.uiManager.getElement(containerId);
            if (container) {
                // Clear any existing content
                container.innerHTML = '';

                // Set up basic container styling
                container.style.position = 'relative';
                container.style.width = '100%';
                container.style.height = '100%';
                container.style.overflow = 'hidden';

                console.log(`[CHART] Setup container: ${containerId}`);
            } else {
                console.warn(`[CHART] Container not found: ${containerId}`);
            }
        });
    }

    /**
     * Render overview sankey diagram
     */
    async renderOverviewSankey() {
        const container = this.uiManager.getElement('overviewChartContent');
        if (!container) {
            console.error('[CHART] Overview chart container not found');
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        try {
            this.uiManager.showLoadingState('Loading overview...');

            // Get current time period and selected year from data manager
            const currentTimePeriod = this.dataManager.getCurrentTimePeriod();
            const selectedYear = this.dataManager.getSelectedYear();

            // Use current time period for the overview Sankey chart, with year filtering if applicable
            const sankeyData = this.prepareSankeyData(currentTimePeriod, selectedYear);

            if (!sankeyData || sankeyData.nodes.length === 0) {
                this.showOverviewPlaceholder(container);
                return;
            }

            this.createSankeyDiagram(container, sankeyData);
            this.uiManager.hideLoadingState();

        } catch (error) {
            console.error('[CHART] Error rendering sankey:', error);
            this.showOverviewPlaceholder(container);
        }
    }

    /**
     * Render overview sankey diagram (alias for renderOverviewSankey)
     */
    renderOverviewSankeyDiagram() {
        this.renderOverviewSankey();
    }

    /**
     * Prepare data for sankey diagram
     * @param {string} timePeriod - Time period to use ('all', 'year', 'quarter', 'month')
     * @param {string} selectedYear - Selected year to filter by ('all' for all years)
     */
    prepareSankeyData(timePeriod = null, selectedYear = null) {
        const allProperties = this.dataManager.getProperties();
        const categories = this.dataManager.getExpenseCategories();

        // Filter out properties that don't have any meaningful expense or income data
        let properties = allProperties.filter(property => {
            // Check if property has any expenses at all (not just empty objects)
            const hasAnyExpenses = property.expenses &&
                                  typeof property.expenses === 'object' &&
                                  Object.keys(property.expenses).length > 0 &&
                                  // Check if any category has actual non-zero values
                                  Object.entries(property.expenses).some(([category, value]) => {
                                      if (typeof value === 'number') {
                                          return value !== 0;
                                      } else if (typeof value === 'object' && value !== null) {
                                          // For hierarchical categories, check if any subcategory has non-zero values
                                          return Object.values(value).some(subValue =>
                                              typeof subValue === 'number' && subValue !== 0
                                          );
                                      }
                                      return false;
                                  });

            // Check if property has monthly data with actual expense values
            const hasMonthlyData = property.monthlyData &&
                                  typeof property.monthlyData === 'object' &&
                                  Object.keys(property.monthlyData).length > 0 &&
                                  Object.values(property.monthlyData).some(monthData =>
                                      monthData && typeof monthData === 'object' &&
                                      Object.values(monthData).some(value =>
                                          typeof value === 'number' && value !== 0
                                      )
                                  );

            // Check if property has quarterly data with actual values
            const hasQuarterlyData = property.quarterlyData &&
                                    typeof property.quarterlyData === 'object' &&
                                    Object.keys(property.quarterlyData).length > 0 &&
                                    Object.values(property.quarterlyData).some(quarterData =>
                                        quarterData && typeof quarterData === 'object' &&
                                        typeof quarterData.total === 'number' && quarterData.total !== 0
                                    );

            return hasAnyExpenses || hasMonthlyData || hasQuarterlyData;
        });

        if (!properties || properties.length === 0) {
            console.log('[CHART] No properties with data available for sankey');
            return null;
        }

        const nodes = [];
        const links = [];
        const nodeMap = new Map();
        let subcategoryIndex = 0;

        // Dynamically detect hierarchical categories and their subcategories from current expenses
        const hierarchicalCategories = {};

        // Scan through all properties to find hierarchical categories in current expenses
        properties.forEach(property => {
            const currentExpenses = property.expenses || {};
            Object.entries(currentExpenses).forEach(([category, expenseData]) => {
                if (typeof expenseData === 'object' && expenseData !== null) {
                    // This is a hierarchical category - collect all subcategories
                    if (!hierarchicalCategories[category]) {
                        hierarchicalCategories[category] = new Set();
                    }
                    Object.keys(expenseData).forEach(subCategory => {
                        hierarchicalCategories[category].add(subCategory);
                    });
                }
            });
        });

        // Convert Sets to Arrays for easier processing
        Object.keys(hierarchicalCategories).forEach(category => {
            hierarchicalCategories[category] = Array.from(hierarchicalCategories[category]);
        });

        // Step 1: Create property nodes (Level 1) - sorted by amount
        const propertyNodes = [];
        const propertyTotals = new Map();

        // Calculate property totals first
        properties.forEach((property, index) => {
            const propertyData = this.dataManager.getCurrentPeriodData(property, timePeriod);
            propertyTotals.set(property.id, propertyData.total);
        });

        // If a specific year is selected, filter properties to only include those with data for that year
        if (selectedYear !== 'all') {
            properties = properties.filter(property => {
                if (!property.monthlyData) return false;

                // Check if property has any data for the selected year
                return Object.keys(property.monthlyData).some(monthKey => {
                    const parts = monthKey.split(' ');
                    return parts.length === 2 && parts[1] === selectedYear;
                });
            });

            // If no properties have data for the selected year, return null
            if (properties.length === 0) {
                console.log('[CHART] No properties found with data for year:', selectedYear);
                return null;
            }
        }

        // Sort properties by absolute total amount descending (highest to lowest)
        const sortedProperties = properties.slice().sort((a, b) => {
            const totalA = propertyTotals.get(a.id) || 0;
            const totalB = propertyTotals.get(b.id) || 0;
            if (totalA !== totalB) {
                return Math.abs(totalB) - Math.abs(totalA); // Sort by absolute value descending
            }
            return a.name.localeCompare(b.name); // Stable sort
        });

        // Create property nodes in sorted order
        sortedProperties.forEach((property, index) => {
            const nodeId = `property-${property.id}`;
            nodeMap.set(nodeId, nodes.length);
            nodes.push({
                id: nodeId,
                name: property.name.toUpperCase(),
                type: 'property',
                level: 1,
                color: this.chartConfig.colors.properties[index % this.chartConfig.colors.properties.length],
                propertyIndex: index,
                originalIndex: nodes.length
            });
        });

        // Create a map of property ID to its sorted index
        const propertySortedIndex = new Map();
        sortedProperties.forEach((property, sortedIndex) => {
            propertySortedIndex.set(property.id, sortedIndex);
        });

        // Step 2: Create category nodes (Level 2) - sorted by amount
        const categoryTotals = new Map();

        // Calculate category totals using the same data source as the sankey data
        categories.forEach((category) => {
            let total = 0;
            properties.forEach(property => {
                const propertyData = this.dataManager.getCurrentPeriodData(property, timePeriod, true);
                const expenseData = propertyData.expenses[category];
                if (expenseData) {
                    if (typeof expenseData === 'object' && expenseData !== null) {
                        // Hierarchical category - sum all subcategory values
                        Object.values(expenseData).forEach(value => {
                            if (value !== 0) total += Math.abs(value); // Include negative values (expenses) using absolute value
                        });
                    } else {
                        // Flat category - direct value
                        const value = expenseData || 0;
                        if (value !== 0) total += Math.abs(value); // Include negative values (expenses) using absolute value
                    }
                }
            });
            categoryTotals.set(category, total);
        });

        // Sort categories by absolute total amount descending (highest to lowest)
        const sortedCategories = categories.slice().sort((a, b) => {
            const totalA = categoryTotals.get(a) || 0;
            const totalB = categoryTotals.get(b) || 0;
            if (totalA !== totalB) {
                return Math.abs(totalB) - Math.abs(totalA); // Sort by absolute value descending
            }
            return a.localeCompare(b); // Stable sort
        });

        // Create a map of category to its sorted index
        const categorySortedIndex = new Map();
        sortedCategories.forEach((category, sortedIndex) => {
            categorySortedIndex.set(category, sortedIndex);
        });

        // Create category nodes in sorted order
        sortedCategories.forEach((category, sortedIndex) => {
            const nodeId = `category-${sortedIndex}`; // Use sorted index for node ID to ensure proper ordering
            nodeMap.set(nodeId, nodes.length);
            nodes.push({
                id: nodeId,
                name: category.toUpperCase(),
                type: 'category',
                level: 2,
                color: this.chartConfig.colors.categories[sortedIndex % this.chartConfig.colors.categories.length],
                hasSubcategories: hierarchicalCategories[category] !== undefined,
                categoryIndex: categories.indexOf(category),
                sortedIndex: sortedIndex, // Add sorted index for proper grouping
                originalIndex: sortedIndex // Use sorted index as original index for proper sorting
            });
        });

        // Step 3: Create subcategory nodes (Level 3) - grouped by parent, sorted by amount within each group
        sortedCategories.forEach((category) => {
            if (hierarchicalCategories[category]) {
                const subcategories = hierarchicalCategories[category];

                // Calculate subcategory totals
                const subcategoryTotals = new Map();
                subcategories.forEach(subCategory => {
                    let total = 0;
                    properties.forEach(property => {
                        const propertyData = this.dataManager.getCurrentPeriodData(property, timePeriod, true);
                        const expenseData = propertyData.expenses[category];
                        if (typeof expenseData === 'object' && expenseData && expenseData[subCategory]) {
                            total += expenseData[subCategory];
                        }
                    });
                    subcategoryTotals.set(subCategory, total);
                });

                // Sort subcategories by absolute amount descending (highest to lowest)
                const sortedSubcategories = subcategories.slice().sort((a, b) => {
                    const totalA = subcategoryTotals.get(a) || 0;
                    const totalB = subcategoryTotals.get(b) || 0;
                    if (totalA !== totalB) {
                        return Math.abs(totalB) - Math.abs(totalA); // Sort by absolute value descending
                    }
                    return a.localeCompare(b); // Stable sort
                });

                // Create subcategory nodes in sorted order
                sortedSubcategories.forEach((subCategory) => {
                    const subNodeId = `sub-${category}-${subCategory}`;
                    const totalAmount = subcategoryTotals.get(subCategory) || 0;
                    nodeMap.set(subNodeId, nodes.length);
                    nodes.push({
                        id: subNodeId,
                        name: subCategory.toUpperCase(),
                        type: 'subcategory',
                        level: 3,
                        color: this.chartConfig.colors.categories[subcategoryIndex++ % this.chartConfig.colors.categories.length],
                        parentCategory: category,
                        parentCategoryIndex: categorySortedIndex.get(category),
                        originalIndex: nodes.length,
                        totalAmount: totalAmount
                    });
                });
            }
        });

        // Step 3.5: Add dummy sink node for flat categories to ensure they're on level 2
        const dummySinkId = 'dummy-sink';
        nodeMap.set(dummySinkId, nodes.length);
        nodes.push({
            id: dummySinkId,
            name: '',
            type: 'dummy',
            level: 3,
            color: 'transparent',
            isDummy: true
        });

        // Step 4: Create links with laminar flow
        properties.forEach((property, propIndex) => {
            const propertyData = this.dataManager.getCurrentPeriodData(property, timePeriod, true);
            const sortedPropertyIndex = propertySortedIndex.get(property.id);

            categories.forEach((category, categoryIndex) => {
                const expenseData = propertyData.expenses[category];

                // Check if this category has hierarchical data in the current period
                const isHierarchicalInPeriod = typeof expenseData === 'object' && expenseData !== null;
                const isHierarchicalInProperty = hierarchicalCategories[category] !== undefined;

                if (isHierarchicalInPeriod) {
                    // Current period has hierarchical data - create hierarchical flows
                    let categoryTotal = 0;
                    Object.entries(expenseData).forEach(([subCategory, value]) => {
                        if (value !== 0) { // Include both positive and negative values
                            categoryTotal += value;
                        }
                    });

                    // Link property -> category (intermediate node)
                    if (categoryTotal !== 0) {
                        links.push({
                            source: nodeMap.get(`property-${property.id}`),
                            target: nodeMap.get(`category-${categorySortedIndex.get(category)}`),
                            value: Math.abs(categoryTotal), // Convert to positive for sankey
                            property: property.name,
                            category,
                            flowType: 'property-to-category',
                            propertyIndex: sortedPropertyIndex
                        });

                        // Link category -> subcategories
                        Object.entries(expenseData).forEach(([subCategory, value]) => {
                            if (value !== 0) {
                                const subNodeId = `sub-${category}-${subCategory}`;
                                if (nodeMap.has(subNodeId)) { // Only create link if subcategory node exists
                                    links.push({
                                        source: nodeMap.get(`category-${categorySortedIndex.get(category)}`),
                                        target: nodeMap.get(subNodeId),
                                        value: Math.abs(value), // Convert to positive for sankey
                                        property: property.name,
                                        category: subCategory,
                                        flowType: 'category-to-subcategory',
                                        propertyIndex: sortedPropertyIndex
                                    });
                                }
                            }
                        });
                    }
                } else if (isHierarchicalInProperty && !isHierarchicalInPeriod) {
                    // Category is hierarchical in property but flat in current period
                    // This can happen when time period filtering results in flat data
                    const value = expenseData || 0;
                    if (value !== 0) {
                        // Create direct link to category node (flat flow)
                        links.push({
                            source: nodeMap.get(`property-${property.id}`),
                            target: nodeMap.get(`category-${categorySortedIndex.get(category)}`),
                            value: Math.abs(value), // Convert to positive for sankey
                            property: property.name,
                            category,
                            flowType: 'property-to-category-flat'
                        });

                        // Add dummy link from flat category to dummy sink to ensure it's on level 2
                        links.push({
                            source: nodeMap.get(`category-${categorySortedIndex.get(category)}`),
                            target: nodeMap.get(dummySinkId),
                            value: 0.001, // Very small value
                            property: '',
                            category: '',
                            flowType: 'dummy'
                        });
                    }
                } else {
                    // Flat category - direct flow to category node
                    const value = expenseData || 0;
                    if (value !== 0) {
                        links.push({
                            source: nodeMap.get(`property-${property.id}`),
                            target: nodeMap.get(`category-${categorySortedIndex.get(category)}`),
                            value: Math.abs(value), // Convert to positive for sankey
                            property: property.name,
                            category,
                            flowType: 'property-to-category-flat'
                        });

                        // Add dummy link from flat category to dummy sink to ensure it's on level 2
                        links.push({
                            source: nodeMap.get(`category-${categorySortedIndex.get(category)}`),
                            target: nodeMap.get(dummySinkId),
                            value: 0.001, // Very small value
                            property: '',
                            category: '',
                            flowType: 'dummy'
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
            console.error('[CHART] Invalid sankey data');
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
            console.error('[CHART] D3 Sankey plugin not loaded');
            this.showOverviewPlaceholder(container);
            return;
        }

        try {
            // Sort links to ensure laminar flow - same target nodes get inputs in property order
            const sortedLinks = data.links.slice().sort((a, b) => {
                // Primary: sort by target node index (ensures laminar flow to same targets)
                if (a.target !== b.target) {
                    return a.target - b.target;
                }
                // Secondary: for same target, sort by source node index
                if (a.source !== b.source) {
                    return a.source - b.source;
                }
                // Tertiary: for category-to-subcategory links, sort by property index (property order)
                if (a.flowType === 'category-to-subcategory' && b.flowType === 'category-to-subcategory') {
                    return (a.propertyIndex || 0) - (b.propertyIndex || 0);
                }
                // Otherwise sort by value descending
                return b.value - a.value;
            });

            // Group subcategories by parent category for consistent spacing
            const categoryGroups = {};
            data.nodes.forEach(node => {
                if (node.level === 3 && node.parentCategory) {
                    if (!categoryGroups[node.parentCategory]) {
                        categoryGroups[node.parentCategory] = [];
                    }
                    categoryGroups[node.parentCategory].push(node);
                }
            });

            // Calculate spacing between category groups
            const categoryGroupKeys = Object.keys(categoryGroups).sort((a, b) => {
                const parentA = data.nodes.find(n => n.level === 2 && n.name === a.toUpperCase());
                const parentB = data.nodes.find(n => n.level === 2 && n.name === b.toUpperCase());
                return (parentA?.sortedIndex || 0) - (parentB?.sortedIndex || 0);
            });

            // Create sankey layout with custom node sorting for consistent spacing
            const sankey = d3.sankey()
                .nodeWidth(20)
                .nodePadding(6)  // Even tighter padding
                .iterations(32)
                .nodeSort((a, b) => {
                    // First sort by level
                    if (a.level !== b.level) {
                        return a.level - b.level;
                    }

                    // For level 3 (subcategories), ensure consistent grouping by parent category
                    if (a.level === 3 && b.level === 3) {
                        // Get parent category indices for consistent ordering
                        const parentAIndex = categoryGroupKeys.indexOf(a.parentCategory);
                        const parentBIndex = categoryGroupKeys.indexOf(b.parentCategory);

                        if (parentAIndex !== parentBIndex) {
                            return parentAIndex - parentBIndex;
                        }

                        // Within the same parent category, sort by absolute amount (descending)
                        return Math.abs(b.totalAmount || 0) - Math.abs(a.totalAmount || 0);
                    }

                    // For level 2 (categories), maintain amount-based sorting
                    if (a.level === 2 && b.level === 2) {
                        return (a.sortedIndex || 0) - (b.sortedIndex || 0);
                    }

                    // For level 1 (properties), maintain amount-based sorting
                    return a.originalIndex - b.originalIndex;
                })
                .linkSort(null)
                .extent([[25, 0], [width - 25, height - 25]]);

            // Process data - nodes are already in correct order from prepareSankeyData
            const sankeyData = sankey({
                nodes: data.nodes.map(d => ({ ...d })),
                links: sortedLinks.map(d => ({ ...d })),
            });

            // Validate sankey output
            if (!sankeyData.nodes || !sankeyData.links) {
                throw new Error('Sankey layout failed');
            }

            const { nodes, links } = sankeyData;

            // Apply consistent colors based on node type
            // Get the current color theme
            const currentTheme = this.themeManager ? this.themeManager.getCurrentColorTheme() : 'default';
            const themeColors = this.themeManager ? this.themeManager.getColorTheme() : this.themeManager.getColorTheme('default');

            // Group nodes by type for consistent color assignment
            const propertyNodes = nodes.filter(d => d.type === 'property');
            const categoryNodes = nodes.filter(d => d.type === 'category');
            const subcategoryNodes = nodes.filter(d => d.type === 'subcategory');

            nodes.forEach(d => {
                if (d.type === 'property') {
                    // Properties use property colors
                    const propertyIndex = d.propertyIndex !== undefined ? d.propertyIndex : propertyNodes.indexOf(d);
                    d.color = themeColors.properties[propertyIndex % themeColors.properties.length];
    } else if (d.type === 'category') {
        // Categories use category colors based on sorted index for proper gradient application
        const categoryIndex = d.sortedIndex !== undefined ? d.sortedIndex : (d.categoryIndex !== undefined ? d.categoryIndex : categoryNodes.indexOf(d));
        d.color = themeColors.categories[categoryIndex % themeColors.categories.length];
                } else if (d.type === 'subcategory') {
                    // Subcategories use parent category colors
                    const parentIndex = d.parentCategoryIndex !== undefined ? d.parentCategoryIndex : 0;
                    d.color = themeColors.categories[parentIndex % themeColors.categories.length];
                } else {
                    // Fallback for any other node types
                    d.color = d.color || '#666666';
                }
            });

            // Note: Node spacing is handled by the custom nodeSort function above

            // Store reference to SVG for interaction updates
            this.sankeySvg = svg;
            this.sankeyNodes = nodes;
            this.sankeyLinks = links;

            // Filter out dummy elements for rendering
            const visibleLinks = links.filter(l => l.flowType !== 'dummy');
            const visibleNodes = nodes.filter(n => !n.isDummy);

            // Create gradients for links with proper direction
            const defs = svg.append('defs');

            // Create individual gradients for each link
            visibleLinks.forEach((d, i) => {
                const deltaX = Math.abs(d.target.x0 - d.source.x1);
                const deltaY = Math.abs((d.target.y0 + d.target.y1) / 2 - (d.source.y0 + d.source.y1) / 2);

                if (deltaY > deltaX) {
                    // Vertical gradient - create per link
                    const gradient = defs.append('linearGradient')
                        .attr('id', `vertical-gradient-${i}`)
                        .attr('gradientUnits', 'userSpaceOnUse');

                    const sourceCenterX = (d.source.x0 + d.source.x1) / 2;
                    gradient
                        .attr('x1', sourceCenterX)
                        .attr('x2', sourceCenterX)
                        .attr('y1', d.source.y0 + (d.source.y1 - d.source.y0) / 2)  // source center y
                        .attr('y2', d.target.y0 + (d.target.y1 - d.target.y0) / 2); // target center y

                    gradient.append('stop')
                        .attr('offset', '0%')
                        .attr('stop-color', d.source.color);

                    gradient.append('stop')
                        .attr('offset', '100%')
                        .attr('stop-color', d.target.color);

                    d.gradientId = `vertical-gradient-${i}`;
                } else {
                    // Horizontal gradient - create per link
                    const gradient = defs.append('linearGradient')
                        .attr('id', `horizontal-gradient-${i}`)
                        .attr('gradientUnits', 'userSpaceOnUse');

                    const sourceCenterY = (d.source.y0 + d.source.y1) / 2;
                    gradient
                        .attr('x1', d.source.x1)
                        .attr('x2', d.target.x0)
                        .attr('y1', sourceCenterY)
                        .attr('y2', sourceCenterY);

                    gradient.append('stop')
                        .attr('offset', '0%')
                        .attr('stop-color', d.source.color);

                    gradient.append('stop')
                        .attr('offset', '100%')
                        .attr('stop-color', d.target.color);

                    d.gradientId = `horizontal-gradient-${i}`;
                }
            });

            // Draw links with gradients (like the original HTML example)
            const linkElements = svg.append('g')
                .attr('class', 'sankey-links')
                .attr('fill', 'none')
                .selectAll('path')
                .data(visibleLinks)
                .enter()
                .append('path')
                .attr('d', d3.sankeyLinkHorizontal())
                .attr('stroke', d => `url(#${d.gradientId})`)
                .attr('stroke-width', d => Math.max(5, d.width || 1))
                .attr('opacity', 0.6)
                .attr('class', d => this.getLinkClass(d))
                .style('cursor', 'pointer')
                .on('mouseover', (event, d) => {
                    this.highlightFlow(d);
                })
                .on('mouseout', () => {
                    this.clearHighlight();
                    // Only hide tooltip if no flow or node is selected
                    if (!this.selectedFlow && !this.selectedNode) {
                        this.hideTooltip();
                    }
                })
                .on('click', (event, d) => {
                    this.selectFlow(d);
                });

            // Draw nodes with interactive features
            const nodeElements = svg.append('g')
                .attr('class', 'sankey-nodes')
                .selectAll('g')
                .data(visibleNodes)
                .enter()
                .append('g')
                .attr('class', d => this.getNodeClass(d));

            nodeElements.append('rect')
                .attr('x', d => Math.min(d.x0, d.x1))
                .attr('y', d => Math.min(d.y0, d.y1))
                .attr('height', d => Math.abs(d.y1 - d.y0))
                .attr('width', d => Math.abs(d.x1 - d.x0))
                .attr('fill', d => d.color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1)
                .attr('rx', 4)
                .style('cursor', 'pointer')
                .on('mouseover', (event, d) => {
                    this.highlightNode(d);
                })
                .on('mouseout', () => {
                    this.clearHighlight();
                    // Only hide tooltip if no flow or node is selected
                    if (!this.selectedFlow && !this.selectedNode) {
                        this.hideTooltip();
                    }
                })
                .on('click', (event, d) => {
                    this.selectNode(d);
                });

            // Add node labels
            nodeElements.append('text')
                .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
                .attr('y', d => (d.y0 + d.y1) / 2)
                .attr('dy', '0.35em')
                .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
                .style('font-size', 'var(--font-size-sm)')
                .style('fill', 'var(--color-text)')
                .style('cursor', 'pointer')
                .text(d => d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name)
                .on('mouseover', (event, d) => {
                    this.highlightNode(d);
                })
                .on('mouseout', () => {
                    this.clearHighlight();
                    // Only hide tooltip if no flow or node is selected
                    if (!this.selectedFlow && !this.selectedNode) {
                        this.hideTooltip();
                    }
                })
                .on('click', (event, d) => {
                    this.selectNode(d);
                });

            // Add click handler to clear selection when clicking on empty space
            svg.on('click', (event) => {
                if (event.target.tagName === 'svg') {
                    this.clearSelection();
                }
            });



        } catch (error) {
            console.error('[CHART] Error creating sankey diagram:', error);
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
     * Get CSS class for a link based on current state
     */
    getLinkClass(link) {
        const classes = ['sankey-link'];

        // Check if this link is in the selected flow path by direct reference comparison
        if (this.selectedFlowPath && this.selectedFlowPath.links.includes(link)) {
            classes.push('sankey-link-selected');
        } else if (this.selectedFlow === link) {
            classes.push('sankey-link-selected');
        } else if (this.highlightedFlowPath && this.highlightedFlowPath.links.includes(link)) {
            classes.push('sankey-link-highlighted');
        } else if (this.highlightedFlow === link) {
            classes.push('sankey-link-highlighted');
        } else if (this.selectedFlowPath || this.selectedFlow || this.highlightedFlowPath || this.highlightedFlow) {
            classes.push('sankey-link-dimmed');
        }

        return classes.join(' ');
    }

    /**
     * Get CSS class for a node based on current state
     */
    getNodeClass(node) {
        const classes = ['sankey-node'];

        // Check if this node is directly selected
        if (this.selectedNode === node) {
            classes.push('sankey-node-selected');
        }
        // Check if this node is in the selected flow path by direct reference comparison
        else if (this.selectedFlowPath && this.selectedFlowPath.nodes.includes(node)) {
            classes.push('sankey-node-selected');
        } else if (this.selectedFlow && this.isNodeInFlow(node, this.selectedFlow)) {
            classes.push('sankey-node-selected');
        } else if (this.highlightedFlowPath && this.highlightedFlowPath.nodes.includes(node)) {
            classes.push('sankey-node-highlighted');
        } else if (this.highlightedFlow && this.isNodeInFlow(node, this.highlightedFlow)) {
            classes.push('sankey-node-highlighted');
        } else if (this.selectedFlowPath || this.selectedFlow || this.selectedNode || this.highlightedFlowPath || this.highlightedFlow) {
            classes.push('sankey-node-dimmed');
        }

        return classes.join(' ');
    }

    /**
     * Check if two flows are equal
     */
    isFlowEqual(flow1, flow2) {
        // Handle cases where flow1 or flow2 might be undefined or null
        if (!flow1 || !flow2) return false;

        // Check if they are the same object reference first (fastest check)
        if (flow1 === flow2) return true;

        // Check if both have the required properties
        if (!flow1.source || !flow2.source || !flow1.target || !flow2.target) return false;

        // Compare by source/target node IDs and flow properties
        const sourceId1 = typeof flow1.source === 'object' ? flow1.source.id : flow1.source;
        const sourceId2 = typeof flow2.source === 'object' ? flow2.source.id : flow2.source;
        const targetId1 = typeof flow1.target === 'object' ? flow1.target.id : flow1.target;
        const targetId2 = typeof flow2.target === 'object' ? flow2.target.id : flow2.target;

        return sourceId1 === sourceId2 &&
               targetId1 === targetId2 &&
               flow1.value === flow2.value &&
               flow1.property === flow2.property;
    }

    /**
     * Check if a node is part of a flow
     */
    isNodeInFlow(node, flow) {
        return node.id === flow.source.id || node.id === flow.target.id;
    }

    /**
     * Get opacity for a link based on current state
     */
    getLinkOpacity(link) {
        // Selected flows have full opacity (1.0)
        if (this.selectedFlowPath && this.selectedFlowPath.links.includes(link)) {
            return 1.0;
        } else if (this.selectedFlow === link) {
            return 1.0;
        }
        // Highlighted flows have 30% lesser dim (0.7)
        else if (this.highlightedFlowPath && this.highlightedFlowPath.links.includes(link)) {
            return 0.7;
        } else if (this.highlightedFlow === link) {
            return 0.7;
        }
        // Dimmed flows have 90% dim when selected (0.1), 30% dim when highlighted (0.2)
        else if (this.selectedFlowPath || this.selectedFlow) {
            return 0.1; // 90% dimming for selected state
        } else if (this.highlightedFlowPath || this.highlightedFlow) {
            return 0.2; // 30% dimming for highlighted state
        }
        // Default opacity
        return 0.6;
    }

    /**
     * Get opacity for a node based on current state
     */
    getNodeOpacity(node) {
        // Selected nodes have full opacity (1.0)
        if (this.selectedFlowPath && this.selectedFlowPath.nodes.includes(node)) {
            return 1.0;
        } else if (this.selectedFlow && this.isNodeInFlow(node, this.selectedFlow)) {
            return 1.0;
        }
        // Highlighted nodes have 30% lesser dim (0.7)
        else if (this.highlightedFlowPath && this.highlightedFlowPath.nodes.includes(node)) {
            return 0.7;
        } else if (this.highlightedFlow && this.isNodeInFlow(node, this.highlightedFlow)) {
            return 0.7;
        }
        // Dimmed nodes have 90% dim when selected (0.1), 30% dim when highlighted (0.2)
        else if (this.selectedFlowPath || this.selectedFlow) {
            return 0.1; // 90% dimming for selected state
        } else if (this.highlightedFlowPath || this.highlightedFlow) {
            return 0.2; // 30% dimming for highlighted state
        }
        // Default opacity
        return 1.0;
    }

    /**
     * Highlight a flow on mouseover
     */
    highlightFlow(flow) {
        // Trace the complete flow path for the hovered flow's property
        this.highlightedFlow = flow;
        this.highlightedFlowPath = this.traceCompleteFlowPath(flow);
        this.updateSankeyVisuals();
    }

    /**
     * Clear flow highlighting
     */
    clearHighlight() {
        this.highlightedFlow = null;
        this.highlightedFlowPath = null;
        this.updateSankeyVisuals();
    }

    /**
     * Select/deselect a flow
     */
    selectFlow(flow, event) {
        if (this.selectedFlow === flow) {
            // Deselect if clicking the same flow
            this.selectedFlow = null;
            this.selectedFlowPath = null;
            this.selectedFlowMousePosition = null;
        } else {
            // Select the clicked flow and trace the complete path including all nodes
            this.selectedFlow = flow;
            this.selectedFlowPath = this.traceCompleteFlowPath(flow);
            // Store mouse click position for tooltip
            if (event) {
                this.selectedFlowMousePosition = {
                    x: event.pageX,
                    y: event.pageY
                };
            }
        }
        this.updateSankeyVisuals();
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedFlow = null;
        this.selectedFlowPath = null;
        this.selectedFlowMousePosition = null;
        this.selectedNode = null;
        this.selectedNodeMousePosition = null;
        this.updateSankeyVisuals();
    }

    /**
     * Trace the complete flow path from a clicked link
     */
    traceCompleteFlowPath(clickedLink) {
        if (!this.sankeyLinks || !this.sankeyNodes) {
            return { links: [], nodes: [] };
        }

        const flowPath = {
            links: [],
            nodes: [],
        };

        // Add the clicked link and its nodes
        flowPath.links.push(clickedLink);
        flowPath.nodes.push(clickedLink.source);
        flowPath.nodes.push(clickedLink.target);

        // For hierarchical flows, find the connected links in the same flow path
        const propertyName = clickedLink.property;

        // If this is a property->category link, find all subcategory links for this property and category
        if (clickedLink.source.type === 'property' && clickedLink.target.type === 'category') {
            // Find all subcategory links that come from this category for the same property
            const subcategoryLinks = this.sankeyLinks.filter(link =>
                link.source.id === clickedLink.target.id && // From the category
                link.property === propertyName && // Same property
                link.target.type === 'subcategory' // To subcategory
            );

            subcategoryLinks.forEach(link => {
                flowPath.links.push(link);
                if (!flowPath.nodes.some(n => n.id === link.target.id)) {
                    flowPath.nodes.push(link.target);
                }
            });
        }
        // If this is a category->subcategory link, find the property->category link
        else if (clickedLink.source.type === 'category' && clickedLink.target.type === 'subcategory') {
            // Find the property link that connects to this category for the same property
            const propertyLink = this.sankeyLinks.find(link =>
                link.target.id === clickedLink.source.id &&
                link.property === propertyName &&
                link.source.type === 'property'
            );

            if (propertyLink) {
                flowPath.links.push(propertyLink);
                if (!flowPath.nodes.some(n => n.id === propertyLink.source.id)) {
                    flowPath.nodes.push(propertyLink.source);
                }
            }
        }

        return flowPath;
    }

    /**
     * Trace backward through the flow path for a specific property
     */
    traceBackward(node, flowPath, propertyName) {
        // Add the current node
        flowPath.nodes.add(node);

        // Find links that flow into this node AND belong to the same property
        const incomingLinks = this.sankeyLinks.filter(link =>
            link.target.id === node.id && link.property === propertyName
        );

        incomingLinks.forEach(link => {
            // Avoid infinite loops by checking if we've already processed this link
            if (!flowPath.links.has(link)) {
                flowPath.links.add(link);
                // Recursively trace backward from the source of this link
                this.traceBackward(link.source, flowPath, propertyName);
            }
        });
    }

    /**
     * Trace forward through the flow path for a specific property
     */
    traceForward(node, flowPath, propertyName) {
        // Add the current node
        flowPath.nodes.add(node);

        // Find links that flow out from this node AND belong to the same property
        const outgoingLinks = this.sankeyLinks.filter(link =>
            link.source.id === node.id && link.property === propertyName
        );

        outgoingLinks.forEach(link => {
            // Avoid infinite loops by checking if we've already processed this link
            if (!flowPath.links.has(link)) {
                flowPath.links.add(link);
                // Recursively trace forward from the target of this link
                this.traceForward(link.target, flowPath, propertyName);
            }
        });
    }

    /**
     * Highlight a flow on mouseover
     */
    highlightFlow(flow) {
        // Trace the complete flow path for the hovered flow's property
        this.highlightedFlow = flow;
        this.highlightedFlowPath = this.traceCompleteFlowPath(flow);
        this.updateSankeyVisuals();
    }

    /**
     * Clear flow highlighting
     */
    clearHighlight() {
        this.highlightedFlow = null;
        this.highlightedFlowPath = null;
        this.updateSankeyVisuals();
    }

    /**
     * Select/deselect a flow
     */
    selectFlow(flow, event) {
        if (this.selectedFlow === flow) {
            // Deselect if clicking the same flow
            this.selectedFlow = null;
            this.selectedFlowPath = null;
            this.selectedFlowMousePosition = null;
        } else {
            // Select the clicked flow and trace the complete path including all nodes
            this.selectedFlow = flow;
            this.selectedFlowPath = this.traceCompleteFlowPath(flow);
            // Store mouse click position for tooltip
            if (event) {
                this.selectedFlowMousePosition = {
                    x: event.pageX,
                    y: event.pageY
                };
            }
        }
        this.updateSankeyVisuals();
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedFlow = null;
        this.selectedFlowPath = null;
        this.selectedFlowMousePosition = null;
        this.selectedNode = null;
        this.selectedNodeMousePosition = null;
        this.updateSankeyVisuals();
    }

    /**
     * Trace the complete flow path from a clicked link
     */
    traceCompleteFlowPath(clickedLink) {
        if (!this.sankeyLinks || !this.sankeyNodes) {
            return { links: [], nodes: [] };
        }

        const flowPath = {
            links: [],
            nodes: [],
        };

        // Add the clicked link and its nodes
        flowPath.links.push(clickedLink);
        flowPath.nodes.push(clickedLink.source);
        flowPath.nodes.push(clickedLink.target);

        // For hierarchical flows, find the connected links in the same flow path
        const propertyName = clickedLink.property;

        // If this is a property->category link, find all subcategory links for this property and category
        if (clickedLink.source.type === 'property' && clickedLink.target.type === 'category') {
            // Find all subcategory links that come from this category for the same property
            const subcategoryLinks = this.sankeyLinks.filter(link =>
                link.source.id === clickedLink.target.id && // From the category
                link.property === propertyName && // Same property
                link.target.type === 'subcategory' // To subcategory
            );

            subcategoryLinks.forEach(link => {
                flowPath.links.push(link);
                if (!flowPath.nodes.some(n => n.id === link.target.id)) {
                    flowPath.nodes.push(link.target);
                }
            });
        }
        // If this is a category->subcategory link, find the property->category link
        else if (clickedLink.source.type === 'category' && clickedLink.target.type === 'subcategory') {
            // Find the property link that connects to this category for the same property
            const propertyLink = this.sankeyLinks.find(link =>
                link.target.id === clickedLink.source.id &&
                link.property === propertyName &&
                link.source.type === 'property'
            );

            if (propertyLink) {
                flowPath.links.push(propertyLink);
                if (!flowPath.nodes.some(n => n.id === propertyLink.source.id)) {
                    flowPath.nodes.push(propertyLink.source);
                }
            }
        }

        return flowPath;
    }

    /**
     * Trace backward through the flow path for a specific property
     */
    traceBackward(node, flowPath, propertyName) {
        // Add the current node
        flowPath.nodes.add(node);

        // Find links that flow into this node AND belong to the same property
        const incomingLinks = this.sankeyLinks.filter(link =>
            link.target.id === node.id && link.property === propertyName
        );

        incomingLinks.forEach(link => {
            // Avoid infinite loops by checking if we've already processed this link
            if (!flowPath.links.has(link)) {
                flowPath.links.add(link);
                // Recursively trace backward from the source of this link
                this.traceBackward(link.source, flowPath, propertyName);
            }
        });
    }

    /**
     * Trace forward through the flow path for a specific property
     */
    traceForward(node, flowPath, propertyName) {
        // Add the current node
        flowPath.nodes.add(node);

        // Find links that flow out from this node AND belong to the same property
        const outgoingLinks = this.sankeyLinks.filter(link =>
            link.source.id === node.id && link.property === propertyName
        );

        outgoingLinks.forEach(link => {
            // Avoid infinite loops by checking if we've already processed this link
            if (!flowPath.links.has(link)) {
                flowPath.links.add(link);
                // Recursively trace forward from the target of this link
                this.traceForward(link.target, flowPath, propertyName);
            }
        });
    }

    /**
     * Highlight a node (show connected flows)
     */
    highlightNode(node) {
        // Find all flows connected to this node
        const connectedFlows = this.sankeyLinks.filter(link =>
            link.source.id === node.id || link.target.id === node.id
        );

        if (connectedFlows.length > 0) {
            this.highlightedFlow = connectedFlows[0]; // Highlight first connected flow
            this.updateSankeyVisuals();
        }
    }

    /**
     * Select a node (highlight all paths flowing through it)
     */
    selectNode(node, event) {
        // Clear any existing selection
        this.clearSelection();

        // Select the node and store mouse position
        this.selectedNode = node;
        if (event) {
            this.selectedNodeMousePosition = {
                x: event.pageX,
                y: event.pageY
            };
        }

        // Trace all paths flowing through this node
        const allPaths = this.traceAllPathsThroughNode(node);

        // Set the selection to include all paths through this node
        this.selectedFlow = null;
        this.selectedFlowPath = allPaths;

        this.updateSankeyVisuals();
    }

    /**
     * Trace all paths flowing through a node
     */
    traceAllPathsThroughNode(selectedNode) {
        if (!this.sankeyLinks || !this.sankeyNodes) {
            return { links: [], nodes: [] };
        }

        const allPaths = {
            links: [],
            nodes: [],
        };

        // Find all links connected to this node (both incoming and outgoing)
        const connectedLinks = this.sankeyLinks.filter(link =>
            link.source.id === selectedNode.id || link.target.id === selectedNode.id
        );

        // For each connected link, trace its complete path
        connectedLinks.forEach(link => {
            const path = this.traceCompleteFlowPath(link);

            // Add all links from this path (avoid duplicates)
            path.links.forEach(link => {
                if (!allPaths.links.some(existingLink =>
                    existingLink.source.id === link.source.id &&
                    existingLink.target.id === link.target.id &&
                    existingLink.property === link.property
                )) {
                    allPaths.links.push(link);
                }
            });

            // Add all nodes from this path (avoid duplicates)
            path.nodes.forEach(node => {
                if (!allPaths.nodes.some(existingNode => existingNode.id === node.id)) {
                    allPaths.nodes.push(node);
                }
            });
        });

        return allPaths;
    }



    /**
     * Update sankey diagram visuals based on current state
     */
    updateSankeyVisuals() {
        if (!this.sankeySvg || !this.sankeyLinks || !this.sankeyNodes) {
            return;
        }

        // Update link classes and opacity
        this.sankeySvg.selectAll('.sankey-links path')
            .attr('class', d => this.getLinkClass(d))
            .style('opacity', d => this.getLinkOpacity(d));

        // Update node classes and opacity
        this.sankeySvg.selectAll('.sankey-nodes rect')
            .attr('class', d => this.getNodeClass(d))
            .style('opacity', d => this.getNodeOpacity(d));

        // Show tooltip for selected flow or node (persistent)
        if (this.selectedFlow) {
            this.showSelectedFlowTooltip();
        } else if (this.selectedNode) {
            this.showSelectedNodeTooltip();
        } else {
            this.hideTooltip();
        }
    }

    /**
     * Show tooltip for selected flow
     */
    showSelectedFlowTooltip() {
        if (!this.tooltip || !this.selectedFlow) {
            return;
        }

        let tooltipX, tooltipY;

        // Use stored mouse click position if available
        if (this.selectedFlowMousePosition) {
            tooltipX = this.selectedFlowMousePosition.x;
            tooltipY = this.selectedFlowMousePosition.y;
        } else {
            // Fallback to center of flow if no mouse position stored
            const container = this.uiManager.getElement('overviewChartContent');
            if (!container) {
                return;
            }

            const containerRect = container.getBoundingClientRect();
            const svgRect = container.querySelector('svg')?.getBoundingClientRect();

            if (!svgRect) {
                return;
            }

            // Calculate the center position of the selected flow
            const sourceNode = this.selectedFlow.source;
            const targetNode = this.selectedFlow.target;

            // Get the midpoint of the link
            const midX = (sourceNode.x1 + targetNode.x0) / 2;
            const midY = (sourceNode.y0 + sourceNode.y1 + targetNode.y0 + targetNode.y1) / 4;

            // Convert SVG coordinates to screen coordinates
            const scaleX = svgRect.width / container.clientWidth;
            const scaleY = svgRect.height / container.clientHeight;

            tooltipX = svgRect.left + midX * scaleX;
            tooltipY = svgRect.top + midY * scaleY;
        }

        // Create tooltip content
        let content = `<strong>${this.selectedFlow.property}</strong>`;
        if (this.selectedFlow.category) {
            content += `<br/>${this.selectedFlow.category}`;
        }
        // Show negative values for expenses in tooltips
        const displayValue = this.selectedFlow.flowType === 'dummy' ? this.selectedFlow.value : -Math.abs(this.selectedFlow.value);
        const formattedValue = this.formatter.formatCurrency(Math.abs(displayValue));
        content += `<br/>${displayValue < 0 ? '-' : ''}${formattedValue}`;

        // Position and show tooltip
        this.tooltip
            .style('opacity', 1)
            .html(content)
            .style('left', (tooltipX + 10) + 'px')
            .style('top', (tooltipY - 10) + 'px');
    }

    /**
     * Show tooltip for selected node
     */
    showSelectedNodeTooltip() {
        if (!this.tooltip || !this.selectedNode) {
            return;
        }

        let tooltipX, tooltipY;

        // Use stored mouse click position if available
        if (this.selectedNodeMousePosition) {
            tooltipX = this.selectedNodeMousePosition.x;
            tooltipY = this.selectedNodeMousePosition.y;
        } else {
            // Fallback to center of node if no mouse position stored
            const container = this.uiManager.getElement('overviewChartContent');
            if (!container) {
                return;
            }

            const containerRect = container.getBoundingClientRect();
            const svgRect = container.querySelector('svg')?.getBoundingClientRect();

            if (!svgRect) {
                return;
            }

            // Calculate the center position of the selected node
            const centerX = (this.selectedNode.x0 + this.selectedNode.x1) / 2;
            const centerY = (this.selectedNode.y0 + this.selectedNode.y1) / 2;

            // Convert SVG coordinates to screen coordinates
            const scaleX = svgRect.width / container.clientWidth;
            const scaleY = svgRect.height / container.clientHeight;

            tooltipX = svgRect.left + centerX * scaleX;
            tooltipY = svgRect.top + centerY * scaleY;
        }

        // Create tooltip content based on node type
        let content = `<strong>${this.selectedNode.name}</strong>`;

        // Calculate total value flowing through this node
        let totalValue = 0;
        if (this.sankeyLinks) {
            this.sankeyLinks.forEach(link => {
                if (link.source.id === this.selectedNode.id || link.target.id === this.selectedNode.id) {
                    totalValue += link.value;
                }
            });
        }

        if (totalValue > 0) {
            // Show negative values for expenses in tooltips
            const formattedValue = this.formatter.formatCurrency(Math.abs(-totalValue));
            content += `<br/>-${formattedValue}`;
        }



        // Set tooltip content first to get its dimensions
        this.tooltip
            .style('opacity', 1)
            .html(content);

        // Get tooltip dimensions
        const tooltipRect = this.tooltip.node().getBoundingClientRect();
        const tooltipWidth = tooltipRect.width;
        const tooltipHeight = tooltipRect.height;

        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Smart positioning based on node location and viewport constraints
        let finalX = tooltipX;
        let finalY = tooltipY;

        // Check if node is on the right side of the chart (level 3 nodes are typically here)
        const container = this.uiManager.getElement('overviewChartContent');
        if (container) {
            const containerRect = container.getBoundingClientRect();
            const svgRect = container.querySelector('svg')?.getBoundingClientRect();

            if (svgRect) {
                // Calculate node's position relative to container center
                const nodeCenterX = (this.selectedNode.x0 + this.selectedNode.x1) / 2;
                const containerCenterX = container.clientWidth / 2;

                // If node is on the right side, position tooltip to the left
                if (nodeCenterX > containerCenterX) {
                    finalX = tooltipX - tooltipWidth - 15; // Position to the left with margin
                } else {
                    finalX = tooltipX + 15; // Position to the right with margin
                }
            }
        }

        // Ensure tooltip doesn't go off-screen horizontally
        if (finalX + tooltipWidth > viewportWidth) {
            finalX = viewportWidth - tooltipWidth - 10;
        }
        if (finalX < 10) {
            finalX = 10;
        }

        // Ensure tooltip doesn't go off-screen vertically
        if (finalY + tooltipHeight > viewportHeight) {
            finalY = viewportHeight - tooltipHeight - 10;
        }
        if (finalY < 10) {
            finalY = 10;
        }

        // Position and show tooltip
        this.tooltip
            .style('left', finalX + 'px')
            .style('top', finalY + 'px');
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
     * Set theme manager reference
     * @param {ThemeManager} themeManager - Theme manager instance
     */
    setThemeManager(themeManager) {
        this.themeManager = themeManager;
        this.updateChartColors();
        console.log('[CHART] Theme manager set');
    }

    /**
     * Update chart colors from theme manager
     */
    updateChartColors() {
        if (!this.themeManager) {
            console.warn('[CHART] Theme manager not available for color updates');
            return;
        }

        const chartColors = this.themeManager.getChartColors();
        this.chartConfig.colors = {
            properties: chartColors.categories || ['#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B', '#ECEBD5', '#33808D', '#C0152F', '#A84B2F'],
            categories: chartColors.categories || ['#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B', '#ECEBD5', '#33808D', '#C0152F', '#A84B2F'],
            trends: chartColors.trends || {
                increasing: '#10B981',
                decreasing: '#EF4444',
                stable: '#6B7280',
            },
        };

        console.log('[CHART] Updated chart colors from theme:', this.themeManager.getCurrentColorTheme());
    }

    /**
     * Handle color theme change event
     */
    handleColorThemeChange(event) {
        console.log('[CHART] Color theme changed, updating chart colors');
        this.updateChartColors();

        // Re-render current charts if they exist
        const overviewContainer = this.uiManager.getElement('overviewChartContent');
        if (overviewContainer && !overviewContainer.querySelector('.coming-soon')) {
            this.renderOverviewSankey();
        }
    }

    /**
     * Adjust color brightness for gradient variations
     * @param {string} color - Hex color string
     * @param {number} factor - Brightness factor (0.1 = 10% brighter, -0.1 = 10% darker)
     * @returns {string} Adjusted hex color
     */
    adjustColorBrightness(color, factor) {
        // Remove # if present
        color = color.replace(/^#/, '');

        // Parse RGB components
        const r = parseInt(color.substr(0, 2), 16);
        const g = parseInt(color.substr(2, 2), 16);
        const b = parseInt(color.substr(4, 2), 16);

        // Adjust brightness
        const adjust = (component) => {
            const adjusted = Math.round(component + (255 - component) * factor);
            return Math.min(255, Math.max(0, adjusted));
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

        this.legends.clear();
        console.log('[CHART] Chart renderer cleaned up');
    }

    /**
     * Debug chart information
     */
    debug() {
        console.log('[CHART DEBUG] === CHART RENDERER INFO ===');
        console.log('[CHART DEBUG] Current chart:', this.currentChart);
        console.log('[CHART DEBUG] Tooltip available:', !!this.tooltip);
        console.log('[CHART DEBUG] Legends count:', this.legends.size);
        console.log('[CHART DEBUG] Chart config:', this.chartConfig);
        console.log('[CHART DEBUG] Selected flow:', this.selectedFlow);
        console.log('[CHART DEBUG] Highlighted flow:', this.highlightedFlow);
        console.log('[CHART DEBUG] Current color theme:', this.themeManager ? this.themeManager.getCurrentColorTheme() : 'N/A');
        console.log('[CHART DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartRenderer;
} else {
    window.ChartRenderer = ChartRenderer;
}
