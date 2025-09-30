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
 * - Legacy data migration from hierarchical structure
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
    constructor(storage, options = {}) {
        this.storage = storage;
        this.options = {
            debounceMs: 500,
            maxTransactions: 10000,
            ...options
        };

        // Core data structure - normalized flat transactions
        this.transactions = [];
        this.properties = new Map(); // id -> property metadata
        this.categories = new Set(); // expense categories
        this.incomeCategories = new Set(); // income categories

        // Reactive state
        this._reactiveTransactions = null;
        this._changeListeners = new Set();
        this._isInitialized = false;

        // Persistence
        this._debounceTimer = null;
        this._hasUnsavedChanges = false;
        this._lastSaved = null;

        // Query memoization cache
        this._queryCache = new Map();
        this._cacheInvalidationTimer = null;
        this._lastCacheInvalidation = null;

        console.log('[TRANSACTIONSTORE] TransactionStore initialized');
    }

    /**
     * Initialize the store with existing data or migrate legacy data
     * @param {Object} initialData - Optional initial data to load
     */
    async initialize(initialData = null) {
        if (this._isInitialized) {
            console.log('[TRANSACTIONSTORE] Already initialized, skipping');
            return;
        }

        try {
            console.log('[TRANSACTIONSTORE] Starting initialization...');

            if (initialData) {
                console.log('[TRANSACTIONSTORE] Initializing with provided data');
                await this._loadFromData(initialData);
            } else {
                // Try to load from storage
                console.log('[TRANSACTIONSTORE] Loading from storage...');
                const stored = await this.storage.load();
                if (stored && stored.transactions) {
                    console.log('[TRANSACTIONSTORE] Found stored transaction data');
                    await this._loadFromData(stored);
                } else {
                    console.log('[TRANSACTIONSTORE] No stored data found, checking for legacy data');
                    // Check for legacy hierarchical data to migrate
                    const legacyData = await this._checkForLegacyData();
                    if (legacyData) {
                        console.log('[TRANSACTIONSTORE] Found legacy data, migrating...');
                        await this._migrateLegacyData(legacyData);
                    } else {
                        console.log('[TRANSACTIONSTORE] No data found, initializing empty store');
                        this._initializeEmpty();
                    }
                }
            }

            // Setup reactive proxy
            this._setupReactiveProxy();

            this._isInitialized = true;
            this._hasUnsavedChanges = false;
            this._lastSaved = new Date();

            console.log('[TRANSACTIONSTORE] Initialization complete');
            console.log(`[TRANSACTIONSTORE] Transactions: ${this.transactions.length}`);
            console.log(`[TRANSACTIONSTORE] Properties: ${this.properties.size}`);
            console.log(`[TRANSACTIONSTORE] Categories: ${this.categories.size}`);

        } catch (error) {
            console.error('[TRANSACTIONSTORE] Error during initialization:', error);
            this._initializeEmpty();
            this._setupReactiveProxy();
            this._isInitialized = true;
        }
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
            }
        });
    }

    /**
     * Load data from provided data object
     */
    async _loadFromData(data) {
        // Load transactions
        if (Array.isArray(data.transactions)) {
            this.transactions = data.transactions.map(txn => this._validateTransaction(txn)).filter(Boolean);
        }

        // Load properties metadata
        if (data.properties) {
            if (Array.isArray(data.properties)) {
                // Check if it's an array of [key, value] pairs (from Array.from(map.entries()))
                if (data.properties.length > 0 && Array.isArray(data.properties[0])) {
                    // Convert [key, value] pairs back to Map
                    this.properties = new Map(data.properties);
                } else {
                    // Convert array of property objects to Map
                    data.properties.forEach(prop => {
                        if (prop && prop.id) {
                            this.properties.set(prop.id, {
                                id: prop.id,
                                name: prop.name || `Property ${prop.id}`,
                                created: prop.created || new Date().toISOString()
                            });
                        }
                    });
                }
            } else if (data.properties instanceof Map) {
                this.properties = new Map(data.properties);
            }
        }

        // Load categories
        if (Array.isArray(data.categories)) {
            this.categories = new Set(data.categories);
        }
        if (Array.isArray(data.incomeCategories)) {
            this.incomeCategories = new Set(data.incomeCategories);
        }

        console.log(`[TRANSACTIONSTORE] Loaded ${this.transactions.length} transactions`);
    }

    /**
     * Check for legacy hierarchical data to migrate
     */
    async _checkForLegacyData() {
        try {
            const data = await this.storage.load();
            if (data && data.properties && Array.isArray(data.properties)) {
                // Check if it has the old hierarchical structure
                const hasLegacyStructure = data.properties.some(prop =>
                    prop && (prop.expenses || prop.monthlyData || prop.quarterlyData)
                );
                if (hasLegacyStructure) {
                    console.log('[TRANSACTIONSTORE] Detected legacy hierarchical data structure');
                    return data;
                }
            }
        } catch (error) {
            console.warn('[TRANSACTIONSTORE] Error checking for legacy data:', error);
        }
        return null;
    }

    /**
     * Migrate legacy hierarchical data to normalized transactions
     */
    async _migrateLegacyData(legacyData) {
        console.log('[TRANSACTIONSTORE] Starting legacy data migration...');

        const migratedTransactions = [];
        const propertyMap = new Map();
        const categorySet = new Set();
        const incomeCategorySet = new Set();

        // Process each property
        legacyData.properties.forEach((property, index) => {
            if (!property) return;

            const propertyId = property.id || (index + 1);

            // Store property metadata
            propertyMap.set(propertyId, {
                id: propertyId,
                name: property.name || `Property ${propertyId}`,
                created: new Date().toISOString()
            });

            // Convert expenses
            if (property.expenses) {
                this._convertExpensesToTransactions(
                    property.expenses,
                    propertyId,
                    'expense',
                    null, // no specific date for top-level expenses
                    migratedTransactions,
                    categorySet
                );
            }

            // Convert monthly data
            if (property.monthlyData) {
                Object.entries(property.monthlyData).forEach(([monthKey, monthData]) => {
                    const date = this._parseMonthKeyToDate(monthKey);

                    // Convert monthly expenses
                    if (monthData.expenses) {
                        this._convertExpensesToTransactions(
                            monthData.expenses,
                            propertyId,
                            'expense',
                            date,
                            migratedTransactions,
                            categorySet
                        );
                    }

                    // Convert monthly incomes
                    if (monthData.incomes) {
                        Object.entries(monthData.incomes).forEach(([category, amount]) => {
                            if (typeof amount === 'number' && amount !== 0) {
                                migratedTransactions.push({
                                    id: this.generateId(),
                                    propertyId,
                                    category,
                                    amount: Math.abs(amount), // incomes are positive
                                    date,
                                    type: 'income'
                                });
                                incomeCategorySet.add(category);
                            }
                        });
                    }
                });
            }

        });

        // Load global categories if available
        if (legacyData.expenseCategories) {
            legacyData.expenseCategories.forEach(cat => categorySet.add(cat));
        }
        if (legacyData.incomeCategories) {
            legacyData.incomeCategories.forEach(cat => incomeCategorySet.add(cat));
        }

        // Apply migrated data
        this.transactions = migratedTransactions;
        this.properties = propertyMap;
        this.categories = categorySet;
        this.incomeCategories = incomeCategorySet;

        console.log(`[TRANSACTIONSTORE] Migration complete: ${migratedTransactions.length} transactions created`);

        // Save migrated data immediately
        await this._saveToStorage();
    }

    /**
     * Convert hierarchical expenses to flat transactions
     */
    _convertExpensesToTransactions(expenses, propertyId, type, date, transactions, categorySet) {
        Object.entries(expenses).forEach(([category, value]) => {
            if (typeof value === 'object' && value !== null) {
                // Hierarchical category with subcategories
                Object.entries(value).forEach(([subcategory, subValue]) => {
                    if (typeof subValue === 'number' && subValue !== 0) {
                        transactions.push({
                            id: this.generateId(),
                            propertyId,
                            category,
                            subcategory,
                            amount: subValue, // expenses should be negative
                            date: date || new Date().toISOString().split('T')[0],
                            type
                        });
                    }
                });
            } else if (typeof value === 'number' && value !== 0) {
                // Flat category
                transactions.push({
                    id: this.generateId(),
                    propertyId,
                    category,
                    amount: value, // expenses should be negative
                    date: date || new Date().toISOString().split('T')[0],
                    type
                });
            }
            categorySet.add(category);
        });
    }

    /**
     * Parse month key (e.g., "Jan 2025") to ISO date string
     */
    _parseMonthKeyToDate(monthKey) {
        const parts = monthKey.split(' ');
        if (parts.length === 2) {
            const monthName = parts[0];
            const year = parts[1];

            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthIndex = monthNames.indexOf(monthName);

            if (monthIndex !== -1) {
                const date = new Date(parseInt(year), monthIndex, 15); // Mid-month
                return date.toISOString().split('T')[0];
            }
        }
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Parse quarter key to ISO date string
     */
    _parseQuarterKeyToDate(quarterKey) {
        const match = quarterKey.match(/Q(\d) (\d{4})/);
        if (match) {
            const quarter = parseInt(match[1]);
            const year = parseInt(match[2]);
            const month = (quarter - 1) * 3; // Q1 = Jan (0), Q2 = Apr (3), etc.
            const date = new Date(year, month, 15); // Mid-quarter
            return date.toISOString().split('T')[0];
        }
        return new Date().toISOString().split('T')[0];
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
    _validateTransaction(txn) {
        if (!txn || typeof txn !== 'object') return null;

        const validated = {
            id: txn.id || this.generateId(),
            propertyId: typeof txn.propertyId === 'number' ? txn.propertyId : null,
            category: typeof txn.category === 'string' ? txn.category.trim() : '',
            subcategory: txn.subcategory ? txn.subcategory.toString().trim() : undefined,
            amount: typeof txn.amount === 'number' ? txn.amount : 0,
            date: txn.date || new Date().toISOString().split('T')[0],
            type: txn.type === 'income' ? 'income' : 'expense',
            description: txn.description ? txn.description.toString().trim() : undefined
        };

        // Basic validation
        if (!validated.propertyId || !validated.category || validated.amount === 0) {
            console.warn('[TRANSACTIONSTORE] Invalid transaction:', txn);
            return null;
        }

        return validated;
    }

    /**
     * Add change listener
     */
    onChange(callback) {
        this._changeListeners.add(callback);
    }

    /**
     * Remove change listener
     */
    offChange(callback) {
        this._changeListeners.delete(callback);
    }

    /**
     * Notify listeners of changes
     */
    _notifyChange(changeType, data) {
        this._changeListeners.forEach(callback => {
            try {
                callback(changeType, data);
            } catch (error) {
                console.error('[TRANSACTIONSTORE] Error in change listener:', error);
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
        if (!this._hasUnsavedChanges) return;

        try {
            const dataToSave = {
                transactions: this.transactions,
                properties: Array.from(this.properties.entries()),
                categories: Array.from(this.categories),
                incomeCategories: Array.from(this.incomeCategories),
                version: '1.0',
                lastSaved: new Date().toISOString()
            };

            const success = await this.storage.save(dataToSave);
            if (success) {
                this._hasUnsavedChanges = false;
                this._lastSaved = new Date();
                console.log('[TRANSACTIONSTORE] Data saved to storage');
            } else {
                console.error('[TRANSACTIONSTORE] Failed to save data to storage');
            }
        } catch (error) {
            console.error('[TRANSACTIONSTORE] Error saving to storage:', error);
        }
    }

    /**
     * Persist data immediately (for testing)
     */
    async persist() {
        return this._saveToStorage();
    }

    /**
     * Invalidate query cache
     */
    _invalidateCache() {
        if (this._cacheInvalidationTimer) {
            clearTimeout(this._cacheInvalidationTimer);
        }

        // Immediate cache invalidation for consistency
        this._queryCache.clear();
        this._lastCacheInvalidation = Date.now();
        console.log('[TRANSACTIONSTORE] Query cache invalidated');
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
    addTransaction(transactionData) {
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
                created: new Date().toISOString()
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
    updateTransaction(transactionId, updates) {
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
    deleteTransaction(transactionId) {
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
     * Query transactions with filters
     */
    queryTransactions(filters = {}) {
        const cacheKey = JSON.stringify(filters);
        if (this._queryCache.has(cacheKey)) {
            return this._queryCache.get(cacheKey);
        }

        let results = [...this.transactions];

        // Apply filters
        if (filters.propertyId !== undefined) {
            results = results.filter(t => t.propertyId === filters.propertyId);
        }

        if (filters.category) {
            results = results.filter(t => t.category === filters.category);
        }

        if (filters.subcategory) {
            results = results.filter(t => t.subcategory === filters.subcategory);
        }

        if (filters.type) {
            results = results.filter(t => t.type === filters.type);
        }

        if (filters.dateRange) {
            const { start, end } = filters.dateRange;
            results = results.filter(t => {
                const txnDate = t.date;

                if (start && txnDate < start) return false;
                if (end && txnDate > end) return false;
                return true;
            });
        }

        if (filters.amountRange) {
            const { min, max } = filters.amountRange;
            results = results.filter(t => {
                if (min !== undefined && t.amount < min) return false;
                if (max !== undefined && t.amount > max) return false;
                return true;
            });
        }

        // Apply sorting
        if (filters.sortBy) {
            const { field, order = 'asc' } = filters.sortBy;
            results.sort((a, b) => {
                let aVal = a[field];
                let bVal = b[field];

                if (field === 'date') {
                    aVal = new Date(aVal);
                    bVal = new Date(bVal);
                }

                if (aVal < bVal) return order === 'asc' ? -1 : 1;
                if (aVal > bVal) return order === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // Default sort by date descending
            results.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        // Apply pagination
        if (filters.limit) {
            const offset = filters.offset || 0;
            results = results.slice(offset, offset + filters.limit);
        }

        this._queryCache.set(cacheKey, results);
        return results;
    }

    /**
     * Query properties with their transaction summaries
     */
    queryProperties(filters = {}) {
        const cacheKey = `properties_${JSON.stringify(filters)}`;
        if (this._queryCache.has(cacheKey)) {
            return this._queryCache.get(cacheKey);
        }

        const properties = [];

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
                lastTransaction: propertyTxns.length > 0 ? propertyTxns[0].date : null
            });
        });

        // Apply sorting
        if (filters.sortBy) {
            const { field, order = 'asc' } = filters.sortBy;
            properties.sort((a, b) => {
                let aVal = a[field];
                let bVal = b[field];

                if (aVal < bVal) return order === 'asc' ? -1 : 1;
                if (aVal > bVal) return order === 'asc' ? 1 : -1;
                return 0;
            });
        }

        this._queryCache.set(cacheKey, properties);
        return properties;
    }

    /**
     * Query categories with transaction summaries
     */
    queryCategories(filters = {}) {
        const cacheKey = `categories_${JSON.stringify(filters)}`;
        if (this._queryCache.has(cacheKey)) {
            return this._queryCache.get(cacheKey);
        }

        const categories = new Map();

        // Get relevant transactions
        const txns = this.queryTransactions(filters);

        txns.forEach(txn => {
            const key = txn.category;
            if (!categories.has(key)) {
                categories.set(key, {
                    name: key,
                    type: txn.type,
                    transactionCount: 0,
                    totalAmount: 0,
                    subcategories: new Map(),
                    properties: new Set()
                });
            }

            const cat = categories.get(key);
            cat.transactionCount++;
            cat.totalAmount += txn.amount;
            cat.properties.add(txn.propertyId);

            if (txn.subcategory) {
                if (!cat.subcategories.has(txn.subcategory)) {
                    cat.subcategories.set(txn.subcategory, {
                        name: txn.subcategory,
                        transactionCount: 0,
                        totalAmount: 0
                    });
                }
                const subcat = cat.subcategories.get(txn.subcategory);
                subcat.transactionCount++;
                subcat.totalAmount += txn.amount;
            }
        });

        // Convert to array and sort
        const result = Array.from(categories.values()).map(cat => ({
            ...cat,
            subcategories: Array.from(cat.subcategories.values()),
            properties: Array.from(cat.properties)
        }));

        if (filters.sortBy) {
            const { field, order = 'asc' } = filters.sortBy;
            result.sort((a, b) => {
                let aVal = a[field];
                let bVal = b[field];

                if (aVal < bVal) return order === 'asc' ? -1 : 1;
                if (aVal > bVal) return order === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // Default sort by total amount descending
            result.sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount));
        }

        this._queryCache.set(cacheKey, result);
        return result;
    }

    /**
     * Get aggregated sankey data (compatible with existing DataManager API)
     */
    queryAggregatedSankey(period = 'all', year = null, month = null) {
        const cacheKey = `sankey_${period}_${year}_${month}`;
        if (this._queryCache.has(cacheKey)) {
            return this._queryCache.get(cacheKey);
        }

        // Get date range for period filtering
        const dateRange = this._getDateRangeForPeriod(period, year, month);

        // Query all transactions within the period
        const allTxns = this.queryTransactions({
            dateRange,
            sortBy: { field: 'date', order: 'desc' }
        });

        // Separate expenses and incomes
        const expenseTxns = allTxns.filter(t => t.type === 'expense');
        const incomeTxns = allTxns.filter(t => t.type === 'income');

        // Aggregate by property
        const propData = new Map();

        // Process expenses
        expenseTxns.forEach(txn => {
            if (!propData.has(txn.propertyId)) {
                propData.set(txn.propertyId, {
                    propertyId: txn.propertyId,
                    expenses: new Map(),
                    totalExpenses: 0,
                    incomes: new Map(),
                    totalIncome: 0
                });
            }

            const prop = propData.get(txn.propertyId);
            const categoryKey = txn.subcategory ? `${txn.category}:${txn.subcategory}` : txn.category;

            prop.expenses.set(categoryKey, (prop.expenses.get(categoryKey) || 0) + Math.abs(txn.amount));
            prop.totalExpenses += Math.abs(txn.amount);
        });

        // Process incomes
        incomeTxns.forEach(txn => {
            if (!propData.has(txn.propertyId)) {
                propData.set(txn.propertyId, {
                    propertyId: txn.propertyId,
                    expenses: new Map(),
                    totalExpenses: 0,
                    incomes: new Map(),
                    totalIncome: 0
                });
            }

            const prop = propData.get(txn.propertyId);
            const incomeAmount = Math.abs(txn.amount); // Convert negative incomes to positive
            prop.incomes.set(txn.category, (prop.incomes.get(txn.category) || 0) + incomeAmount);
            prop.totalIncome += incomeAmount;
        });

        // Get all property IDs that have any transactions in this period
        const allPropertyIds = new Set(expenseTxns.concat(incomeTxns).map(txn => txn.propertyId));

        // Convert to sankey format
        const sources = new Map();
        const propIncomes = new Map();
        const propExpenses = new Map();
        const catTotals = new Map();
        const subTotals = new Map();

        // Initialize property incomes and expenses for all properties with transactions
        allPropertyIds.forEach(propertyId => {
            const prop = propData.get(propertyId);
            propIncomes.set(propertyId, prop ? prop.totalIncome : 0);
            propExpenses.set(propertyId, prop ? prop.totalExpenses : 0);

            // Add income sources if property has data
            if (prop && prop.incomes.size > 0) {
                prop.incomes.forEach((amount, source) => {
                    sources.set(source, (sources.get(source) || 0) + amount);
                });
            }
        });

        // Check if we have any income
        const hasIncome = sources.size > 0 && Array.from(sources.values()).some(v => v > 0);

        // Aggregate expenses by category
        propData.forEach(prop => {
            prop.expenses.forEach((amount, categoryKey) => {
                if (categoryKey.includes(':')) {
                    // Hierarchical category
                    const [category, subcategory] = categoryKey.split(':');
                    if (!subTotals.has(category)) {
                        subTotals.set(category, new Map());
                    }
                    const subMap = subTotals.get(category);
                    subMap.set(subcategory, (subMap.get(subcategory) || 0) + amount);
                    catTotals.set(category, (catTotals.get(category) || 0) + amount);
                } else {
                    // Flat category
                    catTotals.set(categoryKey, (catTotals.get(categoryKey) || 0) + amount);
                }
            });
        });

        const result = {
            hasIncome,
            sources,
            propIncomes,
            propExpenses,
            catTotals,
            subTotals
        };

        this._queryCache.set(cacheKey, result);
        return result;
    }

    /**
     * Group transactions by month/year
     */
    groupByMonthYear(filters = {}) {
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
                    categories: new Map()
                });
            }

            const group = grouped.get(key);
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
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });

        this._queryCache.set(cacheKey, result);
        return result;
    }

    /**
     * Calculate property summary from transactions
     */
    _calculatePropertySummary(transactions) {
        const summary = {
            expenses: 0,
            income: 0,
            net: 0,
            categories: new Map()
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
    _getDateRangeForPeriod(period, year, month = null) {
        const now = new Date();
        let startDate, endDate;

        switch (period) {
            case 'month':
                const selectedYear = year ? parseInt(year) : now.getFullYear();
                let selectedMonth = (month !== null && month !== 'all')
                    ? parseInt(month) - 1 // Convert to 0-based
                    : now.getMonth();

                // Clamp to valid month range (0-11), fallback to January if invalid
                if (selectedMonth < 0 || selectedMonth > 11) {
                    selectedMonth = 0;
                }

                startDate = new Date(selectedYear, selectedMonth, 1);
                endDate = new Date(selectedYear, selectedMonth + 1, 0);
                break;

            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
                break;

            case 'year':
                if (year) {
                    startDate = new Date(year, 0, 1);
                    endDate = new Date(year, 11, 31);
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
            end: endDate.toISOString().split('T')[0]
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
            lastSaved: this._lastSaved
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
    exportData() {
        return {
            transactions: this.transactions,
            properties: Array.from(this.properties.entries()),
            categories: Array.from(this.categories),
            incomeCategories: Array.from(this.incomeCategories),
            version: '1.0',
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Convert legacy data to normalized transactions (without saving)
     */
    convertLegacyData(legacyData) {
        console.log('[TRANSACTIONSTORE] Converting legacy data...');

        if (!legacyData || !legacyData.properties) {
            console.warn('[TRANSACTIONSTORE] No legacy data to convert');
            return { transactions: [], properties: [], categories: [], incomeCategories: [] };
        }

        const migratedTransactions = [];
        const propertyMap = new Map();
        const categorySet = new Set();
        const incomeCategorySet = new Set();

        // Process each property
        legacyData.properties.forEach((property, index) => {
            if (!property) return;

            const propertyId = property.id || (index + 1);

            // Store property metadata
            propertyMap.set(propertyId, {
                id: propertyId,
                name: property.name || `Property ${propertyId}`,
                created: new Date().toISOString()
            });

            // Convert expenses
            if (property.expenses) {
                this._convertExpensesToTransactions(
                    property.expenses,
                    propertyId,
                    'expense',
                    null, // no specific date for top-level expenses
                    migratedTransactions,
                    categorySet
                );
            }

            // Convert monthly data
            if (property.monthlyData) {
                Object.entries(property.monthlyData).forEach(([monthKey, monthData]) => {
                    const date = this._parseMonthKeyToDate(monthKey);

                    // Convert monthly expenses
                    if (monthData.expenses) {
                        this._convertExpensesToTransactions(
                            monthData.expenses,
                            propertyId,
                            'expense',
                            date,
                            migratedTransactions,
                            categorySet
                        );
                    }

                    // Convert monthly incomes
                    if (monthData.incomes) {
                        Object.entries(monthData.incomes).forEach(([category, amount]) => {
                            if (typeof amount === 'number' && amount !== 0) {
                                migratedTransactions.push({
                                    id: this.generateId(),
                                    propertyId,
                                    category,
                                    amount: Math.abs(amount), // incomes are positive
                                    date,
                                    type: 'income'
                                });
                                incomeCategorySet.add(category);
                            }
                        });
                    }
                });
            }

        });

        // Load global categories if available
        if (legacyData.expenseCategories) {
            legacyData.expenseCategories.forEach(cat => categorySet.add(cat));
        }
        if (legacyData.incomeCategories) {
            legacyData.incomeCategories.forEach(cat => incomeCategorySet.add(cat));
        }

        return {
            transactions: migratedTransactions,
            properties: Array.from(propertyMap.values()),
            categories: Array.from(categorySet),
            incomeCategories: Array.from(incomeCategorySet)
        };
    }

    /**
     * Import data
     */
    async importData(data) {
        if (!data || !data.transactions) {
            throw new Error('Invalid import data');
        }

        await this._loadFromData(data);
        this._setupReactiveProxy();
        this._hasUnsavedChanges = true;
        await this._saveToStorage();

        this._notifyChange('import', { transactionCount: this.transactions.length });
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

// Expose globally for browser environments
if (typeof window !== 'undefined') {
    window.TransactionStore = TransactionStore;
}
