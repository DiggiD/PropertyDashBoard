/**
 * Centralized Logging Utility * Provides configurable logging with different levels and debug mode support
 */
class Logger {
    constructor() {
        // Log levels in order of severity (lower number = more severe)
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };

        // Current log level - can be configured
        this.currentLevel = this.levels.INFO;

        // Debug mode flag - can be enabled/disabled
        this.debugMode = false;

        // Cache for consolidated logs
        this.logCache = new Map();
        this.cacheTimeout = 5000; // 5 seconds

        // Track element caching for consolidation
        this.elementCacheStats = {
            total: 0,
            found: 0,
            missing: 0,
            warnings: 0
        };
    }

    /**
     * Set the minimum log level to display
     * @param {string} level - 'ERROR', 'WARN', 'INFO', 'DEBUG'
     */
    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.currentLevel = this.levels[level];
        }
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether debug mode is enabled
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (enabled) {
            this.currentLevel = this.levels.DEBUG;
        } else {
            this.currentLevel = this.levels.INFO;
        }
    }

    /**
     * Check if a log level should be displayed
     * @param {number} level - Log level to check
     * @returns {boolean} Whether to display the log
     */
    shouldLog(level) {
        return level <= this.currentLevel;
    }

    /**
     * Format log message with timestamp and prefix
     * @param {string} level - Log level name
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @returns {string} Formatted message
     */
    formatMessage(level, module, message) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        return `[${timestamp}] [${level}] [${module}] ${message}`;
    }

    /**
     * Core logging method
     * @param {number} level - Log level
     * @param {string} levelName - Log level name for display
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {*} data - Optional data to log
     */
    log(level, levelName, module, message, data = null) {
        if (!this.shouldLog(level)) {
            return;
        }

        const formattedMessage = this.formatMessage(levelName, module, message);

        switch (level) {
            case this.levels.ERROR:
                if (data) {
                    console.error(formattedMessage, data);
                } else {
                    console.error(formattedMessage);
                }
                break;
            case this.levels.WARN:
                if (data) {
                    console.warn(formattedMessage, data);
                } else {
                    console.warn(formattedMessage);
                }
                break;
            case this.levels.INFO:
                if (data) {
                    console.log(formattedMessage, data);
                } else {
                    console.log(formattedMessage);
                }
                break;
            case this.levels.DEBUG:
                if (data) {
                    console.log(formattedMessage, data);
                } else {
                    console.log(formattedMessage);
                }
                break;
        }
    }

    /**
     * Error level logging
     * @param {string} module - Module name
     * @param {string} message - Error message
     * @param {*} data - Optional error data
     */
    error(module, message, data = null) {
        this.log(this.levels.ERROR, 'ERROR', module, message, data);
    }

    /**
     * Warning level logging
     * @param {string} module - Module name
     * @param {string} message - Warning message
     * @param {*} data - Optional warning data
     */
    warn(module, message, data = null) {
        this.log(this.levels.WARN, 'WARN', module, message, data);
    }

    /**
     * Info level logging
     * @param {string} module - Module name
     * @param {string} message - Info message
     * @param {*} data - Optional info data
     */
    info(module, message, data = null) {
        this.log(this.levels.INFO, 'INFO', module, message, data);
    }

    /**
     * Debug level logging
     * @param {string} module - Module name
     * @param {string} message - Debug message
     * @param {*} data - Optional debug data
     */
    debug(module, message, data = null) {
        this.log(this.levels.DEBUG, 'DEBUG', module, message, data);
    }

    /**
     * Log element caching for consolidation
     * @param {string} elementKey - Element key
     * @param {string} selector - CSS selector
     * @param {boolean} found - Whether element was found
     */
    logElementCache(elementKey, selector, found) {
        this.elementCacheStats.total++;

        if (found) {
            this.elementCacheStats.found++;
        } else {
            this.elementCacheStats.missing++;
        }

        // Only log individual elements in debug mode
        if (this.debugMode) {
            this.debug('UI', `Cached element: ${elementKey} -> ${selector}`);
        }
    }

    /**
     * Log element caching warning for consolidation
     * @param {string} elementKey - Element key
     * @param {string} selector - CSS selector
     */
    logElementWarning(elementKey, selector) {
        this.elementCacheStats.warnings++;

        // Always show warnings
        this.warn('UI', `Element not found: ${elementKey} -> ${selector}`);
    }

    /**
     * Flush consolidated element cache logs
     * @param {string} module - Module name
     */
    flushElementCacheLogs(module = 'UI') {
        if (this.elementCacheStats.total > 0) {
            const summary = `Cached ${this.elementCacheStats.found}/${this.elementCacheStats.total} elements`;
            if (this.elementCacheStats.missing > 0) {
                this.warn(module, `${summary} (${this.elementCacheStats.missing} missing)`);
            } else {
                this.info(module, summary);
            }

            // Reset stats
            this.elementCacheStats = {
                total: 0,
                found: 0,
                missing: 0,
                warnings: 0
            };
        }
    }

    /**
     * Log initialization step
     * @param {string} module - Module name
     * @param {string} step - Initialization step
     * @param {boolean} isStart - Whether this is the start or completion
     */
    logInitStep(module, step, isStart = true) {
        const message = isStart ? `Starting ${step}...` : `${step} complete`;
        this.info(module, message);
    }

    /**
     * Log module initialization with timing
     * @param {string} module - Module name
     * @param {boolean} success - Whether initialization was successful
     * @param {number} startTime - Start time (optional)
     */
    logModuleInit(module, success, startTime = null) {
        if (success) {
            if (startTime) {
                const duration = Date.now() - startTime;
                this.info(module, `Module initialized successfully (${duration}ms)`);
            } else {
                this.info(module, 'Module initialized successfully');
            }
        } else {
            this.error(module, 'Module initialization failed');
        }
    }

    /**
     * Log data operation summary
     * @param {string} module - Module name
     * @param {string} operation - Operation name
     * @param {Object} stats - Operation statistics
     */
    logDataOperation(module, operation, stats) {
        if (this.debugMode) {
            this.debug(module, `${operation} completed:`, stats);
        } else {
            this.info(module, `${operation} completed`);
        }
    }

    /**
     * Log performance metrics
     * @param {string} module - Module name
     * @param {string} operation - Operation name
     * @param {number} duration - Duration in milliseconds
     * @param {Object} metadata - Additional metadata
     */
    logPerformance(module, operation, duration, metadata = null) {
        if (this.debugMode) {
            const message = `${operation} took ${duration}ms`;
            if (metadata) {
                this.debug(module, message, metadata);
            } else {
                this.debug(module, message);
            }
        }
    }

    /**
     * Create a module-specific logger
     * @param {string} moduleName - Name of the module
     * @returns {Object} Module logger with bound methods
     */
    createModuleLogger(moduleName) {
        return {
            error: (message, data) => this.error(moduleName, message, data),
            warn: (message, data) => this.warn(moduleName, message, data),
            info: (message, data) => this.info(moduleName, message, data),
            debug: (message, data) => this.debug(moduleName, message, data),
            logElementCache: (key, selector, found) => this.logElementCache(key, selector, found),
            logElementWarning: (key, selector) => this.logElementWarning(key, selector),
            logInitStep: (step, isStart) => this.logInitStep(moduleName, step, isStart),
            logModuleInit: (success, startTime) => this.logModuleInit(moduleName, success, startTime),
            logDataOperation: (operation, stats) => this.logDataOperation(moduleName, operation, stats),
            logPerformance: (operation, duration, metadata) => this.logPerformance(moduleName, operation, duration, metadata)
        };
    }

    /**
     * Get current configuration
     * @returns {Object} Current logger configuration
     */
    getConfig() {
        return {
            currentLevel: Object.keys(this.levels).find(key => this.levels[key] === this.currentLevel),
            debugMode: this.debugMode,
            cacheEnabled: this.logCache.size > 0,
            elementCacheStats: { ...this.elementCacheStats }
        };
    }

    /**
     * Clear all caches and reset stats
     */
    clearCaches() {
        this.logCache.clear();
        this.elementCacheStats = {
            total: 0,
            found: 0,
            missing: 0,
            warnings: 0
        };
    }
}

// Create global logger instance
const logger = new Logger();

// Export for use in other modules
export default logger;

// Export the class for testing
export { Logger };

// Expose globally for easy access (if window is available)
if (typeof window !== 'undefined') {
    window.logger = logger;
}