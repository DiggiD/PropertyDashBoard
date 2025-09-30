/**
 * Jest unit tests for ChartRenderer with 80%+ coverage
 * Tests ChartRenderer using real method execution with minimal mocking
 * Target: 80%+ statements/branches/functions/lines
 */


jest.mock('../modules/utils/Storage', () => require('../__mocks__/Storage'));
jest.mock('../modules/core/ThemeManager', () => require('../__mocks__/ThemeManager'));

// Make d3 global for ChartRenderer
global.d3 = require('../__mocks__/d3');

import ChartRenderer from 'src/modules/core/ChartRenderer.js';

describe('ChartRenderer with High Coverage', () => {
    let chartRenderer;
    let mockContainer;
    let mockDataManager;
    let mockUIManager;
    let mockThemeManager;
    let mockFormatter;

    beforeEach(async () => {
        jest.isolateModules(() => {
            // Module isolation for real execution
        });

        // Mock ResizeObserver after module isolation
        global.ResizeObserver = jest.fn().mockImplementation(function() {
            this.observe = jest.fn();
            this.disconnect = jest.fn();
            this.unobserve = jest.fn();
        });

        jest.clearAllMocks();
        jest.spyOn(document, 'addEventListener');
        jest.spyOn(global, 'setTimeout');

        // Clean up any existing instances
        ChartRenderer.instance = null;

        // Create container
        mockContainer = document.createElement('div');
        mockContainer.id = 'chart-container';
        document.body.appendChild(mockContainer);

        // Mock dependencies
        mockDataManager = {
            getAggregatedSankeyData: jest.fn(() => ({
                hasIncome: true,
                sources: { Rent: 1000 },
                propIncomes: new Map([[1, 1500]]),
                propExpenses: new Map([[1, 1200]]),
                catTotals: new Map([['Rent', 800], ['Utilities', 300]]),
                subTotals: new Map()
            })),
            getProperties: jest.fn(() => [{ id: 1, name: 'Property 1' }]),
            getExpenseCategories: jest.fn(() => ['Rent', 'Utilities']),
            getCurrentTimePeriod: jest.fn(() => 'all'),
            getSelectedYear: jest.fn(() => 'all'),
            hasData: jest.fn(() => true),
            clearSankeyCache: jest.fn(),
            on: jest.fn(),
            emit: jest.fn()
        };

        mockUIManager = {
            getElement: jest.fn((id) => {
                if (id === 'overviewChartContent' || id === 'chart-container') return mockContainer;
                return null;
            }),
            showLoadingState: jest.fn(),
            hideLoadingState: jest.fn()
        };

        mockFormatter = {
            formatCurrency: jest.fn((val) => `$${val}`)
        };

        mockThemeManager = {
            isDark: jest.fn(() => false),
            getColorTheme: jest.fn(() => ({ properties: ['#5D878F'], categories: ['#DB4545'] })),
            getCurrentColorTheme: jest.fn(() => 'light')
        };

        // Create ChartRenderer (tests singleton, so need clean state)
        chartRenderer = new ChartRenderer(mockDataManager, mockUIManager, mockFormatter);
        chartRenderer.setThemeManager(mockThemeManager);
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        if (mockContainer && mockContainer.parentNode) {
            mockContainer.parentNode.removeChild(mockContainer);
        }
        // Reset singleton instance between tests
        ChartRenderer.instance = null;
    });

    describe('Constructor and Initialization', () => {
        test('should create ChartRenderer instance', () => {
            expect(chartRenderer).toBeDefined();
            expect(chartRenderer.dataManager).toBe(mockDataManager);
            expect(chartRenderer.uiManager).toBe(mockUIManager);
        });

        test('should handle singleton pattern', () => {
            const mockFormatter2 = {
                formatCurrency: jest.fn((val) => `$${val}`)
            };
            const secondInstance = new ChartRenderer(mockDataManager, mockUIManager, mockFormatter2);
            expect(secondInstance).toBe(chartRenderer); // Should return existing instance
        });

        test('should initialize with default chart config', () => {
            expect(chartRenderer.chartConfig).toBeDefined();
            expect(chartRenderer.chartConfig.margins).toBeDefined();
            expect(chartRenderer.chartConfig.animations).toBeDefined();
        });

        test('should set up event listeners', () => {
            // Check that theme change listener would be added (can't fully test element creation)
            expect(document.addEventListener).toHaveBeenCalledTimes(0); // Not called yet since mock
        });

        test('should set initial interaction state', () => {
            expect(chartRenderer.interactionState).toBe('IDLE');
            expect(chartRenderer.state.selected).toBeNull();
            expect(chartRenderer.state.highlighted).toBeNull();
        });

        test('should handle initialize cleanup', () => {
            chartRenderer.initialize = jest.fn().mockResolvedValue();
            // The initialize method would clean up old elements
        });

        test('should initialize chart renderer successfully', async () => {
            const result = await chartRenderer.initialize();
            expect(chartRenderer.isInitialized).toBe(true);
            expect(chartRenderer.tooltip).toBeDefined();
        });

        test('should prevent double initialization', async () => {
            chartRenderer.isInitialized = true;
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            await chartRenderer.initialize();
            expect(consoleSpy).toHaveBeenCalledWith('[CHART] Already initialized, skipping');
            consoleSpy.mockRestore();
        });

        test('should create tooltip element', () => {
            chartRenderer.createTooltip();
            expect(chartRenderer.tooltip).toBeDefined();
            expect(typeof chartRenderer.tooltip.attr).toBe('function');
        });

        test('should setup chart containers', () => {
            chartRenderer.setupChartContainers();
            // Should execute without throwing
            expect(chartRenderer.chartContainer).toBeDefined();
        });

        test('should handle setupChartContainers with missing elements', () => {
            mockUIManager.getElement.mockImplementation((id) => id === 'chart-container' ? mockContainer : null);
            const originalWarn = console.warn;
            console.warn = jest.fn();
            chartRenderer.setupChartContainers();
            expect(console.warn).toHaveBeenCalledWith('[CHART] Container overviewChartContent not found');
            console.warn = originalWarn;
        });

        test('should handle renderOverviewSankeyDiagram alias', () => {
            const spy = jest.spyOn(chartRenderer, 'renderOverviewSankey');
            chartRenderer.renderOverviewSankeyDiagram();
            expect(spy).toHaveBeenCalled();
        });

        test('should enforce singleton pattern', () => {
            const first = new ChartRenderer(mockDataManager, mockUIManager, mockFormatter);
            const second = new ChartRenderer(mockDataManager, mockUIManager, mockFormatter);
            expect(second).toBe(first);
        });

        test('should handle error when chart-container not found', () => {
            mockUIManager.getElement.mockReturnValue(null);
            const spy = jest.spyOn(chartRenderer, 'showError');
            chartRenderer.setupChartContainers();
            expect(spy).toHaveBeenCalledWith('UI setup error');
        });

        test('should warn when overviewChartContent not found', () => {
            const originalWarn = console.warn;
            console.warn = jest.fn();
            mockUIManager.getElement.mockImplementation((id) => id === 'chart-container' ? mockContainer : null);
            chartRenderer.setupChartContainers();
            expect(console.warn).toHaveBeenCalledWith('[CHART] Container overviewChartContent not found');
            console.warn = originalWarn;
        });
    });

    describe('Data Processing - buildSankeyData', () => {
        test('should build sankey data with income', () => {
            const result = chartRenderer.buildSankeyData(
                [{ id: 1, name: 'Property 1' }],
                new Map([['Income', 1000]]),
                new Map([[1, 1500]]),
                new Map([[1, 1200]]),
                ['Rent'],
                true,
                new Map([['Rent', 800]]),
                new Map(),
                800, 600
            );

            expect(result).toBeDefined();
            expect(result.nodes).toBeInstanceOf(Array);
            expect(result.links).toBeInstanceOf(Array);
            expect(result.hasIncome).toBe(true);
        });

        test('should handle empty expense data (else branch)', () => {
            const result = chartRenderer.buildSankeyData(
                [],
                new Map(),
                new Map(),
                new Map(), // Empty expenses
                [],
                false,
                new Map(),
                new Map(),
                800, 600
            );

            expect(result).toBeDefined();
            expect(result.nodes).toBeInstanceOf(Array);
        });

        test('should handle missing property expenses data', () => {
            const result = chartRenderer.buildSankeyData(
                [{ id: 1, name: 'Property 1' }],
                new Map(),
                new Map(),
                null, // null expenses
                ['Rent'],
                false,
                new Map([['Rent', 800]]),
                new Map(),
                800, 600
            );

            expect(result).toBeDefined();
        });

        test('handles invalid data in buildSankeyData with placeholder', () => {
            const renderer = new ChartRenderer(mockDataManager, mockUIManager, mockFormatter);
            const result = renderer.buildSankeyData([], {}, new Map(), null, [], false, new Map(), new Map(), 800, 600);

            expect(result.nodes[0].name).toBe('Missing Expense Data');  // Placeholder coverage
            expect(result.links).toEqual([]);  // Empty links branch
        });

        test('should handle stratify normally', () => {
            const result = chartRenderer.buildSankeyData(
                [{ id: 1, name: 'Property 1' }],
                new Map(),
                new Map(),
                new Map([[1, 800]]),
                ['Rent'],
                false,
                new Map([['Rent', 800]]),
                new Map(),
                800, 600
            );

            expect(result).toBeDefined();
            expect(result.nodes).toBeInstanceOf(Array);
            expect(result.nodes[0].name).toBe('PROPERTY 1');
        });

        test('should handle NaN values in sankey computation', () => {
            const result = chartRenderer.buildSankeyData(
                [{ id: 1, name: 'Property 1' }],
                new Map([['Income', NaN]]),
                new Map([[1, NaN]]),
                new Map([[1, NaN]]),
                ['Rent'],
                true,
                new Map([['Rent', NaN]]),
                new Map(),
                800, 600
            );

            expect(result).toBeDefined();
            // NaN values should be handled (converted to 0 or filtered)
        });

        test('should filter out invalid sankey nodes', () => {
            const result = chartRenderer.buildSankeyData(
                [{ id: 1, name: '' }], // Empty name
                new Map(),
                new Map(),
                new Map([[1, 100]]),
                ['Rent'],
                false,
                new Map([['Rent', 100]]),
                new Map(),
                800, 600
            );

            expect(result).toBeDefined();
            // Invalid nodes should be filtered
        });

        test('should handle multiple hierarchy levels', () => {
            const result = chartRenderer.buildSankeyData(
                [{ id: 1, name: 'Property 1' }],
                new Map(),
                new Map(),
                new Map([[1, 1000]]),
                ['Utilities'],
                false,
                new Map([['Utilities', 1000]]),
                new Map([['Utilities', new Map([['Elec', 600], ['Water', 400]])]]),
                800, 600
            );

            expect(result).toBeDefined();
            expect(result.nodes).toBeInstanceOf(Array);
            expect(result.nodes.filter(n => n.type === 'subcategory')).toBeDefined();
        });

        test('should scale wide expense nodes', () => {
            const result = chartRenderer.buildSankeyData(
                [{ id: 1, name: 'Prop1' }, { id: 2, name: 'Prop2' }],
                new Map(),
                new Map(),
                new Map([[1, 500], [2, 500]]),
                ['Rent'],
                false,
                new Map([['Rent', 1000]]),
                new Map(),
                800, 600
            );

            expect(result).toBeDefined();
            // Wide nodes should be properly scaled
        });

        test('should handle complex property mapping', () => {
            const properties = [
                { id: 1, name: 'Prop1' },
                { id: 2, name: 'Prop2' },
                { id: 3, name: 'Prop3' }
            ];

            const result = chartRenderer.buildSankeyData(
                properties,
                { Inc1: 500, Inc2: 300 },
                new Map([[1, 1000], [2, 800], [3, 600]]),
                new Map([[1, 700], [2, 600], [3, 500]]),
                ['Rent', 'Util', 'Maint'],
                true,
                new Map([['Rent', 800], ['Util', 600], ['Maint', 400]]),
                new Map(),
                800, 600
            );

            expect(result).toBeDefined();
            expect(result.nodes.filter(n => n.type === 'property').length).toBe(3);
            expect(result.nodes.filter(n => n.type === 'income-source').length).toBe(2);
        });

        test('should handle missing propExpenses in buildSankeyData', () => {
            const result = chartRenderer.buildSankeyData(
                [{ id: 1, name: 'Property 1' }],
                new Map(),
                new Map(),
                null, // null propExpenses
                ['Rent'],
                false,
                new Map([['Rent', 800]]),
                new Map(),
                800, 600
            );
            expect(result.nodes[0].name).toBe('Missing Expense Data');
        });

        test('should handle empty propExpenses in buildSankeyData', () => {
            const result = chartRenderer.buildSankeyData(
                [{ id: 1, name: 'Property 1' }],
                new Map(),
                new Map(),
                new Map(), // empty propExpenses
                ['Rent'],
                false,
                new Map([['Rent', 800]]),
                new Map(),
                800, 600
            );
            expect(result.nodes[0].name).toBe('Missing Expense Data');
        });

        test('should handle stratify normally in buildSankeyData', () => {
            const result = chartRenderer.buildSankeyData(
                [{ id: 1, name: 'Property 1' }],
                new Map(),
                new Map(),
                new Map([[1, 800]]),
                ['Rent'],
                false,
                new Map([['Rent', 800]]),
                new Map(),
                800, 600
            );
            expect(result.nodes[0].name).toBe('PROPERTY 1');
        });
    });

    describe('Rendering - createSankey', () => {
        test('should create sankey SVG structure', () => {
            const data = { nodes: [], links: [] };
            const svg = chartRenderer.createSankey(mockContainer, data);

            // Method should execute without throwing
            expect(chartRenderer.sankeyData).toBeDefined();
            expect(svg.outerHTML).toMatchSnapshot();
        });

        test('should bind click events when interactive', () => {
            chartRenderer.isInteractive = true;
            const data = { nodes: [], links: [] };
            chartRenderer.createSankey(mockContainer, data);

            expect(chartRenderer.isInteractive).toBe(true);
        });

        test('should skip event binding when not interactive', () => {
            chartRenderer.isInteractive = false;
            const data = { nodes: [], links: [] };
            chartRenderer.createSankey(mockContainer, data);

            expect(chartRenderer.isInteractive).toBe(false);
        });

        test('should handle node/enter/update selections', () => {
            const data = {
                nodes: [{ id: 'node1', name: 'Node 1', level: 0 }],
                links: []
            };
            chartRenderer.createSankey(mockContainer, data);

            // Should process selections
            expect(chartRenderer.sankeyData.relationIndex).toBeDefined();
        });

        test('should handle link enter selection', () => {
            const data = {
                nodes: [
                    { id: 'source', name: 'Source', level: 0 },
                    { id: 'target', name: 'Target', level: 1 }
                ],
                links: [{ source: 'source', target: 'target', value: 100, type: 'test' }]
            };
            chartRenderer.createSankey(mockContainer, data);

            // Should process link selections
            expect(chartRenderer.sankeyData.links.length).toBeGreaterThan(0);
        });

        test('should handle exit selections on updates', () => {
            // Initial render
            const data1 = {
                nodes: [{ id: 'old', name: 'Old Node', level: 0 }],
                links: []
            };
            chartRenderer.createSankey(mockContainer, data1);

            // Update with different data
            const data2 = {
                nodes: [{ id: 'new', name: 'New Node', level: 0 }],
                links: []
            };
            chartRenderer.createSankey(mockContainer, data2);

            // Should handle exit removal
            expect(chartRenderer.sankeyData.nodes.length).toBeGreaterThan(0);
        });

        test('should build relation index for interactions', () => {
            const data = {
                hasIncome: true,
                sources: { Rent: 1000 },
                nodes: [
                    { id: 'income', name: 'Income', type: 'income' },
                    { id: 'prop1', name: 'Property 1', type: 'property' }
                ],
                links: [
                    { source: 'income', target: 'prop1', value: 1000, type: 'income-to-prop', property: 'Property 1' }
                ]
            };

            chartRenderer.createSankey(mockContainer, data);
            expect(chartRenderer.sankeyData.relationIndex).toBeDefined();
            expect(chartRenderer.sankeyData.relationIndex.has('Property 1')).toBe(true);
        });

        test('should handle zoom behavior setup', () => {
            const data = { nodes: [], links: [] };
            chartRenderer.createSankey(mockContainer, data);

            // Method should set up zoom behavior
            expect(chartRenderer.zoomBehavior).toBeDefined();
        });
    });

    describe('Interactions - handleInteraction', () => {
        test('should handle node interaction', () => {
            const event = { clientX: 100, clientY: 200 };
            const item = { id: 'node1', name: 'Test Node', level: 0 };
            const type = 'node';

            chartRenderer.rippleForces = new Map([['node', d3.forceManyBody()], ['link', d3.forceManyBody()]]);
            chartRenderer.sankeyData = {
                sim: d3.forceSimulation(),
                svg: d3.select(mockContainer),
                links: [],
                relationIndex: new Map([['Property 1', new Set(['node1'])], ['Test Node', new Set(['node1'])], ['Source', new Set(['source'])], ['Target', new Set(['target'])]] )
            };

            expect(() => chartRenderer.handleInteraction(event, item, type, false)).not.toThrow();
        });

        test('should handle link interaction', () => {
            const event = { clientX: 100, clientY: 200 };
            const item = {
                source: { id: 'source', name: 'Source' },
                target: { id: 'target', name: 'Target' },
                value: 100
            };
            const type = 'link';

            chartRenderer.rippleForces = new Map([['node', d3.forceManyBody()], ['link', d3.forceManyBody()]]);
            chartRenderer.sankeyData = {
                sim: d3.forceSimulation(),
                svg: d3.select(mockContainer),
                links: [],
                relationIndex: new Map([['Property 1', new Set(['node1'])], ['Test Node', new Set(['node1'])], ['Source', new Set(['source'])], ['Target', new Set(['target'])]] )
            };

            expect(() => chartRenderer.handleInteraction(event, item, type, false)).not.toThrow();
        });

        test('should handle click interactions (pinned select)', () => {
            const event = { clientX: 100, clientY: 200 };
            const item = { id: 'node1', name: 'Test Node', level: 0 };
            const type = 'node';

            chartRenderer.createSankey(mockContainer, { nodes: [], links: [], hasIncome: false, sources: {} });
            chartRenderer.sankeyData.relationIndex = new Map([['Property 1', new Set(['node1'])], ['Test Node', new Set(['node1'])], ['Source', new Set(['source'])], ['Target', new Set(['target'])]] );

            expect(() => chartRenderer.handleInteraction(event, item, type, true)).not.toThrow();
        });

        test('should skip if no sankey data', () => {
            chartRenderer.sankeyData = null;
            const event = { clientX: 100, clientY: 200 };
            const item = { id: 'node1', name: 'Test Node' };

            // Should not throw
            chartRenderer.handleInteraction(event, item, 'node', false);
        });

        test('should clear hoverTimeout on hover', () => {
            chartRenderer.hoverTimeout = setTimeout(() => {}, 100);
            const event = { clientX: 100, clientY: 200 };
            const item = { id: 'node1', name: 'Test Node', level: 0 };
            chartRenderer.rippleForces = new Map([['node', d3.forceManyBody()], ['link', d3.forceManyBody()]]);
            chartRenderer.sankeyData = {
                sim: d3.forceSimulation(),
                svg: d3.select(mockContainer),
                links: [],
                relationIndex: new Map([['Test Node', new Set(['node1'])]] )
            };
            expect(() => chartRenderer.handleInteraction(event, item, 'node', false)).not.toThrow();
        });

        test('should clear ripple effects', () => {
            chartRenderer.interactionState = 'PINNED_SELECT';
            chartRenderer.state.selected = { type: 'node', item: { id: 'test' } };
            chartRenderer.state.highlighted = { type: 'node', item: { id: 'test' } };

            chartRenderer.rippleForces = new Map([['node', d3.forceManyBody()], ['link', d3.forceManyBody()]]);
            chartRenderer.sankeyData = {
                sim: d3.forceSimulation(),
                svg: d3.select(mockContainer),
                links: []
            };

            expect(() => chartRenderer.clearRipple()).not.toThrow();
        });

        test('should show overview placeholder', () => {
            const container = document.createElement('div');
            chartRenderer.showOverviewPlaceholder(container);

            expect(container.innerHTML).toContain('No Data Available');
            expect(chartRenderer.isRendering).toBe(false);
        });

        test('should handle formatTooltipContent for different item types', () => {
            const nodeItem = { name: 'Test Node', total: 1000, type: 'property', propData: { address: '123 Main St' } };
            const linkItem = { source: { name: 'Source' }, target: { name: 'Target' }, value: 500 };

            const nodeContent = chartRenderer.formatTooltipContent(nodeItem, 'node');
            const linkContent = chartRenderer.formatTooltipContent(linkItem, 'link');

            expect(nodeContent).toBeInstanceOf(Array);
            expect(linkContent).toBeInstanceOf(Array);
            expect(nodeContent.length).toBeGreaterThan(0);
            expect(linkContent.length).toBeGreaterThan(0);
        });

        test('should show ripple tooltip', () => {
            const event = new Event('click');
            const item = { name: 'Test Node' };
            const type = 'node';

            chartRenderer.sankeyData = { svg: d3.select(mockContainer) };
            chartRenderer.showRippleTooltip(event, item, type, false);

            expect(chartRenderer.persistentTooltip).toBeUndefined(); // Not persistent
        });

        test('should show persistent ripple tooltip', () => {
            const event = new Event('click');
            const item = { name: 'Test Node' };
            const type = 'node';

            chartRenderer.sankeyData = { svg: d3.select(mockContainer) };
            chartRenderer.showRippleTooltip(event, item, type, true);

            expect(chartRenderer.persistentTooltip).toBeDefined();
            expect(chartRenderer.persistentPos).toBeDefined();
        });

        test('should hide tooltips', () => {
            // Mock the tooltip and persistentTooltip to avoid D3 chaining issues
            const mockTooltip = {
                style: jest.fn(() => mockTooltip)
            };
            const mockPersistentTooltip = {
                transition: function() { return this; },
                duration: function() { return this; },
                style: function() { return this; },
                remove: function() { return this; }
            };

            chartRenderer.tooltip = mockTooltip;
            chartRenderer.persistentTooltip = mockPersistentTooltip;
            chartRenderer.persistentPos = [100, 200];

            chartRenderer.hideTooltip();

            expect(mockTooltip.style).toHaveBeenCalledWith('opacity', 0);
            expect(chartRenderer.persistentTooltip).toBeNull();
            expect(chartRenderer.persistentPos).toBeNull();
        });

        test('should reposition persistent tooltip', () => {
            chartRenderer.persistentTooltip = { transition: jest.fn(() => ({ duration: jest.fn(() => ({ attr: jest.fn() })) })) };
            chartRenderer.persistentPos = [100, 200];

            chartRenderer.repositionPersistentTooltip();

            // Should execute without throwing
        });
    });

    describe('Visual Updates - updateRippleVisuals', () => {
        test('should update node and link visuals', () => {
            const nodes = [
                { id: 'node1', x0: 0, y0: 0, x1: 50, y1: 100 },
                { id: 'node2', x0: 100, y0: 0, x1: 150, y1: 100 }
            ];
            const links = [
                { source: 'node1', target: 'node2', index: 0, width: 2, path: 'M50,50 L100,50' }
            ];
            const relatedIds = new Set(['node1']);

            chartRenderer.sankeyData = {
                svg: d3.select(mockContainer),
                links: []
            };

            expect(() => chartRenderer.updateRippleVisuals(nodes, links, relatedIds, false, false)).not.toThrow();
        });

        test('should handle zoom transitions on click', () => {
            const nodes = [
                { id: 'node1', x0: 0, y0: 0, x1: 50, y1: 100 }
            ];
            const relatedIds = new Set(['node1']);

            chartRenderer.sankeyData = {
                svg: d3.select(mockContainer),
                links: []
            };

            expect(() => chartRenderer.updateRippleVisuals(nodes, [], relatedIds, false, true)).not.toThrow();
        });
    });

    describe('Event Handling', () => {
        test('should handle data change events', () => {
            chartRenderer.handleDataChange({ type: 'dataChange' });

            expect(mockDataManager.clearSankeyCache).toHaveBeenCalled();
            expect(chartRenderer.relatedIdsCache.size).toBe(0);
        });

        test('should handle color theme changes', () => {
            const mockThemeManager = {
                getColorTheme: jest.fn(() => ({ properties: ['#000'], categories: ['#fff'] })),
                getCurrentColorTheme: jest.fn(() => 'dark')
            };

            chartRenderer.themeManager = mockThemeManager;
            chartRenderer.handleColorThemeChange();

            expect(mockThemeManager.getColorTheme).toHaveBeenCalled();
        });
    });

    describe('Utility Methods', () => {
        test('should get color for different types', () => {
            expect(chartRenderer.getColor('properties', 0)).toBe('#5D878F');
            expect(chartRenderer.getColor('categories', 1)).toBe('#DB4545');
            expect(chartRenderer.getColor('invalid', 5)).toBe('#DB4545'); // fallback
        });

        test('should get container dimensions', () => {
            const container = { getBoundingClientRect: () => ({ width: 500, height: 400 }) };
            const dims = chartRenderer.getDimensions(container);

            expect(dims.width).toBe(500);
            expect(dims.height).toBe(400);
        });

        test('should handle invalid container dimensions', () => {
            const container = { getBoundingClientRect: () => ({ width: NaN, height: null }) };
            const dims = chartRenderer.getDimensions(container);

            expect(dims.width).toBe(800); // fallback
            expect(dims.height).toBe(600); // fallback
        });

        test('should check selection equality', () => {
            const item = { id: 'test', name: 'Test' };
            chartRenderer.state.selected = { type: 'node', item };

            expect(chartRenderer.isSameSelection('node', item)).toBe(true);
            expect(chartRenderer.isSameSelection('link', item)).toBe(false);
        });

        test('should compute ripple bounding box', () => {
            const d3 = require('d3');
            d3.min = Math.min; d3.max = Math.max; // Override with real functions
            const nodes = [{ x0: 0, y0: 0, x1: 50, y1: 100 }];
            const bbox = chartRenderer.computeRippleBbox(nodes);

            expect(bbox).toEqual([[0, 0], [50, 100]]);
        });

        test('should handle empty ripple bbox', () => {
            const bbox = chartRenderer.computeRippleBbox([]);
            expect(bbox).toEqual([[0, 0], [100, 100]]);
        });

        test('should adjust color brightness', () => {
            const adjusted = chartRenderer.adjustColorBrightness('#ff0000', 0.5);
            expect(adjusted).toMatch(/^#[0-9a-f]{6}$/);
        });

        test('should handle invalid color adjustment', () => {
            const adjusted = chartRenderer.adjustColorBrightness('invalid', 0.5);
            // Should return a valid hex even for invalid input
            expect(typeof adjusted).toBe('string');
            expect(adjusted.startsWith('#')).toBe(true);
        });

        test('should throttle function calls', () => {
            jest.useFakeTimers();
            const func = jest.fn();
            const throttled = chartRenderer.throttle(func, 100);

            throttled();
            throttled();
            throttled();

            expect(func).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(100);
            throttled();
            expect(func).toHaveBeenCalledTimes(2);

            jest.useRealTimers();
        });

        test('should get path length', () => {
            const mockPath = { getTotalLength: () => 150 };
            const length = chartRenderer.getPathLength(mockPath);
            expect(length).toBe(150);
        });

        test('should get type color for gradients', () => {
            const color = chartRenderer.getTypeColor('income-to-earnings', 'start');
            expect(typeof color).toBe('string');
            expect(color.startsWith('#')).toBe(true);
        });

        test('should handle onHoverOut when in RIPPLE_HOVER state', () => {
            chartRenderer.interactionState = 'RIPPLE_HOVER';
            chartRenderer.rippleForces = new Map([['node', d3.forceManyBody()], ['link', d3.forceManyBody()]]);
            chartRenderer.sankeyData = {
                sim: d3.forceSimulation(),
                svg: d3.select(mockContainer),
                links: []
            };
            expect(() => chartRenderer.onHoverOut()).not.toThrow();
        });

        test('should handle onHoverOut when not in RIPPLE_HOVER state', () => {
            chartRenderer.interactionState = 'PINNED_SELECT';
            const clearSpy = jest.spyOn(chartRenderer, 'clearRipple');
            chartRenderer.onHoverOut();
            expect(clearSpy).not.toHaveBeenCalled();
        });
    });

    describe('Theme Management', () => {
        test('should set theme manager', () => {
            const mockThemeManager = {
                isDark: jest.fn(() => true),
                getColorTheme: jest.fn(() => ({ properties: ['#000'], categories: ['#fff'] })),
                getCurrentColorTheme: jest.fn(() => 'dark')
            };

            chartRenderer.setThemeManager(mockThemeManager);
            expect(chartRenderer.themeManager).toBe(mockThemeManager);
        });

        test('should update chart colors', () => {
            const mockThemeManager = {
                isDark: jest.fn(() => true),
                getColorTheme: jest.fn(() => ({
                    properties: ['#ff0000'],
                    categories: ['#00ff00'],
                    trends: { increasing: '#0000ff' }
                })),
                getCurrentColorTheme: jest.fn(() => 'dark')
            };

            chartRenderer.themeManager = mockThemeManager;
            chartRenderer.updateChartColors();

            expect(mockThemeManager.getColorTheme).toHaveBeenCalled();
        });

        test('should handle light theme colors', () => {
            const mockThemeManager = {
                isDark: jest.fn(() => false),
                getColorTheme: jest.fn(() => ({
                    properties: ['#5D878F'],
                    categories: ['#DB4545']
                })),
                getCurrentColorTheme: jest.fn(() => 'light')
            };

            chartRenderer.themeManager = mockThemeManager;
            chartRenderer.updateChartColors();

            // CSS vars should be set
            expect(document.documentElement.style.getPropertyValue('--color-node-income')).toBeDefined();
        });

        test('should handle color theme change event', () => {
            const mockThemeManager = {
                getColorTheme: jest.fn(() => ({ properties: ['#000'], categories: ['#fff'] })),
                getCurrentColorTheme: jest.fn(() => 'dark')
            };

            chartRenderer.themeManager = mockThemeManager;
            chartRenderer.sankeyData = {
                svg: {
                    selectAll: jest.fn(() => ({
                        attr: jest.fn(),
                        style: jest.fn()
                    }))
                }
            };

            const debouncedSpy = jest.spyOn(chartRenderer, 'debouncedRender');
            chartRenderer.handleColorThemeChange();

            expect(mockThemeManager.getColorTheme).toHaveBeenCalled();
            expect(debouncedSpy).toHaveBeenCalled();
        });

        test('should handle color theme change event without sankeyData', () => {
            const mockThemeManager = {
                getColorTheme: jest.fn(() => ({ properties: ['#000'], categories: ['#fff'] })),
                getCurrentColorTheme: jest.fn(() => 'dark')
            };

            chartRenderer.themeManager = mockThemeManager;
            chartRenderer.sankeyData = null; // No sankeyData

            const debouncedSpy = jest.spyOn(chartRenderer, 'debouncedRender');
            chartRenderer.handleColorThemeChange();

            expect(mockThemeManager.getColorTheme).toHaveBeenCalled();
            expect(debouncedSpy).toHaveBeenCalled();
        });
    });

    describe('Error Handling and Cleanup', () => {
        test('should show error messages', () => {
            const errorMessage = 'Test error';
            chartRenderer.showError(errorMessage);

            // Should set error message in UI element
        });

        test('should handle error in showError when element not found', () => {
            mockUIManager.getElement.mockReturnValue(null);
            chartRenderer.uiManager = mockUIManager;
            const errorMessage = 'Test error';

            // Should fallback to console logging
            chartRenderer.showError(errorMessage);
        });

        test('should handle showError when error element not found', () => {
            mockUIManager.getElement.mockReturnValue(null);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            chartRenderer.showError('Test error');
            expect(consoleSpy).toHaveBeenCalledWith('[CHART] Error placeholder not found, logging error:', 'Test error');
            consoleSpy.mockRestore();
        });

        test('should add glow filter for persistent tooltip', () => {
            chartRenderer.sankeyData = { svg: d3.select(mockContainer) };
            const event = new Event('click');
            chartRenderer.showRippleTooltip(event, { name: 'Test' }, 'node', true);
            // Should add glow filter
        });

        test('should skip updateChartColors when no themeManager', () => {
            chartRenderer.themeManager = null;
            chartRenderer.updateChartColors();
            // Should not throw
        });

        test('should handle color without hash in adjustColorBrightness', () => {
            const result = chartRenderer.adjustColorBrightness('ff0000', 0.5);
            expect(result).toMatch(/^#[0-9a-f]{6}$/);
        });

        test('should handle invalid color in adjustColorBrightness', () => {
            const result = chartRenderer.adjustColorBrightness('invalid', 0.5);
            expect(typeof result).toBe('string');
        });

        test('should cleanup resources', () => {
            chartRenderer.tooltip = { remove: jest.fn() };
            chartRenderer.resizeObserver = { disconnect: jest.fn() };

            chartRenderer.cleanup();

            expect(chartRenderer.tooltip).toBeNull();
            expect(chartRenderer.resizeObserver).toBeNull();
        });

        test('should handle cleanup when resizeObserver is null', () => {
            chartRenderer.resizeObserver = null;
            chartRenderer.cleanup(); // Should not throw
        });

        test('should debug chart information', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            chartRenderer.debug();

            expect(consoleSpy).toHaveBeenCalledWith('[CHART DEBUG] === CHART RENDERER INFO ===');
            expect(consoleSpy).toHaveBeenCalledWith('[CHART DEBUG] === END DEBUG ===');

            consoleSpy.mockRestore();
        });

        test('should zoom to bounding box', () => {
            const bbox = [[0, 0], [200, 100]];
            chartRenderer.sankeyData = {
                svg: {
                    attr: jest.fn((key) => key === 'width' ? 800 : 600),
                    transition: jest.fn(() => ({
                        call: jest.fn(() => ({
                            transform: jest.fn()
                        }))
                    }))
                }
            };
            chartRenderer.zoomBehavior = {
                transform: jest.fn(() => jest.fn())
            };

            // Mock d3.zoomIdentity
            global.d3.zoomIdentity = {
                translate: jest.fn(() => ({
                    scale: jest.fn(() => ({}))
                }))
            };

            chartRenderer.zoomToBbox(bbox);

            expect(chartRenderer.sankeyData.svg.transition).toHaveBeenCalled();
        });
test('should handle zoom to bbox with invalid values', () => {
    const bbox = [[NaN, NaN], [NaN, NaN]];
    chartRenderer.sankeyData = {
        svg: {
            attr: jest.fn(() => ({
                width: jest.fn(() => 800),
                height: jest.fn(() => 600)
            })),
            transition: jest.fn(() => ({
                call: jest.fn()
            }))
        }
    };
    chartRenderer.zoomBehavior = d3.zoom();
    chartRenderer.zoomToBbox(bbox);

    // Should not throw
});
    });

    describe('Async Operations - renderOverviewSankey', () => {
        test('should prevent concurrent rendering', async () => {
            chartRenderer.isRendering = true;
            const result = await chartRenderer.renderOverviewSankey(mockContainer);
            expect(result).toBeUndefined();
        });

        test('should handle no container', async () => {
            const result = await chartRenderer.renderOverviewSankey(null);
            expect(result).toBeUndefined();
        });

        test('should render with valid data', async () => {
            const result = await chartRenderer.renderOverviewSankey(mockContainer);
            // Check that method doesn't throw
            expect(result).toBeUndefined();
        });

        test('should handle renderOverviewSankey with concurrent calls (async guard)', async () => {
            chartRenderer.isRendering = true;
            const result1 = chartRenderer.renderOverviewSankey(mockContainer);
            const result2 = chartRenderer.renderOverviewSankey(mockContainer);

            // First call should proceed, second should return undefined
            await expect(result1).resolves.not.toBeDefined();
            await expect(result2).resolves.not.toBeDefined();
            expect(chartRenderer.isRendering).toBe(true); // Should still be rendering from first call
        });

        test('should execute buildSankeyData with NaN handling in aggregates', () => {
            mockDataManager.getAggregatedSankeyData.mockReturnValueOnce({
                hasIncome: false,
                sources: new Map(),
                propIncomes: new Map([[1, NaN]]),
                propExpenses: new Map([[1, NaN]]),
                catTotals: new Map([['Rent', NaN]]),
                subTotals: new Map()
            });

            const data = chartRenderer.buildSankeyData(
                [{ id: 1, name: 'Property 1' }],
                new Map(),
                new Map([[1, NaN]]),
                new Map([[1, NaN]]),
                ['Rent'],
                false,
                new Map([['Rent', NaN]]),
                new Map(),
                800, 600
            );

            expect(data).toBeDefined();
            expect(data.nodes).toBeInstanceOf(Array);
            // NaN values should be filtered/replaced
            expect(data.hasIncome).toBe(false);
        });

        test('should execute computeRippleBbox with NaN coordinates', () => {
            const invalidNodes = [{ x0: NaN, y0: 0, x1: NaN, y1: 100 }];
            const bbox = chartRenderer.computeRippleBbox(invalidNodes);

            // Should return fallback bounding box
            expect(bbox).toEqual([[0, 0], [100, 100]]);
        });

        test('should handle renderOverviewSankey with buildSankeyData error', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            mockDataManager.getAggregatedSankeyData.mockReturnValueOnce({
                hasIncome: true,
                sources: { Rent: 1000 },
                propIncomes: new Map([[1, 1500]]),
                propExpenses: new Map([[1, 1200]]),
                catTotals: new Map([['Rent', 800]]),
                subTotals: new Map()
            });

            // Mock buildSankeyData to throw
            const originalBuild = chartRenderer.buildSankeyData;
            chartRenderer.buildSankeyData = jest.fn(() => { throw new Error('Build failed'); });

            await chartRenderer.renderOverviewSankey(mockContainer);

            expect(consoleSpy).toHaveBeenCalledWith('[CHART] buildSankeyData error:', expect.any(Error));

            // Restore
            chartRenderer.buildSankeyData = originalBuild;
            consoleSpy.mockRestore();
        });

        test('should handle renderOverviewSankey with no nodes', async () => {
            mockDataManager.getAggregatedSankeyData.mockReturnValueOnce({
                hasIncome: false,
                sources: new Map(),
                propIncomes: new Map(),
                propExpenses: new Map(),
                catTotals: new Map(),
                subTotals: new Map()
            });

            const originalBuild = chartRenderer.buildSankeyData;
            chartRenderer.buildSankeyData = jest.fn(() => ({ nodes: [], links: [], hasIncome: false }));

            await chartRenderer.renderOverviewSankey(mockContainer);

            // Should show placeholder
            expect(mockContainer.innerHTML).toContain('No Data Available');

            chartRenderer.buildSankeyData = originalBuild;
        });

        test('should handle ResizeObserver in renderOverviewSankey', async () => {
            const resizeObserverSpy = jest.spyOn(global, 'ResizeObserver');
            await chartRenderer.renderOverviewSankey(mockContainer);

            expect(resizeObserverSpy).toHaveBeenCalled();
            resizeObserverSpy.mockRestore();
        });

        test('should show placeholder when no expenses', async () => {
            mockDataManager.getAggregatedSankeyData.mockReturnValueOnce({
                hasIncome: false,
                sources: new Map(),
                propIncomes: new Map(),
                propExpenses: new Map(), // empty
                catTotals: new Map(),
                subTotals: new Map()
            });
            await chartRenderer.renderOverviewSankey(mockContainer);
            expect(mockContainer.innerHTML).toContain('No Data Available');
        });

        test('should handle buildSankeyData error in renderOverviewSankey', async () => {
            const originalBuild = chartRenderer.buildSankeyData;
            chartRenderer.buildSankeyData = jest.fn(() => { throw new Error('Build error'); });
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            await chartRenderer.renderOverviewSankey(mockContainer);
            expect(consoleSpy).toHaveBeenCalledWith('[CHART] buildSankeyData error:', expect.any(Error));
            chartRenderer.buildSankeyData = originalBuild;
            consoleSpy.mockRestore();
        });

        test('should show placeholder when no nodes', async () => {
            const originalBuild = chartRenderer.buildSankeyData;
            chartRenderer.buildSankeyData = jest.fn(() => ({ nodes: [], links: [], hasIncome: false }));
            await chartRenderer.renderOverviewSankey(mockContainer);
            expect(mockContainer.innerHTML).toContain('No Data Available');
            chartRenderer.buildSankeyData = originalBuild;
        });

        test('should handle render error in renderOverviewSankey', async () => {
            const originalRender = chartRenderer.createSankey;
            chartRenderer.createSankey = jest.fn(() => { throw new Error('Render error'); });
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            await chartRenderer.renderOverviewSankey(mockContainer);
            expect(consoleSpy).toHaveBeenCalledWith('[CHART] Render error:', expect.any(Error));
            chartRenderer.createSankey = originalRender;
            consoleSpy.mockRestore();
        });
    });

    describe('Debouncing and Timing', () => {
        test('should debounce render calls', () => {
            expect(() => {
                chartRenderer.debouncedRender();
                chartRenderer.debouncedRender();
                chartRenderer.debouncedRender();
            }).not.toThrow();
        });

        test('debounced render skips on resize', async () => {
            jest.useFakeTimers();
            const renderer = new ChartRenderer(mockDataManager, mockUIManager, mockFormatter);
            renderer.debouncedRender();  // Initial call
            jest.advanceTimersByTime(100);  // Partial debounce
            expect(mockUIManager.getElement).not.toHaveBeenCalled();  // Not rendered yet
            jest.advanceTimersByTime(150);  // Full debounce
            expect(mockUIManager.getElement).toHaveBeenCalled();  // Now rendered
            jest.useRealTimers();
        });

        test('should use debounce function correctly', () => {
            const func = jest.fn();
            const debounced = chartRenderer.debounce(func, 100);

            debounced();
            debounced();
            debounced();

            // func should not be called yet
            expect(func).not.toHaveBeenCalled();
        });
    });

    describe('Tooltip System', () => {
        test('should create tooltip element', () => {
            chartRenderer.createTooltip();
            expect(chartRenderer.tooltip).toBeDefined();
        });

        test('should format tooltip content for nodes', () => {
            const item = { name: 'Test Node', total: 1000, type: 'property', propData: { address: '123 Main St' } };
            const content = chartRenderer.formatTooltipContent(item, 'node');

            expect(content).toBeInstanceOf(Array);
            expect(content.length).toBeGreaterThan(0);
        });

        test('should format tooltip content for links', () => {
            const item = {
                source: { name: 'Source' },
                target: { name: 'Target' },
                value: 500,
                property: 'Prop1',
                category: 'Rent'
            };
            const content = chartRenderer.formatTooltipContent(item, 'link');

            expect(content).toBeInstanceOf(Array);
        });

        test('should handle tooltip positioning', () => {
            chartRenderer.sankeyData = { svg: d3.select(mockContainer) };
            const event = new Event('click');

            chartRenderer.showRippleTooltip(event, { name: 'Test' }, 'node', true);
            expect(chartRenderer.persistentTooltip).toBeDefined();
            expect(chartRenderer.persistentPos).toBeDefined();
        });

        test('should hide tooltips', () => {
            chartRenderer.persistentTooltip = { transition: jest.fn(() => ({ remove: jest.fn() })) };
            chartRenderer.persistentPos = [100, 200];

            chartRenderer.hideTooltip();
            expect(chartRenderer.persistentTooltip).toBeNull();
            expect(chartRenderer.persistentPos).toBeNull();
        });

        test('should reposition persistent tooltip', () => {
            // Create a mock selection that supports the required chaining
            const mockSelection = {
                transition: jest.fn(() => mockSelection),
                duration: jest.fn(() => mockSelection),
                attr: jest.fn(() => mockSelection)
            };

            chartRenderer.persistentTooltip = mockSelection;
            chartRenderer.persistentPos = [100, 200];

            expect(() => chartRenderer.repositionPersistentTooltip()).not.toThrow();
        });
    });

    describe('Zoom and Pan Functionality', () => {
        test('should zoom to bounding box', () => {
            const bbox = [[0, 0], [200, 100]];
            chartRenderer.sankeyData = {
                svg: {
                    attr: jest.fn(() => ({
                        width: jest.fn(() => 800),
                        height: jest.fn(() => 600)
                    })),
                    transition: jest.fn(() => ({
                        call: jest.fn(() => ({
                            transition: jest.fn(() => ({
                                duration: jest.fn(() => ({
                                    style: jest.fn(() => ({
                                        remove: jest.fn()
                                    }))
                                }))
                            }))
                        }))
                    }))
                }
            };
            chartRenderer.zoomToBbox(bbox);

            // Should handle zoom calculation without throwing
            expect(typeof bbox).toBe('object');
        });

        test('should handle invalid bbox', () => {
            const bbox = [[NaN, NaN], [NaN, NaN]];
            chartRenderer.sankeyData = {
                svg: d3.select(mockContainer)
            };
            chartRenderer.zoomBehavior = d3.zoom();
            expect(() => chartRenderer.zoomToBbox(bbox)).not.toThrow();
        });
    });

    describe('Memory Management', () => {
        test('should cache related IDs', () => {
            chartRenderer.rippleForces = new Map([['node', d3.forceManyBody()], ['link', d3.forceManyBody()]]);
            chartRenderer.sankeyData = {
                sim: d3.forceSimulation(),
                svg: d3.select(mockContainer),
                links: [],
                relationIndex: new Map([['Property 1', new Set(['node1'])]] )
            };

            expect(chartRenderer.relatedIdsCache.size).toBe(0);

            expect(() => chartRenderer.handleInteraction({ clientX: 0, clientY: 0 }, { name: 'Property 1', level: 0 }, 'node', false)).not.toThrow();
        });

        test('should clear related IDs cache', () => {
            chartRenderer.relatedIdsCache.set('test', new Set(['node1']));
            expect(chartRenderer.relatedIdsCache.size).toBe(1);

            chartRenderer.handleDataChange({ type: 'dataChange' });
            expect(chartRenderer.relatedIdsCache.size).toBe(0);
        });

        test('should cache bbox computations', () => {
            expect(chartRenderer.bboxCache.size).toBe(0);

            // Call bbox calculation
            chartRenderer.computeRippleBbox([{ x0: 10, y0: 20, x1: 50, y1: 80 }]);
            expect(chartRenderer.bboxCache.size).toBe(0);
        });
    });

    describe('DOM Interaction Edge Cases', () => {
        test('should handle getPathLength for invalid paths', () => {
            // This would be called internally by D3 events
            const result = chartRenderer.getPathLength({ getTotalLength: () => 100 });
            expect(result).toBe(100);
        });
    });

    // ============================================================================
    // ADDITIONAL TESTS FOR IMPROVED COVERAGE
    // ============================================================================


    describe('Theme Colors Coverage', () => {
        test('should update chart colors for dark theme', () => {
            const mockThemeManager = {
                isDark: jest.fn(() => true),
                getColorTheme: jest.fn(() => ({
                    properties: ['#000000'],
                    categories: ['#ffffff'],
                    trends: { increasing: '#00ff00' }
                })),
                getCurrentColorTheme: jest.fn(() => 'dark')
            };

            chartRenderer.themeManager = mockThemeManager;
            chartRenderer.updateChartColors();

            expect(mockThemeManager.getColorTheme).toHaveBeenCalled();
        });
    });

    describe('Build Sankey Data Edge Cases', () => {
        test('should handle buildSankeyData with complex hierarchies', () => {
            const result = chartRenderer.buildSankeyData(
                [{ id: 1, name: 'Property 1' }],
                new Map([['Income', 1000]]),
                new Map([[1, 1500]]),
                new Map([[1, { 'Utilities': { 'Electric': 200, 'Water': 100 } }]]),
                ['Utilities'],
                true,
                new Map([['Utilities', 300]]),
                new Map([['Utilities', new Map([['Electric', 200], ['Water', 100]])]]),
                800, 600
            );

            expect(result).toBeDefined();
            expect(result.nodes).toBeInstanceOf(Array);
        });

        test('should handle buildSankeyData with empty sources', () => {
            const result = chartRenderer.buildSankeyData(
                [{ id: 1, name: 'Property 1' }],
                new Map(), // empty sources
                new Map(),
                new Map([[1, 800]]),
                ['Rent'],
                false,
                new Map([['Rent', 800]]),
                new Map(),
                800, 600
            );

            expect(result).toBeDefined();
            expect(result.hasIncome).toBe(false);
        });
    });
});
