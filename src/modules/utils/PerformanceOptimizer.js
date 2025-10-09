/**
 * PerformanceOptimizer Module
 * Optimizes performance across the modular architecture
 * - Memory management and cleanup
 * - Lazy loading and code splitting
 * - Caching strategies
 * - Performance monitoring
 */

import logger from './Logger.js';

class PerformanceOptimizer {
    constructor() {
        this.cacheMap = new Map();
        this.observers = new Set();
        this.metrics = {
            moduleLoadTime: new Map(),
            methodExecutionTime: new Map(),
            memoryUsage: [],
            cacheHits: 0,
            cacheMisses: 0,
        };

        this.isEnabled = true;
        this.logger = logger.createModuleLogger('PERFORMANCE');
        this.logger.info('PerformanceOptimizer initialized');
    }

    /**
     * Initialize performance optimizer - ENHANCED with DataManager monitoring
     */
    async initialize() {
        this.startMemoryMonitoring();
        this.setupPerformanceObservers();
        this.setupDataManagerMonitoring();

        this.logger.info('Performance optimizer initialized with DataManager monitoring');
    }

    /**
      * Setup DataManager specific performance monitoring - ENHANCED
      */
    setupDataManagerMonitoring() {
        // Enhanced DataManager metrics tracking
        this.dataManagerMetrics = {
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

        // Monitor long-running operations (>15ms - reduced threshold for better monitoring)
        const operationObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.duration > 15) { // Reduced from 30ms to catch more operations
                    this.dataManagerMetrics.slowOperations.push({
                        name: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime,
                        timestamp: Date.now(),
                    });

                    // Keep only last 100 slow operations for better tracking
                    if (this.dataManagerMetrics.slowOperations.length > 100) {
                        this.dataManagerMetrics.slowOperations.shift();
                    }

                    // Enhanced logging with categorization
                    if (entry.name.includes('sankey')) {
                        this.logger.warn(`Slow Sankey operation: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
                    } else if (entry.name.includes('query')) {
                        this.logger.warn(`Slow query: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
                    } else if (entry.name.includes('storage') || entry.name.includes('load')) {
                        this.logger.warn(`Slow storage operation: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
                    } else {
                        this.logger.warn(`Slow operation: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
                    }
                }
            }
        });

        if (operationObserver) {
            operationObserver.observe({ entryTypes: ['measure'] });
            this.observers.add(operationObserver);
        }

        // Add memory monitoring for DataManager operations
        this.startDataManagerMemoryMonitoring();
    }

    /**
      * Start memory monitoring specifically for DataManager operations
      */
    startDataManagerMemoryMonitoring() {
        if (performance && performance.memory) {
            this.dataManagerMemoryInterval = setInterval(() => {
                const memoryInfo = performance.memory;
                this.dataManagerMetrics.memoryUsage.push({
                    timestamp: Date.now(),
                    used: memoryInfo.usedJSHeapSize,
                    total: memoryInfo.totalJSHeapSize,
                    limit: memoryInfo.jsHeapSizeLimit,
                });

                // Keep only last 50 measurements
                if (this.dataManagerMetrics.memoryUsage.length > 50) {
                    this.dataManagerMetrics.memoryUsage.shift();
                }
            }, 2000); // Every 2 seconds for DataManager
        }
    }

    /**
     * Start memory monitoring
     */
    startMemoryMonitoring() {
        if (performance && performance.memory) {
            this.memoryMonitoringInterval = setInterval(() => {
                const memoryInfo = performance.memory;
                this.metrics.memoryUsage.push({
                    timestamp: Date.now(),
                    used: memoryInfo.usedJSHeapSize,
                    total: memoryInfo.totalJSHeapSize,
                    limit: memoryInfo.jsHeapSizeLimit,
                });

                // Keep only last 100 measurements
                if (this.metrics.memoryUsage.length > 100) {
                    this.metrics.memoryUsage.shift();
                }
            }, 5000); // Every 5 seconds
        }
    }

    /**
     * Setup performance observers
     */
    setupPerformanceObservers() {
        if ('PerformanceObserver' in window) {
            // Observe long tasks
            const longTaskObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 50) { // Tasks longer than 50ms
                        this.logger.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
                        this.notifyObservers('longTask', {
                            duration: entry.duration,
                            startTime: entry.startTime,
                        });
                    }
                }
            });

            longTaskObserver.observe({ entryTypes: ['longtask'] });

            // Observe layout shifts
            const layoutShiftObserver = new PerformanceObserver((list) => {
                let clsValue = 0;
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                    }
                }

                if (clsValue > 0.1) { // Significant layout shift
                    this.logger.warn(`Layout shift detected: ${clsValue.toFixed(4)}`);
                    this.notifyObservers('layoutShift', { value: clsValue });
                }
            });

            layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });

            this.observers.add(longTaskObserver);
            this.observers.add(layoutShiftObserver);
        }
    }

    /**
     * Measure module load time
     */
    measureModuleLoad(moduleName, startTime) {
        const loadTime = performance.now() - startTime;
        this.metrics.moduleLoadTime.set(moduleName, loadTime);

        this.logger.info(`Module ${moduleName} loaded in ${loadTime.toFixed(2)}ms`);

        if (loadTime > 100) {
            this.logger.warn(`Slow module load: ${moduleName} took ${loadTime.toFixed(2)}ms`);
        }
    }

    /**
     * Measure method execution time
     */
    async measureMethodExecution(methodName, method, context, ...args) {
        if (!this.isEnabled) {
            return method.apply(context, args);
        }

        const startTime = performance.now();
        let result;

        try {
            result = await method.apply(context, args);
        } finally {
            const executionTime = performance.now() - startTime;
            this.metrics.methodExecutionTime.set(methodName, executionTime);

            if (executionTime > 100) {
                this.logger.warn(`Slow method: ${methodName} took ${executionTime.toFixed(2)}ms`);
            }
        }

        return result;
    }

    /**
     * Cache expensive operations
     */
    cache(key, value, ttl = 300000) { // 5 minutes default TTL
        if (!this.isEnabled) {return value;}

        const cacheEntry = {
            value,
            timestamp: Date.now(),
            ttl,
        };

        this.cacheMap.set(key, cacheEntry);

        // Auto-cleanup expired entries
        setTimeout(() => {
            this.cacheMap.delete(key);
        }, ttl);

        return value;
    }

    /**
     * Get cached value
     */
    getCached(key) {
        if (!this.isEnabled) {return null;}

        const entry = this.cacheMap.get(key);
        if (!entry) {
            this.metrics.cacheMisses++;
            return null;
        }

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cacheMap.delete(key);
            this.metrics.cacheMisses++;
            return null;
        }

        this.metrics.cacheHits++;
        return entry.value;
    }

    /**
     * Clear cache
     */
    clearCache(pattern = null) {
        if (pattern) {
            for (const key of this.cacheMap.keys()) {
                if (key.includes(pattern)) {
                    this.cacheMap.delete(key);
                }
            }
        } else {
            this.cacheMap.clear();
        }

        this.logger.info(`Cache cleared${pattern ? ` (pattern: ${pattern})` : ''}`);
    }

    /**
     * Optimize DOM operations
     */
    optimizeDOMOperations() {
        // Use DocumentFragment for bulk DOM operations
        this.createDocumentFragment = (operations) => {
            const fragment = document.createDocumentFragment();
            operations.forEach(op => op(fragment));
            return fragment;
        };

        // Debounce DOM updates
        this.debounceDOMUpdate = (func, wait = 16) => { // ~60fps
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };

        // Batch style updates
        this.batchStyleUpdates = (element, styles) => {
            const currentStyles = element.style.cssText;
            const newStyles = Object.entries(styles)
                .map(([prop, value]) => `${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}:${value}`)
                .join(';');

            element.style.cssText = currentStyles ? `${currentStyles};${newStyles}` : newStyles;
        };
    }

    /**
     * Optimize event handling
     */
    optimizeEventHandling() {
        // Use passive listeners where appropriate
        this.addPassiveEventListener = (element, event, handler, options = {}) => {
            const passiveOptions = { passive: true, ...options };
            element.addEventListener(event, handler, passiveOptions);
        };

        // Debounce event handlers
        this.debounceEvent = (func, wait = 300) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func.apply(this, args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };

        // Throttle event handlers
        this.throttleEvent = (func, limit = 100) => {
            let inThrottle;
            return function executedFunction(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        };
    }

    /**
     * Debounce function
     */
    debounce(func, ms) {
        return this.debounceEvent(func, ms);
    }

    /**
     * Throttle function
     */
    throttle(func, ms) {
        return this.throttleEvent(func, ms);
    }

    /**
     * Measure time of function execution
     */
    async measureTime(func) {
        const start = performance.now();
        const result = await func();
        const time = performance.now() - start;
        return { result, time };
    }

    /**
     * Optimize render with requestAnimationFrame batching
     */
    optimizeRender(callback) {
        if (!this.renderCallbacks) {
            this.renderCallbacks = [];
            this._renderScheduled = false;
        }

        this.renderCallbacks.push(callback);

        if (!this._renderScheduled) {
            this._renderScheduled = true;
            requestAnimationFrame(() => {
                this.renderCallbacks.forEach(cb => {
                    try {
                        cb();
                    } catch (error) {
                        this.logger.error('Error in render callback:', error);
                    }
                });
                this.renderCallbacks = [];
                this._renderScheduled = false;
            });
        }
    }

    /**
     * Optimize data operations
     */
    optimizeDataOperations() {
        // Memoize expensive calculations
        this.memoize = (func, getKey = (...args) => JSON.stringify(args)) => {
            const cache = new Map();
            return (...args) => {
                const key = getKey(...args);
                if (cache.has(key)) {
                    this.metrics.cacheHits++;
                    return cache.get(key);
                }

                this.metrics.cacheMisses++;
                const result = func.apply(this, args);
                cache.set(key, result);
                return result;
            };
        };

        // Lazy load data
        this.lazyLoadData = async (dataLoader, key) => {
            const cached = this.getCached(key);
            if (cached !== null) {
                return cached;
            }

            const data = await dataLoader();
            return this.cache(key, data);
        };
    }

    /**
     * Optimize chart rendering
     */
    optimizeChartRendering() {
        // Use requestAnimationFrame for smooth animations
        this.animateWithRAF = (callback) => {
            const animate = () => {
                callback();
                requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
        };

        // Virtual scrolling for large datasets
        this.createVirtualScroller = (container, items, itemHeight, visibleItems) => {
            let scrollTop = 0;
            const totalHeight = items.length * itemHeight;

            const updateVisibleItems = () => {
                const startIndex = Math.floor(scrollTop / itemHeight);
                const endIndex = Math.min(startIndex + visibleItems, items.length);

                container.innerHTML = '';
                for (let i = startIndex; i < endIndex; i++) {
                    const item = items[i];
                    const itemElement = document.createElement('div');
                    itemElement.style.height = `${itemHeight}px`;
                    itemElement.style.transform = `translateY(${i * itemHeight - scrollTop}px)`;
                    itemElement.textContent = item;
                    container.appendChild(itemElement);
                }
            };

            container.style.height = `${visibleItems * itemHeight}px`;
            container.style.overflow = 'auto';

            container.addEventListener('scroll', (e) => {
                scrollTop = e.target.scrollTop;
                updateVisibleItems();
            });

            updateVisibleItems();
        };
    }

    /**
      * Get performance metrics - ENHANCED with comprehensive DataManager metrics
      */
    getMetrics() {
        const cacheHitRate = (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100;

        // Calculate DataManager specific metrics
        const avgQueryTime = this.dataManagerMetrics.queryTimes.size > 0
            ? Array.from(this.dataManagerMetrics.queryTimes.values()).reduce((a, b) => a + b, 0) / this.dataManagerMetrics.queryTimes.size
            : 0;

        const slowOperationsCount = this.dataManagerMetrics.slowOperations.length;
        const recentSlowOperations = this.dataManagerMetrics.slowOperations.slice(-10); // Last 10 slow operations

        // Calculate memory usage trend
        const memoryTrend = this.dataManagerMetrics.memoryUsage.length > 1
            ? this.dataManagerMetrics.memoryUsage[this.dataManagerMetrics.memoryUsage.length - 1].used -
              this.dataManagerMetrics.memoryUsage[0].used
            : 0;

        // Calculate cache invalidation rate
        const cacheInvalidationRate = this.dataManagerMetrics.cacheInvalidations /
            Math.max(1, (Date.now() - this.dataManagerMetrics.startTime) / 1000);

        return {
            moduleLoadTimes: Object.fromEntries(this.metrics.moduleLoadTime),
            methodExecutionTimes: Object.fromEntries(this.metrics.methodExecutionTime),
            memoryUsage: this.metrics.memoryUsage,
            cacheStats: {
                hits: this.metrics.cacheHits,
                misses: this.metrics.cacheMisses,
                hitRate: isNaN(cacheHitRate) ? 0 : cacheHitRate.toFixed(2) + '%',
                size: this.cacheMap.size,
            },
            dataManagerMetrics: {
                initializationTime: this.dataManagerMetrics.initializationTime,
                averageQueryTime: avgQueryTime.toFixed(2) + 'ms',
                totalQueries: this.dataManagerMetrics.totalQueries,
                slowOperationsCount,
                recentSlowOperations,
                sankeyGenerationTime: this.dataManagerMetrics.sankeyGenerationTime,
                storageLoadTime: this.dataManagerMetrics.storageLoadTime,
                dataReconstructionTime: this.dataManagerMetrics.dataReconstructionTime,
                transactionProcessingTime: this.dataManagerMetrics.transactionProcessingTime,
                cacheInvalidations: this.dataManagerMetrics.cacheInvalidations,
                cacheInvalidationRate: cacheInvalidationRate.toFixed(2) + '/sec',
                memoryTrend: memoryTrend,
                memoryUsage: this.dataManagerMetrics.memoryUsage,
            },
            cacheSize: this.cacheMap.size,
            timestamp: Date.now(),
        };
    }

    /**
      * Record DataManager operation metrics - ENHANCED
      */
    recordDataManagerOperation(operationName, duration) {
        if (operationName.includes('query')) {
            this.dataManagerMetrics.queryTimes.set(operationName, duration);
            this.dataManagerMetrics.totalQueries++;
        } else if (operationName.includes('sankey')) {
            this.dataManagerMetrics.sankeyGenerationTime = duration;
        } else if (operationName.includes('storage') || operationName.includes('load')) {
            this.dataManagerMetrics.storageLoadTime = duration;
        } else if (operationName.includes('reconstruct')) {
            this.dataManagerMetrics.dataReconstructionTime = duration;
        } else if (operationName.includes('transaction') || operationName.includes('process')) {
            this.dataManagerMetrics.transactionProcessingTime = duration;
        }

        // Track cache invalidations
        if (operationName.includes('invalidate') || operationName.includes('clear')) {
            this.dataManagerMetrics.cacheInvalidations++;
        }
    }

    /**
     * Record DataManager initialization time
     */
    recordDataManagerInitialization(duration) {
        this.dataManagerMetrics.initializationTime = duration;
    }

    /**
     * Lazy load implementation for expensive operations
     */
    lazyLoad = (operation, delay = 100) => {
        return new Promise((resolve) => {
            setTimeout(async () => {
                const startTime = performance.now();
                const result = await operation();
                const duration = performance.now() - startTime;

                this.recordDataManagerOperation('lazyLoad', duration);
                resolve(result);
            }, delay);
        });
    }

    /**
     * Batch operations for better performance
     */
    batchOperations = (operations, batchSize = 10) => {
        const batches = [];
        for (let i = 0; i < operations.length; i += batchSize) {
            batches.push(operations.slice(i, i + batchSize));
        }

        return Promise.all(batches.map(async (batch) => {
            const results = await Promise.all(batch.map(op => op()));
            return results;
        }));
    }

    /**
     * Add performance observer
     */
    addObserver(callback) {
        this.observers.add(callback);
    }

    /**
     * Remove performance observer
     */
    removeObserver(callback) {
        this.observers.delete(callback);
    }

    /**
     * Notify observers
     */
    notifyObservers(event, data) {
        this.observers.forEach(observer => {
            if (typeof observer === 'function') {
                observer(event, data);
            }
        });
    }

    /**
     * Enable/disable performance monitoring
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.logger.info(`Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
      * Cleanup resources - ENHANCED
      */
    cleanup() {
        // Clear cache
        this.cacheMap.clear();

        // Disconnect observers
        this.observers.forEach(observer => {
            if (observer && typeof observer.disconnect === 'function') {
                observer.disconnect();
            }
        });
        this.observers.clear();

        // Clear memory monitoring intervals
        if (this.memoryMonitoringInterval) {
            clearInterval(this.memoryMonitoringInterval);
            this.memoryMonitoringInterval = null;
        }

        if (this.dataManagerMemoryInterval) {
            clearInterval(this.dataManagerMemoryInterval);
            this.dataManagerMemoryInterval = null;
        }

        // Clear metrics
        this.metrics.moduleLoadTime.clear();
        this.metrics.methodExecutionTime.clear();
        this.metrics.memoryUsage = [];
        this.metrics.cacheHits = 0;
        this.metrics.cacheMisses = 0;

        // Clear DataManager metrics
        if (this.dataManagerMetrics) {
            this.dataManagerMetrics.queryTimes.clear();
            this.dataManagerMetrics.slowOperations = [];
            this.dataManagerMetrics.memoryUsage = [];
            this.dataManagerMetrics.cacheInvalidations = 0;
        }

        this.logger.info('Performance optimizer cleaned up');
    }

    /**
     * Debug performance information
     */
    debug() {
        const metrics = this.getMetrics();

        this.logger.info('=== PERFORMANCE METRICS ===');
        this.logger.info('Module Load Times:');
        Object.entries(metrics.moduleLoadTimes).forEach(([module, time]) => {
            this.logger.info(`  ${module}: ${time.toFixed(2)}ms`);
        });

        this.logger.info('Method Execution Times:');
        Object.entries(metrics.methodExecutionTimes).forEach(([method, time]) => {
            this.logger.info(`  ${method}: ${time.toFixed(2)}ms`);
        });

        this.logger.info('Cache Stats:');
        this.logger.info(`  Hits: ${metrics.cacheStats.hits}`);
        this.logger.info(`  Misses: ${metrics.cacheStats.misses}`);
        this.logger.info(`  Hit Rate: ${metrics.cacheStats.hitRate}`);
        this.logger.info(`  Size: ${metrics.cacheStats.size}`);

        if (metrics.memoryUsage.length > 0) {
            const latest = metrics.memoryUsage[metrics.memoryUsage.length - 1];
            this.logger.info('Latest Memory Usage:');
            this.logger.info(`  Used: ${(latest.used / 1024 / 1024).toFixed(2)}MB`);
            this.logger.info(`  Total: ${(latest.total / 1024 / 1024).toFixed(2)}MB`);
            this.logger.info(`  Limit: ${(latest.limit / 1024 / 1024).toFixed(2)}MB`);
        }

        this.logger.info('=== END DEBUG ===');
    }
}

// Export for use in other modules
export default PerformanceOptimizer;

// Expose globally for Babel standalone transpilation
window.PerformanceOptimizer = PerformanceOptimizer;
