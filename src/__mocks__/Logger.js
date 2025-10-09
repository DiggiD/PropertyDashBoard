/**
 * Logger mock for testing
 * Provides mock implementations of all Logger methods
 */

const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    logPerformance: jest.fn(),
    logModuleInit: jest.fn(),
    logInitStep: jest.fn(),
    logDataOperation: jest.fn(),
    createModuleLogger: jest.fn((moduleName) => ({
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        logPerformance: jest.fn(),
        logModuleInit: jest.fn(),
        logInitStep: jest.fn(),
        logDataOperation: jest.fn(),
        logElementCache: jest.fn(),
        logElementWarning: jest.fn(),
    })),
    setLevel: jest.fn(),
    setDebugMode: jest.fn(),
    shouldLog: jest.fn(),
    formatMessage: jest.fn(),
    log: jest.fn(),
    logElementCache: jest.fn(),
    logElementWarning: jest.fn(),
    flushElementCacheLogs: jest.fn(),
    getConfig: jest.fn(),
    clearCaches: jest.fn(),
};

// Export as default (matching the real Logger export)
export default mockLogger;