import logger from '../utils/Logger.js';
import { migrateToFlat } from '../utils/legacyMigrator.js';
import {
    parseTransaction,
    type AggregatedSankey,
    type DashboardData,
    type PropertyRecord,
    type Transaction,
    type TransactionQuery,
    type TransactionType,
} from './transactionModel.js';

type StoragePort = {
    load: () => Promise<unknown>;
    save: (data: unknown) => Promise<unknown>;
};

type StoreOptions = {
    debounceMs: number;
    maxTransactions: number;
};

type ChangeListener = (changeType: string, data: unknown) => void;
/**
 * TransactionStore Module
 * Reactive data store for normalized flat transaction data
 *
 * @class TransactionStore
 *
 * Core Responsibilities:
 * - Manage normalized flat transaction arrays
 * - Reactive change detection using Proxy
 * - Persistence with Dexie.js and localStorage fallback
 * - Memoized query methods for performance
 *
 * Key Features:
 * - Normalized data model: transactions as flat objects
 * - Reactive updates with Proxy-based change detection
 * - Efficient queries with O(n) complexity using filters
 * - Automatic debounced persistence
 * - Event-driven reactivity with callbacks
 *
 * Data Model:
 * Transaction: {
 *   id: string,
 *   propertyId: number,
 *   category: string,
 *   subcategory?: string,
 *   amount: number, // negative for expenses, positive for income
 *   date: string, // ISO date string
 *   type: 'expense' | 'income',
 *   description?: string
 * }
 *
 * @example
 * ```javascript
 * const store = new TransactionStore(storage);
 * await store.initialize();
 *
 * // Add transaction
 * const txnId = store.addTransaction({
 *   propertyId: 1,
 *   category: 'Utilities',
 *   subcategory: 'Electricity',
 *   amount: -1200,
 *   date: '2025-01-15',
 *   type: 'expense'
 * });
 *
 * // Query transactions
 * const expenses = store.queryTransactions({
 *   type: 'expense',
 *   propertyId: 1,
 *   dateRange: { start: '2025-01-01', end: '2025-01-31' }
 * });
 * ```
 */

class TransactionStore {
    storage: StoragePort;
    _validator: unknown;
    _formatter: unknown;
    options: StoreOptions;
    _isInitialized: boolean;
    transactions!: Transaction[];
    properties!: Map<PropertyRecord['id'], PropertyRecord>;
    categories!: Set<string>;
    incomeCategories!: Set<string>;
    _reactiveTransactions: Transaction[] | null;
    _changeListeners!: Set<ChangeListener>;
    _debounceTimer: ReturnType<typeof setTimeout> | null;
    _hasUnsavedChanges: boolean;
    _lastSaved: Date | null;
    _queryCache!: Map<string, unknown>;
    _cacheInvalidationTimer: ReturnType<typeof setTimeout> | null;
    _lastCacheInvalidation: number | null;

    constructor(
        storage: StoragePort,
        validator: unknown = null,
        formatter: unknown = null,
        options: Partial<StoreOptions> = {},
    ) {
        this.storage = storage;
        this._validator = validator;
        this._formatter = formatter;
        this.options = {
            debounceMs: 500,
            maxTransactions: 10000,
            ...options,
        };

        this._isInitialized = false;
        this._reactiveTransactions = null;
        this._debounceTimer = null;
        this._hasUnsavedChanges = false;
        this._lastSaved = null;
        this._cacheInvalidationTimer = null;
        this._lastCacheInvalidation = null;

        logger.info('TRANSACTIONSTORE', 'TransactionStore constructor completed (lightweight)');
    }

    /**
      * Initialize the store with existing data or migrate legacy data - EXPANDED
      * @param {Object} initialData - Optional initial data to load
      */
    async replaceData(data: unknown) {
        this._initializeDataStructures();
        await this._loadFromData(data);
        this._setupReactiveProxy();
        this._isInitialized = true;
        this._hasUnsavedChanges = false;
        this._lastSaved = new Date();
        this._notifyChange('import', { transactionCount: this.transactions.length });
    }

    async initialize(initialData: unknown = null) {
        if (this._isInitialized) {
            logger.info('TRANSACTIONSTORE', 'Already initialized, skipping');
            return;
        }

        const initStart = performance.now();

        try {
            logger.info('TRANSACTIONSTORE', 'Starting optimized initialization...');

            // EARLY EMPTY DETECTION: Check if we have meaningful data upfront
            const seed = initialData as DashboardData | null;
            const hasInitialData = seed && (
                (seed.transactions && seed.transactions.length > 0) ||
                (seed.properties && seed.properties.length > 0) ||
                (seed.expenseCategories && seed.expenseCategories.length > 0)
            );

            // EXPANDED: Initialize all data structures (moved from constructor)
            this._initializeDataStructures();

            logger.info('TRANSACTIONSTORE', 'Initial data provided', !!seed);
            if (seed) {
                logger.info('TRANSACTIONSTORE', 'Initial data keys', Object.keys(seed));
                logger.info('TRANSACTIONSTORE', 'Initial data transactions', seed.transactions?.length || 0);
                logger.info('TRANSACTIONSTORE', 'Initial data properties', seed.properties?.length || 0);
            }

            if (seed) {
                logger.info('TRANSACTIONSTORE', 'Initializing with provided data');
                await this._loadFromData(seed);
            } else {
                // FAST PATH: Check storage for existing data first
                logger.info('TRANSACTIONSTORE', 'Checking storage for existing data...');
                const storageCheckStart = performance.now();
                const stored = await this.storage.load() as DashboardData | null;
                const storageCheckTime = performance.now() - storageCheckStart;

                // EARLY EMPTY DETECTION: If no meaningful data, skip expensive operations
                if (!stored || (stored.properties.length === 0 && stored.expenseCategories.length === 0)) {
                    logger.info('TRANSACTIONSTORE', `No stored data found (storage check: ${storageCheckTime.toFixed(2)}ms), using fast empty initialization`);
                    this._initializeEmpty();
                } else {
                    logger.info('TRANSACTIONSTORE', 'Found stored data, loading normally');
                    logger.info('TRANSACTIONSTORE', 'Storage.load() returned', {
                        hasData: !!stored,
                        hasTransactions: !!(stored && stored.transactions),
                        transactionsCount: stored?.transactions?.length || 0,
                        propertiesCount: stored?.properties?.length || 0,
                        categoriesCount: stored?.expenseCategories?.length || 0,
                    });

                    if (stored && stored.transactions) {
                        logger.info('TRANSACTIONSTORE', 'Found stored transaction data');
                        await this._loadFromData(stored);
                    } else {
                        logger.info('TRANSACTIONSTORE', 'No stored transactions, initializing empty store');
                        this._initializeEmpty();
                    }
                }
            }

            // Setup reactive proxy
            this._setupReactiveProxy();

            this._isInitialized = true;
            this._hasUnsavedChanges = false;
            this._lastSaved = new Date();

            const initTime = performance.now() - initStart;
            logger.info('TRANSACTIONSTORE', `Full initialization complete in ${initTime.toFixed(2)}ms`);
            logger.info('TRANSACTIONSTORE', `Transactions: ${this.transactions.length}`);
            logger.info('TRANSACTIONSTORE', `Properties: ${this.properties.size}`);
            logger.info('TRANSACTIONSTORE', `Categories: ${this.categories.size}`);

        } catch (error) {
            logger.error('TRANSACTIONSTORE', 'Error during initialization', error);
            this._initializeEmpty();
            this._setupReactiveProxy();
            this._isInitialized = true;
        }
    }

    /**
      * Initialize data structures - moved from constructor for performance
      */
    _initializeDataStructures() {
        // Core data structure - normalized flat transactions
        this.transactions = [];
        this.properties = new Map(); // id -> property metadata
        this.categories = new Set(); // expense categories
        this.incomeCategories = new Set(); // income categories

        // Reactive state
        this._reactiveTransactions = null;
        this._changeListeners = new Set();

        // Persistence
        this._debounceTimer = null;
        this._hasUnsavedChanges = false;
        this._lastSaved = null;

        // Query memoization cache
        this._queryCache = new Map();
        this._cacheInvalidationTimer = null;
        this._lastCacheInvalidation = null;

        logger.info('TRANSACTIONSTORE', 'Data structures initialized');
    }

    /**
     * Setup reactive proxy for change detection
     */
    _setupReactiveProxy() {
        const self = this;

        this._reactiveTransactions = new Proxy(this.transactions, {
            set(target, property, value) {
                const result = Reflect.set(target, property, value);

                if (result && typeof property === 'string') {
                    const index = parseInt(property);
                    if (!isNaN(index) || property === 'length') {
                        self._notifyChange('transaction', { type: 'update', index, value });
                        self._markAsChanged();
                        self._invalidateCache();
                    }
                }

                return result;
            },

            deleteProperty(target, property) {
                const result = Reflect.deleteProperty(target, property);

                if (result && typeof property === 'string') {
                    const index = parseInt(property);
                    if (!isNaN(index)) {
                        self._notifyChange('transaction', { type: 'delete', index });
                        self._markAsChanged();
                        self._invalidateCache();
                    }
                }

                return result;
            },
        });
    }

    /**
      * Load data from provided data object - OPTIMIZED for performance
      */
    async _loadFromData(data: unknown) {
        const loadStart = performance.now();
        logger.info('TRANSACTIONSTORE', 'Starting optimized data loading...');

        const loaded = migrateToFlat(data) as DashboardData & { categories?: string[] };

        const hasTransactions = Array.isArray(loaded.transactions) && loaded.transactions.length > 0;
        const hasProperties = loaded.properties && loaded.properties.length > 0;
        const hasCategories = (Array.isArray(loaded.expenseCategories) && loaded.expenseCategories.length > 0) ||
                            (Array.isArray(loaded.incomeCategories) && loaded.incomeCategories.length > 0);

        if (!hasTransactions && !hasProperties && !hasCategories) {
            logger.info('TRANSACTIONSTORE', 'No data to load, skipping expensive operations');
            const loadTime = performance.now() - loadStart;
            logger.info('TRANSACTIONSTORE', `Fast empty data loading completed in ${loadTime.toFixed(2)}ms`);
            return;
        }

        // OPTIMIZED: Parallel processing of different data types (only for non-empty data)
        const promises: Promise<void>[] = [];

        // Process transactions asynchronously
        if (hasTransactions) {
            promises.push(this._processTransactionsOptimized(loaded.transactions));
        }

        // Process properties asynchronously
        if (hasProperties) {
            promises.push(this._processPropertiesOptimized(loaded.properties));
        }

        // Process categories asynchronously
        if (hasCategories) {
            promises.push(this._processCategoriesOptimized(loaded));
        }

        // Wait for all parallel operations to complete
        if (promises.length > 0) {
            await Promise.all(promises);
        }

        const loadTime = performance.now() - loadStart;
        logger.info('TRANSACTIONSTORE', `Optimized data loading completed in ${loadTime.toFixed(2)}ms`);
        logger.info('TRANSACTIONSTORE', `Loaded ${this.transactions.length} transactions, ${this.properties.size} properties, ${this.categories.size} categories`);
    }

    /**
     * Process transactions with optimized validation
     */
    async _processTransactionsOptimized(transactions: unknown[]) {
        logger.info('TRANSACTIONSTORE', `Processing ${transactions.length} transactions...`);

        // OPTIMIZED: Increased batch size for better performance
        const batchSize = 500; // Increased from 100 to 500 for better throughput
        const validatedTransactions: Transaction[] = [];

        for (let i = 0; i < transactions.length; i += batchSize) {
            const batch = transactions.slice(i, i + batchSize);
            const batchPromises = batch.map(txn => this._validateTransactionOptimized(txn));
            const batchResults = await Promise.all(batchPromises);

            // Filter out null results and add to validated transactions
            validatedTransactions.push(...batchResults.filter((row): row is Transaction => row !== null));
        }

        this.transactions = validatedTransactions;

        // Update categories metadata from loaded transactions
        validatedTransactions.forEach(txn => {
            this.categories.add(txn.category);
            if (txn.type === 'income') {
                this.incomeCategories.add(txn.category);
            }
        });

        logger.info('TRANSACTIONSTORE', `Validated ${validatedTransactions.length} transactions`);
    }

    /**
     * Optimized transaction validation
     */
    _validateTransactionOptimized(txn: unknown): Transaction | null {
        return parseTransaction(txn, () => this.generateId());
    }

    /**
     * Process properties with optimized loading
     */
    async _processPropertiesOptimized(properties: unknown) {
        if (Array.isArray(properties)) {
            properties.forEach(item => {
                const prop = (Array.isArray(item) ? item[1] : item) as PropertyRecord | undefined;
                if (prop && prop.id !== null && prop.id !== undefined) {
                    this.properties.set(prop.id, {
                        id: prop.id,
                        name: prop.name || `Property ${prop.id}`,
                        created: prop.created || prop.created_date || new Date().toISOString(),
                    });
                }
            });
        } else if (properties instanceof Map) {
            this.properties = new Map(properties as Map<PropertyRecord['id'], PropertyRecord>);
        }
    }


    /**
     * Process categories with optimized loading
     */
    async _processCategoriesOptimized(data: DashboardData & { categories?: string[] }) {
        const expenseCategories = data.expenseCategories || data.categories;
        if (Array.isArray(expenseCategories)) {
            this.categories = new Set(expenseCategories);
        }
        if (Array.isArray(data.incomeCategories)) {
            this.incomeCategories = new Set(data.incomeCategories);
        }
    }





    /**
     * Initialize empty store
     */
    _initializeEmpty() {
        this.transactions = [];
        this.properties = new Map();
        this.categories = new Set();
        this.incomeCategories = new Set();
    }

    /**
     * Validate transaction object
     */
    _validateTransaction(txn: unknown): Transaction | null {
        const validated = parseTransaction(txn, () => this.generateId());
        if (!validated) {
            logger.warn('TRANSACTIONSTORE', 'Invalid transaction', txn);
            return null;
        }
        return validated;
    }

    /**
     * Add change listener
     */
    onChange(callback: ChangeListener) {
        this._changeListeners.add(callback);
    }

    /**
     * Remove change listener
     */
    offChange(callback: ChangeListener) {
        this._changeListeners.delete(callback);
    }

    /**
     * Notify listeners of changes
     */
    _notifyChange(changeType: string, data: unknown) {
        this._changeListeners.forEach(callback => {
            try {
                callback(changeType, data);
            } catch (error) {
                logger.error('TRANSACTIONSTORE', 'Error in change listener', error);
            }
        });
    }

    /**
     * Mark store as having unsaved changes
     */
    _markAsChanged() {
        this._hasUnsavedChanges = true;
        this._debounceSave();
    }

    /**
     * Debounce save operation
     */
    _debounceSave() {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        this._debounceTimer = setTimeout(() => {
            this._saveToStorage();
        }, this.options.debounceMs);
    }

    /**
     * Save to storage
     */
    async _saveToStorage() {
        if (!this._hasUnsavedChanges) {return;}

        try {
            const dataToSave = {
                transactions: this.transactions,
                properties: Array.from(this.properties.values()).map(prop => ({
                    id: prop.id,
                    name: prop.name,
                    created: prop.created,
                })),
                expenseCategories: Array.from(this.categories),
                incomeCategories: Array.from(this.incomeCategories),
                version: '1.0',
                lastSaved: new Date().toISOString(),
            };

            const success = await this.storage.save(dataToSave);
            if (success) {
                this._hasUnsavedChanges = false;
                this._lastSaved = new Date();
                logger.info('TRANSACTIONSTORE', 'Data saved to storage');
            } else {
                logger.error('TRANSACTIONSTORE', 'Failed to save data to storage');
            }
        } catch (error) {
            logger.error('TRANSACTIONSTORE', 'Error saving to storage', error);
        }
    }

    /**
     * Persist data immediately (for testing)
     */
    async persist() {
        return this._saveToStorage();
    }

    /**
     * Invalidate query cache - OPTIMIZED with smart invalidation
     */
    _invalidateCache() {
        if (this._cacheInvalidationTimer) {
            clearTimeout(this._cacheInvalidationTimer);
        }
        this._queryCache.clear();
        this._lastCacheInvalidation = Date.now();
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ===== PUBLIC API METHODS =====

    /**
     * Add a new transaction
     */
    addTransaction(transactionData: unknown) {
        const validatedTxn = this._validateTransaction(transactionData);
        if (!validatedTxn) {
            throw new Error('Invalid transaction data');
        }

        // Check limits
        if (this.transactions.length >= this.options.maxTransactions) {
            throw new Error(`Maximum transactions limit (${this.options.maxTransactions}) reached`);
        }

        this.transactions.push(validatedTxn);

        // Update metadata
        this.categories.add(validatedTxn.category);
        if (validatedTxn.type === 'income') {
            this.incomeCategories.add(validatedTxn.category);
        }

        // Ensure property exists in metadata
        if (!this.properties.has(validatedTxn.propertyId)) {
            this.properties.set(validatedTxn.propertyId, {
                id: validatedTxn.propertyId,
                name: `Property ${validatedTxn.propertyId}`,
                created: new Date().toISOString(),
            });
        }

        this._notifyChange('transaction', { type: 'add', transaction: validatedTxn });
        this._markAsChanged();
        this._invalidateCache();

        return validatedTxn.id;
    }

    /**
     * Update an existing transaction
     */
    updateTransaction(transactionId: string, updates: Record<string, unknown>) {
        const index = this.transactions.findIndex(t => t.id === transactionId);
        if (index === -1) {
            throw new Error('Transaction not found');
        }

        const existingTxn = this.transactions[index];
        const updatedTxn = { ...existingTxn, ...updates, id: transactionId };

        const validatedTxn = this._validateTransaction(updatedTxn);
        if (!validatedTxn) {
            throw new Error('Invalid transaction update data');
        }

        this.transactions[index] = validatedTxn;

        // Update categories if changed
        if (updates.category) {
            this.categories.add(validatedTxn.category);
            if (validatedTxn.type === 'income') {
                this.incomeCategories.add(validatedTxn.category);
            }
        }

        this._notifyChange('transaction', { type: 'update', transaction: validatedTxn });
        this._markAsChanged();
        this._invalidateCache();

        return validatedTxn;
    }

    /**
     * Delete a transaction
     */
    deleteTransaction(transactionId: string) {
        const index = this.transactions.findIndex(t => t.id === transactionId);
        if (index === -1) {
            throw new Error('Transaction not found');
        }

        const deletedTxn = this.transactions.splice(index, 1)[0];

        this._notifyChange('transaction', { type: 'delete', transaction: deletedTxn });
        this._markAsChanged();
        this._invalidateCache();

        return deletedTxn;
    }

    /**
      * Query transactions with filters - OPTIMIZED for performance
      */
    queryTransactions(filters: TransactionQuery = {}): Transaction[] {
        // OPTIMIZED: Skip expensive operations when no data exists
        if (this._isEmpty()) {
            logger.debug('TRANSACTIONSTORE', 'Empty store, returning empty results');
            return [];
        }

        const cacheKey = JSON.stringify(filters);
        if (this._queryCache.has(cacheKey)) {
            return this._queryCache.get(cacheKey) as Transaction[];
        }

        const queryStart = performance.now();
        let results = [...this.transactions];

        // OPTIMIZED: Early return for empty results
        if (results.length === 0) {
            this._queryCache.set(cacheKey, results);
            return results;
        }

        // OPTIMIZED: Apply filters in order of selectivity (most selective first)
        if (filters.propertyId !== undefined) {
            results = results.filter(t => t.propertyId === filters.propertyId);
            if (results.length === 0) {
                this._queryCache.set(cacheKey, results);
                return results;
            }
        }

        if (filters.type) {
            results = results.filter(t => t.type === filters.type);
            if (results.length === 0) {
                this._queryCache.set(cacheKey, results);
                return results;
            }
        }

        if (filters.category) {
            results = results.filter(t => t.category === filters.category);
            if (results.length === 0) {
                this._queryCache.set(cacheKey, results);
                return results;
            }
        }

        if (filters.subcategory) {
            results = results.filter(t => t.subcategory === filters.subcategory);
            if (results.length === 0) {
                this._queryCache.set(cacheKey, results);
                return results;
            }
        }

        if (filters.dateRange) {
            const { start, end } = filters.dateRange;
            results = results.filter(t => {
                const txnDate = t.date;
                if (start && txnDate < start) {return false;}
                if (end && txnDate > end) {return false;}
                return true;
            });
            if (results.length === 0) {
                this._queryCache.set(cacheKey, results);
                return results;
            }
        }

        if (filters.amountRange) {
            const { min, max } = filters.amountRange;
            results = results.filter(t => {
                if (min !== undefined && t.amount < min) {return false;}
                if (max !== undefined && t.amount > max) {return false;}
                return true;
            });
        }

        // OPTIMIZED: Apply sorting only if needed
        if (filters.sortBy) {
            const { field, order = 'asc' } = filters.sortBy;
            results.sort((a, b) => {
                const rawA = a[field as keyof Transaction];
                const rawB = b[field as keyof Transaction];
                let aVal: string | number | Date = rawA as string | number;
                let bVal: string | number | Date = rawB as string | number;

                if (field === 'date') {
                    aVal = new Date(String(rawA));
                    bVal = new Date(String(rawB));
                }

                if (aVal < bVal) {return order === 'asc' ? -1 : 1;}
                if (aVal > bVal) {return order === 'asc' ? 1 : -1;}
                return 0;
            });
        } else {
            // Default sort by date descending - only if not already sorted
            results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        // OPTIMIZED: Apply pagination efficiently
        if (filters.limit) {
            const offset = filters.offset || 0;
            results = results.slice(offset, offset + filters.limit);
        }

        this._queryCache.set(cacheKey, results);

        const queryTime = performance.now() - queryStart;

        // PERFORMANCE MONITORING: Record query performance
        if (window.performanceOptimizer) {
            window.performanceOptimizer.recordDataManagerOperation(`query_${Object.keys(filters).join('_')}`, queryTime);
        }

        if (queryTime > 15) {
            logger.warn('TRANSACTIONSTORE', `Query took ${queryTime.toFixed(2)}ms for ${filters}`);
        }

        return results;
    }

    /**
      * Check if store is empty for optimization
      * @returns {boolean} True if store is empty
      */
    _isEmpty() {
        return this.transactions.length === 0 &&
               this.properties.size === 0 &&
               this.categories.size === 0 &&
               this.incomeCategories.size === 0;
    }

    /**
      * Query properties with their transaction summaries
      */
    queryProperties(filters: TransactionQuery = {}) {
        // OPTIMIZED: Skip expensive operations when no data exists
        if (this._isEmpty()) {
            logger.debug('TRANSACTIONSTORE', 'Empty store, returning empty properties');
            return [];
        }

        const cacheKey = `properties_${JSON.stringify(filters)}`;
        if (this._queryCache.has(cacheKey)) {
            return this._queryCache.get(cacheKey);
        }

        const properties: Array<PropertyRecord & {
            transactionCount: number;
            totalExpenses: number;
            totalIncome: number;
            netAmount: number;
            categories: unknown;
            lastTransaction: string | null;
        }> = [];

        this.properties.forEach((propMeta, propertyId) => {
            // Get transactions for this property
            const propertyTxns = this.queryTransactions({ propertyId, ...filters });

            // Calculate summary
            const summary = this._calculatePropertySummary(propertyTxns);

            properties.push({
                ...propMeta,
                transactionCount: propertyTxns.length,
                totalExpenses: summary.expenses,
                totalIncome: summary.income,
                netAmount: summary.net,
                categories: summary.categories,
                lastTransaction: propertyTxns.length > 0 ? propertyTxns[0].date : null,
            });
        });

        // Apply sorting
        if (filters.sortBy) {
            const { field, order = 'asc' } = filters.sortBy;
            properties.sort((a, b) => {
                const aVal = a[field as keyof typeof a] as string | number;
                const bVal = b[field as keyof typeof b] as string | number;

                if (aVal < bVal) {return order === 'asc' ? -1 : 1;}
                if (aVal > bVal) {return order === 'asc' ? 1 : -1;}
                return 0;
            });
        }

        this._queryCache.set(cacheKey, properties);
        return properties;
    }

    /**
     * Query categories with transaction summaries
     */
    queryCategories(filters: TransactionQuery | string = {}) {
        const normalized = typeof filters === 'string' ? { type: filters } : (filters || {});
        const { sortBy, ...txnFilters } = normalized;
        const cacheKey = `categories_${JSON.stringify(normalized)}`;
        if (this._queryCache.has(cacheKey)) {
            return this._queryCache.get(cacheKey);
        }

        type CategorySummary = {
            name: string;
            type: TransactionType;
            transactionCount: number;
            totalAmount: number;
            subcategories: Map<string, { name: string; transactionCount: number; totalAmount: number }>;
            properties: Set<PropertyRecord['id']>;
        };
        const categories = new Map<string, CategorySummary>();
        const txns = this.queryTransactions(txnFilters);

        txns.forEach(txn => {
            const key = txn.category;
            if (!categories.has(key)) {
                categories.set(key, {
                    name: key,
                    type: txn.type,
                    transactionCount: 0,
                    totalAmount: 0,
                    subcategories: new Map(),
                    properties: new Set(),
                });
            }

            const cat = categories.get(key);
            if (!cat) {
                return;
            }
            cat.transactionCount++;
            cat.totalAmount += txn.amount;
            cat.properties.add(txn.propertyId);

            if (txn.subcategory) {
                if (!cat.subcategories.has(txn.subcategory)) {
                    cat.subcategories.set(txn.subcategory, {
                        name: txn.subcategory,
                        transactionCount: 0,
                        totalAmount: 0,
                    });
                }
                const subcat = cat.subcategories.get(txn.subcategory);
                if (!subcat) {
                    return;
                }
                subcat.transactionCount++;
                subcat.totalAmount += txn.amount;
            }
        });

        // Convert to array and sort
        const result = Array.from(categories.values()).map(cat => ({
            ...cat,
            subcategories: Array.from(cat.subcategories.values()),
            properties: Array.from(cat.properties),
        }));

        if (sortBy) {
            const { field, order = 'asc' } = sortBy;
            result.sort((a, b) => {
                const aVal = a[field as keyof typeof a];
                const bVal = b[field as keyof typeof b];

                if (aVal < bVal) {return order === 'asc' ? -1 : 1;}
                if (aVal > bVal) {return order === 'asc' ? 1 : -1;}
                return 0;
            });
        } else {
            result.sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount));
        }

        this._queryCache.set(cacheKey, result);
        return result;
    }

    /**
      * Get aggregated sankey data (compatible with existing DataManager API) - OPTIMIZED
      */
    queryAggregatedSankey(period = 'all', year: string | number | null = null, month: string | number | null = null): AggregatedSankey {
        // OPTIMIZED: Skip expensive operations when no data exists
        if (this._isEmpty()) {
            logger.debug('TRANSACTIONSTORE', 'Empty store, returning empty sankey data');
            return {
                hasIncome: false,
                sources: new Map(),
                propIncomes: new Map(),
                propExpenses: new Map(),
                catTotals: new Map(),
                subTotals: new Map(),
            };
        }

        const cacheKey = `sankey_${period}_${year}_${month}`;
        if (this._queryCache.has(cacheKey)) {
            return this._queryCache.get(cacheKey) as AggregatedSankey;
        }

        const sankeyStart = performance.now();

        // Get date range for period filtering
        const dateRange = this._getDateRangeForPeriod(period, year, month);

        // OPTIMIZED: Query transactions with early filtering for better performance
        const allTxns = this.queryTransactions({
            dateRange,
            sortBy: { field: 'date', order: 'desc' },
        });

        if (allTxns.length === 0) {
            const emptyResult = {
                hasIncome: false,
                sources: new Map(),
                propIncomes: new Map(),
                propExpenses: new Map(),
                catTotals: new Map(),
                subTotals: new Map(),
            };
            this._queryCache.set(cacheKey, emptyResult);
            return emptyResult;
        }

        // OPTIMIZED: Pre-allocate maps for better performance
        type PropAgg = {
            expenses: Map<string, number>;
            totalExpenses: number;
            incomes: Map<string, number>;
            totalIncome: number;
        };
        const propData = new Map<PropertyRecord['id'], PropAgg>();
        const sources = new Map<string, number>();
        const propIncomes = new Map<PropertyRecord['id'], number>();
        const propExpenses = new Map<PropertyRecord['id'], number>();
        const catTotals = new Map<string, number>();
        const subTotals = new Map<string, Map<string, number>>();

        // OPTIMIZED: Single pass aggregation
        let hasIncome = false;

        for (const txn of allTxns) {
            if (!propData.has(txn.propertyId)) {
                propData.set(txn.propertyId, {
                    expenses: new Map(),
                    totalExpenses: 0,
                    incomes: new Map(),
                    totalIncome: 0,
                });
            }

            const prop = propData.get(txn.propertyId);
            if (!prop) {
                continue;
            }

            if (txn.type === 'expense') {
                const categoryKey = txn.subcategory ? `${txn.category}:${txn.subcategory}` : txn.category;
                const amount = Math.abs(txn.amount);

                prop.expenses.set(categoryKey, (prop.expenses.get(categoryKey) || 0) + amount);
                prop.totalExpenses += amount;

                // Aggregate category totals
                if (txn.subcategory) {
                    if (!subTotals.has(txn.category)) {
                        subTotals.set(txn.category, new Map());
                    }
                    const subMap = subTotals.get(txn.category);
                    if (subMap) {
                        subMap.set(txn.subcategory, (subMap.get(txn.subcategory) || 0) + amount);
                    }
                    catTotals.set(txn.category, (catTotals.get(txn.category) || 0) + amount);
                } else {
                    catTotals.set(txn.category, (catTotals.get(txn.category) || 0) + amount);
                }
            } else {
                // Income transaction
                const incomeAmount = Math.abs(txn.amount);
                prop.incomes.set(txn.category, (prop.incomes.get(txn.category) || 0) + incomeAmount);
                prop.totalIncome += incomeAmount;
                hasIncome = true;

                // Aggregate income sources
                sources.set(txn.category, (sources.get(txn.category) || 0) + incomeAmount);
            }
        }

        // OPTIMIZED: Set property totals in single pass
        propData.forEach((prop, propertyId) => {
            propIncomes.set(propertyId, prop.totalIncome);
            propExpenses.set(propertyId, prop.totalExpenses);
        });

        const result = {
            hasIncome,
            sources,
            propIncomes,
            propExpenses,
            catTotals,
            subTotals,
        };

        this._queryCache.set(cacheKey, result);

        const sankeyTime = performance.now() - sankeyStart;

        // PERFORMANCE MONITORING: Record sankey aggregation performance
        if (window.performanceOptimizer) {
            window.performanceOptimizer.recordDataManagerOperation('sankey_aggregation', sankeyTime);
        }

        if (sankeyTime > 20) {
            logger.warn('TRANSACTIONSTORE', `Sankey aggregation took ${sankeyTime.toFixed(2)}ms for ${allTxns.length} transactions`);
        }

        return result;
    }

    /**
     * Group transactions by month/year
     */
    groupByMonthYear(filters: TransactionQuery = {}) {
        const cacheKey = `groupby_${JSON.stringify(filters)}`;
        if (this._queryCache.has(cacheKey)) {
            return this._queryCache.get(cacheKey);
        }

        const txns = this.queryTransactions(filters);
        const grouped = new Map();

        txns.forEach(txn => {
            const date = new Date(txn.date);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const key = `${String(month).padStart(2, '0')}/${year}`;

            if (!grouped.has(key)) {
                grouped.set(key, {
                    period: key,
                    year,
                    month,
                    transactions: [],
                    totalExpenses: 0,
                    totalIncome: 0,
                    netAmount: 0,
                    categories: new Map(),
                });
            }

            const group = grouped.get(key);
            if (!group) {
                return;
            }
            group.transactions.push(txn);

            if (txn.type === 'expense') {
                group.totalExpenses += Math.abs(txn.amount);
            } else {
                group.totalIncome += txn.amount;
            }

            group.netAmount = group.totalIncome - group.totalExpenses;

            // Track categories
            const catKey = txn.subcategory ? `${txn.category}:${txn.subcategory}` : txn.category;
            group.categories.set(catKey, (group.categories.get(catKey) || 0) + txn.amount);
        });

        // Convert to sorted array
        const result = Array.from(grouped.values()).sort((a, b) => {
            if (a.year !== b.year) {return b.year - a.year;}
            return b.month - a.month;
        });

        this._queryCache.set(cacheKey, result);
        return result;
    }

    /**
     * Calculate property summary from transactions
     */
    _calculatePropertySummary(transactions: Transaction[]) {
        const summary = {
            expenses: 0,
            income: 0,
            net: 0,
            categories: new Map(),
        };

        transactions.forEach(txn => {
            if (txn.type === 'expense') {
                summary.expenses += Math.abs(txn.amount);
            } else {
                summary.income += txn.amount;
            }

            const catKey = txn.subcategory ? `${txn.category}:${txn.subcategory}` : txn.category;
            summary.categories.set(catKey, (summary.categories.get(catKey) || 0) + txn.amount);
        });

        summary.net = summary.income - summary.expenses;
        return summary;
    }

    /**
     * Get date range for period
     */
    _getDateRangeForPeriod(
        period: string,
        year: string | number | null,
        month: string | number | null = null,
    ): { start: string; end: string } | null {
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        switch (period) {
            case 'month': {
                const selectedYear = year ? parseInt(String(year), 10) : now.getFullYear();
                let selectedMonth = (month !== null && month !== 'all')
                    ? parseInt(String(month), 10) - 1 // Convert to 0-based
                    : now.getMonth();

                // Clamp to valid month range (0-11), fallback to January if invalid
                if (selectedMonth < 0 || selectedMonth > 11) {
                    selectedMonth = 0;
                }

                startDate = new Date(selectedYear, selectedMonth, 1);
                endDate = new Date(selectedYear, selectedMonth + 1, 0);
                break;
            }

            case 'year':
                if (year) {
                    const yearNum = parseInt(String(year), 10);
                    startDate = new Date(yearNum, 0, 1);
                    endDate = new Date(yearNum, 11, 31);
                } else {
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = new Date(now.getFullYear(), 11, 31);
                }
                break;

            case 'all':
            default:
                return null; // No date filtering
        }

        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
        };
    }

    /**
     * Get all transactions (for debugging)
     */
    getAllTransactions() {
        return [...this.transactions];
    }

    /**
     * Get store statistics
     */
    getStatistics() {
        const txns = this.transactions;
        const expenseTxns = txns.filter(t => t.type === 'expense');
        const incomeTxns = txns.filter(t => t.type === 'income');

        return {
            totalTransactions: txns.length,
            expenseTransactions: expenseTxns.length,
            incomeTransactions: incomeTxns.length,
            totalProperties: this.properties.size,
            totalCategories: this.categories.size,
            totalIncomeCategories: this.incomeCategories.size,
            totalExpenses: expenseTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0),
            totalIncome: incomeTxns.reduce((sum, t) => sum + t.amount, 0),
            netAmount: incomeTxns.reduce((sum, t) => sum + t.amount, 0) - expenseTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0),
            hasUnsavedChanges: this._hasUnsavedChanges,
            lastSaved: this._lastSaved,
        };
    }

    /**
     * Get standardized data counts for consistency across modules
     * @returns {Object} Standardized data counts
     */
    getDataCounts() {
        return {
            transactionsCount: this.transactions.length,
            propertiesCount: this.properties.size,
            categoriesCount: this.categories.size + this.incomeCategories.size, // Combined count
            expenseCategoriesCount: this.categories.size,
            incomeCategoriesCount: this.incomeCategories.size,
        };
    }

    /**
     * Clear all data
     */
    async clearAllData() {
        this.transactions = [];
        this.properties = new Map();
        this.categories = new Set();
        this.incomeCategories = new Set();

        this._queryCache.clear();
        this._hasUnsavedChanges = true;

        await this._saveToStorage();

        this._notifyChange('clear', {});
    }

    /**
     * Export data
     */
    exportData(): DashboardData {
        return {
            transactions: this.transactions,
            properties: Array.from(this.properties.values()).map(prop => ({
                id: prop.id,
                name: prop.name,
                created: prop.created,
            })),
            expenseCategories: Array.from(this.categories),
            incomeCategories: Array.from(this.incomeCategories),
            version: '1.0',
            exportedAt: new Date().toISOString(),
        };
    }


    /**
     * Import data
     */
    async importData(data: unknown) {
        const incoming = data as (DashboardData & { categories?: unknown }) | null;
        logger.info('TRANSACTIONSTORE', 'Starting importData with', {
            hasData: !!incoming,
            dataType: typeof incoming,
            dataKeys: incoming ? Object.keys(incoming) : 'N/A',
            hasTransactions: !!(incoming && incoming.transactions),
            transactionsType: incoming && incoming.transactions ? typeof incoming.transactions : 'N/A',
            transactionsLength: incoming && incoming.transactions ? incoming.transactions.length : 'N/A',
            hasProperties: !!(incoming && incoming.properties),
            propertiesType: incoming && incoming.properties ? typeof incoming.properties : 'N/A',
            hasCategories: !!(incoming && incoming.categories),
            categoriesType: incoming && incoming.categories ? typeof incoming.categories : 'N/A',
        });

        if (!incoming || !incoming.transactions) {
            logger.error('TRANSACTIONSTORE', 'Import validation failed', {
                dataExists: !!incoming,
                transactionsExists: !!(incoming && incoming.transactions),
                dataValue: incoming,
            });
            throw new Error('Invalid import data');
        }

        logger.info('TRANSACTIONSTORE', 'Import validation passed, proceeding with import...');

        try {
            await this._loadFromData(incoming);
            logger.info('TRANSACTIONSTORE', '_loadFromData completed successfully');

            this._setupReactiveProxy();
            logger.info('TRANSACTIONSTORE', '_setupReactiveProxy completed');

            this._hasUnsavedChanges = true;
            await this._saveToStorage();
            logger.info('TRANSACTIONSTORE', '_saveToStorage completed');

            logger.info('TRANSACTIONSTORE', 'Import completed successfully, notifying listeners...');
            this._notifyChange('import', { transactionCount: this.transactions.length });

            return true; // Explicit success return
        } catch (error) {
            logger.error('TRANSACTIONSTORE', 'Import failed during processing', error);
            return false; // Explicit failure return
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        if (this._cacheInvalidationTimer) {
            clearTimeout(this._cacheInvalidationTimer);
        }
        this._changeListeners.clear();
        this._queryCache.clear();
    }
}

// Export for use in other modules
export default TransactionStore;

declare global {
    interface Window {
        TransactionStore: typeof TransactionStore;
        performanceOptimizer?: {
            recordDataManagerOperation: (name: string, ms: number) => void;
        };
    }
}

// Expose globally for browser environments
if (typeof window !== 'undefined') {
    window.TransactionStore = TransactionStore;
}
