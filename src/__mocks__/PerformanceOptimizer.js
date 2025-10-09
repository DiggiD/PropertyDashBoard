/**
 * PerformanceOptimizer mock for testing
 * Provides mock implementations of all PerformanceOptimizer methods
 */

const mockPerformanceOptimizer = jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    measureModuleLoad: jest.fn(),
    getMetrics: jest.fn().mockReturnValue({
        moduleLoadTimes: {},
        methodExecutionTimes: {},
        memoryUsage: [],
        cacheStats: { hits: 0, misses: 0, hitRate: '0%', size: 0 },
        dataManagerMetrics: {
            initializationTime: 0,
            averageQueryTime: '0ms',
            totalQueries: 0,
            slowOperationsCount: 0,
            recentSlowOperations: [],
            sankeyGenerationTime: 0,
            storageLoadTime: 0,
            dataReconstructionTime: 0,
            transactionProcessingTime: 0,
            cacheInvalidations: 0,
            cacheInvalidationRate: '0/sec',
            memoryTrend: 0,
            memoryUsage: [],
        },
        cacheSize: 0,
        timestamp: Date.now(),
    }),
    recordDataManagerOperation: jest.fn(),
    recordDataManagerInitialization: jest.fn(),
    setEnabled: jest.fn(),
    cleanup: jest.fn(),
    debug: jest.fn(),
    cache: jest.fn((key, value) => value),
    getCached: jest.fn(),
    clearCache: jest.fn(),
    optimizeDOMOperations: jest.fn(),
    optimizeEventHandling: jest.fn(),
    debounce: jest.fn(),
    throttle: jest.fn(),
    measureTime: jest.fn(),
    optimizeRender: jest.fn(),
    optimizeDataOperations: jest.fn(),
    optimizeChartRendering: jest.fn(),
    addObserver: jest.fn(),
    removeObserver: jest.fn(),
    notifyObservers: jest.fn(),
    lazyLoad: jest.fn(),
    batchOperations: jest.fn(),
}));

// Export as default (matching the real PerformanceOptimizer export)
export default mockPerformanceOptimizer;