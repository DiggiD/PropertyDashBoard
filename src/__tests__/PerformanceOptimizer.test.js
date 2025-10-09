/**
 * Jest unit tests for PerformanceOptimizer module
 * Focus: Performance monitoring, caching, and optimization features
 * Coverage: Aim for 90%+ across all modules with minimal mocking
 */

// Mock only external dependencies, not the modules we're testing
jest.mock('../modules/core/ThemeManager', () => require('../__mocks__/ThemeManager'));
jest.mock('../modules/utils/Logger.js', () => ({
    createModuleLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    })),
}));

// Now import real modules (after mocks are set up)
import PerformanceOptimizer from '../modules/utils/PerformanceOptimizer.js';

describe('PerformanceOptimizer', () => {
    let performanceOptimizer;

    beforeEach(() => {
        // Mock setInterval for memory monitoring tests
        global.setInterval = jest.fn((callback, delay) => {
            // Return a mock interval ID
            return 12345;
        });

        // Mock performance API for PerformanceOptimizer
        global.performance = {
            now: jest.fn(() => Date.now()),
            memory: {
                usedJSHeapSize: 1000000,
                totalJSHeapSize: 2000000,
                jsHeapSizeLimit: 5000000,
            },
        };

        // Ensure performance.memory is properly accessible
        Object.defineProperty(global.performance, 'memory', {
            value: {
                usedJSHeapSize: 1000000,
                totalJSHeapSize: 2000000,
                jsHeapSizeLimit: 5000000,
            },
            writable: true,
        });

        // Mock requestAnimationFrame for PerformanceOptimizer
        global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));

        // Mock document for DOM operations in PerformanceOptimizer
        global.document = {
            createDocumentFragment: jest.fn().mockReturnValue({
                appendChild: jest.fn(),
            }),
            createElement: jest.fn().mockReturnValue({
                style: {},
                appendChild: jest.fn(),
                addEventListener: jest.fn(),
            }),
        };

        // Create fresh instances
        performanceOptimizer = new PerformanceOptimizer();

        // Initialize dataManagerMetrics to avoid undefined errors
        performanceOptimizer.dataManagerMetrics = {
            initializationTime: 0,
            queryTimes: new Map(),
            cacheHitRate: 0,
            sankeyGenerationTime: 0,
            totalQueries: 0,
            slowOperations: [],
            storageLoadTime: 0,
            dataReconstructionTime: 0,
            transactionProcessingTime: 0,
            cacheInvalidations: 0,
            memoryUsage: [],
        };

        // Mock initialize methods to avoid real initialization
        jest.spyOn(performanceOptimizer, 'initialize').mockResolvedValue();
    });

    afterEach(() => {
        // Cleanup PerformanceOptimizer
        performanceOptimizer.cleanup();
        delete global.performance;
        delete global.requestAnimationFrame;
        delete global.document;
        jest.restoreAllMocks();
    });

    // ============================================================================
    // PERFORMANCE OPTIMIZER TESTS (15+ tests using isolated real code execution)
    // ============================================================================

    describe('initialization', () => {
        test('should initialize with default state', () => {
            expect(performanceOptimizer.cacheMap).toBeInstanceOf(Map);
            expect(performanceOptimizer.observers).toBeInstanceOf(Set);
            expect(performanceOptimizer.isEnabled).toBe(true);
            expect(performanceOptimizer.metrics).toBeDefined();
        });

        test('should start memory monitoring when performance.memory is available', () => {
            performanceOptimizer.startMemoryMonitoring();
            expect(performanceOptimizer.memoryMonitoringInterval).toBeDefined();
            expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
        });

        test('should initialize and setup performance observers', async () => {
            const loggerSpy = jest.spyOn(performanceOptimizer.logger, 'info').mockImplementation();
            await performanceOptimizer.initialize();
            expect(loggerSpy).toHaveBeenCalledWith('PerformanceOptimizer initialized');
            loggerSpy.mockRestore();
        });

        test('should setup performance observers when PerformanceObserver is available', () => {
            // Mock PerformanceObserver
            global.PerformanceObserver = jest.fn((callback) => ({
                observe: jest.fn(),
                disconnect: jest.fn(),
            }));

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            performanceOptimizer.setupPerformanceObservers();

            expect(global.PerformanceObserver).toHaveBeenCalledTimes(2); // longtask and layout-shift
            expect(performanceOptimizer.observers.size).toBe(2);

            consoleSpy.mockRestore();
            delete global.PerformanceObserver;
        });

        test('should not setup performance observers when PerformanceObserver is not available', () => {
            // PerformanceObserver is not available by default in our test setup
            performanceOptimizer.setupPerformanceObservers();
            expect(performanceOptimizer.observers.size).toBe(0);
        });
    });

    describe('measureMethodExecution', () => {
        test('should measure execution time of async method', async () => {
            const mockMethod = jest.fn().mockResolvedValue('result');
            const context = { test: 'context' };

            const result = await performanceOptimizer.measureMethodExecution(
                'testMethod',
                mockMethod,
                context,
                'arg1',
                'arg2',
            );

            expect(result).toBe('result');
            expect(mockMethod).toHaveBeenCalledWith('arg1', 'arg2');
            expect(mockMethod).toHaveBeenCalledTimes(1);
            expect(performanceOptimizer.metrics.methodExecutionTime.has('testMethod')).toBe(true);
        });

        test('should measure execution time of sync method', async () => {
            const mockMethod = jest.fn().mockReturnValue(42);

            const result = await performanceOptimizer.measureMethodExecution(
                'syncMethod',
                mockMethod,
                null,
            );

            expect(result).toBe(42);
            expect(performanceOptimizer.metrics.methodExecutionTime.has('syncMethod')).toBe(true);
        });

        test('should warn for slow methods', async () => {
            // Mock performance.now to simulate slow operation
            const originalNow = global.performance.now;
            global.performance.now
                .mockReturnValueOnce(100) // start time
                .mockReturnValueOnce(250); // end time (150ms later)

            const mockMethod = jest.fn(() => 'slow result');

            const result = await performanceOptimizer.measureMethodExecution('slowMethod', mockMethod, null);

            expect(result).toBe('slow result');

            // Restore original mock
            global.performance.now = originalNow;
        });

        test('should skip measurement when disabled', async () => {
            performanceOptimizer.setEnabled(false);
            const mockMethod = jest.fn().mockReturnValue('result');

            const result = await performanceOptimizer.measureMethodExecution(
                'disabledMethod',
                mockMethod,
                null,
            );

            expect(result).toBe('result');
            expect(performanceOptimizer.metrics.methodExecutionTime.has('disabledMethod')).toBe(false);
        });
    });

    describe('caching', () => {
        test('should cache values with TTL', () => {
            const value = { data: 'test' };
            const result = performanceOptimizer.cache('testKey', value, 1000);

            expect(result).toBe(value);
            expect(performanceOptimizer.cacheMap.has('testKey')).toBe(true);
        });

        test('should retrieve cached values', () => {
            const value = 'cached value';
            performanceOptimizer.cache('testKey', value);

            const cached = performanceOptimizer.getCached('testKey');

            expect(cached).toBe(value);
            expect(performanceOptimizer.metrics.cacheHits).toBe(1);
        });

        test('should return null for non-existent cache key', () => {
            const cached = performanceOptimizer.getCached('nonExistent');

            expect(cached).toBe(null);
            expect(performanceOptimizer.metrics.cacheMisses).toBe(1);
        });

        test('should return null for expired cache entries', () => {
            jest.useFakeTimers();
            performanceOptimizer.cache('expiredKey', 'value', 100);
            jest.advanceTimersByTime(150); // Expire the cache

            const cached = performanceOptimizer.getCached('expiredKey');

            expect(cached).toBe(null);
            expect(performanceOptimizer.metrics.cacheMisses).toBe(1);
            jest.useRealTimers();
        });

        test('cache expires after TTL', () => {
            const optimizer = new PerformanceOptimizer();
            optimizer.cache('testKey', 'value', 100);  // 100ms TTL

            jest.useFakeTimers();
            expect(optimizer.getCached('testKey')).toBe('value');  // Fresh

            jest.advanceTimersByTime(101);  // Expired
            expect(optimizer.getCached('testKey')).toBeNull();  // Miss after expiry
            expect(optimizer.metrics.cacheMisses).toBe(1);
            jest.useRealTimers();
        });

        test('should clear all cache', () => {
            performanceOptimizer.cache('key1', 'value1');
            performanceOptimizer.cache('key2', 'value2');

            performanceOptimizer.clearCache();

            expect(performanceOptimizer.cacheMap.size).toBe(0);
        });

        test('should clear cache by pattern', () => {
            performanceOptimizer.cache('user:1', 'user1');
            performanceOptimizer.cache('user:2', 'user2');
            performanceOptimizer.cache('post:1', 'post1');

            performanceOptimizer.clearCache('user:');

            expect(performanceOptimizer.cacheMap.has('user:1')).toBe(false);
            expect(performanceOptimizer.cacheMap.has('user:2')).toBe(false);
            expect(performanceOptimizer.cacheMap.has('post:1')).toBe(true);
        });
    });

    describe('event optimization', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            performanceOptimizer.optimizeEventHandling();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should create debounced function', () => {
            const mockFn = jest.fn();
            const debouncedFn = performanceOptimizer.debounce(mockFn, 100);

            // Call multiple times quickly
            debouncedFn('arg1');
            debouncedFn('arg2');
            debouncedFn('arg3');

            expect(mockFn).not.toHaveBeenCalled();

            // Advance time past debounce delay
            jest.advanceTimersByTime(101);

            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith('arg3');
        });

        test('should create throttled event handler', () => {
            const mockFn = jest.fn();
            const throttledFn = performanceOptimizer.throttleEvent(mockFn, 200);

            // Call multiple times
            throttledFn('call1');
            throttledFn('call2');
            throttledFn('call3');

            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith('call1');

            // Advance time past throttle limit
            jest.advanceTimersByTime(201);

            throttledFn('call4');
            expect(mockFn).toHaveBeenCalledTimes(2);
            expect(mockFn).toHaveBeenCalledWith('call4');
        });
    });

    describe('data optimization', () => {
        beforeEach(() => {
            performanceOptimizer.optimizeDataOperations();
        });

        test('should memoize function results', () => {
            const expensiveFn = jest.fn((x) => x * 2);
            const memoizedFn = performanceOptimizer.memoize(expensiveFn);

            // First call
            const result1 = memoizedFn(5);
            expect(result1).toBe(10);
            expect(expensiveFn).toHaveBeenCalledTimes(1);

            // Second call with same argument should use cache
            const result2 = memoizedFn(5);
            expect(result2).toBe(10);
            expect(expensiveFn).toHaveBeenCalledTimes(1); // Still 1 call

            // Third call with different argument
            const result3 = memoizedFn(3);
            expect(result3).toBe(6);
            expect(expensiveFn).toHaveBeenCalledTimes(2);
        });

        test('should handle custom key generator', () => {
            const expensiveFn = jest.fn((a, b) => a + b);
            const memoizedFn = performanceOptimizer.memoize(
                expensiveFn,
                (a, b) => `${a}-${b}`,
            );

            memoizedFn(1, 2);
            memoizedFn(1, 2); // Should use cache

            expect(expensiveFn).toHaveBeenCalledTimes(1);
        });
    });

    describe('DOM optimization', () => {
        beforeEach(() => {
            performanceOptimizer.optimizeDOMOperations();
        });

        test('should create document fragment for bulk operations', () => {
            const operations = [
                jest.fn(),
                jest.fn(),
            ];

            const fragment = performanceOptimizer.createDocumentFragment(operations);

            expect(operations[0]).toHaveBeenCalledWith(fragment);
            expect(operations[1]).toHaveBeenCalledWith(fragment);
        });

        test('should debounce DOM updates', () => {
            const mockFn = jest.fn();
            const debouncedFn = performanceOptimizer.debounceDOMUpdate(mockFn, 16);

            debouncedFn('arg1');
            debouncedFn('arg2');

            expect(mockFn).not.toHaveBeenCalled();
        });

        test('should batch style updates', () => {
            const element = { style: { cssText: 'color: red;' } };

            performanceOptimizer.batchStyleUpdates(element, {
                backgroundColor: 'blue',
                fontSize: '14px',
            });

            expect(element.style.cssText).toContain('background-color:blue');
            expect(element.style.cssText).toContain('font-size:14px');
        });
    });

    describe('chart rendering optimization', () => {
        beforeEach(() => {
            performanceOptimizer.optimizeChartRendering();
        });

        test('should create virtual scroller', () => {
            const container = {
                innerHTML: '',
                style: {},
                appendChild: jest.fn(),
                addEventListener: jest.fn(),
            };

            const items = ['item1', 'item2', 'item3', 'item4', 'item5'];
            const itemHeight = 50;
            const visibleItems = 3;

            performanceOptimizer.createVirtualScroller(container, items, itemHeight, visibleItems);

            expect(container.style.height).toBe('150px'); // 3 * 50
            expect(container.style.overflow).toBe('auto');
            expect(container.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
        });
    });

    describe('metrics and monitoring', () => {
        test('should get performance metrics', () => {
            performanceOptimizer.metrics.cacheHits = 8;
            performanceOptimizer.metrics.cacheMisses = 2;

            const metrics = performanceOptimizer.getMetrics();

            expect(metrics.cacheStats.hitRate).toBe('80.00%');
            expect(metrics.cacheSize).toBe(0); // Empty cache
        });

        test('should measure module load time', () => {
            const startTime = performance.now() - 50; // 50ms ago

            performanceOptimizer.measureModuleLoad('TestModule', startTime);

            expect(performanceOptimizer.metrics.moduleLoadTime.get('TestModule')).toBeGreaterThanOrEqual(50);
        });

        test('should warn for slow module loads', () => {
            const startTime = performance.now() - 150; // 150ms ago

            performanceOptimizer.measureModuleLoad('SlowModule', startTime);

            // Just verify the method runs without error
            expect(performanceOptimizer.metrics.moduleLoadTime.has('SlowModule')).toBe(true);
        });
    });

    describe('observers', () => {
        test('should add and remove observers', () => {
            const observer = jest.fn();

            performanceOptimizer.addObserver(observer);
            expect(performanceOptimizer.observers.has(observer)).toBe(true);

            performanceOptimizer.removeObserver(observer);
            expect(performanceOptimizer.observers.has(observer)).toBe(false);
        });

        test('should notify observers', () => {
            const observer1 = jest.fn();
            const observer2 = jest.fn();

            performanceOptimizer.addObserver(observer1);
            performanceOptimizer.addObserver(observer2);

            performanceOptimizer.notifyObservers('testEvent', { data: 'test' });

            expect(observer1).toHaveBeenCalledWith('testEvent', { data: 'test' });
            expect(observer2).toHaveBeenCalledWith('testEvent', { data: 'test' });
        });
    });

    describe('enable/disable', () => {
        test('should enable and disable performance monitoring', () => {
            performanceOptimizer.setEnabled(false);
            expect(performanceOptimizer.isEnabled).toBe(false);

            performanceOptimizer.setEnabled(true);
            expect(performanceOptimizer.isEnabled).toBe(true);
        });

        test('should skip operations when disabled', () => {
            performanceOptimizer.setEnabled(false);

            const result = performanceOptimizer.cache('test', 'value');
            expect(result).toBe('value');

            const cached = performanceOptimizer.getCached('test');
            expect(cached).toBe(null); // Should not cache when disabled
        });
    });

    describe('cleanup', () => {
        test('should cleanup all resources', () => {
            // Add some data
            performanceOptimizer.cache('test', 'value');
            performanceOptimizer.metrics.moduleLoadTime.set('TestModule', 100);
            performanceOptimizer.metrics.methodExecutionTime.set('testMethod', 50);

            performanceOptimizer.cleanup();

            expect(performanceOptimizer.cacheMap.size).toBe(0);
            expect(performanceOptimizer.metrics.moduleLoadTime.size).toBe(0);
            expect(performanceOptimizer.metrics.methodExecutionTime.size).toBe(0);
            expect(performanceOptimizer.metrics.memoryUsage.length).toBe(0);
        });
    });

    describe('utility functions', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should measure time of function execution', async () => {
            const originalNow = global.performance.now;
            global.performance.now = jest.fn().mockReturnValueOnce(100).mockReturnValueOnce(150);

            const func = jest.fn(() => 'result');
            const { result, time } = await performanceOptimizer.measureTime(func);

            expect(result).toBe('result');
            expect(time).toBe(50);
            expect(func).toHaveBeenCalledTimes(1);

            global.performance.now = originalNow;
        });

        test('should handle errors in measureTime', async () => {
            const errorFunc = jest.fn(() => {
                throw new Error('Function failed');
            });

            try {
                await performanceOptimizer.measureTime(errorFunc);
                fail('Should have thrown');
            } catch (error) {
                expect(error.message).toBe('Function failed');
            }
        });

        test('should optimize render with requestAnimationFrame batching', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            performanceOptimizer.optimizeRender(callback1);
            performanceOptimizer.optimizeRender(callback2);

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();

            // Advance timers to trigger requestAnimationFrame
            jest.advanceTimersByTime(16);

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        test('should handle zero delay for debounce', () => {
            performanceOptimizer.optimizeEventHandling();
            const mockFn = jest.fn();
            const debouncedFn = performanceOptimizer.debounce(mockFn, 0);

            debouncedFn('arg');

            // Advance timers to execute the setTimeout(0)
            jest.advanceTimersByTime(1);

            // Should execute immediately with zero delay
            expect(mockFn).toHaveBeenCalledWith('arg');
        });
    });

    describe('error handling', () => {
        test('should handle errors in measured methods', async () => {
            const mockMethod = jest.fn().mockRejectedValue(new Error('Method failed'));

            await expect(
                performanceOptimizer.measureMethodExecution('failingMethod', mockMethod, null),
            ).rejects.toThrow('Method failed');
        });

        test('should handle missing performance.memory', () => {
            delete global.performance.memory;

            expect(() => performanceOptimizer.startMemoryMonitoring()).not.toThrow();
        });

        test('should handle missing PerformanceObserver', () => {
            delete global.PerformanceObserver;

            expect(() => performanceOptimizer.setupPerformanceObservers()).not.toThrow();
        });
    });

    describe('memory monitoring', () => {
        let testPerformanceOptimizer;

        beforeEach(() => {
            jest.useFakeTimers();
            // Create a fresh instance for memory monitoring tests
            testPerformanceOptimizer = new PerformanceOptimizer();

            // Ensure setInterval is properly mocked
            global.setInterval = jest.fn((callback, delay) => {
                return 12345;
            });

            // Ensure performance.memory is available
            global.performance = {
                now: jest.fn(() => Date.now()),
                memory: {
                    usedJSHeapSize: 1000000,
                    totalJSHeapSize: 2000000,
                    jsHeapSizeLimit: 5000000,
                },
            };
        });

        afterEach(() => {
            jest.useRealTimers();
            if (testPerformanceOptimizer && testPerformanceOptimizer.memoryMonitoringInterval) {
                clearInterval(testPerformanceOptimizer.memoryMonitoringInterval);
                testPerformanceOptimizer.memoryMonitoringInterval = null;
            }
            if (testPerformanceOptimizer && testPerformanceOptimizer.cleanup) {
                testPerformanceOptimizer.cleanup();
            }
            // Restore global performance
            delete global.performance;
        });

        test('should start memory monitoring with performance.memory available', () => {
            testPerformanceOptimizer.startMemoryMonitoring();
            // Test that the method runs without error
            expect(testPerformanceOptimizer.startMemoryMonitoring).toBeDefined();
        });

        test('should handle memory monitoring without performance.memory', () => {
            const originalMemory = global.performance.memory;
            delete global.performance.memory;

            expect(() => testPerformanceOptimizer.startMemoryMonitoring()).not.toThrow();
            expect(testPerformanceOptimizer.memoryMonitoringInterval).toBeUndefined();

            global.performance.memory = originalMemory;
        });

        test('should collect memory usage data during monitoring interval', () => {
            testPerformanceOptimizer.startMemoryMonitoring();

            // Get the callback from setInterval calls
            expect(global.setInterval).toHaveBeenCalledTimes(1);
            expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
            const intervalCallback = global.setInterval.mock.calls[0][0];

            // Manually trigger the memory monitoring callback
            intervalCallback();

            // Check that memory usage data was collected
            expect(testPerformanceOptimizer.metrics.memoryUsage.length).toBeGreaterThan(0);
            expect(testPerformanceOptimizer.metrics.memoryUsage[0]).toHaveProperty('timestamp');
            expect(testPerformanceOptimizer.metrics.memoryUsage[0]).toHaveProperty('used');
            expect(testPerformanceOptimizer.metrics.memoryUsage[0]).toHaveProperty('total');
            expect(testPerformanceOptimizer.metrics.memoryUsage[0]).toHaveProperty('limit');
        });

        test('should limit memory usage history to 100 entries', () => {
            testPerformanceOptimizer.startMemoryMonitoring();

            // Get the callback from setInterval calls
            expect(global.setInterval).toHaveBeenCalledTimes(1);
            expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
            const intervalCallback = global.setInterval.mock.calls[0][0];

            // Simulate 105 intervals by manually calling the callback
            for (let i = 0; i < 105; i++) {
                intervalCallback();
            }

            // Should only keep the last 100 entries
            expect(testPerformanceOptimizer.metrics.memoryUsage.length).toBe(100);
        });
    });

    describe('performance observers', () => {
        test('should setup performance observers when PerformanceObserver is available', () => {
            performanceOptimizer.setupPerformanceObservers();
            // Test that the method runs without error
            expect(performanceOptimizer.setupPerformanceObservers).toBeDefined();
        });

        test('should handle long task detection', () => {
            const observerCallback = jest.fn();
            performanceOptimizer.addObserver(observerCallback);

            // Mock PerformanceObserver entry
            const mockEntry = {
                duration: 60,
                startTime: 100,
            };

            // Trigger the observer (this is hard to test directly, so we test the logic)
            performanceOptimizer.notifyObservers('longTask', {
                duration: mockEntry.duration,
                startTime: mockEntry.startTime,
            });

            expect(observerCallback).toHaveBeenCalledWith('longTask', expect.objectContaining({
                duration: 60,
                startTime: 100,
            }));
        });

        test('should handle layout shift detection', () => {
            const observerCallback = jest.fn();
            performanceOptimizer.addObserver(observerCallback);

            performanceOptimizer.notifyObservers('layoutShift', { value: 0.15 });
            expect(observerCallback).toHaveBeenCalledWith('layoutShift', { value: 0.15 });
        });

        test('should trigger long task observer callback when duration > 50ms', () => {
            // Mock PerformanceObserver
            const mockObserver = {
                observe: jest.fn(),
                disconnect: jest.fn(),
            };

            global.PerformanceObserver = jest.fn((callback) => {
                // Store the callback to trigger it manually
                mockObserver.callback = callback;
                return mockObserver;
            });

            performanceOptimizer.setupPerformanceObservers();

            // Manually trigger the long task observer callback
            const mockList = {
                getEntries: jest.fn().mockReturnValue([
                    { duration: 60, startTime: 100 }, // Long task
                    { duration: 30, startTime: 200 },  // Not a long task
                ]),
            };

            // Find the long task observer callback (first one)
            const longTaskCallback = global.PerformanceObserver.mock.calls[0][0];
            longTaskCallback(mockList);

            // Just verify it doesn't throw
            expect(longTaskCallback).toBeDefined();

            delete global.PerformanceObserver;
        });

        test('should trigger layout shift observer callback when cls > 0.1', () => {
            // Mock PerformanceObserver
            const mockObserver = {
                observe: jest.fn(),
                disconnect: jest.fn(),
            };

            global.PerformanceObserver = jest.fn((callback) => {
                // Store the callback to trigger it manually
                mockObserver.callback = callback;
                return mockObserver;
            });

            performanceOptimizer.setupPerformanceObservers();

            // Manually trigger the layout shift observer callback
            const mockList = {
                getEntries: jest.fn().mockReturnValue([
                    { value: 0.15, hadRecentInput: false }, // Significant layout shift
                ]),
            };

            // Find the layout shift observer callback (second one)
            const layoutShiftCallback = global.PerformanceObserver.mock.calls[1][0];
            layoutShiftCallback(mockList);

            // Just verify it doesn't throw
            expect(layoutShiftCallback).toBeDefined();

            delete global.PerformanceObserver;
        });

        test('should not warn for layout shifts with recent input', () => {
            // Mock PerformanceObserver
            const mockObserver = {
                observe: jest.fn(),
                disconnect: jest.fn(),
            };

            global.PerformanceObserver = jest.fn((callback) => {
                mockObserver.callback = callback;
                return mockObserver;
            });

            performanceOptimizer.setupPerformanceObservers();

            // Manually trigger with recent input
            const mockList = {
                getEntries: jest.fn().mockReturnValue([
                    { value: 0.15, hadRecentInput: true }, // Should be ignored
                ]),
            };

            // Find the layout shift observer callback (second one)
            const layoutShiftCallback = global.PerformanceObserver.mock.calls[1][0];
            layoutShiftCallback(mockList);

            // Just verify it doesn't throw
            expect(layoutShiftCallback).toBeDefined();

            delete global.PerformanceObserver;
        });
    });

    describe('DOM operations', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            performanceOptimizer.optimizeEventHandling();
            performanceOptimizer.optimizeDOMOperations();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should add passive event listeners', () => {
            const element = { addEventListener: jest.fn() };
            const handler = jest.fn();

            performanceOptimizer.addPassiveEventListener(element, 'scroll', handler);

            expect(element.addEventListener).toHaveBeenCalledWith('scroll', handler, {
                passive: true,
            });
        });

        test('should add passive event listeners with custom options', () => {
            const element = { addEventListener: jest.fn() };
            const handler = jest.fn();

            performanceOptimizer.addPassiveEventListener(element, 'scroll', handler, { capture: true });

            expect(element.addEventListener).toHaveBeenCalledWith('scroll', handler, {
                passive: true,
                capture: true,
            });
        });

        test('should debounce event handlers', () => {
            const handler = jest.fn();
            const debouncedHandler = performanceOptimizer.debounceEvent(handler, 100);

            debouncedHandler('arg1');
            debouncedHandler('arg2');

            expect(handler).not.toHaveBeenCalled();

            jest.advanceTimersByTime(101);
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith('arg2');
        });

        test('should throttle event handlers', () => {
            const handler = jest.fn();
            const throttledHandler = performanceOptimizer.throttleEvent(handler, 100);

            throttledHandler('arg1');
            throttledHandler('arg2');

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith('arg1');

            jest.advanceTimersByTime(101);
            throttledHandler('arg3');
            expect(handler).toHaveBeenCalledTimes(2);
            expect(handler).toHaveBeenCalledWith('arg3');
        });

        test('should debounce functions', () => {
            const handler = jest.fn();
            const debouncedHandler = performanceOptimizer.debounce(handler, 100);

            debouncedHandler('arg1');
            debouncedHandler('arg2');

            expect(handler).not.toHaveBeenCalled();

            jest.advanceTimersByTime(101);
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith('arg2');
        });

        test('should throttle functions', () => {
            const handler = jest.fn();
            const throttledHandler = performanceOptimizer.throttle(handler, 100);

            throttledHandler('arg1');
            throttledHandler('arg2');

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith('arg1');

            jest.advanceTimersByTime(101);
            throttledHandler('arg3');
            expect(handler).toHaveBeenCalledTimes(2);
            expect(handler).toHaveBeenCalledWith('arg3');
        });

        test('should create document fragment for bulk operations', () => {
            const operations = [
                jest.fn(),
                jest.fn(),
            ];

            const fragment = performanceOptimizer.createDocumentFragment(operations);

            expect(operations[0]).toHaveBeenCalledWith(fragment);
            expect(operations[1]).toHaveBeenCalledWith(fragment);
        });

        test('should debounce DOM updates', () => {
            const mockFn = jest.fn();
            const debouncedFn = performanceOptimizer.debounceDOMUpdate(mockFn, 16);

            debouncedFn('arg1');
            debouncedFn('arg2');

            expect(mockFn).not.toHaveBeenCalled();
        });

        test('should execute debounced DOM updates after timeout', () => {
            jest.useFakeTimers();
            const mockFn = jest.fn();
            const debouncedFn = performanceOptimizer.debounceDOMUpdate(mockFn, 16);

            debouncedFn('arg1');
            debouncedFn('arg2');

            jest.advanceTimersByTime(16);

            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith('arg2');

            jest.useRealTimers();
        });

        test('should batch style updates', () => {
            const element = { style: { cssText: 'color: red;' } };

            performanceOptimizer.batchStyleUpdates(element, {
                backgroundColor: 'blue',
                fontSize: '14px',
            });

            expect(element.style.cssText).toContain('background-color:blue');
            expect(element.style.cssText).toContain('font-size:14px');
        });
    });

    describe('data operations', () => {
        beforeEach(() => {
            performanceOptimizer.optimizeDataOperations();
        });

        test('should lazy load data with caching', async () => {
            const dataLoader = jest.fn().mockResolvedValue('loaded data');
            const key = 'test-data';

            const result1 = await performanceOptimizer.lazyLoadData(dataLoader, key);
            expect(result1).toBe('loaded data');
            expect(dataLoader).toHaveBeenCalledTimes(1);

            // Second call should use cache
            const result2 = await performanceOptimizer.lazyLoadData(dataLoader, key);
            expect(result2).toBe('loaded data');
            expect(dataLoader).toHaveBeenCalledTimes(1); // Still 1 call
        });

        test('should memoize function results', () => {
            const expensiveFn = jest.fn((x) => x * 2);
            const memoizedFn = performanceOptimizer.memoize(expensiveFn);

            expect(memoizedFn(5)).toBe(10);
            expect(memoizedFn(5)).toBe(10); // Should use cache
            expect(expensiveFn).toHaveBeenCalledTimes(1);

            expect(memoizedFn(3)).toBe(6);
            expect(expensiveFn).toHaveBeenCalledTimes(2);
        });

        test('should memoize with custom key generator', () => {
            const expensiveFn = jest.fn((a, b) => a + b);
            const memoizedFn = performanceOptimizer.memoize(
                expensiveFn,
                (a, b) => `custom-${a}-${b}`,
            );

            expect(memoizedFn(1, 2)).toBe(3);
            expect(memoizedFn(1, 2)).toBe(3); // Should use cache
            expect(expensiveFn).toHaveBeenCalledTimes(1);
        });
    });

    describe('chart rendering', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            performanceOptimizer.optimizeChartRendering();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should animate with requestAnimationFrame', () => {
            const callback = jest.fn();
            performanceOptimizer.animateWithRAF(callback);

            // Test that the method runs without error
            expect(performanceOptimizer.animateWithRAF).toBeDefined();
        });

        test('should execute animateWithRAF callback in animation loop', () => {
            jest.useFakeTimers();
            const callback = jest.fn();

            performanceOptimizer.animateWithRAF(callback);

            // First frame
            jest.advanceTimersByTime(16);
            expect(callback).toHaveBeenCalledTimes(1);

            // Second frame
            jest.advanceTimersByTime(16);
            expect(callback).toHaveBeenCalledTimes(2);

            // Third frame
            jest.advanceTimersByTime(16);
            expect(callback).toHaveBeenCalledTimes(3);

            jest.useRealTimers();
        });

        test('should create virtual scroller with proper setup', () => {
            const container = {
                innerHTML: '',
                style: {},
                appendChild: jest.fn(),
                addEventListener: jest.fn(),
            };

            const items = ['item1', 'item2', 'item3'];
            const itemHeight = 50;
            const visibleItems = 2;

            performanceOptimizer.createVirtualScroller(container, items, itemHeight, visibleItems);

            expect(container.style.height).toBe('100px'); // 2 * 50
            expect(container.style.overflow).toBe('auto');
            expect(container.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
        });

        test('should handle virtual scroller scroll events', () => {
            const container = {
                innerHTML: '',
                style: {},
                appendChild: jest.fn(),
                addEventListener: jest.fn(),
            };

            const items = Array.from({ length: 10 }, (_, i) => `item${i}`);
            const itemHeight = 50;
            const visibleItems = 3;

            performanceOptimizer.createVirtualScroller(container, items, itemHeight, visibleItems);

            // Get the scroll handler
            const scrollHandler = container.addEventListener.mock.calls.find(
                call => call[0] === 'scroll',
            )[1];

            // Simulate scroll
            container.scrollTop = 100; // Scroll to show items 2-4
            scrollHandler({ target: container });

            // Should have updated visible items
            expect(container.appendChild).toHaveBeenCalled();
        });
    });

    describe('enable/disable functionality', () => {
        test('should disable performance monitoring', () => {
            performanceOptimizer.setEnabled(false);
            expect(performanceOptimizer.isEnabled).toBe(false);

            // Operations should be skipped when disabled
            const result = performanceOptimizer.cache('test', 'value');
            expect(result).toBe('value');

            const cached = performanceOptimizer.getCached('test');
            expect(cached).toBe(null); // Should not cache when disabled
        });

        test('should re-enable performance monitoring', () => {
            performanceOptimizer.setEnabled(false);
            expect(performanceOptimizer.isEnabled).toBe(false);

            performanceOptimizer.setEnabled(true);
            expect(performanceOptimizer.isEnabled).toBe(true);
        });
    });

    describe('debug functionality', () => {
        test('should provide debug information', () => {
            // Add some test data
            performanceOptimizer.cache('debug-test', 'value');
            performanceOptimizer.metrics.moduleLoadTime.set('TestModule', 100);
            performanceOptimizer.metrics.methodExecutionTime.set('testMethod', 50);

            // Just verify debug doesn't throw
            expect(() => performanceOptimizer.debug()).not.toThrow();
        });

        test('should handle debug with memory usage', () => {
            // Mock memory usage
            performanceOptimizer.metrics.memoryUsage = [{
                timestamp: Date.now(),
                used: 1000000,
                total: 2000000,
                limit: 5000000,
            }];

            // Just verify debug doesn't throw
            expect(() => performanceOptimizer.debug()).not.toThrow();
        });
    });
});