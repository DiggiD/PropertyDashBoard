import DataManager from './modules/core/DataManager.js';
import ChartRenderer from './modules/core/ChartRenderer.js';
import DashboardStorage from './modules/utils/Storage.js';
import Validator from './modules/utils/Validator.js';
import Formatter from './modules/utils/Formatter.js';
import UIManager from './modules/core/UIManager.js';
import ThemeManager from './modules/core/ThemeManager.js';
import HistoryManager from './modules/core/HistoryManager.js';
import PropertiesManager from './modules/PropertiesManager.js';
import logger from './modules/utils/Logger.js';
import PerformanceOptimizer from './modules/utils/PerformanceOptimizer.js';

async function initializeApplication() {
    const startTime = Date.now();
    logger.info('INDEX', 'Starting application initialization...');

    // Initialize performance optimizer
    const performanceOptimizer = new PerformanceOptimizer();
    await performanceOptimizer.initialize();

    try {
        logger.info('INDEX', 'Initializing utility modules...');

        // Initialize dependencies with performance tracking
        const storageStart = performance.now();
        const storage = new DashboardStorage();
        performanceOptimizer.measureModuleLoad('Storage', storageStart);
        logger.logPerformance('INDEX', 'Storage initialization', performance.now() - storageStart);

        const validatorStart = performance.now();
        const validator = new Validator();
        performanceOptimizer.measureModuleLoad('Validator', validatorStart);
        logger.logPerformance('INDEX', 'Validator initialization', performance.now() - validatorStart);

        const formatterStart = performance.now();
        const formatter = new Formatter();
        performanceOptimizer.measureModuleLoad('Formatter', formatterStart);
        logger.logPerformance('INDEX', 'Formatter initialization', performance.now() - formatterStart);

        logger.info('INDEX', 'Initializing DataManager...');
        // Initialize DataManager first (needed by HistoryManager)
        const dataManagerStart = performance.now();
        const dataManager = new DataManager(storage, validator, formatter);
        await dataManager.initialize();
        performanceOptimizer.measureModuleLoad('DataManager', dataManagerStart);
        logger.logPerformance('INDEX', 'DataManager initialization', performance.now() - dataManagerStart);

        logger.info('INDEX', 'Initializing ThemeManager...');
        // Initialize ThemeManager
        const themeManagerStart = performance.now();
        const themeManager = new ThemeManager();
        await themeManager.initialize();
        performanceOptimizer.measureModuleLoad('ThemeManager', themeManagerStart);
        logger.logPerformance('INDEX', 'ThemeManager initialization', performance.now() - themeManagerStart);

        logger.info('INDEX', 'Initializing HistoryManager...');
        // Initialize HistoryManager (depends on storage and dataManager)
        const historyManagerStart = performance.now();
        const historyManager = new HistoryManager(storage, dataManager);
        await historyManager.initialize();
        performanceOptimizer.measureModuleLoad('HistoryManager', historyManagerStart);
        logger.logPerformance('INDEX', 'HistoryManager initialization', performance.now() - historyManagerStart);

        logger.info('INDEX', 'Initializing UIManager...');
        // Initialize UIManager (depends on themeManager)
        const uiManagerStart = performance.now();
        const uiManager = new UIManager(formatter, themeManager);
        await uiManager.initialize(); // Now DOM/elements ready
        performanceOptimizer.measureModuleLoad('UIManager', uiManagerStart);
        logger.logPerformance('INDEX', 'UIManager initialization', performance.now() - uiManagerStart);

        // Check if we need to show onboarding tooltips for empty state
        const hasData = dataManager.getProperties().length > 0;
        if (!hasData) {
            logger.info('INDEX', 'No data found, setting up on-demand onboarding tooltips');
            // Set up on-demand onboarding tooltips for empty state
            setupOnDemandOnboardingTooltips(uiManager);
        } else {
            logger.debug('INDEX', 'Data exists, skipping onboarding tooltips');
        }

        // Check if we have data before initializing ChartRenderer
        logger.info('INDEX', `Data availability check: ${hasData ? 'data found' : 'no data'}`);

        let chartRenderer = null;

        if (hasData) {
            logger.info('INDEX', 'Data available, initializing ChartRenderer...');
            // Initialize ChartRenderer only when data is available
            const chartRendererStart = performance.now();
            chartRenderer = new ChartRenderer(dataManager, uiManager, formatter, themeManager);
            await chartRenderer.initialize();
            performanceOptimizer.measureModuleLoad('ChartRenderer', chartRendererStart);
            logger.logPerformance('INDEX', 'ChartRenderer initialization', performance.now() - chartRendererStart);

            logger.info('INDEX', 'Rendering initial chart...');
            // Render initial chart only when data is available
            const renderStart = performance.now();
            await chartRenderer.renderOverviewSankey();
            logger.logPerformance('INDEX', 'Initial chart rendering', performance.now() - renderStart);
            logger.info('INDEX', 'Initial chart rendered');
        } else {
            logger.info('INDEX', 'No data available, deferring ChartRenderer initialization');
            // Set up lazy initialization for when data becomes available
            setupLazyChartInitialization(dataManager, uiManager, formatter, themeManager, performanceOptimizer);
        }

        logger.info('INDEX', 'Initializing PropertiesManager...');
        const propertiesManagerStart = performance.now();
        const propertiesManager = new PropertiesManager(
            dataManager,
            uiManager,
            historyManager,
            chartRenderer,
        );
        await propertiesManager.initialize();
        performanceOptimizer.measureModuleLoad('PropertiesManager', propertiesManagerStart);
        logger.logPerformance(
            'INDEX',
            'PropertiesManager initialization',
            performance.now() - propertiesManagerStart,
        );

        logger.info('INDEX', 'Setting up event listeners...');
        setupEventListeners(
            uiManager,
            dataManager,
            chartRenderer,
            themeManager,
            historyManager,
            formatter,
            performanceOptimizer,
            propertiesManager,
        );
        logger.info('INDEX', 'Event listeners setup complete');

        window.DataManager = DataManager;
        window.storage = storage;
        window.dataManager = dataManager;
        window.chartRenderer = chartRenderer;
        window.uiManager = uiManager;
        window.themeManager = themeManager;
        window.historyManager = historyManager;
        window.propertiesManager = propertiesManager;
        logger.debug('INDEX', 'Global objects exposed for debugging');

        const totalTime = Date.now() - startTime;
        logger.info('INDEX', `Application initialization complete (${totalTime}ms)`);

        // Log performance summary
        const metrics = performanceOptimizer.getMetrics();
        logger.info('INDEX', '=== MODULE LOAD PERFORMANCE SUMMARY ===');
        Object.entries(metrics.moduleLoadTimes).forEach(([module, time]) => {
            logger.info('INDEX', `${module}: ${time.toFixed(2)}ms`);
        });
        logger.info('INDEX', `Total startup time: ${totalTime}ms`);
        logger.info('INDEX', '=== END PERFORMANCE SUMMARY ===');
    } catch (e) {
        logger.error('INDEX', 'Initialization failed:', e);
        logger.error('INDEX', 'Error stack:', e.stack);
    }
}

/**
 * Setup event listeners for UIManager events
 */
function setupEventListeners(
    uiManager,
    dataManager,
    chartRenderer,
    themeManager,
    historyManager,
    formatter,
    performanceOptimizer,
    propertiesManager,
) {
    logger.debug('INDEX', 'Setting up UIManager event listeners...');

    document.addEventListener('viewChange', (event) => {
        const { view } = event.detail;
        logger.debug('INDEX', `View change requested: ${view}`);

        uiManager.setCurrentView(view);

        switch (view) {
            case 'overview':
                logger.debug('INDEX', 'Switching to overview view');
                if (chartRenderer) {
                    chartRenderer.renderOverviewSankey();
                } else {
                    logger.debug('INDEX', 'ChartRenderer not available, attempting lazy initialization');
                    ensureChartRenderer(
                        dataManager,
                        uiManager,
                        formatter,
                        themeManager,
                        performanceOptimizer,
                    )
                        .then(cr => cr?.renderOverviewSankey())
                        .catch(error => logger.error('INDEX', 'Failed to render chart on view change:', error));
                }
                break;
            case 'properties':
                logger.debug('INDEX', 'Switching to properties view');
                if (propertiesManager && typeof propertiesManager.renderPropertiesDashboard === 'function') {
                    propertiesManager.renderPropertiesDashboard();
                }
                break;
            default:
                logger.debug('INDEX', `Unhandled view: ${view}`);
                break;
        }
    });

    // History button click - use HistoryManager if available
    document.addEventListener('historyClick', () => {
        logger.debug('INDEX', 'History button clicked');

        // Try to use HistoryManager if available globally
        if (window.historyManager && window.historyManager.openHistoryManager) {
            logger.debug('INDEX', 'Using HistoryManager for history functionality');
            window.historyManager.openHistoryManager();
        } else {
            logger.debug('INDEX', 'HistoryManager not available, falling back to basic history display');
            // Fallback to basic history display
            if (dataManager) {
                const historyData = dataManager.getHistory?.();
                logger.debug('INDEX', 'Current data history:', historyData);

                if (historyData && historyData.length > 0) {
                    const historyText = historyData.map((entry, index) =>
                        `${index + 1}. ${entry.action} - ${entry.timestamp}`,
                    ).join('\n');

                    alert(`Data History:\n\n${historyText}`);
                } else {
                    alert('No history data available yet.');
                }
            } else {
                alert('DataManager not available for history.');
            }
        }
    });

    document.addEventListener('undoClick', () => {
        logger.debug('INDEX', 'Undo button clicked');
        if (historyManager && typeof historyManager.undo === 'function') {
            historyManager.undo();
        } else {
            logger.warn('INDEX', 'HistoryManager undo is not available');
        }
    });

    document.addEventListener('redoClick', () => {
        logger.debug('INDEX', 'Redo button clicked');
        if (historyManager && typeof historyManager.redo === 'function') {
            historyManager.redo();
        } else {
            logger.warn('INDEX', 'HistoryManager redo is not available');
        }
    });

    // Year change events
    document.addEventListener('yearChange', (event) => {
        const { selectedYear } = event.detail;
        logger.debug('INDEX', `Year changed to: ${selectedYear}`);

        // Update data manager with new year
        if (dataManager) {
            dataManager.setSelectedYear(selectedYear);
        }

        // Re-render chart with new year
        if (chartRenderer) {
            chartRenderer.renderOverviewSankey();
        } else {
            logger.debug('INDEX', 'ChartRenderer not available for year change, attempting lazy initialization');
            // Attempt to initialize chart renderer if data is now available
            ensureChartRenderer(
                dataManager,
                uiManager,
                formatter,
                themeManager,
                performanceOptimizer,
            )
                .then(cr => cr?.renderOverviewSankey())
                .catch(error => logger.error('INDEX', 'Failed to render chart on year change:', error));
        }
    });

    // Month change events
    document.addEventListener('monthChange', (event) => {
        const { selectedMonth } = event.detail;
        logger.debug('INDEX', `Month changed to: ${selectedMonth}`);

        // Update data manager with new month
        if (dataManager) {
            dataManager.setSelectedMonth(selectedMonth);
        }

        // Re-render chart with new month
        if (chartRenderer) {
            chartRenderer.renderOverviewSankey();
        } else {
            logger.debug('INDEX', 'ChartRenderer not available for month change, attempting lazy initialization');
            // Attempt to initialize chart renderer if data is now available
            ensureChartRenderer(
                dataManager,
                uiManager,
                formatter,
                themeManager,
                performanceOptimizer,
            )
                .then(cr => cr?.renderOverviewSankey())
                .catch(error => logger.error('INDEX', 'Failed to render chart on month change:', error));
        }
    });

    // Theme change events
    document.addEventListener('themeChange', (event) => {
        const { theme } = event.detail;
        logger.debug('INDEX', `Theme changed to: ${theme}`);

        // Theme is already handled by ThemeManager
        // Additional theme-specific logic can go here
    });

    // Color theme change events
    document.addEventListener('colorThemeChange', (event) => {
        const { theme } = event.detail;
        logger.debug('INDEX', `Color theme changed to: ${theme}`);

        // Update chart colors if chart is rendered
        if (chartRenderer) {
            chartRenderer.handleColorThemeChange(event);
        } else {
            logger.debug(
                'INDEX',
                'ChartRenderer not available for color theme change, will apply when chart is initialized',
            );
        }
    });

    logger.info('INDEX', 'All event listeners setup complete');
}

document.addEventListener('DOMContentLoaded', initializeApplication);

// Add window load event listener for early theme application
window.addEventListener('load', () => window.themeManager?.applyTheme());

// Add global unhandledrejection
window.addEventListener('unhandledrejection', e => logger.error('GLOBAL', 'Promise rejected:', e.reason));

/**
 * Setup lazy chart initialization for when data becomes available
 * @param {DataManager} dataManager - Data manager instance
 * @param {UIManager} uiManager - UI manager instance
 * @param {Formatter} formatter - Formatter instance
 * @param {ThemeManager} themeManager - Theme manager instance
 * @param {PerformanceOptimizer} performanceOptimizer - Performance optimizer instance
 */
function setupLazyChartInitialization(dataManager, uiManager, formatter, themeManager, performanceOptimizer) {
    logger.info('INDEX', 'Setting up lazy chart initialization...');

    // Listen for data changes to initialize chart when data becomes available
    const handleDataChange = async () => {
        const hasData = dataManager.getProperties().length > 0;
        if (hasData && !window.chartRenderer) {
            logger.info('INDEX', 'Data now available, initializing ChartRenderer...');

            try {
                const chartRendererStart = performance.now();
                const chartRenderer = new ChartRenderer(dataManager, uiManager, formatter, themeManager);
                await chartRenderer.initialize();
                performanceOptimizer.measureModuleLoad('ChartRenderer', chartRendererStart);
                logger.logPerformance(
                    'INDEX',
                    'ChartRenderer lazy initialization',
                    performance.now() - chartRendererStart,
                );

                const renderStart = performance.now();
                await chartRenderer.renderOverviewSankey();
                logger.logPerformance('INDEX', 'Lazy chart rendering', performance.now() - renderStart);

                // Expose globally for debugging
                window.chartRenderer = chartRenderer;

                logger.info('INDEX', 'ChartRenderer initialized and chart rendered after data became available');

                // Remove this listener since we only need it once
                dataManager.eventListeners.get('dataChange')?.pop();
            } catch (error) {
                logger.error('INDEX', 'Failed to initialize ChartRenderer after data became available:', error);
            }
        }
    };

    // Listen for data changes
    if (dataManager && typeof dataManager.on === 'function') {
        dataManager.on('dataChange', handleDataChange);
    }

    logger.info('INDEX', 'Lazy chart initialization setup complete');
}

/**
 * Setup on-demand onboarding tooltips for empty state
 * @param {UIManager} uiManager - UI manager instance
 */
function setupOnDemandOnboardingTooltips(uiManager) {
    logger.info('INDEX', 'Setting up on-demand onboarding tooltips...');

    // Show tooltips when user first interacts with relevant elements
    const showTooltipsOnFirstInteraction = () => {
        if (uiManager && typeof uiManager.showOnboardingTooltips === 'function') {
            uiManager.showOnboardingTooltips();
            logger.info('INDEX', 'Onboarding tooltips shown on first user interaction');

            // Remove listeners after showing tooltips once
            document.removeEventListener('click', showTooltipsOnFirstInteraction, true);
            document.removeEventListener('focus', showTooltipsOnFirstInteraction, true);
        }
    };

    // Listen for first user interaction (click or focus on interactive elements)
    document.addEventListener('click', showTooltipsOnFirstInteraction, true);
    document.addEventListener('focus', showTooltipsOnFirstInteraction, true);

    logger.info('INDEX', 'On-demand onboarding tooltips setup complete');
}

/**
 * Ensure ChartRenderer is initialized if data is available
 * @param {DataManager} dataManager - Data manager instance
 * @param {UIManager} uiManager - UI manager instance
 * @param {Formatter} formatter - Formatter instance
 * @param {ThemeManager} themeManager - Theme manager instance
 * @returns {Promise<ChartRenderer|null>} ChartRenderer instance or null if no data
 */
async function ensureChartRenderer(
    dataManager,
    uiManager,
    formatter,
    themeManager,
    performanceOptimizer,
) {
    // Check if chartRenderer is already available globally
    if (window.chartRenderer) {
        return window.chartRenderer;
    }

    // Check if data is available
    const hasData = dataManager.getProperties().length > 0;
    if (!hasData) {
        logger.debug('INDEX', 'No data available for chart initialization');
        return null;
    }

    try {
        logger.debug('INDEX', 'Initializing ChartRenderer on-demand...');
        const chartRendererStart = performance.now();
        const chartRenderer = new ChartRenderer(dataManager, uiManager, formatter, themeManager);
        await chartRenderer.initialize();
        if (performanceOptimizer && typeof performanceOptimizer.measureModuleLoad === 'function') {
            performanceOptimizer.measureModuleLoad('ChartRenderer', chartRendererStart);
        }
        logger.logPerformance(
            'INDEX',
            'ChartRenderer on-demand initialization',
            performance.now() - chartRendererStart,
        );

        // Expose globally for debugging
        window.chartRenderer = chartRenderer;

        logger.info('INDEX', 'ChartRenderer initialized on-demand');
        return chartRenderer;
    } catch (error) {
        logger.error('INDEX', 'Failed to initialize ChartRenderer on-demand:', error);
        return null;
    }
}

// Export for use in other modules
export default { initializeApplication };
