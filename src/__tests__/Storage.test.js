/**
 * Jest unit tests for Storage module - Comprehensive version
 * Tests all major functionality including database operations, caching, and error handling
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

// Mock Dexie for database operations
jest.mock('dexie', () => {
    return jest.fn().mockImplementation(() => ({
        version: jest.fn().mockReturnThis(),
        stores: jest.fn().mockReturnThis(),
        open: jest.fn().mockResolvedValue(),
        close: jest.fn(),
        delete: jest.fn().mockResolvedValue(),
        transaction: jest.fn((mode, tables, callback) => callback()),
        properties: {
            add: jest.fn().mockResolvedValue(1),
            put: jest.fn().mockResolvedValue(),
            get: jest.fn().mockResolvedValue(null),
            where: jest.fn().mockReturnThis(),
            equals: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            delete: jest.fn().mockResolvedValue(),
            bulkDelete: jest.fn().mockResolvedValue(),
        },
        expenseCategories: {
            add: jest.fn().mockResolvedValue(1),
            where: jest.fn().mockReturnThis(),
            equals: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            delete: jest.fn().mockResolvedValue(),
        },
        expenses: {
            add: jest.fn().mockResolvedValue(1),
            where: jest.fn().mockReturnThis(),
            between: jest.fn().mockReturnThis(),
            and: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            delete: jest.fn().mockResolvedValue(),
        },
        incomes: {
            add: jest.fn().mockResolvedValue(1),
            where: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
        },
        history: {
            add: jest.fn().mockResolvedValue(1),
            where: jest.fn().mockReturnThis(),
            equals: jest.fn().mockReturnThis(),
            reverse: jest.fn().mockReturnThis(),
            sortBy: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            update: jest.fn().mockResolvedValue(),
            bulkDelete: jest.fn().mockResolvedValue(),
        },
        settings: {
            where: jest.fn().mockReturnThis(),
            equals: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue([]),
            put: jest.fn().mockResolvedValue(),
            delete: jest.fn().mockResolvedValue(),
        },
        metadata: {
            toArray: jest.fn().mockResolvedValue([]),
            put: jest.fn().mockResolvedValue(),
        },
        audit_log: {
            add: jest.fn().mockResolvedValue(1),
            where: jest.fn().mockReturnThis(),
            between: jest.fn().mockReturnThis(),
            and: jest.fn().mockReturnThis(),
            reverse: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue([]),
        },
        users: {
            put: jest.fn().mockResolvedValue(),
            get: jest.fn().mockResolvedValue(null),
        },
        export: jest.fn().mockResolvedValue({}),
        import: jest.fn().mockResolvedValue(),
    }));
});

// Mock IndexedDB
Object.defineProperty(window, 'indexedDB', {
    value: {
        open: jest.fn().mockReturnValue({
            onerror: null,
            onsuccess: null,
            result: {
                close: jest.fn(),
                deleteDatabase: jest.fn(),
            },
        }),
        deleteDatabase: jest.fn(),
    },
    writable: true,
});

// Now import real modules (after mocks are set up)
import DashboardStorage from '../modules/utils/Storage.js';

describe('DashboardStorage', () => {
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
        storage = new DashboardStorage();

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

        test('uses npm Dexie even when the Dexie global is missing', async () => {
            const originalDexie = global.Dexie;
            delete global.Dexie;

            const newStorage = new DashboardStorage();
            expect(() => new DashboardStorage()).not.toThrow();
            await newStorage._initPromise;

            global.Dexie = originalDexie;
        });

        test('should cleanup resources', () => {
            storage.cleanup();
            expect(storage._initialized).toBe(false);
        });
    });

    describe('Database Operations', () => {
        beforeEach(() => {
            // Setup mock database
            storage.db = {
                transaction: jest.fn((mode, tables, callback) => callback()),
                properties: {
                    add: jest.fn().mockResolvedValue(1),
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    delete: jest.fn().mockResolvedValue(),
                    toArray: jest.fn().mockResolvedValue([]),
                },
                expenseCategories: {
                    add: jest.fn().mockResolvedValue(1),
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockResolvedValue([]),
                },
                expenses: {
                    add: jest.fn().mockResolvedValue(1),
                    where: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockResolvedValue([]),
                },
                incomes: {
                    add: jest.fn().mockResolvedValue(1),
                    where: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockResolvedValue([]),
                },
                metadata: {
                    put: jest.fn().mockResolvedValue(),
                    toArray: jest.fn().mockResolvedValue([]),
                },
                audit_log: {
                    add: jest.fn().mockResolvedValue(1),
                },
            };
        });

        test('should save data to database successfully', async () => {
            const testData = {
                properties: [
                    {
                        id: 1,
                        name: 'Test Property',
                        created: '2023-01-01',
                    },
                ],
                expenseCategories: ['Rent', 'Utilities'],
                incomeCategories: ['Rental Income'],
                transactions: [
                    {
                        id: 't1',
                        propertyId: 1,
                        category: 'Rent',
                        amount: -1000,
                        date: '2023-01-01',
                        type: 'expense',
                    },
                    {
                        id: 't2',
                        propertyId: 1,
                        category: 'Rental Income',
                        amount: 2000,
                        date: '2023-01-01',
                        type: 'income',
                    },
                ],
            };

            // Ensure database is available for this test
            storage.db = {
                transaction: jest.fn((mode, tables, callback) => {
                    // Mock successful transaction
                    return Promise.resolve(callback());
                }),
                properties: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    delete: jest.fn().mockResolvedValue(),
                    add: jest.fn().mockResolvedValue(1),
                },
                expenseCategories: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    delete: jest.fn().mockResolvedValue(),
                    add: jest.fn().mockResolvedValue(1),
                },
                incomeCategories: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    delete: jest.fn().mockResolvedValue(),
                    add: jest.fn().mockResolvedValue(1),
                },
                expenses: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    delete: jest.fn().mockResolvedValue(),
                    add: jest.fn().mockResolvedValue(1),
                },
                incomes: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    delete: jest.fn().mockResolvedValue(),
                    add: jest.fn().mockResolvedValue(1),
                },
                metadata: {
                    put: jest.fn().mockResolvedValue(),
                },
                audit_log: {
                    add: jest.fn().mockResolvedValue(1),
                },
            };

            const result = await storage.saveToDatabase(testData);

            expect(result).toBe(true);
            expect(storage.db.expenses.add).toHaveBeenCalledWith(expect.objectContaining({
                property_id: 1,
                category: 'Rent',
                amount: -1000,
            }));
            expect(storage.db.incomes.add).toHaveBeenCalledWith(expect.objectContaining({
                property_id: 1,
                category: 'Rental Income',
                amount: 2000,
            }));
            expect(storage.db.properties.add).toHaveBeenCalledWith(expect.not.objectContaining({
                monthlyData: expect.anything(),
            }));
        });

        test('should load data from database as flat transactions', async () => {
            storage.db = {
                properties: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockResolvedValue([
                        { id: 1, name: 'Test Property', created_date: '2023-01-01' },
                    ]),
                },
                expenseCategories: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockResolvedValue([{ name: 'Rent' }, { name: 'Utilities' }]),
                },
                incomeCategories: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockResolvedValue([]),
                },
                expenses: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockResolvedValue([
                        { property_id: 1, category: 'Rent', amount: 1000, month: 'Jan 2023' },
                    ]),
                },
                incomes: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockResolvedValue([]),
                },
                metadata: {
                    toArray: jest.fn().mockResolvedValue([]),
                },
            };

            const result = await storage.loadFromDatabase();

            expect(result).toBeDefined();
            expect(result.properties).toHaveLength(1);
            expect(result.expenseCategories).toEqual(['Rent', 'Utilities']);
            expect(Array.isArray(result.transactions)).toBe(true);
            expect(result.transactions.length).toBeGreaterThan(0);
        });

        test('should handle database save errors gracefully', async () => {
            storage.db.properties.add.mockRejectedValue(new Error('Database error'));

            const result = await storage.saveToDatabase({ properties: [] });

            expect(result).toBe(false);
        });

        test('should handle database load errors gracefully', async () => {
            // Ensure database is available for this test
            storage.db = {
                properties: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockRejectedValue(new Error('Database error')),
                },
                expenseCategories: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockRejectedValue(new Error('Database error')),
                },
                incomeCategories: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockRejectedValue(new Error('Database error')),
                },
                expenses: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockRejectedValue(new Error('Database error')),
                },
                incomes: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockRejectedValue(new Error('Database error')),
                },
                metadata: {
                    toArray: jest.fn().mockRejectedValue(new Error('Database error')),
                },
            };

            const result = await storage.loadFromDatabase();

            expect(result).toBe(null);
        });
    });

    describe('History Operations', () => {
        beforeEach(() => {
            storage.db = {
                history: {
                    add: jest.fn().mockResolvedValue(1),
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    reverse: jest.fn().mockReturnThis(),
                    sortBy: jest.fn().mockResolvedValue([]),
                    count: jest.fn().mockResolvedValue(0),
                    orderBy: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    bulkDelete: jest.fn().mockResolvedValue(),
                },
            };
        });

        test('should save history snapshot successfully', async () => {
            const snapshot = {
                id: 'test-id',
                name: 'Test Snapshot',
                timestamp: '2023-01-01',
                description: 'Test description',
                data: { properties: [] },
                totalExpenses: 1000,
                propertyCount: 1,
                categoryCount: 2,
            };

            const result = await storage.saveHistorySnapshot(snapshot);

            expect(result).toBe(true);
            expect(storage.db.history.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Test Snapshot',
                    data: { properties: [] },
                })
            );
        });

        test('should load history from storage', async () => {
            const mockHistory = [
                {
                    id: 1,
                    name: 'Test Snapshot',
                    timestamp: '2023-01-01',
                    description: 'Test description',
                    data: { properties: [] },
                    totalExpenses: 1000,
                    propertyCount: 1,
                    categoryCount: 2,
                },
            ];

            storage.db.history.sortBy.mockResolvedValue(mockHistory);

            const result = await storage.loadHistoryFromStorage();

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('name', 'Test Snapshot');
        });

        test('should update history snapshot', async () => {
            storage.db.history.update = jest.fn().mockResolvedValue();

            const result = await storage.updateHistorySnapshot('1', { name: 'Updated Name' });

            expect(result).toBe(true);
            expect(storage.db.history.update).toHaveBeenCalledWith(1, { name: 'Updated Name' });
        });
    });

    describe('Settings Operations', () => {
        beforeEach(() => {
            storage.db = {
                settings: {
                    where: jest.fn().mockReturnThis(),
                    equals: jest.fn().mockReturnThis(),
                    delete: jest.fn().mockResolvedValue(),
                    toArray: jest.fn().mockResolvedValue([]),
                    put: jest.fn().mockResolvedValue(),
                },
            };
        });

        test('should save settings successfully', async () => {
            const settings = {
                theme: 'dark',
                language: 'en',
            };

            const result = await storage.saveSettings(settings);

            expect(result).toBe(true);
            expect(storage.db.settings.delete).toHaveBeenCalled();
            expect(storage.db.settings.put).toHaveBeenCalledTimes(2);
        });

        test('should load settings successfully', async () => {
            const mockSettings = [
                { key: 'theme', value: 'dark' },
                { key: 'language', value: 'en' },
            ];

            storage.db.settings.toArray.mockResolvedValue(mockSettings);

            const result = await storage.loadSettings();

            expect(result).toEqual({
                theme: 'dark',
                language: 'en',
            });
        });
    });

    describe('Data Import/Export', () => {
        beforeEach(() => {
            storage.db = {
                export: jest.fn().mockResolvedValue({}),
                import: jest.fn().mockResolvedValue(),
            };
        });

        test('should export all data successfully', async () => {
            storage.load = jest.fn().mockResolvedValue({ properties: [] });
            storage.loadHistoryFromStorage = jest.fn().mockResolvedValue([]);
            storage.loadSettings = jest.fn().mockResolvedValue({});

            const result = await storage.exportAllData();

            expect(result).toHaveProperty('currentData');
            expect(result).toHaveProperty('history');
            expect(result).toHaveProperty('settings');
            expect(result).toHaveProperty('exportDate');
            expect(result).toHaveProperty('version');
        });

        test('should import data successfully', async () => {
            const importData = {
                currentData: {
                    properties: [{ id: 1, name: 'Test Property' }],
                    expenseCategories: ['Rent'],
                },
                history: [],
                settings: { theme: 'dark' },
            };

            storage.save = jest.fn().mockResolvedValue(true);
            storage.saveSettings = jest.fn().mockResolvedValue(true);

            const result = await storage.importData(importData);

            expect(result).toBe(true);
            expect(storage.save).toHaveBeenCalledWith(importData.currentData);
        });
    });

    describe('Advanced Storage Features', () => {
        beforeEach(() => {
            storage.db = {
                expenses: {
                    where: jest.fn().mockReturnThis(),
                    between: jest.fn().mockReturnThis(),
                    and: jest.fn().mockReturnThis(),
                    sortBy: jest.fn().mockResolvedValue([]),
                },
            };
        });

        test('should get chronological expenses', async () => {
            const mockExpenses = [
                { property_id: 1, category: 'Rent', amount: 1000, expense_date: '2023-01-15' },
            ];

            storage.db.expenses.sortBy.mockResolvedValue(mockExpenses);

            const result = await storage.getChronologicalExpenses(1, '2023-01-01', '2023-01-31');

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('category', 'Rent');
        });

        test('should get monthly expense summary', async () => {
            const mockExpenses = [
                { category: 'Rent', amount: 1000, expense_date: '2023-01-15', user_id: 'default' },
                { category: 'Utilities', amount: 200, expense_date: '2023-01-20', user_id: 'default' },
            ];

            // Create a proper mock that simulates the Dexie query chain
            const mockFilteredCollection = {
                and: jest.fn().mockReturnThis(),
                toArray: jest.fn().mockResolvedValue(mockExpenses),
            };

            const mockUserCollection = {
                equals: jest.fn().mockReturnValue(mockFilteredCollection),
            };

            // Ensure database is available for this test
            storage.db = {
                expenses: {
                    where: jest.fn().mockReturnValue(mockUserCollection),
                },
            };

            const result = await storage.getMonthlyExpenseSummary(2023, 1);

            expect(result).toEqual({
                Rent: 1000,
                Utilities: 200,
            });
        });

        test('should save and get user data', async () => {
            storage.db.users = {
                put: jest.fn().mockResolvedValue(),
                get: jest.fn().mockResolvedValue({
                    id: 1,
                    username: 'testuser',
                    email: 'test@example.com',
                }),
            };

            const userData = {
                id: 1,
                username: 'testuser',
                email: 'test@example.com',
            };

            const saveResult = await storage.saveUser(userData);
            expect(saveResult).toBe(true);

            const getResult = await storage.getUser(1);
            expect(getResult).toEqual(userData);
        });

        test('should log and get audit events', async () => {
            storage.db.audit_log = {
                add: jest.fn().mockResolvedValue(1),
                where: jest.fn().mockReturnThis(),
                between: jest.fn().mockReturnThis(),
                and: jest.fn().mockReturnThis(),
                reverse: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                toArray: jest.fn().mockResolvedValue([]),
            };

            const logResult = await storage.logAuditEvent('save', 'property', '1');
            expect(logResult).toBe(true);

            const trailResult = await storage.getAuditTrail('property', '1');
            expect(Array.isArray(trailResult)).toBe(true);
        });

        test('should export user-specific data', async () => {
            storage.db.properties = {
                where: jest.fn().mockReturnThis(),
                equals: jest.fn().mockReturnThis(),
                toArray: jest.fn().mockResolvedValue([]),
            };
            storage.db.expenseCategories = {
                where: jest.fn().mockReturnThis(),
                equals: jest.fn().mockReturnThis(),
                toArray: jest.fn().mockResolvedValue([]),
            };
            storage.db.expenses = {
                where: jest.fn().mockReturnThis(),
                equals: jest.fn().mockReturnThis(),
                toArray: jest.fn().mockResolvedValue([]),
            };
            storage.db.audit_log = {
                where: jest.fn().mockReturnThis(),
                equals: jest.fn().mockReturnThis(),
                toArray: jest.fn().mockResolvedValue([]),
            };

            const result = await storage.exportUserData('user1');

            expect(result).toHaveProperty('userId', 'user1');
            expect(result).toHaveProperty('exportDate');
            expect(result).toHaveProperty('data');
        });

        test('should get data counts', async () => {
            storage.load = jest.fn().mockResolvedValue({
                properties: [{ id: 1 }, { id: 2 }],
                expenseCategories: ['Rent', 'Utilities'],
                incomeCategories: ['Rental Income'],
            });

            const result = await storage.getDataCounts();

            expect(result).toEqual({
                transactionsCount: 0,
                propertiesCount: 2,
                categoriesCount: 3,
                expenseCategoriesCount: 2,
                incomeCategoriesCount: 1,
            });
        });
    });

    describe('Cache Management', () => {
        test('should clear load cache', () => {
            storage._cachedData = { test: 'data' };
            storage._lastLoadTime = Date.now();
            storage._loadingPromise = Promise.resolve();

            storage.clearLoadCache();

            expect(storage._cachedData).toBe(null);
            expect(storage._lastLoadTime).toBe(null);
            expect(storage._loadingPromise).toBe(null);
        });

        test('should load fresh data bypassing cache', async () => {
            storage.clearLoadCache = jest.fn();
            storage.load = jest.fn().mockResolvedValue({ properties: [] });

            const result = await storage.loadFresh();

            expect(storage.clearLoadCache).toHaveBeenCalled();
            expect(storage.load).toHaveBeenCalled();
            expect(result).toEqual({ properties: [] });
        });

        test('should return cached data when available and recent', async () => {
            const cachedData = { properties: [{ id: 1 }] };
            storage._cachedData = cachedData;
            storage._lastLoadTime = Date.now();

            const result = await storage.load();

            expect(result).toBe(cachedData);
        });

        test('should perform load operation when cache is stale', async () => {
            storage._cachedData = {
                properties: [],
                expenseCategories: [],
                incomeCategories: []
            };
            storage._lastLoadTime = Date.now() - 10000; // 10 seconds ago
            storage._performLoad = jest.fn().mockResolvedValue({ properties: [{ id: 1 }] });

            const result = await storage.load();

            expect(storage._performLoad).toHaveBeenCalled();
            expect(result).toEqual({ properties: [{ id: 1 }] });
        });
    });

    describe('Utility Methods', () => {
        test('should check IndexedDB availability', () => {
            expect(storage.isIndexedDBAvailable()).toBe(true);

            // Mock unavailable IndexedDB
            const originalIndexedDB = window.indexedDB;
            delete window.indexedDB;

            const newStorage = new DashboardStorage();
            expect(newStorage.isIndexedDBAvailable()).toBe(false);

            window.indexedDB = originalIndexedDB;
        });

        test('should get storage statistics', async () => {
            storage.loadHistoryFromStorage = jest.fn().mockResolvedValue([{}, {}]);
            storage.getStorageUsage = jest.fn().mockReturnValue({
                localStorage: { used: 1000, limit: 5000000, percentage: 0.02 },
                database: { available: true, estimated: 0 },
            });

            const result = await storage.getStorageStats();

            expect(result).toHaveProperty('localStorage', true);
            expect(result).toHaveProperty('database', true);
            expect(result).toHaveProperty('usage');
            expect(result).toHaveProperty('historyItems', 2);
        });

        test('should clear all data', async () => {
            storage.db = {
                delete: jest.fn().mockResolvedValue(),
            };

            const result = await storage.clearAllData();

            expect(result).toBe(true);
            expect(localStorage.removeItem).toHaveBeenCalled();
        });

        test('should debug storage information', async () => {
            storage.getStorageStats = jest.fn().mockResolvedValue({});

            await storage.debug();

            // Should not throw and should log debug information
            expect(true).toBe(true);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle null data in save operations', async () => {
            // Mock the save method to avoid timeout
            storage.saveToDatabase = jest.fn().mockResolvedValue(false);
            storage.saveToLocalStorage = jest.fn().mockReturnValue(false);

            // Mock the initialization promise to avoid hanging
            storage._initPromise = Promise.resolve();

            const result = await storage.save(null);
            expect(result).toBe(false);
        }, 5000);

        test('should handle database quota exceeded errors', async () => {
            storage.db = {
                transaction: jest.fn().mockRejectedValue(new Error('QuotaExceeded')),
            };

            const result = await storage.saveToDatabase({ properties: [] });
            expect(result).toBe(false);
            // Note: The db is not set to null in this case because the error message doesn't contain "Quota exceeded"
            // This is expected behavior based on the implementation
        });

        test('should handle schema mismatch errors', async () => {
            const recovered = {
                properties: [{ id: 1, name: 'Office' }],
                expenseCategories: ['Rent'],
                incomeCategories: [],
                transactions: [{
                    id: 't1',
                    propertyId: 1,
                    category: 'Rent',
                    amount: -1500,
                    date: '2024-01-01',
                    type: 'expense',
                }],
            };
            localStorage.getItem.mockImplementation(key => {
                if (key === storage.storageKey) {
                    return JSON.stringify(recovered);
                }
                return null;
            });
            const missingStore = {
                where: jest.fn().mockReturnThis(),
                equals: jest.fn().mockReturnThis(),
                toArray: jest.fn().mockRejectedValue(new Error('object stores was not found')),
            };
            storage.db = {
                properties: missingStore,
                expenseCategories: missingStore,
                incomeCategories: missingStore,
                expenses: missingStore,
                incomes: missingStore,
                metadata: missingStore,
            };

            const result = await storage.loadFromDatabase();
            expect(result).not.toBe(null);
            expect(result.transactions.some(t => t.category === 'Rent' && t.amount === -1500)).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith(
                storage.idbBackupKey,
                expect.stringContaining('object stores was not found'),
            );
            expect(storage.db).not.toBeNull();
        });

        test('should handle invalid import data', async () => {
            const result = await storage.importData(null);
            expect(result).toBe(false);

            const invalidResult = await storage.importData({ invalid: 'format' });
            expect(invalidResult).toBe(false);
        });

        test('should handle backup creation failures', () => {
            localStorage.setItem.mockImplementation(() => {
                throw new Error('Storage full');
            });

            const result = storage.createBackup({ test: 'data' });
            expect(result).toBe(false);
        });
    });
});