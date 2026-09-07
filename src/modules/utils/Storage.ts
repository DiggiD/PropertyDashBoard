/**
 * Storage Module
 * Handles all data persistence operations for the dashboard
 * - localStorage operations
 * - Dexie database operations
 * - Data migration and backup
 * - Storage validation and error handling
 */

import Dexie, { type Table } from 'dexie';
import logger from './Logger.js';
import { migrateToFlat } from './legacyMigrator.js';
import type { Transaction } from '../core/transactionModel.js';

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function errorName(error: unknown): string {
    return error instanceof Error ? error.name : '';
}

type CachedDashboard = {
    properties: unknown[];
    expenseCategories: unknown[];
    incomeCategories?: unknown[];
    transactions?: unknown[];
    [key: string]: unknown;
};

type PropertyRow = {
    id?: number;
    name: string;
    created_date?: string;
    user_id?: string;
};

type CategoryRow = {
    id?: number;
    name: string;
    user_id?: string;
};

type ExpenseRow = {
    id?: number;
    property_id: number;
    category: string;
    subcategory?: string | null;
    amount: number;
    expense_date?: string;
    month?: string;
    year?: number;
    user_id?: string;
};

type IncomeRow = {
    id?: number;
    property_id: number;
    category: string;
    subcategory?: string | null;
    amount: number;
    income_date?: string;
    month?: string;
    year?: number;
    user_id?: string;
};

type SettingsRow = {
    key: string;
    value: unknown;
    user_id?: string;
};

type HistoryRow = {
    id?: number;
    timestamp?: unknown;
    name?: string;
    description?: string;
    data?: unknown;
    totalExpenses?: unknown;
    propertyCount?: unknown;
    categoryCount?: unknown;
    user_id?: string;
};

type MetadataRow = {
    key: string;
    value: unknown;
};

type DashboardDB = Dexie & {
    properties: Table<PropertyRow, number>;
    expenseCategories: Table<CategoryRow, number>;
    incomeCategories: Table<CategoryRow, number>;
    expenses: Table<ExpenseRow, number>;
    incomes: Table<IncomeRow, number>;
    users: Table<Record<string, unknown>, number>;
    audit_log: Table<Record<string, unknown>, number>;
    settings: Table<SettingsRow, string>;
    history: Table<HistoryRow, number>;
    metadata: Table<MetadataRow, string>;
    export?: () => Promise<unknown>;
    import?: (data: unknown) => Promise<unknown>;
};

class Storage {
    storageKey: string;
    historyStorageKey: string;
    settingsStorageKey: string;
    backupStorageKey: string;
    db: DashboardDB | null;
    dbVersion: number;
    _initialized: boolean;
    _initPromise: Promise<void> | null;
    maxLocalStorageSize: number;
    maxHistoryItems: number;
    _loadingPromise: Promise<CachedDashboard | null> | null;
    _cachedData: CachedDashboard | null;
    _lastLoadTime: number | null;
    _cacheTimeout: number;
    _emptyCacheTimeout: number;
    logger: {
        debug: (...args: unknown[]) => void;
        info: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
    };

    constructor() {
        this.storageKey = 'sankey-property-dashboard-data';
        this.historyStorageKey = 'sankey-property-dashboard-history';
        this.settingsStorageKey = 'sankey-property-dashboard-settings';
        this.backupStorageKey = 'sankey-property-dashboard-backup';

        // Dexie database instance
        this.db = null;
        this.dbVersion = 3; // Updated for history schema with calculated fields
        this._initialized = false;  // Prevent multiple initializations
        this._initPromise = null;  // Track initialization promise

        // Storage limits
        this.maxLocalStorageSize = 5 * 1024 * 1024; // 5MB
        this.maxHistoryItems = 50;

        // Centralized loading cache to prevent duplicate operations
        this._loadingPromise = null;
        this._cachedData = null;
        this._lastLoadTime = null;
        this._cacheTimeout = 5000; // Base cache timeout for better performance (5 seconds)
        this._emptyCacheTimeout = 1000; // Shorter timeout for empty databases (1 second)

        // Create module-specific logger first
        this.logger = logger.createModuleLogger('STORAGE') as Storage['logger'];

        // Initialize Dexie database asynchronously
        this._initPromise = this.initDatabase();
    }

    /**
     * Initialize Dexie database
     * @returns {Promise<void>}
     */
    async initDatabase() {
        if (this._initialized) {
            this.logger.debug('Already initialized, skipping');
            return;
        }

        // Prevent concurrent initialization
        if (this._initPromise) {
            return this._initPromise;
        }

        this._initialized = true;

        try {
            // Check IndexedDB availability first
            if (!this.isIndexedDBAvailable()) {
                this.logger.warn('IndexedDB not available, will use localStorage fallback');
                this.db = null;
                return;
            }

            const startTime = performance.now();
            this.db = new Dexie('ExpenseDashboardDB') as DashboardDB;

            // Enhanced schema for chronological data and multi-user support
            this.db.version(this.dbVersion).stores({
                // Core data tables
                properties: '++id, name, created_date, user_id',
                expenseCategories: '++id, name, user_id',
                incomeCategories: '++id, name, user_id',

                // Enhanced expense tracking with chronological indexing
                expenses: '++id, property_id, category, subcategory, amount, expense_date, month, year, user_id, [property_id+expense_date], [property_id+month], [user_id+expense_date]',

                // Income tracking for future income categories feature
                incomes: '++id, property_id, category, subcategory, amount, income_date, month, year, user_id, [property_id+income_date], [property_id+month], [user_id+income_date]',

                // User management for future multi-user features
                users: '++id, username, email, last_sync, created_date',

                // Audit trail for data integrity
                audit_log: '++id, action, entity_type, entity_id, user_id, timestamp, [entity_type+timestamp], [user_id+timestamp]',

                // Settings and metadata
                settings: 'key, value, user_id',
                history: '++id, timestamp, name, description, data, totalExpenses, propertyCount, categoryCount, user_id',
                metadata: 'key, value',
            });

            await this.db.open();
            const initTime = performance.now() - startTime;
            this.logger.info(`Database initialized successfully in ${initTime.toFixed(2)}ms`);
        } catch (error) {
            this.logger.error('Failed to initialize database:', error);
            this.db = null;
        }
    }

    /**
     * Check if IndexedDB is available
     * @returns {boolean}
     */
    isIndexedDBAvailable() {
        try {
            if (!window.indexedDB) {
                return false;
            }
            // Test basic IndexedDB functionality
            const testDB = indexedDB.open('test', 1);
            testDB.onerror = () => {};
            testDB.onsuccess = () => {
                indexedDB.deleteDatabase('test');
            };
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Save data to localStorage with validation
     * @param {Object} data - Data to save
     * @param {string} key - Storage key (optional)
     * @returns {boolean} Success status
     */
    saveToLocalStorage(data: unknown, key: string | null = null) {
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

            this.logger.info(`Data saved to localStorage: ${storageKey}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to save to localStorage:', error);

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
    loadFromLocalStorage(key: string | null = null): CachedDashboard | null {
        const storageKey = key || this.storageKey;

        try {
            const dataString = localStorage.getItem(storageKey);
            if (!dataString) {
                this.logger.info(`No data found in localStorage: ${storageKey}`);
                return { properties: [], expenseCategories: [] };
            }

            const data = JSON.parse(dataString) as CachedDashboard;

            // Validate loaded data
            if (!this.validateDataForStorage(data)) {
                throw new Error('Loaded data validation failed');
            }

            const lastSaved = localStorage.getItem(`${storageKey}-lastSaved`);
            if (lastSaved) {
                data._lastSaved = lastSaved;
            }

            this.logger.info(`Data loaded from localStorage: ${storageKey}`);
            return data;
        } catch (error) {
            this.logger.error('Failed to load from localStorage:', error);

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
     * @param {string} userId - User ID for multi-user support (optional)
     * @returns {boolean} Success status
     */
    async saveToDatabase(data: Record<string, unknown>, userId = 'default') {
        const db = this.db;
        if (!db) {
            this.logger.warn('Database not available');
            return false;
        }

        try {
            const timestamp = new Date().toISOString();

            // Start transaction with all tables
            await db.transaction('rw', [
                'properties', 'expenseCategories', 'incomeCategories', 'expenses', 'incomes',
                'users', 'audit_log', 'metadata',
            ], async () => {

                // Clear existing user-specific data
                await db.properties.where('user_id').equals(userId).delete();
                await db.expenseCategories.where('user_id').equals(userId).delete();
                await db.incomeCategories.where('user_id').equals(userId).delete();
                await db.expenses.where('user_id').equals(userId).delete();
                await db.incomes.where('user_id').equals(userId).delete();

                if (data.properties && Array.isArray(data.properties)) {
                    for (const property of data.properties) {
                        const prop = property as Record<string, unknown>;
                        await db.properties.add({
                            id: prop.id as number | undefined,
                            name: String(prop.name),
                            created_date: String(prop.created || prop.created_date || timestamp),
                            user_id: userId,
                        });
                    }
                }

                if (Array.isArray(data.transactions)) {
                    await this._saveTransactions(data.transactions as Transaction[], userId);
                }

                // Save categories with user association
                if (data.expenseCategories && Array.isArray(data.expenseCategories)) {
                    for (const category of data.expenseCategories) {
                        await db.expenseCategories.add({
                            name: String(category),
                            user_id: userId,
                        });
                    }
                }

                // Save income categories for future feature
                if (data.incomeCategories && Array.isArray(data.incomeCategories)) {
                    for (const category of data.incomeCategories) {
                        await db.incomeCategories.add({
                            name: String(category),
                            user_id: userId,
                        });
                    }
                }

                // Save metadata
                await db.metadata.put({
                    key: 'version',
                    value: '2.0',
                });
                await db.metadata.put({
                    key: 'lastSaved',
                    value: timestamp,
                });
                await db.metadata.put({
                    key: 'currentTimePeriod',
                    value: data.currentTimePeriod || 'all',
                });
                await db.metadata.put({
                    key: 'currentView',
                    value: data.currentView || 'overview',
                });
                await db.metadata.put({
                    key: 'currentUser',
                    value: userId,
                });

                // Log audit entry
                await db.audit_log.add({
                    action: 'save',
                    entity_type: 'database',
                    entity_id: 'full_backup',
                    user_id: userId,
                    timestamp,
                });
            });

            this.logger.info(`Enhanced data saved to database successfully for user: ${userId}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to save to database:', error);
            const message = error instanceof Error ? error.message : String(error);
            // For quota exceeded errors, mark database unavailable and throw
            if (message.includes('Quota exceeded')) {
                this.db = null;
                throw error;
            }
            return false;
        }
    }

    _dateParts(dateStr: string | undefined) {
        const parsed = dateStr ? new Date(dateStr) : new Date();
        const d = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return {
            iso: d.toISOString().split('T')[0],
            year: d.getFullYear(),
            monthKey: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        };
    }

    async _saveTransactions(transactions: Transaction[], userId: string) {
        const db = this.db;
        if (!db) {
            return;
        }
        for (const txn of transactions) {
            if (!txn) {
                continue;
            }
            const parts = this._dateParts(txn.date);
            const row = {
                property_id: txn.propertyId,
                category: txn.category,
                subcategory: txn.subcategory || null,
                amount: txn.amount || 0,
                user_id: userId,
                year: parts.year,
                month: parts.monthKey,
            };
            switch (txn.type) {
                case 'income':
                    await db.incomes.add({
                        ...row,
                        income_date: parts.iso,
                    });
                    break;
                case 'expense':
                    await db.expenses.add({
                        ...row,
                        expense_date: parts.iso,
                    });
                    break;
                default: {
                    const _exhaustive: never = txn;
                    void _exhaustive;
                }
            }
        }
    }

    /**
     * Load data from Dexie database
     * @param {string} userId - User ID for multi-user support (optional)
     * @returns {Object|null} Loaded data or null if failed
     */
    async loadFromDatabase(userId = 'default') {
        if (!this.db) {
            this.logger.warn('Database not available');
            return null;
        }

        try {
            const queryStartTime = performance.now();

            // Load all data for the user in parallel for better performance
            const [properties, categories, incomeCategories, expenses, incomesFromDB, metadata] = await Promise.all([
                this.db.properties.where('user_id').equals(userId).toArray(),
                this.db.expenseCategories.where('user_id').equals(userId).toArray(),
                this.db.incomeCategories.where('user_id').equals(userId).toArray(),
                this.db.expenses.where('user_id').equals(userId).toArray(),
                this.db.incomes.where('user_id').equals(userId).toArray(),
                this.db.metadata.toArray(),
            ]);

            const queryTime = performance.now() - queryStartTime;
            this.logger.debug(`Database queries completed in ${queryTime.toFixed(2)}ms`);

            // Early return for empty database
            if (properties.length === 0 && categories.length === 0) {
                this.logger.debug(`No data found in database for user: ${userId}`);
                return null;
            }

            const propertiesData = properties.map(p => ({
                id: p.id,
                name: p.name,
                created: p.created_date,
                created_date: p.created_date,
            }));

            const data: CachedDashboard = {
                properties: propertiesData,
                expenseCategories: categories.map(c => c.name),
                incomeCategories: incomeCategories.map(c => c.name),
                transactions: this._transactionsFromTables(expenses, incomesFromDB),
            };

            // Load metadata efficiently
            const metadataMap: Record<string, unknown> = {};
            metadata.forEach(item => {
                metadataMap[item.key] = item.value;
            });

            data.currentTimePeriod = metadataMap.currentTimePeriod || 'all';
            data.currentView = metadataMap.currentView || 'overview';
            data._lastSaved = metadataMap.lastSaved;
            data.currentUser = metadataMap.currentUser || userId;

            const totalTime = performance.now() - queryStartTime;
            this.logger.info(`Data loaded from database in ${totalTime.toFixed(2)}ms:`, {
                properties: data.properties.length,
                expenseCategories: data.expenseCategories.length,
                incomeCategories: data.incomeCategories?.length || 0,
                totalExpenses: expenses.length,
                transactions: data.transactions ? data.transactions.length : 0,
            });

            return migrateToFlat(data);
        } catch (error) {
            this.logger.error('Failed to load from database:', error);

            if (errorName(error) === 'NotFoundError' || errorMessage(error).includes('object stores was not found')) {
                this.logger.warn(
                    'Database schema mismatch detected. IndexedDB left intact. Falling back to localStorage.',
                );
                this.db = null;
            }

            return null;
        }
    }

    _monthKeyToIsoDate(month: unknown) {
        if (!month || typeof month !== 'string') {
            return new Date().toISOString().split('T')[0];
        }
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const parts = month.split(' ');
        const monthIndex = monthNames.indexOf(parts[0]);
        const year = parseInt(parts[1], 10);
        if (monthIndex < 0 || !year) {
            return new Date().toISOString().split('T')[0];
        }
        return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    }

    _transactionsFromTables(expenses: ExpenseRow[], incomes: IncomeRow[]) {
        const fromExpenses = (expenses || []).map(expense => ({
            id: expense.id != null ? `exp_${expense.id}` : undefined,
            propertyId: expense.property_id,
            category: expense.category,
            subcategory: expense.subcategory || undefined,
            amount: typeof expense.amount === 'number'
                ? (expense.amount > 0 ? -Math.abs(expense.amount) : expense.amount)
                : 0,
            date: expense.expense_date || this._monthKeyToIsoDate(expense.month),
            type: 'expense',
        }));
        const fromIncomes = (incomes || []).map(income => ({
            id: income.id != null ? `inc_${income.id}` : undefined,
            propertyId: income.property_id,
            category: income.category,
            subcategory: income.subcategory || undefined,
            amount: typeof income.amount === 'number' ? Math.abs(income.amount) : 0,
            date: income.income_date || this._monthKeyToIsoDate(income.month),
            type: 'income',
        }));
        return [...fromExpenses, ...fromIncomes];
    }

    /**
     * Save data using Dexie database as primary storage with localStorage fallback
     * @param {Object} data - Data to save
     * @returns {boolean} Success status
     */
    async save(data: unknown) {
        const startTime = performance.now();

        // Clear cache when saving to ensure fresh data on next load
        this.clearLoadCache();

        // Ensure database is initialized
        await this._initPromise;

        // Use Dexie database as primary storage method
        if (this.db) {
            try {
                const dbSuccess = await this.saveToDatabase(data as Record<string, unknown>);
                const saveTime = performance.now() - startTime;

                if (dbSuccess) {
                    this.logger.info(`Data saved to Dexie database successfully in ${saveTime.toFixed(2)}ms`);
                    return true;
                } else {
                    this.logger.warn(`Database save failed after ${saveTime.toFixed(2)}ms, falling back to localStorage`);
                    // Fallback to localStorage
                    return this.saveToLocalStorage(data);
                }
            } catch (error) {
                const saveTime = performance.now() - startTime;
                this.logger.warn(`Database save failed after ${saveTime.toFixed(2)}ms, falling back to localStorage:`, errorMessage(error));
                // Fallback to localStorage
                return this.saveToLocalStorage(data);
            }
        } else {
            this.logger.warn('Database not available, using localStorage fallback');
            // Fallback to localStorage
            const success = this.saveToLocalStorage(data);
            const saveTime = performance.now() - startTime;
            this.logger.info(`Data saved to localStorage in ${saveTime.toFixed(2)}ms`);
            return success;
        }
    }

    /**
      * Quick check if database is empty to avoid expensive operations
      * @returns {Promise<boolean>} True if database is empty
      */
    async _quickEmptyCheck() {
        if (!this.db) {return true;}

        try {
            // Check if any tables have data (fast check)
            const propertyCount = await this.db.properties.count();
            const categoryCount = await this.db.expenseCategories.count();
            const transactionCount = await this.db.expenses.count();

            return propertyCount === 0 && categoryCount === 0 && transactionCount === 0;
        } catch (error) {
            this.logger.debug('Quick empty check failed:', errorMessage(error));
            return false; // Assume not empty on error
        }
    }

    /**
      * Get standardized empty data structure
      * @returns {Object} Empty data structure
      */
    _getEmptyDataStructure() {
        return {
            properties: [],
            expenseCategories: [],
            incomeCategories: [],
        };
    }

    /**
      * Clear the load cache to force fresh loading
      */
    clearLoadCache() {
        this._cachedData = null;
        this._lastLoadTime = null;
        this._loadingPromise = null;
        this.logger.debug('Load cache cleared');
    }

    /**
     * Force a fresh load bypassing cache
     * @returns {Object|null} Fresh loaded data
     */
    async loadFresh() {
        this.logger.info('Forcing fresh load, clearing cache...');
        this.clearLoadCache();
        return await this.load();
    }

    /**
      * Load data using Dexie database as primary storage with centralized caching
      * @returns {Object|null} Loaded data
      */
    async load() {
        // Return cached data if available and recent
        if (this._cachedData && this._lastLoadTime) {
            const timeSinceLastLoad = Date.now() - this._lastLoadTime;
            // OPTIMIZED: Use shorter cache timeout for empty databases
            const effectiveTimeout = (!this._cachedData ||
                (this._cachedData.properties.length === 0 &&
                 this._cachedData.expenseCategories.length === 0 &&
                 (!this._cachedData.incomeCategories || this._cachedData.incomeCategories.length === 0)))
                ? this._emptyCacheTimeout
                : this._cacheTimeout;

            if (timeSinceLastLoad < effectiveTimeout) {
                this.logger.debug(`Returning cached data (loaded ${timeSinceLastLoad}ms ago, timeout: ${effectiveTimeout}ms)`);
                return this._cachedData;
            }
        }

        // If a load operation is already in progress, wait for it
        if (this._loadingPromise) {
            this.logger.debug('Load already in progress, waiting for result...');
            return await this._loadingPromise;
        }

        // Start new load operation
        this._loadingPromise = this._performLoad();
        try {
            const data = await this._loadingPromise;
            // Cache the result (including null/empty results)
            this._cachedData = data;
            this._lastLoadTime = Date.now();
            return data;
        } finally {
            this._loadingPromise = null;
        }
    }

    /**
      * Perform the actual load operation (internal method)
      * @returns {Object|null} Loaded data
      */
    async _performLoad(): Promise<CachedDashboard | null> {
        const startTime = performance.now();
        this.logger.debug('Performing optimized data load...');

        // Ensure database is initialized before attempting to use it
        await this._initPromise;
        this.logger.debug('Database initialization complete, instance exists:', !!this.db);

        // FAST PATH: Check for empty database early
        if (this.db) {
            try {
                const emptyCheckStart = performance.now();
                // Quick check if database has any data
                const hasData = await this._quickEmptyCheck();
                const emptyCheckTime = performance.now() - emptyCheckStart;

                if (!hasData) {
                    this.logger.debug(`Empty database detected in ${emptyCheckTime.toFixed(2)}ms, using fast path`);
                    return this._getEmptyDataStructure();
                } else {
                    this.logger.debug(`Database has data (check: ${emptyCheckTime.toFixed(2)}ms), continuing with full load`);
                }
            } catch (error) {
                this.logger.debug('Quick empty check failed, continuing with full load');
            }
        }

        // Use Dexie database as primary storage method
        if (this.db) {
            this.logger.debug('Attempting to load from Dexie database...');
            try {
                const data = await this.loadFromDatabase();
                const loadTime = performance.now() - startTime;

                if (data) {
                    this.logger.info(`Data loaded from Dexie database successfully in ${loadTime.toFixed(2)}ms:`, {
                        properties: data.properties?.length || 0,
                        categories: data.expenseCategories?.length || 0,
                        transactions: data.transactions?.length || 0,
                    });
                    return data;
                } else {
                    this.logger.debug('No data found in Dexie database, returning empty structure');
                    // Return empty data structure for new installations
                    return { properties: [], expenseCategories: [], incomeCategories: [] };
                }
            } catch (error) {
                this.logger.warn(`Database load failed after ${(performance.now() - startTime).toFixed(2)}ms, falling back to localStorage:`, errorMessage(error));
                // Fallback to localStorage
                return this.loadFromLocalStorage();
            }
        } else {
            this.logger.warn('Database not available, using localStorage fallback');
            // Fallback to localStorage
            const data = this.loadFromLocalStorage();
            const loadTime = performance.now() - startTime;

            // Return null if localStorage also has no real data (consistent with database behavior)
            if (!data || (data.properties.length === 0 && data.expenseCategories.length === 0 && (!data.incomeCategories || data.incomeCategories.length === 0))) {
                this.logger.debug('No data found in localStorage either, returning null');
                return null;
            }

            this.logger.info(`Data loaded from localStorage in ${loadTime.toFixed(2)}ms`);
            return data;
        }
    }

    /**
     * Save history snapshot
     * @param {Object} snapshot - History snapshot
     * @returns {boolean} Success status
     */
    async saveHistorySnapshot(snapshot: Record<string, unknown> | null) {
        if (!snapshot) {return false;}

        try {
            this.logger.info('Saving history snapshot:', {
                id: snapshot.id,
                name: snapshot.name,
                timestamp: snapshot.timestamp,
                dataSize: JSON.stringify(snapshot).length,
                hasData: !!snapshot.data,
                dataProperties: (snapshot.data as CachedDashboard | undefined)?.properties?.length || 0,
            });

            // Ensure database is initialized
            await this.initDatabase();

            // Save to database as the only storage method
            if (this.db) {
                this.logger.info('Saving to Dexie database...');
                const dbId = await this.db.history.add({
                    timestamp: snapshot.timestamp,
                    name: snapshot.name as string | undefined,
                    description: snapshot.description as string | undefined,
                    data: snapshot.data,
                    totalExpenses: snapshot.totalExpenses,
                    propertyCount: snapshot.propertyCount,
                    categoryCount: snapshot.categoryCount,
                    user_id: 'default', // Add user_id for consistency
                });
                // Update the snapshot ID to match the database ID
                snapshot.id = dbId.toString();
                this.logger.info('History saved to Dexie database with ID:', dbId);

                // Clean up old history items to maintain limit
                const historyCount = await this.db.history.count();
                if (historyCount > this.maxHistoryItems) {
                    const excessCount = historyCount - this.maxHistoryItems;
                    const oldItems = await this.db.history.orderBy('timestamp').limit(excessCount).toArray();
                    await this.db.history.bulkDelete(
                        oldItems.map(item => item.id).filter((id): id is number => typeof id === 'number'),
                    );
                    this.logger.info(`Cleaned up ${excessCount} old history items`);
                }

                return true;
            } else {
                this.logger.error('Database unavailable for history save');
                return false;
            }
        } catch (error) {
            this.logger.error('Failed to save history snapshot:', error);
            return false;
        }
    }

    /**
     * Update history snapshot
     * @param {string} snapshotId - Snapshot ID to update
     * @param {Object} updates - Fields to update
     * @returns {boolean} Success status
     */
    async updateHistorySnapshot(snapshotId: unknown, updates: Record<string, unknown> | null) {
        if (!this.db || !snapshotId || !updates) {return false;}

        try {
            const numericId = parseInt(String(snapshotId), 10);
            if (isNaN(numericId)) {return false;}

            await this.db.history.update(numericId, updates);
            this.logger.debug('History snapshot updated:', snapshotId, updates);
            return true;
        } catch (error) {
            this.logger.error('Failed to update history snapshot:', error);
            return false;
        }
    }

    /**
     * Load history from database
     * @returns {Array} History snapshots
     */
    async loadHistoryFromStorage() {
        try {
            // Ensure database is initialized
            await this.initDatabase();

            // Use database as the only storage method
            if (this.db) {
                this.logger.info('Loading history from Dexie database...');
                const history = await this.db.history
                    .where('user_id').equals('default')
                    .reverse()
                    .sortBy('timestamp');

                this.logger.info('History loaded from Dexie database:', {
                    length: history.length,
                    items: history.map(item => ({
                        id: item.id,
                        name: item.name,
                        timestamp: item.timestamp,
                    })),
                });

                // Convert database format to expected format
                return history.map(item => ({
                    id: item.id, // Include the database ID
                    name: item.name,
                    timestamp: item.timestamp,
                    description: item.description,
                    data: item.data,
                    totalExpenses: item.totalExpenses,
                    propertyCount: item.propertyCount,
                    categoryCount: item.categoryCount,
                }));
            } else {
                this.logger.error('Database unavailable for history loading');
                return [];
            }
        } catch (error) {
            this.logger.error('Failed to load history:', error);
            return [];
        }
    }

    /**
     * Save settings
     * @param {Object} settings - Settings object
     * @returns {boolean} Success status
     */
    async saveSettings(settings: Record<string, unknown> | null) {
        if (!settings || typeof settings !== 'object' || Object.keys(settings).length === 0) {
            return false;
        }

        try {
            // Ensure database is initialized
            await this.initDatabase();

            // Save to database as the only storage method
            if (this.db) {
                // Clear existing settings and save new ones
                await this.db.settings.where('user_id').equals('default').delete();

                // Save each setting as a separate record
                for (const [key, value] of Object.entries(settings)) {
                    await this.db.settings.put({
                        key,
                        value,
                        user_id: 'default',
                    });
                }

                this.logger.info('Settings saved to Dexie database');
                return true;
            } else {
                this.logger.error('Database unavailable for settings save');
                return false;
            }
        } catch (error) {
            this.logger.error('Failed to save settings:', error);
            return false;
        }
    }

    /**
     * Load settings
     * @returns {Object} Settings object
     */
    async loadSettings() {
        try {
            // Ensure database is initialized
            await this.initDatabase();

            // Use database as the only storage method
            if (this.db) {
                const settingsRecords = await this.db.settings.where('user_id').equals('default').toArray();
                const settings: Record<string, unknown> = {};

                settingsRecords.forEach(record => {
                    settings[record.key] = record.value;
                });

                this.logger.info('Settings loaded from Dexie database:', Object.keys(settings));
                return settings;
            } else {
                this.logger.error('Database unavailable for settings loading');
                return {};
            }
        } catch (error) {
            this.logger.error('Failed to load settings:', error);
            return {};
        }
    }

    /**
     * Create backup of current data
     * @param {Object} data - Data to backup
     * @returns {boolean} Success status
     */
    createBackup(data: unknown) {
        try {
            const backup = {
                data,
                timestamp: new Date().toISOString(),
                version: '1.0',
            };

            localStorage.setItem(this.backupStorageKey, JSON.stringify(backup));
            this.logger.info('Backup created');
            return true;
        } catch (error) {
            this.logger.error('Failed to create backup:', error);
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
            this.logger.info('Backup loaded');
            return backup.data;
        } catch (error) {
            this.logger.error('Failed to load backup:', error);
            return null;
        }
    }

    /**
     * Clear all stored data
     * @param {boolean} includeBackup - Whether to clear backup too
     * @returns {boolean} Success status
     */
    async clearAllData(includeBackup = false) {
        try {
            this.logger.info('Starting data clearing process...');

            const keysToRemove = [
                this.storageKey,
                `${this.storageKey}-lastSaved`,
                this.historyStorageKey,
                this.settingsStorageKey,
            ];

            if (includeBackup) {
                keysToRemove.push(this.backupStorageKey);
            }

            // Clear localStorage keys
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                this.logger.info(`Cleared localStorage key: ${key}`);
            });

            // Clear database if available - make this synchronous
            if (this.db) {
                this.logger.info('Clearing Dexie database...');
                try {
                    await this.db.delete();
                    this.logger.info('Database deleted successfully');
                    this.db = null;
                    // Don't reinitialize here - let the page reload handle it
                } catch (dbError) {
                    this.logger.error('Error deleting database:', dbError);
                    // Continue with the process even if DB deletion fails
                }
            }

            // Also clear any other potential storage keys that might exist
            const allKeys = Object.keys(localStorage);
            allKeys.forEach(key => {
                if (key.includes('sankey') || key.includes('ExpenseDashboard') || key.includes('property-dashboard')) {
                    localStorage.removeItem(key);
                    this.logger.info(`Cleared additional key: ${key}`);
                }
            });

            this.logger.info('All data cleared successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to clear data:', error);
            return false;
        }
    }

    /**
     * Export all data
     * @returns {Object} Export data
     */
    async exportAllData() {
        const exportData: Record<string, unknown> = {
            currentData: await this.load(),
            history: await this.loadHistoryFromStorage(),
            settings: await this.loadSettings(),
            exportDate: new Date().toISOString(),
            version: '2.0',
        };

        // Add database data if available
        if (this.db) {
            try {
                const dbData = this.db.export ? await this.db.export() : null;
                exportData.database = dbData;
            } catch (error) {
                this.logger.warn('Failed to export database data:', error);
            }
        }

        return exportData;
    }

    /**
     * Import data from export
     * @param {Object} importData - Data to import
     * @returns {boolean} Success status
     */
    async importData(importData: unknown) {
        if (!importData || typeof importData !== 'object') {return false;}
        const incoming = importData as Record<string, unknown>;

        this.logger.info('Importing data with structure:', Object.keys(incoming));

        try {
            // Handle different data formats
            let dataToSave: Record<string, unknown> | null = null;

            // Check if it's export format (with currentData, history, settings)
            if (incoming.currentData) {
                this.logger.info('Detected export format');
                dataToSave = incoming.currentData as Record<string, unknown>;

                // Import history if present
                if (incoming.history && Array.isArray(incoming.history)) {
                    // Save history to database
                    if (this.db) {
                        for (const historyItem of incoming.history as HistoryRow[]) {
                            await this.db.history.add({
                                timestamp: historyItem.timestamp,
                                name: historyItem.name,
                                description: historyItem.description,
                                data: historyItem.data,
                                user_id: 'default',
                            });
                        }
                        this.logger.info('Imported history data to database');
                    } else {
                        // Fallback to localStorage
                        localStorage.setItem(this.historyStorageKey, JSON.stringify(incoming.history));
                        this.logger.info('Imported history data to localStorage');
                    }
                }

                // Import settings if present
                if (incoming.settings) {
                    await this.saveSettings(incoming.settings as Record<string, unknown>);
                    this.logger.info('Imported settings data');
                }
            }
            // Check if it's direct data format (properties, expenseCategories)
            else if (incoming.properties || incoming.expenseCategories) {
                this.logger.info('Detected direct data format');
                dataToSave = incoming;
            }
            else {
                this.logger.error('Unknown data format');
                return false;
            }

            // Save the main data
            if (dataToSave) {
                this.logger.info('Saving data:', {
                    properties: Array.isArray(dataToSave.properties) ? dataToSave.properties.length : 0,
                    categories: Array.isArray(dataToSave.expenseCategories) ? dataToSave.expenseCategories.length : 0,
                });
                const saveResult = await this.save(dataToSave);
                this.logger.info('Save result:', saveResult);

                if (!saveResult) {
                    this.logger.error('Failed to save imported data');
                    return false;
                }
            }

            // Import database data if available
            if (incoming.database && this.db?.import) {
                await this.db.import(incoming.database);
                this.logger.info('Imported database data');
            }

            this.logger.info('Data imported successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to import data:', error);
            return false;
        }
    }

    /**
     * Validate data structure before storage
     * @param {Object} data - Data to validate
     * @returns {boolean} Validation status
     */
    validateDataForStorage(data: unknown): boolean {
        if (!data || typeof data !== 'object') {
            return false;
        }
        const bag = data as Record<string, unknown>;

        // Check required properties
        if (!Array.isArray(bag.properties)) {
            return false;
        }

        if (!Array.isArray(bag.expenseCategories)) {
            return false;
        }

        // Validate properties structure
        for (const property of bag.properties) {
            if (typeof property !== 'object' || property === null) {
                this.logger.error('Invalid property format:', property);
                return false;
            }
            const prop = property as Record<string, unknown>;
            if (!prop.id || !prop.name) {
                this.logger.error('Invalid property format:', property);
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
    getStringSize(str: unknown) {
        if (str == null) {return 0;}
        return new Blob([String(str)]).size;
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
     * @returns {Promise<Object>} Storage statistics
     */
    async getStorageStats() {
        const history = await this.loadHistoryFromStorage();
        return {
            localStorage: this.isStorageAvailable('localStorage'),
            database: this.isStorageAvailable('database'),
            usage: this.getStorageUsage(),
            lastSaved: localStorage.getItem(`${this.storageKey}-lastSaved`),
            historyItems: history.length,
        };
    }

    /**
     * Initialize the storage module
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized) {
            this.logger.debug('Already initialized, skipping');
            return;
        }

        // Wait for initialization to complete
        await this._initPromise;
        this.logger.info('Storage initialized');
    }

    /**
     * Get chronological expenses for a property
     * @param {number} propertyId - Property ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {string} userId - User ID
     * @returns {Array} Chronological expenses
     */
    async getChronologicalExpenses(propertyId: unknown, startDate: unknown, endDate: unknown, userId = 'default') {
        if (!this.db) {
            this.logger.warn('Database not available for chronological queries');
            return [];
        }

        try {
            const expenses = await this.db.expenses
                .where('[property_id+expense_date]')
                .between([propertyId, startDate], [propertyId, endDate])
                .and(expense => expense.user_id === userId)
                .sortBy('expense_date');

            this.logger.info(`Found ${expenses.length} chronological expenses for property ${propertyId}`);
            return expenses;
        } catch (error) {
            this.logger.error('Failed to get chronological expenses:', error);
            return [];
        }
    }

    /**
     * Get monthly expense summary
     * @param {number} year - Year
     * @param {number} month - Month (1-12)
     * @param {string} userId - User ID
     * @returns {Object} Monthly summary
     */
    async getMonthlyExpenseSummary(year: unknown, month: unknown, userId = 'default') {
        if (!this.db) {
            this.logger.warn('Database not available for monthly summary');
            return {};
        }

        try {
            const yearNum = Number(year);
            const monthNum = Number(month);
            const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
            const endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0]; // Last day of month

            const expenses = await this.db.expenses
                .where('user_id').equals(userId)
                .and(expense => {
                    const date = expense.expense_date || '';
                    return date >= startDate && date <= endDate;
                })
                .toArray();

            const summary: Record<string, number> = {};
            expenses.forEach(expense => {
                const category = expense.category;
                if (!summary[category]) {
                    summary[category] = 0;
                }
                summary[category] += expense.amount;
            });

            this.logger.info(`Monthly summary for ${year}-${month}:`, summary);
            return summary;
        } catch (error) {
            this.logger.error('Failed to get monthly summary:', error);
            return {};
        }
    }

    /**
     * Add or update user
     * @param {Object} userData - User data
     * @returns {boolean} Success status
     */
    async saveUser(userData: Record<string, unknown>) {
        if (!this.db) {
            this.logger.warn('Database not available for user operations');
            return false;
        }

        try {
            await this.db.users.put({
                id: userData.id || Date.now(),
                username: userData.username,
                email: userData.email,
                last_sync: new Date().toISOString(),
                created_date: userData.created_date || new Date().toISOString(),
            });

            this.logger.info('User saved:', userData.username);
            return true;
        } catch (error) {
            this.logger.error('Failed to save user:', error);
            return false;
        }
    }

    /**
     * Get user by ID
     * @param {string} userId - User ID
     * @returns {Object|null} User data
     */
    async getUser(userId: unknown) {
        if (!this.db) {
            this.logger.warn('Database not available for user queries');
            return null;
        }

        try {
            const user = await this.db.users.get(Number(userId));
            return user || null;
        } catch (error) {
            this.logger.error('Failed to get user:', error);
            return null;
        }
    }

    /**
     * Log audit event
     * @param {string} action - Action performed
     * @param {string} entityType - Type of entity
     * @param {string} entityId - Entity ID
     * @param {string} userId - User ID
     * @returns {boolean} Success status
     */
    async logAuditEvent(action: unknown, entityType: unknown, entityId: unknown, userId = 'default') {
        if (!this.db) {
            this.logger.warn('Database not available for audit logging');
            return false;
        }

        try {
            await this.db.audit_log.add({
                action,
                entity_type: entityType,
                entity_id: entityId,
                user_id: userId,
                timestamp: new Date().toISOString(),
            });

            this.logger.info(`Audit logged: ${action} on ${entityType}:${entityId}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to log audit event:', error);
            return false;
        }
    }

    /**
     * Get audit trail for entity
     * @param {string} entityType - Entity type
     * @param {string} entityId - Entity ID
     * @param {string} userId - User ID
     * @returns {Array} Audit trail
     */
    async getAuditTrail(entityType: unknown, entityId: unknown, userId = 'default') {
        if (!this.db) {
            this.logger.warn('Database not available for audit queries');
            return [];
        }

        try {
            const auditTrail = await this.db.audit_log
                .where('[entity_type+timestamp]')
                .between([entityType, '0000-00-00'], [entityType, '9999-99-99'])
                .and(entry => entry.entity_id === entityId && entry.user_id === userId)
                .reverse()
                .limit(50)
                .toArray();

            this.logger.info(`Found ${auditTrail.length} audit entries for ${entityType}:${entityId}`);
            return auditTrail;
        } catch (error) {
            this.logger.error('Failed to get audit trail:', error);
            return [];
        }
    }

    /**
     * Export user-specific data
     * @param {string} userId - User ID
     * @returns {Object} User data export
     */
    async exportUserData(userId = 'default') {
        if (!this.db) {
            this.logger.warn('Database not available for export');
            return null;
        }

        try {
            const [properties, categories, expenses, auditTrail] = await Promise.all([
                this.db.properties.where('user_id').equals(userId).toArray(),
                this.db.expenseCategories.where('user_id').equals(userId).toArray(),
                this.db.expenses.where('user_id').equals(userId).toArray(),
                this.db.audit_log.where('user_id').equals(userId).toArray(),
            ]);

            const exportData = {
                userId,
                exportDate: new Date().toISOString(),
                version: '2.0',
                data: {
                    properties,
                    expenseCategories: categories.map(c => c.name),
                    expenses,
                    auditTrail,
                },
            };

            this.logger.info(`Exported data for user ${userId}:`, {
                properties: properties.length,
                categories: categories.length,
                expenses: expenses.length,
                auditEntries: auditTrail.length,
            });

            return exportData;
        } catch (error) {
            this.logger.error('Failed to export user data:', error);
            return null;
        }
    }

    /**
     * Get standardized data counts for consistency across modules
     * @returns {Promise<Object>} Standardized data counts
     */
    async getDataCounts() {
        try {
            // Load current data to get accurate counts
            const data = await this.load();

            if (!data) {
                return {
                    transactionsCount: 0,
                    propertiesCount: 0,
                    categoriesCount: 0,
                    expenseCategoriesCount: 0,
                    incomeCategoriesCount: 0,
                };
            }

            const bag = data as CachedDashboard;
            const transactionsCount = Array.isArray(bag.transactions) ? bag.transactions.length : 0;
            const propertiesCount = Array.isArray(bag.properties) ? bag.properties.length : 0;
            const expenseCategoriesCount = Array.isArray(bag.expenseCategories) ? bag.expenseCategories.length : 0;
            const incomeCategoriesCount = Array.isArray(bag.incomeCategories) ? bag.incomeCategories.length : 0;
            const categoriesCount = expenseCategoriesCount + incomeCategoriesCount;

            return {
                transactionsCount,
                propertiesCount,
                categoriesCount,
                expenseCategoriesCount,
                incomeCategoriesCount,
            };
        } catch (error) {
            this.logger.error('Failed to get data counts:', error);
            return {
                transactionsCount: 0,
                propertiesCount: 0,
                categoriesCount: 0,
                expenseCategoriesCount: 0,
                incomeCategoriesCount: 0,
            };
        }
    }

    /**
     * Debug storage information
     */
    async debug() {
        this.logger.info('=== STORAGE INFORMATION ===');
        this.logger.info('localStorage available:', this.isStorageAvailable('localStorage'));
        this.logger.info('Database available:', this.isStorageAvailable('database'));
        this.logger.info('Storage usage:', this.getStorageUsage());
        const stats = await this.getStorageStats();
        this.logger.info('Storage stats:', stats);
        this.logger.info('=== END DEBUG ===');
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.db) {
            this.db.close();
        }
        this._initialized = false;  // Reset for potential re-initg
    }
}

// Export for use in other modules
export default Storage;

// Expose globally for Babel standalone transpilation.
// Window.Storage is the DOM Storage constructor, so this assignment is a name collision on purpose.
(window as unknown as { Storage: typeof Storage }).Storage = Storage;
