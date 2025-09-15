/**
 * Test script to verify Dexie database conformity with sample data structure
 * This script tests the updated Storage, DataManager, and Validator modules
 * to ensure they properly handle the sample expense data format.
 */

// Import required modules
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simulate browser environment for Node.js
if (typeof window === 'undefined') {
    global.window = global;
    global.localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
    };
    global.indexedDB = {
        open: () => ({
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null
        })
    };
}

// Import project modules (CommonJS style)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const Storage = require('./src/modules/utils/Storage.js');
const Validator = require('./src/modules/utils/Validator.js');
const DataManager = require('./src/modules/core/DataManager.js');

class DataConformityTest {
    constructor() {
        this.storage = null;
        this.dataManager = null;
        this.validator = null;
        this.sampleData = null;
        this.testResults = [];
    }

    /**
     * Initialize test environment
     */
    async initialize() {
        console.log('[TEST] Initializing data conformity test...');

        try {
            // Initialize modules
            this.storage = new Storage();
            await this.storage.initialize();

            this.validator = new Validator();

            // Create a simple formatter mock
            const formatter = {
                formatCurrency: (amount) => `₹${amount.toLocaleString()}`,
                formatDate: (date) => date.toLocaleString(),
                formatPercentage: (value) => `${value.toFixed(1)}%`
            };

            this.dataManager = new DataManager(this.storage, this.validator, formatter);

            console.log('[TEST] Test environment initialized successfully');
            return true;
        } catch (error) {
            console.error('[TEST] Failed to initialize test environment:', error);
            return false;
        }
    }

    /**
     * Load sample data from JSON file
     */
    async loadSampleData() {
        console.log('[TEST] Loading sample data...');

        try {
            let rawData;

            // Use different loading methods for different environments
            if (typeof window !== 'undefined') {
                // Browser environment - use fetch
                const response = await fetch('sample-expense-data-3-years.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                rawData = await response.json();
            } else {
                // Node.js environment - use file system
                const filePath = join(__dirname, 'sample-expense-data-3-years.json');
                const fileContent = readFileSync(filePath, 'utf8');
                rawData = JSON.parse(fileContent);
            }

            // Extract the currentData from the sample
            this.sampleData = rawData.currentData;

            console.log('[TEST] Sample data loaded successfully:', {
                properties: this.sampleData.properties?.length || 0,
                categories: this.sampleData.expenseCategories?.length || 0,
                hasMonthlyData: this.sampleData.properties?.some(p => p.monthlyData) || false
            });

            return true;
        } catch (error) {
            console.error('[TEST] Failed to load sample data:', error);
            return false;
        }
    }

    /**
     * Test data validation
     */
    testDataValidation() {
        console.log('[TEST] Testing data validation...');

        const validation = this.validator.validateDashboardData(this.sampleData);
        this.testResults.push({
            test: 'Data Validation',
            passed: validation.isValid,
            message: validation.isValid ? 'Sample data is valid' : `Validation failed: ${validation.message}`,
            details: validation.errors
        });

        console.log(`[TEST] Data validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
        return validation.isValid;
    }

    /**
     * Test data import
     */
    async testDataImport() {
        console.log('[TEST] Testing data import...');

        try {
            // Clear existing data first
            await this.storage.clearAllData(true);
            console.log('[TEST] Cleared existing data');

            // Import sample data
            const importResult = await this.dataManager.importData(this.sampleData);
            this.testResults.push({
                test: 'Data Import',
                passed: importResult,
                message: importResult ? 'Sample data imported successfully' : 'Failed to import sample data'
            });

            console.log(`[TEST] Data import: ${importResult ? 'PASSED' : 'FAILED'}`);
            return importResult;
        } catch (error) {
            console.error('[TEST] Data import test failed:', error);
            this.testResults.push({
                test: 'Data Import',
                passed: false,
                message: `Import failed with error: ${error.message}`
            });
            return false;
        }
    }

    /**
     * Test data retrieval
     */
    async testDataRetrieval() {
        console.log('[TEST] Testing data retrieval...');

        try {
            // Load data from storage
            const loadedData = await this.storage.load();

            if (!loadedData) {
                this.testResults.push({
                    test: 'Data Retrieval',
                    passed: false,
                    message: 'No data retrieved from storage'
                });
                return false;
            }

            // Compare key properties
            const originalProps = this.sampleData.properties || [];
            const loadedProps = loadedData.properties || [];

            const propsMatch = originalProps.length === loadedProps.length;
            const categoriesMatch = (this.sampleData.expenseCategories || []).length === (loadedData.expenseCategories || []).length;

            // Check if monthly data is preserved
            const hasMonthlyData = loadedProps.some(p => p.monthlyData && Object.keys(p.monthlyData).length > 0);

            this.testResults.push({
                test: 'Data Retrieval',
                passed: propsMatch && categoriesMatch && hasMonthlyData,
                message: `Properties: ${propsMatch ? 'MATCH' : 'MISMATCH'} (${originalProps.length} vs ${loadedProps.length}), Categories: ${categoriesMatch ? 'MATCH' : 'MISMATCH'}, Monthly Data: ${hasMonthlyData ? 'PRESERVED' : 'MISSING'}`,
                details: {
                    originalProperties: originalProps.length,
                    loadedProperties: loadedProps.length,
                    originalCategories: (this.sampleData.expenseCategories || []).length,
                    loadedCategories: (loadedData.expenseCategories || []).length,
                    hasMonthlyData: hasMonthlyData
                }
            });

            console.log(`[TEST] Data retrieval: ${propsMatch && categoriesMatch && hasMonthlyData ? 'PASSED' : 'FAILED'}`);
            return propsMatch && categoriesMatch && hasMonthlyData;
        } catch (error) {
            console.error('[TEST] Data retrieval test failed:', error);
            this.testResults.push({
                test: 'Data Retrieval',
                passed: false,
                message: `Retrieval failed with error: ${error.message}`
            });
            return false;
        }
    }

    /**
     * Test monthly data structure
     */
    async testMonthlyDataStructure() {
        console.log('[TEST] Testing monthly data structure...');

        try {
            const loadedData = await this.storage.load();
            if (!loadedData || !loadedData.properties) {
                this.testResults.push({
                    test: 'Monthly Data Structure',
                    passed: false,
                    message: 'No properties found in loaded data'
                });
                return false;
            }

            let totalMonths = 0;
            let propertiesWithMonthlyData = 0;
            let sampleMonths = 0;

            // Check original sample data
            if (this.sampleData.properties) {
                this.sampleData.properties.forEach(prop => {
                    if (prop.monthlyData) {
                        sampleMonths += Object.keys(prop.monthlyData).length;
                    }
                });
            }

            // Check loaded data
            loadedData.properties.forEach(prop => {
                if (prop.monthlyData) {
                    propertiesWithMonthlyData++;
                    totalMonths += Object.keys(prop.monthlyData).length;

                    // Verify month format
                    Object.keys(prop.monthlyData).forEach(monthKey => {
                        const monthValidation = this.validator.validateMonth(monthKey);
                        if (!monthValidation.isValid) {
                            console.warn(`[TEST] Invalid month format: ${monthKey}`);
                        }
                    });
                }
            });

            const structurePreserved = totalMonths > 0 && propertiesWithMonthlyData > 0;

            this.testResults.push({
                test: 'Monthly Data Structure',
                passed: structurePreserved,
                message: `Found ${propertiesWithMonthlyData} properties with ${totalMonths} total months of data`,
                details: {
                    propertiesWithMonthlyData,
                    totalMonths,
                    sampleMonths
                }
            });

            console.log(`[TEST] Monthly data structure: ${structurePreserved ? 'PASSED' : 'FAILED'}`);
            return structurePreserved;
        } catch (error) {
            console.error('[TEST] Monthly data structure test failed:', error);
            this.testResults.push({
                test: 'Monthly Data Structure',
                passed: false,
                message: `Structure test failed with error: ${error.message}`
            });
            return false;
        }
    }

    /**
     * Test database schema conformity
     */
    async testDatabaseSchema() {
        console.log('[TEST] Testing database schema conformity...');

        try {
            // Check if database is available
            const dbAvailable = this.storage.isStorageAvailable('database');
            if (!dbAvailable) {
                this.testResults.push({
                    test: 'Database Schema',
                    passed: false,
                    message: 'Database not available'
                });
                return false;
            }

            // Try to access database tables
            const db = this.storage.db;
            if (!db) {
                this.testResults.push({
                    test: 'Database Schema',
                    passed: false,
                    message: 'Database instance not found'
                });
                return false;
            }

            // Check if required tables exist
            const requiredTables = ['properties', 'expenseCategories', 'expenses'];
            const existingTables = Object.keys(db._dbSchema);

            const missingTables = requiredTables.filter(table => !existingTables.includes(table));
            const hasAllTables = missingTables.length === 0;

            // Check if new income tables exist (for future feature)
            const incomeTables = ['incomeCategories', 'incomes'];
            const hasIncomeTables = incomeTables.every(table => existingTables.includes(table));

            this.testResults.push({
                test: 'Database Schema',
                passed: hasAllTables,
                message: `Required tables: ${hasAllTables ? 'ALL PRESENT' : `MISSING: ${missingTables.join(', ')}`}, Income tables: ${hasIncomeTables ? 'PRESENT' : 'NOT PRESENT'}`,
                details: {
                    existingTables,
                    missingTables,
                    hasIncomeTables
                }
            });

            console.log(`[TEST] Database schema: ${hasAllTables ? 'PASSED' : 'FAILED'}`);
            return hasAllTables;
        } catch (error) {
            console.error('[TEST] Database schema test failed:', error);
            this.testResults.push({
                test: 'Database Schema',
                passed: false,
                message: `Schema test failed with error: ${error.message}`
            });
            return false;
        }
    }

    /**
     * Test data integrity
     */
    async testDataIntegrity() {
        console.log('[TEST] Testing data integrity...');

        try {
            const integrityResult = this.dataManager.validateDataIntegrity();
            this.testResults.push({
                test: 'Data Integrity',
                passed: integrityResult.isValid,
                message: integrityResult.isValid ? 'Data integrity check passed' : `Integrity issues: ${integrityResult.message}`,
                details: integrityResult.errors
            });

            console.log(`[TEST] Data integrity: ${integrityResult.isValid ? 'PASSED' : 'FAILED'}`);
            return integrityResult.isValid;
        } catch (error) {
            console.error('[TEST] Data integrity test failed:', error);
            this.testResults.push({
                test: 'Data Integrity',
                passed: false,
                message: `Integrity test failed with error: ${error.message}`
            });
            return false;
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('[TEST] === STARTING DATA CONFORMITY TESTS ===');

        const results = {
            total: 0,
            passed: 0,
            failed: 0
        };

        // Test 1: Initialize environment
        results.total++;
        if (await this.initialize()) {
            results.passed++;
            console.log('[TEST] ✓ Environment initialization: PASSED');
        } else {
            results.failed++;
            console.log('[TEST] ✗ Environment initialization: FAILED');
        }

        // Test 2: Load sample data
        results.total++;
        if (await this.loadSampleData()) {
            results.passed++;
            console.log('[TEST] ✓ Sample data loading: PASSED');
        } else {
            results.failed++;
            console.log('[TEST] ✗ Sample data loading: FAILED');
        }

        // Test 3: Data validation
        results.total++;
        if (this.testDataValidation()) {
            results.passed++;
            console.log('[TEST] ✓ Data validation: PASSED');
        } else {
            results.failed++;
            console.log('[TEST] ✗ Data validation: FAILED');
        }

        // Test 4: Data import
        results.total++;
        if (await this.testDataImport()) {
            results.passed++;
            console.log('[TEST] ✓ Data import: PASSED');
        } else {
            results.failed++;
            console.log('[TEST] ✗ Data import: FAILED');
        }

        // Test 5: Data retrieval
        results.total++;
        if (await this.testDataRetrieval()) {
            results.passed++;
            console.log('[TEST] ✓ Data retrieval: PASSED');
        } else {
            results.failed++;
            console.log('[TEST] ✗ Data retrieval: FAILED');
        }

        // Test 6: Monthly data structure
        results.total++;
        if (await this.testMonthlyDataStructure()) {
            results.passed++;
            console.log('[TEST] ✓ Monthly data structure: PASSED');
        } else {
            results.failed++;
            console.log('[TEST] ✗ Monthly data structure: FAILED');
        }

        // Test 7: Database schema
        results.total++;
        if (await this.testDatabaseSchema()) {
            results.passed++;
            console.log('[TEST] ✓ Database schema: PASSED');
        } else {
            results.failed++;
            console.log('[TEST] ✗ Database schema: FAILED');
        }

        // Test 8: Data integrity
        results.total++;
        if (await this.testDataIntegrity()) {
            results.passed++;
            console.log('[TEST] ✓ Data integrity: PASSED');
        } else {
            results.failed++;
            console.log('[TEST] ✗ Data integrity: FAILED');
        }

        // Print summary
        console.log('[TEST] === TEST RESULTS SUMMARY ===');
        console.log(`[TEST] Total tests: ${results.total}`);
        console.log(`[TEST] Passed: ${results.passed}`);
        console.log(`[TEST] Failed: ${results.failed}`);
        console.log(`[TEST] Success rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

        // Print detailed results
        console.log('[TEST] === DETAILED RESULTS ===');
        this.testResults.forEach((result, index) => {
            const status = result.passed ? '✓' : '✗';
            console.log(`[TEST] ${index + 1}. ${status} ${result.test}: ${result.message}`);
            if (result.details) {
                console.log(`[TEST]    Details:`, result.details);
            }
        });

        console.log('[TEST] === TESTS COMPLETED ===');

        return results.failed === 0;
    }
}

// Auto-run tests in Node.js environment
if (typeof globalThis !== 'undefined' && typeof window === 'undefined') {
    // Simulate browser environment for Node.js testing
    global.window = global;

    // Import node-fetch for Node.js environment
    import('node-fetch').then(({ default: fetch }) => {
        global.fetch = fetch;

        // Run tests immediately in Node.js
        setTimeout(async () => {
            const test = new DataConformityTest();
            const success = await test.runAllTests();

            if (success) {
                console.log('[TEST] 🎉 All tests passed! Dexie database conforms to sample data structure.');
                process.exit(0);
            } else {
                console.log('[TEST] ❌ Some tests failed. Please review the issues above.');
                process.exit(1);
            }
        }, 100);
    }).catch(error => {
        console.error('[TEST] Failed to import node-fetch:', error);
        process.exit(1);
    });
}

// Auto-run tests when script is loaded (browser environment)
if (typeof window !== 'undefined' && typeof process === 'undefined') {
    window.addEventListener('load', async () => {
        const test = new DataConformityTest();
        const success = await test.runAllTests();

        if (success) {
            console.log('[TEST] 🎉 All tests passed! Dexie database conforms to sample data structure.');
        } else {
            console.log('[TEST] ❌ Some tests failed. Please review the issues above.');
        }
    });
}

// Export for use in other contexts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataConformityTest;
} else if (typeof window !== 'undefined') {
    window.DataConformityTest = DataConformityTest;
}
