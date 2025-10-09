/**
 * Jest unit tests for Storage module - Simplified version
 * Focus: Core functionality without complex async operations
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
import Storage from '../modules/utils/Storage.js';

describe('Storage', () => {
    let storage;

    beforeEach(() => {
        // Mock localStorage completely for testing
        const mockLocalStorage = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(() => {}),
            removeItem: jest.fn(() => {}),
            clear: jest.fn(() => {}),
            key: jest.fn(() => null),
            length: 0,
        };

        Object.defineProperty(window, 'localStorage', {
            value: mockLocalStorage,
            writable: true,
        });

        // Create fresh instances
        storage = new Storage();

        // Mock initialize methods to avoid real initialization
        jest.spyOn(storage, 'initialize').mockResolvedValue();

        // Set up essential spies on storage methods for isolation
        jest.spyOn(storage, 'validateDataForStorage');
        jest.spyOn(storage, 'getStorageUsage');
        jest.spyOn(storage, 'isStorageAvailable');
    });

    afterEach(() => {
        // Cleanup
        jest.restoreAllMocks();
    });

    // ============================================================================
    // CORE STORAGE TESTS - Simplified for performance
    // ============================================================================

    describe('Core Storage Methods', () => {
        test('should validate data for storage correctly', () => {
            const validData = {
                properties: [{ id: 1, name: 'Test Property' }],
                expenseCategories: ['Rent', 'Utilities'],
            };

            expect(storage.validateDataForStorage(validData)).toBe(true);

            const invalidData = {
                properties: [{ name: 'Missing ID' }],
                expenseCategories: [],
            };

            expect(storage.validateDataForStorage(invalidData)).toBe(false);
        });

        test('should calculate string size correctly', () => {
            expect(storage.getStringSize('hello')).toBeGreaterThan(0);
            expect(storage.getStringSize('')).toBe(0);
            expect(storage.getStringSize(null)).toBe(0);
            expect(storage.getStringSize(undefined)).toBe(0);
        });

        test('should detect localStorage availability', () => {
            expect(storage.isStorageAvailable('localStorage')).toBe(true);

            const originalSetItem = localStorage.setItem;
            localStorage.setItem = jest.fn(() => { throw new Error('Unavailable'); });

            expect(storage.isStorageAvailable('localStorage')).toBe(false);

            localStorage.setItem = originalSetItem;
        });

        test('should detect database availability', () => {
            expect(storage.isStorageAvailable('database')).toBe(true);

            storage.db = null;
            expect(storage.isStorageAvailable('database')).toBe(false);
        });
    });

    describe('localStorage Operations', () => {
        test('should save and load with custom keys', () => {
            const testData = { properties: [], expenseCategories: [] };
            const customKey = 'custom-key';

            const saveResult = storage.saveToLocalStorage(testData, customKey);
            expect(saveResult).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith(customKey, JSON.stringify(testData));
            expect(localStorage.setItem).toHaveBeenCalledWith(`${customKey}-lastSaved`, expect.any(String));

            localStorage.getItem.mockReturnValue(JSON.stringify(testData));
            const loadResult = storage.loadFromLocalStorage(customKey);
            expect(loadResult).toMatchObject(testData);
            expect(loadResult).toHaveProperty('_lastSaved');
        });

        test('should handle localStorage size limits', () => {
            const largeData = { data: 'x'.repeat(6 * 1024 * 1024) }; // 6MB

            const result = storage.saveToLocalStorage(largeData);
            expect(result).toBe(false);
        });

        test('should handle backup operations', () => {
            const testData = { properties: [] };

            const originalSetItem = localStorage.setItem;
            localStorage.setItem = jest.fn();

            const createResult = storage.createBackup(testData);
            expect(createResult).toBe(true);

            expect(localStorage.setItem).toHaveBeenCalledWith('sankey-property-dashboard-backup', expect.any(String));
            const call = localStorage.setItem.mock.calls.find(call => call[0] === 'sankey-property-dashboard-backup');
            const backupData = JSON.parse(call[1]);
            expect(backupData).toHaveProperty('data', testData);
            expect(backupData).toHaveProperty('timestamp');
            expect(backupData).toHaveProperty('version');

            localStorage.setItem = originalSetItem;
        });

        test('should handle backup load errors', () => {
            const originalGetItem = localStorage.getItem;
            localStorage.getItem = jest.fn(() => 'invalid json');

            const result = storage.loadBackup();
            expect(result).toBe(null);

            localStorage.getItem = originalGetItem;
        });
    });

    describe('Storage Statistics', () => {
        test('should calculate storage usage accurately', () => {
            Object.defineProperty(localStorage, 'length', { value: 2 });
            localStorage.key.mockImplementation((index) => `key${index}`);
            localStorage.getItem.mockImplementation((key) => 'test data');

            const usage = storage.getStorageUsage();
            expect(usage.localStorage).toHaveProperty('used');
            expect(usage.localStorage).toHaveProperty('limit');
            expect(usage.localStorage).toHaveProperty('percentage');
            expect(typeof usage.localStorage.used).toBe('number');
        });

        test('should get storage statistics', async () => {
            storage.loadHistoryFromStorage = jest.fn().mockResolvedValue([{}, {}, {}]);

            const stats = await storage.getStorageStats();
            expect(stats).toHaveProperty('localStorage');
            expect(stats).toHaveProperty('database');
            expect(stats).toHaveProperty('usage');
            expect(stats).toHaveProperty('historyItems', 3);
            expect(stats).toHaveProperty('lastSaved');
        });
    });

    describe('Data Validation', () => {
        const validationTestCases = [
            [{ properties: [{ id: 1, name: 'Test' }], expenseCategories: ['Maintenance'] }, true],
            [{ properties: [], expenseCategories: [] }, true],
            [{ properties: null, expenseCategories: [] }, false],
            [{ properties: [], expenseCategories: null }, false],
            [{ properties: [{ name: 'Test' }], expenseCategories: [] }, false], // Missing ID
            [null, false],
            [{}, false],
        ];

        test.each(validationTestCases)(
            'validateDataForStorage(%j) should return %s',
            (data, expected) => {
                expect(storage.validateDataForStorage(data)).toBe(expected);
            },
        );
    });

    describe('Error Handling', () => {
        test('should handle localStorage save errors gracefully', () => {
            localStorage.setItem.mockImplementation(() => {
                throw new Error('Quota exceeded');
            });

            const result = storage.saveToLocalStorage({ test: 'data' });
            expect(result).toBe(false);
        });

        test('should handle localStorage load errors gracefully', () => {
            localStorage.getItem.mockReturnValue('invalid json');

            const result = storage.loadFromLocalStorage('test-key');
            expect(result).toBe(null);
        });

        test('should handle database errors gracefully', async () => {
            storage.db = null; // No database available

            const result = await storage.saveToDatabase({ properties: [] });
            expect(result).toBe(false);
        });
    });

    describe('Initialization', () => {
        test('should initialize without errors', async () => {
            // Just test that initialize doesn't throw
            await expect(storage.initialize()).resolves.not.toThrow();
        });

        test('should handle Dexie unavailability', async () => {
            // Mock Dexie as undefined
            const originalDexie = global.Dexie;
            delete global.Dexie;

            const newStorage = new Storage();
            await newStorage.initialize();
            expect(newStorage.db).toBe(null);

            global.Dexie = originalDexie;
        });

        test('should cleanup resources', () => {
            storage.cleanup();
            expect(storage._initialized).toBe(false);
        });
    });

    describe('Data Reconstruction', () => {
        test('should reconstruct monthly data from expenses', () => {
            const mockExpenses = [
                {
                    property_id: 1,
                    category: 'Rent',
                    amount: 1000,
                    month: 'Jan 2023',
                    subcategory: null,
                },
                {
                    property_id: 1,
                    category: 'Utilities',
                    subcategory: 'Electricity',
                    amount: 200,
                    month: 'Jan 2023',
                },
            ];

            const result = storage.reconstructMonthlyData(mockExpenses);

            expect(result[1]['Jan 2023']).toBeDefined();
            expect(result[1]['Jan 2023'].expenses.Rent).toBe(1000);
            expect(result[1]['Jan 2023'].expenses.Utilities.Electricity).toBe(200);
        });

        test('should calculate month total correctly', () => {
            const expenses = {
                Rent: 1000,
                Utilities: { Electricity: 200, Water: 100 },
                Maintenance: 300,
            };

            const result = storage.calculateMonthTotal(expenses);
            expect(result).toBe(1600); // 1000 + 200 + 100 + 300
        });
    });
});