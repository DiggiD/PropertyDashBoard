// filepath: src/__mocks__/Storage.js

export default class MockStorage {
    constructor() {
        this.storageKey = 'sankey-property-dashboard-data';
        this.historyStorageKey = 'sankey-property-dashboard-history';
        this.settingsStorageKey = 'sankey-property-dashboard-settings';
        this.backupStorageKey = 'sankey-property-dashboard-backup';

        // Mock database instance
        this.db = null;
        this.dbVersion = 3;
        this._initialized = false;
        this._initPromise = null;

        // Storage limits
        this.maxLocalStorageSize = 5 * 1024 * 1024;
        this.maxHistoryItems = 50;

        // Centralized loading cache
        this._loadingPromise = null;
        this._cachedData = null;
        this._lastLoadTime = null;
        this._cacheTimeout = 5000;
        this._emptyCacheTimeout = 1000;

        this.mockData = {
            properties: [
                {
                    id: 1,
                    name: 'Downtown Office Complex',
                    monthlyData: {
                        'Jan 2024': {
                            expenses: {
                                'Utilities': { 'Electricity': 933, 'Water': 400, 'Gas': 267 },
                                'Maintenance': { 'Cleaning': 800, 'Repairs': 1333, 'Landscaping': 300 },
                                'Insurance': 833,
                                'Taxes': 1167,
                                'Security': 600,
                                'Parking': 833,
                                'Management': 667,
                                'Legal': 500,
                            },
                            incomes: { 'Rent': 5000 },
                            total: 5000 - (933 + 400 + 267 + 800 + 1333 + 300 + 833 + 1167 + 600 + 833 + 667 + 500),
                        },
                        'Feb 2024': {
                            expenses: {
                                'Utilities': { 'Electricity': 933, 'Water': 400, 'Gas': 267 },
                                'Maintenance': { 'Cleaning': 800, 'Repairs': 1333, 'Landscaping': 300 },
                                'Insurance': 833,
                                'Taxes': 1167,
                                'Security': 600,
                                'Parking': 833,
                                'Management': 667,
                                'Legal': 500,
                            },
                            incomes: { 'Rent': 5000 },
                            total: 5000 - (933 + 400 + 267 + 800 + 1333 + 300 + 833 + 1167 + 600 + 833 + 667 + 500),
                        },
                    },
                    created_date: '2024-01-01T00:00:00Z',
                    expenses: {
                        'Utilities': { 'Electricity': 933, 'Water': 400, 'Gas': 267 },
                        'Maintenance': { 'Cleaning': 800, 'Repairs': 1333, 'Landscaping': 300 },
                        'Insurance': 833,
                        'Taxes': 1167,
                        'Security': 600,
                        'Parking': 833,
                        'Management': 667,
                        'Legal': 500,
                    },
                    incomes: { 'Rent': 5000 },
                },
                {
                    id: 2,
                    name: 'Suburban Retail Center',
                    monthlyData: {
                        'Jan 2024': {
                            expenses: {
                                'Rent': 4000,
                                'Utilities': { 'Electricity': 800, 'Water': 300, 'Gas': 200 },
                                'Maintenance': { 'Cleaning': 600, 'Repairs': 1000, 'Landscaping': 250 },
                                'Insurance': 700,
                                'Taxes': 1000,
                                'Security': 500,
                                'Parking': 700,
                                'Management': 550,
                                'Legal': 400,
                            },
                            incomes: { 'Rent': 6000 },
                            total: 6000 - (4000 + 800 + 300 + 200 + 600 + 1000 + 250 + 700 + 1000 + 500 + 700 + 550 + 400),
                        },
                    },
                    created_date: '2024-01-01T00:00:00Z',
                    expenses: {
                        'Rent': 4000,
                        'Utilities': { 'Electricity': 800, 'Water': 300, 'Gas': 200 },
                        'Maintenance': { 'Cleaning': 600, 'Repairs': 1000, 'Landscaping': 250 },
                        'Insurance': 700,
                        'Taxes': 1000,
                        'Security': 500,
                        'Parking': 700,
                        'Management': 550,
                        'Legal': 400,
                    },
                    incomes: { 'Rent': 6000 },
                },
            ],
            expenseCategories: ['Rent', 'Utilities', 'Maintenance', 'Insurance', 'Taxes', 'Security', 'Parking', 'Management', 'Legal'],
            incomeCategories: ['Rent'],
            lastBackup: null,
        };
    }

    async initDatabase() {
        if (this._initialized) {
            return Promise.resolve();
        }

        this._initialized = true;
        this.db = {
            // Mock database tables
            properties: {
                where: () => ({ equals: () => ({ toArray: () => Promise.resolve(this.mockData.properties) }) }),
                toArray: () => Promise.resolve(this.mockData.properties),
                add: () => Promise.resolve(1),
                put: () => Promise.resolve(),
                delete: () => Promise.resolve(),
                count: () => Promise.resolve(this.mockData.properties.length),
            },
            expenseCategories: {
                where: () => ({ equals: () => ({ toArray: () => Promise.resolve(this.mockData.expenseCategories.map(c => ({ name: c, user_id: 'default' }))) }) }),
                toArray: () => Promise.resolve(this.mockData.expenseCategories.map(c => ({ name: c, user_id: 'default' }))),
                add: () => Promise.resolve(1),
                delete: () => Promise.resolve(),
                count: () => Promise.resolve(this.mockData.expenseCategories.length),
            },
            incomeCategories: {
                where: () => ({ equals: () => ({ toArray: () => Promise.resolve(this.mockData.incomeCategories.map(c => ({ name: c, user_id: 'default' }))) }) }),
                toArray: () => Promise.resolve(this.mockData.incomeCategories.map(c => ({ name: c, user_id: 'default' }))),
                add: () => Promise.resolve(1),
                delete: () => Promise.resolve(),
                count: () => Promise.resolve(this.mockData.incomeCategories.length),
            },
            expenses: {
                where: () => ({
                    equals: () => ({ toArray: () => Promise.resolve([]) }),
                    between: () => ({ and: () => ({ sortBy: () => Promise.resolve([]) }) }),
                    toArray: () => Promise.resolve([]),
                }),
                toArray: () => Promise.resolve([]),
                add: () => Promise.resolve(1),
                delete: () => Promise.resolve(),
                count: () => Promise.resolve(0),
            },
            incomes: {
                where: () => ({
                    equals: () => ({ toArray: () => Promise.resolve([]) }),
                    toArray: () => Promise.resolve([]),
                }),
                toArray: () => Promise.resolve([]),
                add: () => Promise.resolve(1),
                delete: () => Promise.resolve(),
                count: () => Promise.resolve(0),
            },
            users: {
                put: () => Promise.resolve(),
                get: () => Promise.resolve(null),
            },
            audit_log: {
                add: () => Promise.resolve(1),
                where: () => ({
                    between: () => ({ and: () => ({ reverse: () => ({ limit: () => ({ toArray: () => Promise.resolve([]) }) }) }) }),
                    equals: () => ({ toArray: () => Promise.resolve([]) }),
                }),
                toArray: () => Promise.resolve([]),
            },
            settings: {
                where: () => ({ equals: () => ({ delete: () => Promise.resolve(), toArray: () => Promise.resolve([]) }) }),
                put: () => Promise.resolve(),
                toArray: () => Promise.resolve([]),
            },
            history: {
                add: () => Promise.resolve(1),
                where: () => ({ equals: () => ({ reverse: () => ({ sortBy: () => Promise.resolve([]) }) }) }),
                orderBy: () => ({ limit: () => ({ toArray: () => Promise.resolve([]) }) }),
                count: () => Promise.resolve(0),
                bulkDelete: () => Promise.resolve(),
            },
            metadata: {
                put: () => Promise.resolve(),
                toArray: () => Promise.resolve([
                    { key: 'version', value: '2.0' },
                    { key: 'lastSaved', value: new Date().toISOString() }
                ]),
            },
            // Mock database methods
            transaction: (mode, tables, callback) => {
                if (callback) return Promise.resolve(callback());
                return Promise.resolve();
            },
            open: () => Promise.resolve(),
            delete: () => Promise.resolve(),
            close: () => {},
            export: () => Promise.resolve({}),
            import: () => Promise.resolve(),
        };

        return Promise.resolve();
    }

    async loadFromDatabase(userId = 'default') {
        // Reconstruct data in the format expected by the refactored implementation
        const properties = this.mockData.properties.map(p => ({
            id: p.id,
            name: p.name,
            created_date: p.created_date,
            monthlyData: p.monthlyData || {},
            expenses: p.expenses || {},
            incomes: p.incomes || {},
        }));

        return {
            properties,
            expenseCategories: this.mockData.expenseCategories,
            incomeCategories: this.mockData.incomeCategories,
            currentTimePeriod: 'all',
            currentView: 'overview',
            _lastSaved: new Date().toISOString(),
            currentUser: userId,
        };
    }

    async saveToDatabase(data, userId = 'default') {
        // Update mock data with new data
        if (data.properties) {
            this.mockData.properties = data.properties;
        }
        if (data.expenseCategories) {
            this.mockData.expenseCategories = data.expenseCategories;
        }
        if (data.incomeCategories) {
            this.mockData.incomeCategories = data.incomeCategories;
        }
        return Promise.resolve(true);
    }

    getPropertyData(propertyId, period) {
        const property = this.mockData.properties.find(p => p.id === propertyId);
        if (!property || !property.monthlyData[period]) {
            throw new Error(`Invalid property or period: ${propertyId}, ${period}`);
        }
        return {
            incomes: property.monthlyData[period].incomes || {},
            expenses: property.monthlyData[period].expenses || {},
        };
    }

    seedSampleData() {
        return this.mockData;
    }

    hasDataForMonthYear(month, year) {
        const period = `${month} ${year}`;
        return this.mockData.properties.some(p => p.monthlyData[period]);
    }

    getLastAvailableMonthForYear(year) {
        // Mock always has up to Dec
        return 12;
    }

    // Other methods as no-ops
    async backupDatabase() {
        return Promise.resolve();
    }

    async restoreFromBackup() {
        return Promise.resolve();
    }

    async saveToLocalStorage(data, key = null) {
        return Promise.resolve(true);
    }

    loadFromLocalStorage(key = null) {
        return null;
    }

    async save(data) {
        return Promise.resolve(true);
    }

    async load() {
        return null;
    }

    async saveHistorySnapshot(snapshot) {
        return Promise.resolve(true);
    }

    async loadHistoryFromStorage() {
        return Promise.resolve([]);
    }

    async saveSettings(settings) {
        return Promise.resolve(true);
    }

    async loadSettings() {
        return Promise.resolve({});
    }

    createBackup(data) {
        return true;
    }

    loadBackup() {
        return null;
    }

    async clearAllData(includeBackup = false) {
        return Promise.resolve(true);
    }

    async exportAllData() {
        return Promise.resolve({
            currentData: null,
            history: [],
            settings: {},
            exportDate: new Date().toISOString(),
            version: '2.0',
        });
    }

    async importData(importData) {
        return Promise.resolve(true);
    }

    validateDataForStorage(data) {
        return true;
    }

    getStorageUsage() {
        return {
            localStorage: {
                used: 0,
                limit: 5 * 1024 * 1024,
                percentage: 0,
            },
            database: {
                available: false,
                estimated: 0,
            },
        };
    }

    getStringSize(str) {
        return str.length * 2;
    }

    isStorageAvailable(type = 'localStorage') {
        return type === 'localStorage';
    }

    async getStorageStats() {
        return {
            localStorage: true,
            database: false,
            usage: this.getStorageUsage(),
            lastSaved: null,
            historyItems: 0,
        };
    }

    async initialize() {
        console.log('[STORAGE] Storage initialized');
        return Promise.resolve(true);
    }

    async getChronologicalExpenses(propertyId, startDate, endDate, userId = 'default') {
        return Promise.resolve([]);
    }

    async getMonthlyExpenseSummary(year, month, userId = 'default') {
        return Promise.resolve({});
    }

    async saveUser(userData) {
        return Promise.resolve(true);
    }

    async getUser(userId) {
        return Promise.resolve(null);
    }

    async logAuditEvent(action, entityType, entityId, userId = 'default') {
        return Promise.resolve(true);
    }

    async getAuditTrail(entityType, entityId, userId = 'default') {
        return Promise.resolve([]);
    }

    async exportUserData(userId = 'default') {
        return Promise.resolve({
            userId,
            exportDate: new Date().toISOString(),
            version: '2.0',
            data: {
                properties: [],
                expenseCategories: [],
                expenses: [],
                auditTrail: [],
            },
        });
    }

    // New methods for refactored implementation
    isIndexedDBAvailable() {
        return false; // Mock doesn't support IndexedDB
    }

    async _quickEmptyCheck() {
        return this.mockData.properties.length === 0;
    }

    _getEmptyDataStructure() {
        return {
            properties: [],
            expenseCategories: [],
            incomeCategories: []
        };
    }

    clearLoadCache() {
        this._cachedData = null;
        this._lastLoadTime = null;
        this._loadingPromise = null;
    }

    async loadFresh() {
        this.clearLoadCache();
        return await this.load();
    }

    async _performLoad() {
        await this._initPromise;
        if (this.db) {
            return await this.loadFromDatabase();
        } else {
            return this.loadFromLocalStorage();
        }
    }

    async load() {
        // Return cached data if available and recent
        if (this._cachedData && this._lastLoadTime) {
            const timeSinceLastLoad = Date.now() - this._lastLoadTime;
            const effectiveTimeout = this._cacheTimeout;

            if (timeSinceLastLoad < effectiveTimeout) {
                return this._cachedData;
            }
        }

        // If a load operation is already in progress, wait for it
        if (this._loadingPromise) {
            return await this._loadingPromise;
        }

        // Start new load operation
        this._loadingPromise = this._performLoad();
        try {
            const data = await this._loadingPromise;
            // Cache the result
            this._cachedData = data;
            this._lastLoadTime = Date.now();
            return data;
        } finally {
            this._loadingPromise = null;
        }
    }

    async save(data) {
        this.clearLoadCache();
        await this._initPromise;

        if (this.db) {
            try {
                const dbSuccess = await this.saveToDatabase(data);
                if (dbSuccess) {
                    return true;
                } else {
                    return this.saveToLocalStorage(data);
                }
            } catch (error) {
                return this.saveToLocalStorage(data);
            }
        } else {
            return this.saveToLocalStorage(data);
        }
    }

    // Query methods
    async getChronologicalExpenses(propertyId, startDate, endDate, userId = 'default') {
        // Return mock chronological data
        return [];
    }

    async getMonthlyExpenseSummary(year, month, userId = 'default') {
        // Return mock monthly summary
        return {
            'Rent': 4000,
            'Utilities': 1300,
            'Maintenance': 2950,
        };
    }

    // User management
    async saveUser(userData) {
        return Promise.resolve(true);
    }

    async getUser(userId) {
        return Promise.resolve(null);
    }

    // Audit logging
    async logAuditEvent(action, entityType, entityId, userId = 'default') {
        return Promise.resolve(true);
    }

    async getAuditTrail(entityType, entityId, userId = 'default') {
        return Promise.resolve([]);
    }

    // Export/Import
    async exportUserData(userId = 'default') {
        return Promise.resolve({
            userId,
            exportDate: new Date().toISOString(),
            version: '2.0',
            data: {
                properties: this.mockData.properties,
                expenseCategories: this.mockData.expenseCategories,
                expenses: [],
                auditTrail: [],
            },
        });
    }

    async getDataCounts() {
        return {
            transactionsCount: 0,
            propertiesCount: this.mockData.properties.length,
            categoriesCount: this.mockData.expenseCategories.length + this.mockData.incomeCategories.length,
            expenseCategoriesCount: this.mockData.expenseCategories.length,
            incomeCategoriesCount: this.mockData.incomeCategories.length,
        };
    }

    async debug() {
        console.log('[STORAGE DEBUG] Mock storage debug called');
    }

    cleanup() {
        if (this.db) {
            this.db.close();
        }
        this._initialized = false;
    }
}
