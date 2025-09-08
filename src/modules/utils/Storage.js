/**
 * Storage Module
 * Handles all data persistence operations for the expense dashboard
 * - localStorage operations
 * - Dexie database operations
 * - Data migration and backup
 * - Storage validation and error handling
 */

class Storage {
    constructor() {
        this.storageKey = 'sankey-property-dashboard-data';
        this.historyStorageKey = 'sankey-property-dashboard-history';
        this.settingsStorageKey = 'sankey-property-dashboard-settings';
        this.backupStorageKey = 'sankey-property-dashboard-backup';

        // Dexie database instance
        this.db = null;
        this.dbVersion = 1;

        // Storage limits
        this.maxLocalStorageSize = 5 * 1024 * 1024; // 5MB
        this.maxHistoryItems = 50;

        // Initialize Dexie database
        this.initDatabase();
    }

    /**
     * Initialize Dexie database
     */
    async initDatabase() {
        if (typeof Dexie === 'undefined') {
            console.warn('🔧 [STORAGE] Dexie not available, falling back to localStorage only');
            return;
        }

        try {
            this.db = new Dexie('ExpenseDashboardDB');

            this.db.version(this.dbVersion).stores({
                properties: '++id, name',
                expenseCategories: '++id, name',
                settings: 'key, value',
                history: '++id, timestamp, name, description, data',
                metadata: 'key, value',
            });

            await this.db.open();
            console.log('🔧 [STORAGE] Database initialized successfully');
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to initialize database:', error);
            this.db = null;
        }
    }

    /**
     * Save data to localStorage with validation
     * @param {Object} data - Data to save
     * @param {string} key - Storage key (optional)
     * @returns {boolean} Success status
     */
    saveToLocalStorage(data, key = null) {
        const storageKey = key || this.storageKey;

        try {
            // Validate data before saving
            if (!this.validateDataForStorage(data)) {
                throw new Error('Data validation failed');
            }

            const dataString = JSON.stringify(data);

            // Check size limits
            if (this.getStringSize(dataString) > this.maxLocalStorageSize) {
                throw new Error('Data size exceeds localStorage limit');
            }

            localStorage.setItem(storageKey, dataString);
            localStorage.setItem(`${storageKey}-lastSaved`, new Date().toISOString());

            console.log(`🔧 [STORAGE] Data saved to localStorage: ${storageKey}`);
            return true;
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to save to localStorage:', error);

            // Try to save backup if main save fails
            if (key !== this.backupStorageKey) {
                this.createBackup(data);
            }

            return false;
        }
    }

    /**
     * Load data from localStorage
     * @param {string} key - Storage key (optional)
     * @returns {Object|null} Loaded data or null if failed
     */
    loadFromLocalStorage(key = null) {
        const storageKey = key || this.storageKey;

        try {
            const dataString = localStorage.getItem(storageKey);
            if (!dataString) {
                console.log(`🔧 [STORAGE] No data found in localStorage: ${storageKey}`);
                return null;
            }

            const data = JSON.parse(dataString);

            // Validate loaded data
            if (!this.validateDataForStorage(data)) {
                throw new Error('Loaded data validation failed');
            }

            const lastSaved = localStorage.getItem(`${storageKey}-lastSaved`);
            if (lastSaved) {
                data._lastSaved = lastSaved;
            }

            console.log(`🔧 [STORAGE] Data loaded from localStorage: ${storageKey}`);
            return data;
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to load from localStorage:', error);

            // Try to load from backup
            if (key !== this.backupStorageKey) {
                return this.loadBackup();
            }

            return null;
        }
    }

    /**
     * Save data to Dexie database
     * @param {Object} data - Data to save
     * @returns {boolean} Success status
     */
    async saveToDatabase(data) {
        if (!this.db) {
            console.warn('🔧 [STORAGE] Database not available');
            return false;
        }

        try {
            // Start transaction
            await this.db.transaction('rw', ['properties', 'expenseCategories', 'metadata'], async () => {
                // Clear existing data
                await this.db.properties.clear();
                await this.db.expenseCategories.clear();

                // Save properties
                if (data.properties && Array.isArray(data.properties)) {
                    for (const property of data.properties) {
                        await this.db.properties.add({
                            id: property.id,
                            name: property.name,
                            quarterlyData: property.quarterlyData || {},
                            categoryTrends: property.categoryTrends || {},
                        });
                    }
                }

                // Save categories
                if (data.expenseCategories && Array.isArray(data.expenseCategories)) {
                    for (const category of data.expenseCategories) {
                        await this.db.expenseCategories.add({ name: category });
                    }
                }

                // Save metadata
                await this.db.metadata.put({
                    key: 'version',
                    value: '1.0',
                });
                await this.db.metadata.put({
                    key: 'lastSaved',
                    value: new Date().toISOString(),
                });
                await this.db.metadata.put({
                    key: 'currentTimePeriod',
                    value: data.currentTimePeriod || 'all',
                });
                await this.db.metadata.put({
                    key: 'currentView',
                    value: data.currentView || 'overview',
                });
            });

            console.log('🔧 [STORAGE] Data saved to database successfully');
            return true;
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to save to database:', error);
            return false;
        }
    }

    /**
     * Load data from Dexie database
     * @returns {Object|null} Loaded data or null if failed
     */
    async loadFromDatabase() {
        if (!this.db) {
            console.warn('🔧 [STORAGE] Database not available');
            return null;
        }

        try {
            const [properties, categories, metadata] = await Promise.all([
                this.db.properties.toArray(),
                this.db.expenseCategories.toArray(),
                this.db.metadata.toArray(),
            ]);

            const data = {
                properties: properties.map(p => ({
                    id: p.id,
                    name: p.name,
                    quarterlyData: p.quarterlyData || {},
                    categoryTrends: p.categoryTrends || {},
                    expenses: this.calculateExpensesFromQuarterly(p.quarterlyData),
                })),
                expenseCategories: categories.map(c => c.name),
            };

            // Load metadata
            const metadataMap = {};
            metadata.forEach(item => {
                metadataMap[item.key] = item.value;
            });

            data.currentTimePeriod = metadataMap.currentTimePeriod || 'all';
            data.currentView = metadataMap.currentView || 'overview';
            data._lastSaved = metadataMap.lastSaved;

            console.log('🔧 [STORAGE] Data loaded from database successfully');
            return data;
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to load from database:', error);
            return null;
        }
    }

    /**
     * Calculate expenses from quarterly data
     * @param {Object} quarterlyData - Quarterly data object
     * @returns {Object} Expenses object
     */
    calculateExpensesFromQuarterly(quarterlyData) {
        const expenses = {};

        if (!quarterlyData) {return expenses;}

        // Get the most recent quarter
        const quarters = Object.keys(quarterlyData).sort();
        const latestQuarter = quarters[quarters.length - 1];

        if (latestQuarter && quarterlyData[latestQuarter]?.expenses) {
            Object.assign(expenses, quarterlyData[latestQuarter].expenses);
        }

        return expenses;
    }

    /**
     * Save data using best available storage method
     * @param {Object} data - Data to save
     * @returns {boolean} Success status
     */
    async save(data) {
        // Try database first, then localStorage as fallback
        const dbSuccess = await this.saveToDatabase(data);
        const localSuccess = this.saveToLocalStorage(data);

        return dbSuccess || localSuccess;
    }

    /**
     * Load data using best available storage method
     * @returns {Object|null} Loaded data
     */
    async load() {
        // Try database first, then localStorage as fallback
        let data = await this.loadFromDatabase();

        if (!data) {
            data = this.loadFromLocalStorage();
        }

        return data;
    }

    /**
     * Save history snapshot
     * @param {Object} snapshot - History snapshot
     * @returns {boolean} Success status
     */
    async saveHistorySnapshot(snapshot) {
        if (!snapshot) {return false;}

        try {
            // Save to localStorage
            const history = this.loadHistoryFromStorage() || [];
            history.unshift(snapshot);

            // Keep only recent items
            if (history.length > this.maxHistoryItems) {
                history.splice(this.maxHistoryItems);
            }

            localStorage.setItem(this.historyStorageKey, JSON.stringify(history));

            // Save to database if available
            if (this.db) {
                await this.db.history.add({
                    timestamp: snapshot.timestamp,
                    name: snapshot.name,
                    description: snapshot.description,
                    data: snapshot.data,
                });
            }

            console.log('🔧 [STORAGE] History snapshot saved');
            return true;
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to save history snapshot:', error);
            return false;
        }
    }

    /**
     * Load history from storage
     * @returns {Array} History snapshots
     */
    loadHistoryFromStorage() {
        try {
            const historyString = localStorage.getItem(this.historyStorageKey);
            return historyString ? JSON.parse(historyString) : [];
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to load history:', error);
            return [];
        }
    }

    /**
     * Save settings
     * @param {Object} settings - Settings object
     * @returns {boolean} Success status
     */
    saveSettings(settings) {
        try {
            localStorage.setItem(this.settingsStorageKey, JSON.stringify(settings));
            console.log('🔧 [STORAGE] Settings saved');
            return true;
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to save settings:', error);
            return false;
        }
    }

    /**
     * Load settings
     * @returns {Object} Settings object
     */
    loadSettings() {
        try {
            const settingsString = localStorage.getItem(this.settingsStorageKey);
            return settingsString ? JSON.parse(settingsString) : {};
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to load settings:', error);
            return {};
        }
    }

    /**
     * Create backup of current data
     * @param {Object} data - Data to backup
     * @returns {boolean} Success status
     */
    createBackup(data) {
        try {
            const backup = {
                data,
                timestamp: new Date().toISOString(),
                version: '1.0',
            };

            localStorage.setItem(this.backupStorageKey, JSON.stringify(backup));
            console.log('🔧 [STORAGE] Backup created');
            return true;
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to create backup:', error);
            return false;
        }
    }

    /**
     * Load data from backup
     * @returns {Object|null} Backup data
     */
    loadBackup() {
        try {
            const backupString = localStorage.getItem(this.backupStorageKey);
            if (!backupString) {return null;}

            const backup = JSON.parse(backupString);
            console.log('🔧 [STORAGE] Backup loaded');
            return backup.data;
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to load backup:', error);
            return null;
        }
    }

    /**
     * Clear all stored data
     * @param {boolean} includeBackup - Whether to clear backup too
     * @returns {boolean} Success status
     */
    clearAllData(includeBackup = false) {
        try {
            const keysToRemove = [
                this.storageKey,
                `${this.storageKey}-lastSaved`,
                this.historyStorageKey,
                this.settingsStorageKey,
            ];

            if (includeBackup) {
                keysToRemove.push(this.backupStorageKey);
            }

            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
            });

            // Clear database if available
            if (this.db) {
                this.db.delete().then(() => {
                    console.log('🔧 [STORAGE] Database cleared');
                    this.db = null;
                    this.initDatabase(); // Reinitialize
                });
            }

            console.log('🔧 [STORAGE] All data cleared');
            return true;
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to clear data:', error);
            return false;
        }
    }

    /**
     * Export all data
     * @returns {Object} Export data
     */
    async exportAllData() {
        const exportData = {
            currentData: await this.load(),
            history: this.loadHistoryFromStorage(),
            settings: this.loadSettings(),
            exportDate: new Date().toISOString(),
            version: '1.0',
        };

        // Add database data if available
        if (this.db) {
            try {
                const dbData = await this.db.export();
                exportData.database = dbData;
            } catch (error) {
                console.warn('🔧 [STORAGE] Failed to export database data:', error);
            }
        }

        return exportData;
    }

    /**
     * Import data from export
     * @param {Object} importData - Data to import
     * @returns {boolean} Success status
     */
    async importData(importData) {
        if (!importData) {return false;}

        try {
            // Import current data
            if (importData.currentData) {
                await this.save(importData.currentData);
            }

            // Import history
            if (importData.history && Array.isArray(importData.history)) {
                localStorage.setItem(this.historyStorageKey, JSON.stringify(importData.history));
            }

            // Import settings
            if (importData.settings) {
                this.saveSettings(importData.settings);
            }

            // Import database data if available
            if (importData.database && this.db) {
                await this.db.import(importData.database);
            }

            console.log('🔧 [STORAGE] Data imported successfully');
            return true;
        } catch (error) {
            console.error('🔧 [STORAGE] Failed to import data:', error);
            return false;
        }
    }

    /**
     * Validate data structure before storage
     * @param {Object} data - Data to validate
     * @returns {boolean} Validation status
     */
    validateDataForStorage(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }

        // Check required properties
        if (!Array.isArray(data.properties)) {
            return false;
        }

        if (!Array.isArray(data.expenseCategories)) {
            return false;
        }

        // Validate properties structure
        for (const property of data.properties) {
            if (!property.id || !property.name) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get storage usage information
     * @returns {Object} Storage usage info
     */
    getStorageUsage() {
        let localStorageUsed = 0;
        const databaseUsed = 0;

        // Calculate localStorage usage
        for (const key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                localStorageUsed += this.getStringSize(localStorage[key]) + this.getStringSize(key);
            }
        }

        return {
            localStorage: {
                used: localStorageUsed,
                limit: this.maxLocalStorageSize,
                percentage: (localStorageUsed / this.maxLocalStorageSize) * 100,
            },
            database: {
                available: !!this.db,
                estimated: databaseUsed,
            },
        };
    }

    /**
     * Get string size in bytes
     * @param {string} str - String to measure
     * @returns {number} Size in bytes
     */
    getStringSize(str) {
        return new Blob([str]).size;
    }

    /**
     * Check if storage is available
     * @param {string} type - Storage type ('localStorage' or 'database')
     * @returns {boolean} Availability status
     */
    isStorageAvailable(type = 'localStorage') {
        if (type === 'database') {
            return !!this.db;
        }

        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get storage statistics
     * @returns {Object} Storage statistics
     */
    getStorageStats() {
        return {
            localStorage: this.isStorageAvailable('localStorage'),
            database: this.isStorageAvailable('database'),
            usage: this.getStorageUsage(),
            lastSaved: localStorage.getItem(`${this.storageKey}-lastSaved`),
            historyItems: this.loadHistoryFromStorage().length,
        };
    }

    /**
     * Initialize the storage module
     * @returns {Promise<void>}
     */
    async initialize() {
        // Initialize Dexie database
        await this.initDatabase();
        console.log('🔧 [STORAGE] Storage initialized');
    }

    /**
     * Debug storage information
     */
    debug() {
        console.log('🔧 [STORAGE DEBUG] === STORAGE INFORMATION ===');
        console.log('🔧 [STORAGE DEBUG] localStorage available:', this.isStorageAvailable('localStorage'));
        console.log('🔧 [STORAGE DEBUG] Database available:', this.isStorageAvailable('database'));
        console.log('🔧 [STORAGE DEBUG] Storage usage:', this.getStorageUsage());
        console.log('🔧 [STORAGE DEBUG] Storage stats:', this.getStorageStats());
        console.log('🔧 [STORAGE DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
} else {
    window.Storage = Storage;
}
