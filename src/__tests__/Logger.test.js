/**
 * Jest unit tests for Logger module
 * Tests logging functionality, level management, and specialized logging methods
 */

// Import the Logger class and create a fresh instance for each test
import { Logger } from '../modules/utils/Logger.js';

// Create a fresh logger instance for testing
let logger;

beforeEach(() => {
    logger = new Logger();
});

describe('Logger', () => {
    let consoleSpy;

    beforeEach(() => {
        // Create fresh logger instance for each test
        logger = new Logger();

        // Clear any existing spies
        jest.clearAllMocks();

        // Spy on console methods
        consoleSpy = {
            error: jest.spyOn(console, 'error').mockImplementation(() => {}),
            warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
            log: jest.spyOn(console, 'log').mockImplementation(() => {}),
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor and Initialization', () => {
        test('should initialize with correct default values', () => {
            expect(logger.levels).toEqual({
                ERROR: 0,
                WARN: 1,
                INFO: 2,
                DEBUG: 3
            });
            expect(logger.currentLevel).toBe(2); // INFO level
            expect(logger.debugMode).toBe(false);
            expect(logger.logCache).toBeInstanceOf(Map);
            expect(logger.cacheTimeout).toBe(5000);
            expect(logger.elementCacheStats).toEqual({
                total: 0,
                found: 0,
                missing: 0,
                warnings: 0
            });
        });

        test('should create log cache as Map instance', () => {
            expect(logger.logCache).toBeInstanceOf(Map);
            expect(logger.logCache.size).toBe(0);
        });
    });

    describe('Log Level Management', () => {
        test('setLevel() should update current level for valid levels', () => {
            logger.setLevel('ERROR');
            expect(logger.currentLevel).toBe(0);

            logger.setLevel('WARN');
            expect(logger.currentLevel).toBe(1);

            logger.setLevel('INFO');
            expect(logger.currentLevel).toBe(2);

            logger.setLevel('DEBUG');
            expect(logger.currentLevel).toBe(3);
        });

        test('setLevel() should ignore invalid levels', () => {
            const originalLevel = logger.currentLevel;
            logger.setLevel('INVALID');
            expect(logger.currentLevel).toBe(originalLevel);
        });

        test('setDebugMode() should enable debug mode and set DEBUG level', () => {
            logger.setDebugMode(true);
            expect(logger.debugMode).toBe(true);
            expect(logger.currentLevel).toBe(3); // DEBUG level
        });

        test('setDebugMode() should disable debug mode and set INFO level', () => {
            logger.setDebugMode(true); // First enable
            logger.setDebugMode(false); // Then disable
            expect(logger.debugMode).toBe(false);
            expect(logger.currentLevel).toBe(2); // INFO level
        });

        test('shouldLog() should return true for levels at or below current level', () => {
            logger.setLevel('ERROR');
            expect(logger.shouldLog(0)).toBe(true); // ERROR
            expect(logger.shouldLog(1)).toBe(false); // WARN
            expect(logger.shouldLog(2)).toBe(false); // INFO
            expect(logger.shouldLog(3)).toBe(false); // DEBUG

            logger.setLevel('DEBUG');
            expect(logger.shouldLog(0)).toBe(true); // ERROR
            expect(logger.shouldLog(1)).toBe(true); // WARN
            expect(logger.shouldLog(2)).toBe(true); // INFO
            expect(logger.shouldLog(3)).toBe(true); // DEBUG
        });
    });

    describe('Message Formatting', () => {
        test('formatMessage() should format message with timestamp and prefix', () => {
            const message = logger.formatMessage('INFO', 'TEST', 'Test message');
            expect(message).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[INFO\] \[TEST\] Test message$/);
        });

        test('formatMessage() should handle different log levels', () => {
            const errorMsg = logger.formatMessage('ERROR', 'MODULE', 'Error occurred');
            expect(errorMsg).toContain('[ERROR]');
            expect(errorMsg).toContain('[MODULE]');
            expect(errorMsg).toContain('Error occurred');

            const debugMsg = logger.formatMessage('DEBUG', 'TEST', 'Debug info');
            expect(debugMsg).toContain('[DEBUG]');
            expect(debugMsg).toContain('[TEST]');
            expect(debugMsg).toContain('Debug info');
        });
    });

    describe('Core Logging Methods', () => {
        test('log() should call console methods based on level', () => {
            logger.setLevel('DEBUG');

            logger.log(0, 'ERROR', 'TEST', 'Error message');
            expect(consoleSpy.error).toHaveBeenCalled();

            logger.log(1, 'WARN', 'TEST', 'Warning message');
            expect(consoleSpy.warn).toHaveBeenCalled();

            logger.log(2, 'INFO', 'TEST', 'Info message');
            expect(consoleSpy.log).toHaveBeenCalled();

            logger.log(3, 'DEBUG', 'TEST', 'Debug message');
            expect(consoleSpy.log).toHaveBeenCalled();
        });

        test('log() should not log when level is below current level', () => {
            logger.setLevel('ERROR');

            logger.log(1, 'WARN', 'TEST', 'Warning message');
            logger.log(2, 'INFO', 'TEST', 'Info message');
            logger.log(3, 'DEBUG', 'TEST', 'Debug message');

            expect(consoleSpy.warn).not.toHaveBeenCalled();
            expect(consoleSpy.log).not.toHaveBeenCalled();
        });

        test('log() should handle data parameter', () => {
            logger.setLevel('DEBUG');

            const testData = { key: 'value' };
            logger.log(2, 'INFO', 'TEST', 'Message with data', testData);

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Message with data'),
                testData
            );
        });
    });

    describe('Specific Log Methods', () => {
        beforeEach(() => {
            logger.setLevel('DEBUG');
        });

        test('error() should log error messages', () => {
            logger.error('TEST', 'Error message');
            expect(consoleSpy.error).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR] [TEST] Error message')
            );
        });

        test('error() should log error messages with data', () => {
            const errorData = new Error('Test error');
            logger.error('TEST', 'Error message', errorData);
            expect(consoleSpy.error).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR]'),
                errorData
            );
        });

        test('warn() should log warning messages', () => {
            logger.warn('TEST', 'Warning message');
            expect(consoleSpy.warn).toHaveBeenCalledWith(
                expect.stringContaining('[WARN] [TEST] Warning message')
            );
        });

        test('info() should log info messages', () => {
            logger.info('TEST', 'Info message');
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('[INFO] [TEST] Info message')
            );
        });

        test('debug() should log debug messages', () => {
            logger.debug('TEST', 'Debug message');
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('[DEBUG] [TEST] Debug message')
            );
        });
    });

    describe('Element Caching Methods', () => {
        beforeEach(() => {
            logger.setLevel('DEBUG');
        });

        test('logElementCache() should update stats and log in debug mode', () => {
            logger.setDebugMode(true);

            logger.logElementCache('testElement', '.test-class', true);
            expect(logger.elementCacheStats.total).toBe(1);
            expect(logger.elementCacheStats.found).toBe(1);
            expect(logger.elementCacheStats.missing).toBe(0);
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Cached element: testElement')
            );

            logger.logElementCache('missingElement', '.missing-class', false);
            expect(logger.elementCacheStats.total).toBe(2);
            expect(logger.elementCacheStats.found).toBe(1);
            expect(logger.elementCacheStats.missing).toBe(1);
        });

        test('logElementCache() should not log individual elements when not in debug mode', () => {
            logger.setDebugMode(false);

            logger.logElementCache('testElement', '.test-class', true);
            expect(logger.elementCacheStats.total).toBe(1);
            expect(logger.elementCacheStats.found).toBe(1);
            // Should not call console.log for individual element caching
            expect(consoleSpy.log).not.toHaveBeenCalled();
        });

        test('logElementWarning() should update warning stats and always log', () => {
            logger.logElementWarning('missingElement', '.missing-class');

            expect(logger.elementCacheStats.warnings).toBe(1);
            expect(consoleSpy.warn).toHaveBeenCalledWith(
                expect.stringContaining('Element not found: missingElement')
            );
        });

        test('flushElementCacheLogs() should log summary and reset stats', () => {
            logger.elementCacheStats = {
                total: 5,
                found: 3,
                missing: 2,
                warnings: 1
            };

            logger.flushElementCacheLogs('TEST');

            expect(consoleSpy.warn).toHaveBeenCalledWith(
                expect.stringContaining('Cached 3/5 elements (2 missing)')
            );
            expect(logger.elementCacheStats.total).toBe(0);
            expect(logger.elementCacheStats.found).toBe(0);
            expect(logger.elementCacheStats.missing).toBe(0);
            expect(logger.elementCacheStats.warnings).toBe(0);
        });

        test('flushElementCacheLogs() should log success when no missing elements', () => {
            logger.elementCacheStats = {
                total: 3,
                found: 3,
                missing: 0,
                warnings: 0
            };

            logger.flushElementCacheLogs('TEST');

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Cached 3/3 elements')
            );
        });

        test('flushElementCacheLogs() should not log when no elements cached', () => {
            logger.flushElementCacheLogs('TEST');

            expect(consoleSpy.log).not.toHaveBeenCalled();
            expect(consoleSpy.warn).not.toHaveBeenCalled();
        });
    });

    describe('Specialized Logging Methods', () => {
        beforeEach(() => {
            logger.setLevel('DEBUG');
        });

        test('logInitStep() should log initialization steps', () => {
            logger.logInitStep('TEST', 'Database connection', true);
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Starting Database connection')
            );

            logger.logInitStep('TEST', 'Database connection', false);
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Database connection complete')
            );
        });

        test('logModuleInit() should log module initialization with timing', () => {
            const startTime = Date.now() - 100;
            logger.logModuleInit('TEST', true, startTime);

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringMatching(/Module initialized successfully \(\d+ms\)/)
            );
        });

        test('logModuleInit() should log failure without timing', () => {
            logger.logModuleInit('TEST', false);

            expect(consoleSpy.error).toHaveBeenCalledWith(
                expect.stringContaining('Module initialization failed')
            );
        });

        test('logDataOperation() should log operation in debug mode', () => {
            logger.setDebugMode(true);

            const stats = { records: 10, duration: 50 };
            logger.logDataOperation('TEST', 'Data load', stats);

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Data load completed'),
                stats
            );
        });

        test('logDataOperation() should log operation summary in non-debug mode', () => {
            logger.setDebugMode(false);

            const stats = { records: 10, duration: 50 };
            logger.logDataOperation('TEST', 'Data load', stats);

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Data load completed')
            );
            expect(consoleSpy.log).not.toHaveBeenCalledWith(
                expect.anything(),
                stats
            );
        });

        test('logPerformance() should log performance in debug mode', () => {
            logger.setDebugMode(true);

            logger.logPerformance('TEST', 'Database query', 150);

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Database query took 150ms')
            );
        });

        test('logPerformance() should log performance with metadata in debug mode', () => {
            logger.setDebugMode(true);

            const metadata = { records: 100, cacheHit: true };
            logger.logPerformance('TEST', 'Database query', 150, metadata);

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Database query took 150ms'),
                metadata
            );
        });

        test('logPerformance() should not log in non-debug mode', () => {
            logger.setDebugMode(false);

            logger.logPerformance('TEST', 'Database query', 150);

            expect(consoleSpy.log).not.toHaveBeenCalled();
        });
    });

    describe('Module Logger Creation', () => {
        test('createModuleLogger() should create logger with bound methods', () => {
            const moduleLogger = logger.createModuleLogger('TESTMODULE');

            expect(typeof moduleLogger.error).toBe('function');
            expect(typeof moduleLogger.warn).toBe('function');
            expect(typeof moduleLogger.info).toBe('function');
            expect(typeof moduleLogger.debug).toBe('function');
            expect(typeof moduleLogger.logElementCache).toBe('function');
            expect(typeof moduleLogger.logElementWarning).toBe('function');
            expect(typeof moduleLogger.logInitStep).toBe('function');
            expect(typeof moduleLogger.logModuleInit).toBe('function');
            expect(typeof moduleLogger.logDataOperation).toBe('function');
            expect(typeof moduleLogger.logPerformance).toBe('function');
        });

        test('createModuleLogger() should bind methods to correct module', () => {
            logger.setLevel('DEBUG');
            const moduleLogger = logger.createModuleLogger('TESTMODULE');

            moduleLogger.info('Test message');

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('[TESTMODULE] Test message')
            );
        });

        test('createModuleLogger() should pass data to logging methods', () => {
            logger.setLevel('DEBUG');
            const moduleLogger = logger.createModuleLogger('TESTMODULE');
            const testData = { key: 'value' };

            moduleLogger.debug('Debug message', testData);

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('[TESTMODULE]'),
                testData
            );
        });
    });

    describe('Configuration Management', () => {
        test('getConfig() should return current configuration', () => {
            logger.setLevel('ERROR');
            logger.setDebugMode(true);

            const config = logger.getConfig();

            expect(config.currentLevel).toBe('DEBUG'); // Debug mode overrides level
            expect(config.debugMode).toBe(true);
            expect(config.cacheEnabled).toBe(false); // Empty cache
            expect(config.elementCacheStats).toEqual(logger.elementCacheStats);
        });

        test('getConfig() should detect cache state', () => {
            logger.logCache.set('test', 'value');

            const config = logger.getConfig();

            expect(config.cacheEnabled).toBe(true);
        });

        test('clearCaches() should clear log cache and reset element stats', () => {
            logger.logCache.set('test1', 'value1');
            logger.logCache.set('test2', 'value2');
            logger.elementCacheStats = {
                total: 5,
                found: 3,
                missing: 2,
                warnings: 1
            };

            logger.clearCaches();

            expect(logger.logCache.size).toBe(0);
            expect(logger.elementCacheStats).toEqual({
                total: 0,
                found: 0,
                missing: 0,
                warnings: 0
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle null/undefined data in logging methods', () => {
            logger.setLevel('DEBUG');

            logger.error('TEST', 'Error message', null);
            logger.warn('TEST', 'Warning message', undefined);
            logger.info('TEST', 'Info message', null);
            logger.debug('TEST', 'Debug message', undefined);

            expect(consoleSpy.error).toHaveBeenCalled();
            expect(consoleSpy.warn).toHaveBeenCalled();
            expect(consoleSpy.log).toHaveBeenCalledTimes(2);
        });

        test('should handle empty module names', () => {
            logger.setLevel('DEBUG');

            logger.info('', 'Empty module message');
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Empty module message')
            );
        });

        test('should handle empty messages', () => {
            logger.setLevel('DEBUG');

            logger.info('TEST', '');
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('[TEST]')
            );
        });

        test('should handle special characters in messages', () => {
            logger.setLevel('DEBUG');

            logger.info('TEST', 'Message with émojis 🚀 and spëcial châractérs');
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Message with émojis 🚀 and spëcial châractérs')
            );
        });

        test('should handle very long messages', () => {
            logger.setLevel('DEBUG');

            const longMessage = 'A'.repeat(10000);
            logger.info('TEST', longMessage);

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining(longMessage)
            );
        });
    });

    describe('Integration Tests', () => {
        test('should work correctly with different log levels and debug modes', () => {
            // Test ERROR level only - should only log ERROR messages
            logger.setLevel('ERROR');

            logger.error('TEST', 'Error message');
            logger.warn('TEST', 'Warning message');
            logger.info('TEST', 'Info message');
            logger.debug('TEST', 'Debug message');

            expect(consoleSpy.error).toHaveBeenCalledTimes(1);
            expect(consoleSpy.warn).not.toHaveBeenCalled(); // Warning should not be called since ERROR level is set
            expect(consoleSpy.log).not.toHaveBeenCalled(); // Info message should not be called since ERROR level is set
        });

        test('should work correctly with WARN level', () => {
            // Test WARN level - should log ERROR and WARN messages
            logger.setLevel('WARN');

            logger.error('TEST', 'Error message 2');
            logger.warn('TEST', 'Warning message 2');
            logger.info('TEST', 'Info message 2');
            logger.debug('TEST', 'Debug message 2');

            expect(consoleSpy.error).toHaveBeenCalledTimes(1);
            expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
            expect(consoleSpy.log).not.toHaveBeenCalled(); // Info should not be called since WARN level is set
        });

        test('should handle module logger creation and usage', () => {
            logger.setLevel('DEBUG');
            const moduleLogger = logger.createModuleLogger('TESTMODULE');

            // Test all module logger methods
            moduleLogger.error('Error from module');
            moduleLogger.warn('Warning from module');
            moduleLogger.info('Info from module');
            moduleLogger.debug('Debug from module');

            expect(consoleSpy.error).toHaveBeenCalledWith(
                expect.stringContaining('[TESTMODULE] Error from module')
            );
            expect(consoleSpy.warn).toHaveBeenCalledWith(
                expect.stringContaining('[TESTMODULE] Warning from module')
            );
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('[TESTMODULE] Info from module')
            );
        });

        test('should handle element cache consolidation correctly', () => {
            logger.setDebugMode(true);

            // Log several element cache operations
            logger.logElementCache('elem1', '.class1', true);
            logger.logElementCache('elem2', '.class2', false);
            logger.logElementCache('elem3', '.class3', true);
            logger.logElementWarning('elem4', '.class4');

            expect(logger.elementCacheStats.total).toBe(3);
            expect(logger.elementCacheStats.found).toBe(2);
            expect(logger.elementCacheStats.missing).toBe(1);
            expect(logger.elementCacheStats.warnings).toBe(1);

            // Flush logs
            logger.flushElementCacheLogs('UI');

            expect(consoleSpy.warn).toHaveBeenCalledWith(
                expect.stringContaining('Cached 2/3 elements (1 missing)')
            );
        });
    });
});