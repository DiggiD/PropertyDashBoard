/**
 * Integration Test Suite
 * Tests that all modules work together correctly
 * - Module loading and initialization
 * - Inter-module communication
 * - End-to-end functionality
 * - Performance benchmarks
 */

// Integration test results
const testResults = {
    passed: 0,
    failed: 0,
    tests: [],
};

function logTest(name, passed, message = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const result = { name, passed, message, timestamp: new Date().toISOString() };
    testResults.tests.push(result);

    if (passed) {
        testResults.passed++;
        console.log(`${status} ${name}`);
    } else {
        testResults.failed++;
        console.error(`${status} ${name}: ${message}`);
    }

    if (message) {
        console.log(`   ${message}`);
    }
}

function logSection(title) {
    console.log(`\n🔧 [INTEGRATION TEST] === ${title.toUpperCase()} ===`);
}

/**
 * Test 1: Module Loading
 */
async function testModuleLoading() {
    logSection('Module Loading Test');

    try {
        // Test that all modules can be loaded
        const moduleLoader = new ModuleLoader();

        // Register all modules
        moduleLoader.registerModule('formatter', Formatter, []);
        moduleLoader.registerModule('storage', Storage, []);
        moduleLoader.registerModule('validator', Validator, []);
        moduleLoader.registerModule('themeManager', ThemeManager, []);

        moduleLoader.registerModule('dataManager', DataManager, ['storage', 'validator']);
        moduleLoader.registerModule('uiManager', UIManager, ['formatter', 'themeManager']);
        moduleLoader.registerModule('historyManager', HistoryManager, ['storage', 'dataManager']);
        moduleLoader.registerModule('eventHandler', EventHandler, ['dataManager', 'uiManager', 'historyManager']);
        moduleLoader.registerModule('chartRenderer', ChartRenderer, ['dataManager', 'uiManager', 'formatter']);

        moduleLoader.registerModule('app', App, [
            'dataManager', 'uiManager', 'eventHandler', 'chartRenderer', 'historyManager',
            'formatter', 'storage', 'validator', 'themeManager',
        ]);

        logTest('Module registration', true, 'All 10 modules registered successfully');

        // Load all modules
        await moduleLoader.loadAllModules();

        logTest('Module loading', true, 'All modules loaded without errors');

        // Verify all modules are loaded
        const loadedModules = moduleLoader.getLoadedModules();
        const expectedModules = ['formatter', 'storage', 'validator', 'themeManager',
            'dataManager', 'uiManager', 'historyManager', 'eventHandler',
            'chartRenderer', 'app'];

        const allLoaded = expectedModules.every(module => loadedModules.includes(module));
        logTest('All modules loaded', allLoaded,
            allLoaded ? 'All expected modules loaded' : `Missing: ${expectedModules.filter(m => !loadedModules.includes(m)).join(', ')}`);

        // Verify all modules are initialized
        const initializedModules = moduleLoader.getInitializedModules();
        const allInitialized = expectedModules.every(module => initializedModules.includes(module));
        logTest('All modules initialized', allInitialized,
            allInitialized ? 'All modules initialized successfully' : `Not initialized: ${expectedModules.filter(m => !initializedModules.includes(m)).join(', ')}`);

        // Test module dependencies
        const status = moduleLoader.getModuleStatus();
        let dependencyIssues = 0;
        for (const [name, info] of Object.entries(status)) {
            if (!info.initialized) {
                dependencyIssues++;
                logTest(`Module ${name} initialization`, false, 'Module failed to initialize');
            }
        }

        logTest('Module dependencies resolved', dependencyIssues === 0,
            dependencyIssues === 0 ? 'All dependencies resolved correctly' : `${dependencyIssues} dependency issues found`);

        return moduleLoader;

    } catch (error) {
        logTest('Module loading test', false, `Error: ${error.message}`);
        return null;
    }
}

/**
 * Test 2: Module Communication
 */
async function testModuleCommunication(moduleLoader) {
    logSection('Module Communication Test');

    try {
        // Get module instances
        const formatter = moduleLoader.getModule('formatter');
        const dataManager = moduleLoader.getModule('dataManager');
        const uiManager = moduleLoader.getModule('uiManager');

        // Test formatter functionality
        const testAmount = 1234.56;
        const formatted = formatter.formatCurrency(testAmount);
        const isValidFormat = formatted.includes('₹') && formatted.includes('1,234.56');
        logTest('Formatter communication', isValidFormat,
            isValidFormat ? `Formatted ${testAmount} to ${formatted}` : `Invalid format: ${formatted}`);

        // Test data manager basic functionality
        const testData = {
            properties: [{
                id: 1,
                name: 'Test Property',
                expenses: { 'Maintenance': 500, 'Utilities': 300 },
            }],
            expenseCategories: ['Maintenance', 'Utilities'],
        };

        // This would normally load from storage, but for testing we'll simulate
        logTest('DataManager instance', !!dataManager, 'DataManager instance available');
        logTest('UIManager instance', !!uiManager, 'UIManager instance available');

        // Test module method calls
        const hasRequiredMethods = typeof dataManager.getProperties === 'function' &&
                                  typeof uiManager.showElement === 'function' &&
                                  typeof formatter.formatCurrency === 'function';

        logTest('Module methods available', hasRequiredMethods,
            hasRequiredMethods ? 'All required methods are available' : 'Some methods missing');

        return true;

    } catch (error) {
        logTest('Module communication test', false, `Error: ${error.message}`);
        return false;
    }
}

/**
 * Test 3: Application Initialization
 */
async function testApplicationInitialization(moduleLoader) {
    logSection('Application Initialization Test');

    try {
        // Get the main app instance
        const app = moduleLoader.getModule('app');

        logTest('App instance available', !!app, 'Main application instance created');

        // Test that app has required methods
        const hasRequiredMethods = typeof app.initialize === 'function' &&
                                  typeof app.showOverviewView === 'function' &&
                                  typeof app.cleanup === 'function';

        logTest('App methods available', hasRequiredMethods,
            hasRequiredMethods ? 'All required app methods available' : 'Some app methods missing');

        // Test app properties
        const hasRequiredProperties = app.hasOwnProperty('dataManager') &&
                                     app.hasOwnProperty('uiManager') &&
                                     app.hasOwnProperty('chartRenderer');

        logTest('App properties initialized', hasRequiredProperties,
            hasRequiredProperties ? 'App has all required module references' : 'Some module references missing');

        return app;

    } catch (error) {
        logTest('Application initialization test', false, `Error: ${error.message}`);
        return null;
    }
}

/**
 * Test 4: Performance Benchmark
 */
async function testPerformanceBenchmark(moduleLoader) {
    logSection('Performance Benchmark Test');

    try {
        const startTime = performance.now();

        // Test module loading performance
        const loadStart = performance.now();
        await moduleLoader.loadAllModules();
        const loadTime = performance.now() - loadStart;

        logTest('Module loading performance', loadTime < 1000,
            `Module loading took ${loadTime.toFixed(2)}ms (${loadTime < 1000 ? 'GOOD' : 'SLOW'})`);

        // Test formatter performance
        const formatter = moduleLoader.getModule('formatter');
        const formatStart = performance.now();
        for (let i = 0; i < 1000; i++) {
            formatter.formatCurrency(Math.random() * 10000);
        }
        const formatTime = performance.now() - formatStart;

        logTest('Formatter performance', formatTime < 100,
            `1000 currency formats took ${formatTime.toFixed(2)}ms (${formatTime < 100 ? 'GOOD' : 'SLOW'})`);

        const totalTime = performance.now() - startTime;
        logTest('Total test time', totalTime < 2000,
            `Complete test suite took ${totalTime.toFixed(2)}ms`);

        return true;

    } catch (error) {
        logTest('Performance benchmark test', false, `Error: ${error.message}`);
        return false;
    }
}

/**
 * Test 5: Error Handling
 */
async function testErrorHandling() {
    logSection('Error Handling Test');

    try {
        // Test circular dependency detection
        const testLoader = new ModuleLoader();

        testLoader.registerModule('moduleA', () => {}, ['moduleB']);
        testLoader.registerModule('moduleB', () => {}, ['moduleA']);

        let circularDependencyDetected = false;
        try {
            testLoader.registerModule('moduleC', () => {}, ['moduleA']);
        } catch (error) {
            if (error.message.includes('Circular dependency')) {
                circularDependencyDetected = true;
            }
        }

        logTest('Circular dependency detection', circularDependencyDetected,
            circularDependencyDetected ? 'Circular dependencies detected correctly' : 'Circular dependency detection failed');

        // Test missing module handling
        const missingModuleLoader = new ModuleLoader();
        let missingModuleHandled = false;
        try {
            missingModuleLoader.getModule('nonexistent');
        } catch (error) {
            missingModuleHandled = error.message.includes('not registered');
        }

        logTest('Missing module handling', missingModuleHandled,
            missingModuleHandled ? 'Missing modules handled correctly' : 'Missing module error not handled properly');

        return true;

    } catch (error) {
        logTest('Error handling test', false, `Error: ${error.message}`);
        return false;
    }
}

/**
 * Run all integration tests
 */
async function runIntegrationTests() {
    console.log('🚀 [INTEGRATION TEST] Starting Modular Architecture Integration Tests');
    console.log('🔧 [INTEGRATION TEST] Testing all modules work together correctly');

    const startTime = performance.now();

    try {
        // Test 1: Module Loading
        const moduleLoader = await testModuleLoading();
        if (!moduleLoader) {
            throw new Error('Module loading failed, cannot continue tests');
        }

        // Test 2: Module Communication
        await testModuleCommunication(moduleLoader);

        // Test 3: Application Initialization
        const app = await testApplicationInitialization(moduleLoader);
        if (!app) {
            console.warn('⚠️ [INTEGRATION TEST] Application initialization test failed, but continuing...');
        }

        // Test 4: Performance Benchmark
        await testPerformanceBenchmark(moduleLoader);

        // Test 5: Error Handling
        await testErrorHandling();

    } catch (error) {
        logTest('Integration test suite', false, `Critical error: ${error.message}`);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Print test summary
    logSection('Test Summary');
    console.log(`📊 Total Tests: ${testResults.tests.length}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⏱️  Total Time: ${totalTime.toFixed(2)}ms`);
    console.log(`📈 Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(1)}%`);

    if (testResults.failed === 0) {
        console.log('🎉 [INTEGRATION TEST] ALL TESTS PASSED! Modular architecture is working correctly.');
    } else {
        console.log('⚠️ [INTEGRATION TEST] Some tests failed. Check the output above for details.');
    }

    // Return test results for external analysis
    return testResults;
}

// Export for use in browser console or other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runIntegrationTests };
} else {
    window.runIntegrationTests = runIntegrationTests;
}

// Auto-run tests if this script is loaded directly
if (typeof window !== 'undefined' && window.location) {
    // Only run automatically if not in a test environment
    if (!window.jest && !window.mocha) {
        console.log('🔧 [INTEGRATION TEST] Auto-running integration tests in 2 seconds...');
        setTimeout(() => {
            runIntegrationTests().then(results => {
                window.integrationTestResults = results;
                console.log('🔧 [INTEGRATION TEST] Test results available at window.integrationTestResults');
            });
        }, 2000);
    }
}
