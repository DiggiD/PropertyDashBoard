/**
 * PerformanceOptimizer Module
 * Optimizes performance across the modular architecture
 * - Memory management and cleanup
 * - Lazy loading and code splitting
 * - Caching strategies
 * - Performance monitoring
 */

class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.observers = new Set();
        this.metrics = {
            moduleLoadTime: new Map(),
            methodExecutionTime: new Map(),
            memoryUsage: [],
            cacheHits: 0,
            cacheMisses: 0,
        };

        this.isEnabled = true;
        console.log('🔧 [PERFORMANCE] PerformanceOptimizer initialized');
    }

    /**
     * Initialize performance optimizer
     */
    async initialize() {
        this.startMemoryMonitoring();
        this.setupPerformanceObservers();

        console.log('🔧 [PERFORMANCE] Performance optimizer initialized');
    }

    /**
     * Start memory monitoring
     */
    startMemoryMonitoring() {
        if ('memory' in performance) {
            setInterval(() => {
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
                        console.warn(`🔧 [PERFORMANCE] Long task detected: ${entry.duration.toFixed(2)}ms`);
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
                    console.warn(`🔧 [PERFORMANCE] Layout shift detected: ${clsValue.toFixed(4)}`);
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

        console.log(`🔧 [PERFORMANCE] Module ${moduleName} loaded in ${loadTime.toFixed(2)}ms`);

        if (loadTime > 100) {
            console.warn(`🔧 [PERFORMANCE] Slow module load: ${moduleName} took ${loadTime.toFixed(2)}ms`);
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
                console.warn(`🔧 [PERFORMANCE] Slow method: ${methodName} took ${executionTime.toFixed(2)}ms`);
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

        this.cache.set(key, cacheEntry);

        // Auto-cleanup expired entries
        setTimeout(() => {
            this.cache.delete(key);
        }, ttl);

        return value;
    }

    /**
     * Get cached value
     */
    getCached(key) {
        if (!this.isEnabled) {return null;}

        const entry = this.cache.get(key);
        if (!entry) {
            this.metrics.cacheMisses++;
            return null;
        }

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
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
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }

        console.log(`🔧 [PERFORMANCE] Cache cleared${pattern ? ` (pattern: ${pattern})` : ''}`);
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
                    func(...args);
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
     * Get performance metrics
     */
    getMetrics() {
        const cacheHitRate = (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100;

        return {
            moduleLoadTimes: Object.fromEntries(this.metrics.moduleLoadTime),
            methodExecutionTimes: Object.fromEntries(this.metrics.methodExecutionTime),
            memoryUsage: this.metrics.memoryUsage,
            cacheStats: {
                hits: this.metrics.cacheHits,
                misses: this.metrics.cacheMisses,
                hitRate: isNaN(cacheHitRate) ? 0 : cacheHitRate.toFixed(2) + '%',
                size: this.cache.size,
            },
            cacheSize: this.cache.size,
        };
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
        console.log(`🔧 [PERFORMANCE] Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Clear cache
        this.cache.clear();

        // Disconnect observers
        this.observers.forEach(observer => {
            if (observer && typeof observer.disconnect === 'function') {
                observer.disconnect();
            }
        });
        this.observers.clear();

        // Clear metrics
        this.metrics.moduleLoadTime.clear();
        this.metrics.methodExecutionTime.clear();
        this.metrics.memoryUsage = [];
        this.metrics.cacheHits = 0;
        this.metrics.cacheMisses = 0;

        console.log('🔧 [PERFORMANCE] Performance optimizer cleaned up');
    }

    /**
     * Debug performance information
     */
    debug() {
        const metrics = this.getMetrics();

        console.log('🔧 [PERFORMANCE DEBUG] === PERFORMANCE METRICS ===');
        console.log('🔧 [PERFORMANCE DEBUG] Module Load Times:');
        Object.entries(metrics.moduleLoadTimes).forEach(([module, time]) => {
            console.log(`🔧 [PERFORMANCE DEBUG]   ${module}: ${time.toFixed(2)}ms`);
        });

        console.log('🔧 [PERFORMANCE DEBUG] Method Execution Times:');
        Object.entries(metrics.methodExecutionTimes).forEach(([method, time]) => {
            console.log(`🔧 [PERFORMANCE DEBUG]   ${method}: ${time.toFixed(2)}ms`);
        });

        console.log('🔧 [PERFORMANCE DEBUG] Cache Stats:');
        console.log(`🔧 [PERFORMANCE DEBUG]   Hits: ${metrics.cacheStats.hits}`);
        console.log(`🔧 [PERFORMANCE DEBUG]   Misses: ${metrics.cacheStats.misses}`);
        console.log(`🔧 [PERFORMANCE DEBUG]   Hit Rate: ${metrics.cacheStats.hitRate}`);
        console.log(`🔧 [PERFORMANCE DEBUG]   Size: ${metrics.cacheStats.size}`);

        if (metrics.memoryUsage.length > 0) {
            const latest = metrics.memoryUsage[metrics.memoryUsage.length - 1];
            console.log('🔧 [PERFORMANCE DEBUG] Latest Memory Usage:');
            console.log(`🔧 [PERFORMANCE DEBUG]   Used: ${(latest.used / 1024 / 1024).toFixed(2)}MB`);
            console.log(`🔧 [PERFORMANCE DEBUG]   Total: ${(latest.total / 1024 / 1024).toFixed(2)}MB`);
            console.log(`🔧 [PERFORMANCE DEBUG]   Limit: ${(latest.limit / 1024 / 1024).toFixed(2)}MB`);
        }

        console.log('🔧 [PERFORMANCE DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
} else {
    window.PerformanceOptimizer = PerformanceOptimizer;
}
