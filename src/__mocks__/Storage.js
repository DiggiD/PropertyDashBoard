// filepath: src/__mocks__/Storage.js

export default class MockStorage {
    constructor() {
        this.mockData = {
            properties: [
                {
                    id: 1,
                    name: 'Downtown Office Complex',
                    monthlyData: {
                        'Jan 2023': {
                            expenses: {
                                'Utilities': { 'Electricity': -933, 'Water': -400, 'Gas': -267 },
                                'Maintenance': { 'Cleaning': -800, 'Repairs': -1333, 'Landscaping': -300 },
                                'Insurance': -833,
                                'Taxes': -1167,
                                'Security': -600,
                                'Parking': -833,
                                'Management': -667,
                                'Legal': -500,
                            },
                            incomes: { 'Rent': 5000 },
                        },
                        'Feb 2023': {
                            expenses: {
                                'Utilities': { 'Electricity': -933, 'Water': -400, 'Gas': -267 },
                                'Maintenance': { 'Cleaning': -800, 'Repairs': -1333, 'Landscaping': -300 },
                                'Insurance': -833,
                                'Taxes': -1167,
                                'Security': -600,
                                'Parking': -833,
                                'Management': -667,
                                'Legal': -500,
                            },
                            incomes: { 'Rent': 5000 },
                        },
                        'Mar 2023': {
                            expenses: {
                                'Utilities': { 'Electricity': -933, 'Water': -400, 'Gas': -267 },
                                'Maintenance': { 'Cleaning': -800, 'Repairs': -1333, 'Landscaping': -300 },
                                'Insurance': -833,
                                'Taxes': -1167,
                                'Security': -600,
                                'Parking': -833,
                                'Management': -667,
                                'Legal': -500,
                            },
                            incomes: { 'Rent': 5000 },
                        },
                    },
                },
                {
                    id: 2,
                    name: 'Suburban Retail Center',
                    monthlyData: {
                        'Jan 2023': {
                            expenses: {
                                'Rent': -4000,
                                'Utilities': { 'Electricity': -800, 'Water': -300, 'Gas': -200 },
                                'Maintenance': { 'Cleaning': -600, 'Repairs': -1000, 'Landscaping': -250 },
                                'Insurance': -700,
                                'Taxes': -1000,
                                'Security': -500,
                                'Parking': -700,
                                'Management': -550,
                                'Legal': -400,
                            },
                        },
                        'Feb 2023': {
                            expenses: {
                                'Rent': -4000,
                                'Utilities': { 'Electricity': -800, 'Water': -300, 'Gas': -200 },
                                'Maintenance': { 'Cleaning': -600, 'Repairs': -1000, 'Landscaping': -250 },
                                'Insurance': -700,
                                'Taxes': -1000,
                                'Security': -500,
                                'Parking': -700,
                                'Management': -550,
                                'Legal': -400,
                            },
                        },
                        'Mar 2023': {
                            expenses: {
                                'Rent': -4000,
                                'Utilities': { 'Electricity': -800, 'Water': -300, 'Gas': -200 },
                                'Maintenance': { 'Cleaning': -600, 'Repairs': -1000, 'Landscaping': -250 },
                                'Insurance': -700,
                                'Taxes': -1000,
                                'Security': -500,
                                'Parking': -700,
                                'Management': -550,
                                'Legal': -400,
                            },
                        },
                    },
                },
            ],
            lastBackup: null,
        };
    }

    async initDatabase() {
        return Promise.resolve(true);
    }

    async loadFromDatabase() {
        return Promise.resolve(this.mockData);
    }

    async saveToDatabase(data) {
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

    async debug() {
        console.log('[STORAGE DEBUG] Mock storage debug called');
    }

    cleanup() {
        // No-op
    }
}
