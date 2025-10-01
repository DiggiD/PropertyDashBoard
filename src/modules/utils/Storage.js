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
        this.dbVersion = 2; // Updated for enhanced schema
        this._initialized = false;  // Prevent multiple initializations

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
        if (this._initialized) {
            console.log('[STORAGE] Already initialized, skipping');
            return;
        }
        this._initialized = true;

        if (typeof Dexie === 'undefined') {
            console.warn('[STORAGE] Dexie not available, falling back to localStorage only');
            return;
        }

        try {
            this.db = new Dexie('ExpenseDashboardDB');

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
                history: '++id, timestamp, name, description, data, user_id',
                metadata: 'key, value',
            });

            await this.db.open();
            console.log('[STORAGE] Database initialized successfully');
        } catch (error) {
            console.error('[STORAGE] Failed to initialize database:', error);
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

            console.log(`[STORAGE] Data saved to localStorage: ${storageKey}`);
            return true;
        } catch (error) {
            console.error('[STORAGE] Failed to save to localStorage:', error);

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
                console.log(`[STORAGE] No data found in localStorage: ${storageKey}`);
                return { properties: [], expenseCategories: [] };
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

            console.log(`[STORAGE] Data loaded from localStorage: ${storageKey}`);
            return data;
        } catch (error) {
            console.error('[STORAGE] Failed to load from localStorage:', error);

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
    async saveToDatabase(data, userId = 'default') {
        if (!this.db) {
            console.warn('[STORAGE] Database not available');
            return false;
        }

        try {
            const timestamp = new Date().toISOString();

            // Start transaction with all tables
            await this.db.transaction('rw', [
                'properties', 'expenseCategories', 'incomeCategories', 'expenses', 'incomes',
                'users', 'audit_log', 'metadata',
            ], async () => {

                // Clear existing user-specific data
                await this.db.properties.where('user_id').equals(userId).delete();
                await this.db.expenseCategories.where('user_id').equals(userId).delete();
                await this.db.incomeCategories.where('user_id').equals(userId).delete();
                await this.db.expenses.where('user_id').equals(userId).delete();
                await this.db.incomes.where('user_id').equals(userId).delete();

                // Save properties with enhanced fields
                if (data.properties && Array.isArray(data.properties)) {
                    for (const property of data.properties) {
                        await this.db.properties.add({
                            id: property.id,
                            name: property.name,
                            created_date: property.created_date || timestamp,
                            user_id: userId,
                            monthlyData: property.monthlyData || {},
                        });

                        // Save expense data in separate table for better querying
                        if (property.monthlyData) {
                            await this.savePropertyMonthlyExpenses(property, userId, timestamp);
                            await this.savePropertyMonthlyIncomes(property, userId, timestamp);  // Add this line
                        } else if (property.expenses) {
                            await this.savePropertyFlatExpenses(property, userId, timestamp);
                        }
                    }
                }

                // Save categories with user association
                if (data.expenseCategories && Array.isArray(data.expenseCategories)) {
                    for (const category of data.expenseCategories) {
                        await this.db.expenseCategories.add({
                            name: category,
                            user_id: userId,
                        });
                    }
                }

                // Save income categories for future feature
                if (data.incomeCategories && Array.isArray(data.incomeCategories)) {
                    for (const category of data.incomeCategories) {
                        await this.db.incomeCategories.add({
                            name: category,
                            user_id: userId,
                        });
                    }
                }

                // Save metadata
                await this.db.metadata.put({
                    key: 'version',
                    value: '2.0',
                });
                await this.db.metadata.put({
                    key: 'lastSaved',
                    value: timestamp,
                });
                await this.db.metadata.put({
                    key: 'currentTimePeriod',
                    value: data.currentTimePeriod || 'all',
                });
                await this.db.metadata.put({
                    key: 'currentView',
                    value: data.currentView || 'overview',
                });
                await this.db.metadata.put({
                    key: 'currentUser',
                    value: userId,
                });

                // Log audit entry
                await this.db.audit_log.add({
                    action: 'save',
                    entity_type: 'database',
                    entity_id: 'full_backup',
                    user_id: userId,
                    timestamp,
                });
            });

            console.log('[STORAGE] Enhanced data saved to database successfully for user:', userId);
            return true;
        } catch (error) {
            console.error('[STORAGE] Failed to save to database:', error);
            // For quota exceeded errors, mark database unavailable and throw
            if (error.message && error.message.includes('Quota exceeded')) {
                this.db = null;
                throw error;
            }
            return false;
        }
    }

    /**
     * Save property monthly expenses to separate table for better chronological queries
     * @param {Object} property - Property object
     * @param {string} userId - User ID
     * @param {string} timestamp - Current timestamp
     */
    async savePropertyMonthlyExpenses(property, userId, timestamp) {
        // Extract expenses from monthly data for chronological storage
        if (property.monthlyData) {
            for (const [monthKey, monthData] of Object.entries(property.monthlyData)) {
                if (monthData.expenses) {
                    // Parse month key (e.g., "Jan 2021" -> year: 2021, month: 1)
                    const [monthName, yearStr] = monthKey.split(' ');
                    const year = parseInt(yearStr);
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const month = monthNames.indexOf(monthName) + 1;

                    for (const [category, expenseValue] of Object.entries(monthData.expenses)) {
                        if (typeof expenseValue === 'object' && expenseValue !== null) {
                            // Hierarchical expenses (subcategories)
                            for (const [subcategory, amount] of Object.entries(expenseValue)) {
                                await this.db.expenses.add({
                                    property_id: property.id,
                                    category,
                                    subcategory,
                                    amount: amount || 0,
                                    expense_date: `${year}-${month.toString().padStart(2, '0')}-01`,
                                    month: monthKey,
                                    year,
                                    user_id: userId,
                                });
                            }
                        } else {
                            // Flat expenses
                            await this.db.expenses.add({
                                property_id: property.id,
                                category,
                                subcategory: null,
                                amount: expenseValue || 0,
                                expense_date: `${year}-${month.toString().padStart(2, '0')}-01`,
                                month: monthKey,
                                year,
                                user_id: userId,
                            });
                        }
                    }
                }
            }
        }
    }


    /**
     * Save property flat expenses to separate table
     * @param {Object} property - Property object
     * @param {string} userId - User ID
     * @param {string} timestamp - Current timestamp
     */
    async savePropertyFlatExpenses(property, userId, timestamp) {
        // Save flat expenses as current month data
        if (property.expenses) {
            const currentDate = new Date();
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthKey = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

            for (const [category, expenseValue] of Object.entries(property.expenses)) {
                if (typeof expenseValue === 'object' && expenseValue !== null) {
                    // Hierarchical expenses (subcategories)
                    for (const [subcategory, amount] of Object.entries(expenseValue)) {
                        await this.db.expenses.add({
                            property_id: property.id,
                            category,
                            subcategory,
                            amount: amount || 0,
                            expense_date: currentDate.toISOString().split('T')[0],
                            month: monthKey,
                            year: currentDate.getFullYear(),
                            user_id: userId,
                        });
                    }
                } else {
                    // Flat expenses
                    await this.db.expenses.add({
                        property_id: property.id,
                        category,
                        subcategory: null,
                        amount: expenseValue || 0,
                        expense_date: currentDate.toISOString().split('T')[0],
                        month: monthKey,
                        year: currentDate.getFullYear(),
                        user_id: userId,
                    });
                }
            }
        }
    }

    /**
     * Save property monthly incomes to separate table for better chronological queries
     * @param {Object} property - Property object
     * @param {string} userId - User ID
     * @param {string} timestamp - Current timestamp
     */
    async savePropertyMonthlyIncomes(property, userId, timestamp) {
        if (property.monthlyData) {
            for (const [monthKey, monthData] of Object.entries(property.monthlyData)) {
                if (monthData.incomes) {
                    // Parse month key (e.g., "Jan 2021" -> year: 2021, month: 1)
                    const [monthName, yearStr] = monthKey.split(' ');
                    const year = parseInt(yearStr);
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const month = monthNames.indexOf(monthName) + 1;

                    for (const [category, incomeValue] of Object.entries(monthData.incomes)) {
                        if (typeof incomeValue === 'object' && incomeValue !== null) {
                            // Hierarchical incomes (subcategories)
                            for (const [subcategory, amount] of Object.entries(incomeValue)) {
                                await this.db.incomes.add({
                                    property_id: property.id,
                                    category,
                                    subcategory,
                                    amount: amount || 0,
                                    income_date: `${year}-${month.toString().padStart(2, '0')}-01`,
                                    month: monthKey,
                                    year,
                                    user_id: userId,
                                });
                            }
                        } else {
                            // Flat incomes
                            await this.db.incomes.add({
                                property_id: property.id,
                                category,
                                subcategory: null,
                                amount: incomeValue || 0,
                                income_date: `${year}-${month.toString().padStart(2, '0')}-01`,
                                month: monthKey,
                                year,
                                user_id: userId,
                            });
                        }
                    }
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
            console.warn('[STORAGE] Database not available');
            return null;
        }

        try {
            // Load all data for the user
            const [properties, categories, incomeCategories, expenses, incomesFromDB, metadata] = await Promise.all([
                this.db.properties.where('user_id').equals(userId).toArray(),
                this.db.expenseCategories.where('user_id').equals(userId).toArray(),
                this.db.incomeCategories.where('user_id').equals(userId).toArray(),
                this.db.expenses.where('user_id').equals(userId).toArray(),
                this.db.incomes.where('user_id').equals(userId).toArray(),  // Add this
                this.db.metadata.toArray(),
            ]);

            console.log('[STORAGE] Enhanced database query results:', {
                properties: properties.length,
                expenseCategories: categories.length,
                incomeCategories: incomeCategories.length,
                expenses: expenses.length,
                incomes: incomesFromDB.length,  // Add this
                metadata: metadata.length,
            });

            // If no data in database, return null to allow fallback to localStorage
            if (properties.length === 0 && categories.length === 0) {
                console.log('[STORAGE] No data found in database for user:', userId);
                return null;
            }

            // Reconstruct monthly data from expenses and incomes tables
            const monthlyExpenses = this.reconstructMonthlyData(expenses);
            const monthlyIncomes = this.reconstructMonthlyIncomes(incomesFromDB);  // Add this

            const data = {
                properties: properties.map(p => ({
                    id: p.id,
                    name: p.name,
                    created_date: p.created_date,
                    monthlyData: this.mergeMonthlyData(monthlyExpenses[p.id] || {}, monthlyIncomes[p.id] || {}),  // Updated to merge
                    expenses: this.calculateExpensesFromMonthly(monthlyExpenses[p.id]),
                    incomes: this.calculateIncomesFromMonthly(monthlyIncomes[p.id]),  // Add this
                })),
                expenseCategories: categories.map(c => c.name),
                incomeCategories: incomeCategories.map(c => c.name),
            };

            // Load metadata
            const metadataMap = {};
            metadata.forEach(item => {
                metadataMap[item.key] = item.value;
            });

            data.currentTimePeriod = metadataMap.currentTimePeriod || 'all';
            data.currentView = metadataMap.currentView || 'overview';
            data._lastSaved = metadataMap.lastSaved;
            data.currentUser = metadataMap.currentUser || userId;

            console.log('[STORAGE] Enhanced data loaded from database successfully:', {
                properties: data.properties.length,
                expenseCategories: data.expenseCategories.length,
                incomeCategories: data.incomeCategories?.length || 0,
                totalExpenses: expenses.length,
                hasMonthlyData: data.properties.some(p => p.monthlyData && Object.keys(p.monthlyData).length > 0),
            });
            return data;
        } catch (error) {
            console.error('[STORAGE] Failed to load from database:', error);

            // Check if this is a schema mismatch error
            if (error.name === 'NotFoundError' || error.message.includes('object stores was not found')) {
                console.warn('[STORAGE] Database schema mismatch detected. Clearing database to recreate with correct schema...');

                try {
                    // Clear the database and reinitialize
                    await this.db.delete();
                    this.db = null;

                    // Reinitialize with correct schema
                    await this.initDatabase();
                    console.log('[STORAGE] Database cleared and reinitialized successfully');
                } catch (clearError) {
                    console.error('[STORAGE] Failed to clear and reinitialize database:', clearError);
                    this.db = null;
                }
            }

            return null;
        }
    }

    /**
     * Reconstruct monthly data from expenses table
     * @param {Array} expenses - Expenses from database
     * @returns {Object} Reconstructed monthly data
     */
    reconstructMonthlyData(expenses) {
        const monthlyData = {};

        expenses.forEach(expense => {
            const propertyId = expense.property_id;
            const month = expense.month;

            if (!month) {return;} // Skip if no month data

            if (!monthlyData[propertyId]) {
                monthlyData[propertyId] = {};
            }

            if (!monthlyData[propertyId][month]) {
                monthlyData[propertyId][month] = {
                    expenses: {},
                    total: 0,
                };
            }

            const monthData = monthlyData[propertyId][month];

            if (expense.subcategory) {
                // Hierarchical expense
                if (!monthData.expenses[expense.category]) {
                    monthData.expenses[expense.category] = {};
                }
                monthData.expenses[expense.category][expense.subcategory] = expense.amount;
            } else {
                // Flat expense
                monthData.expenses[expense.category] = expense.amount;
            }

            // Recalculate total
            monthData.total = this.calculateMonthTotal(monthData.expenses);
        });

        return monthlyData;
    }

    /**
     * Reconstruct monthly data from incomes table
     * @param {Array} incomes - Incomes from database
     * @returns {Object} Reconstructed monthly data
     */
    reconstructMonthlyIncomes(incomes) {
        const monthlyIncomes = {};

        incomes.forEach(income => {
            const propertyId = income.property_id;
            const month = income.month;

            if (!month) {return;} // Skip if no month data

            if (!monthlyIncomes[propertyId]) {
                monthlyIncomes[propertyId] = {};
            }

            if (!monthlyIncomes[propertyId][month]) {
                monthlyIncomes[propertyId][month] = {
                    incomes: {},
                };
            }

            const monthIncomes = monthlyIncomes[propertyId][month];

            if (income.subcategory) {
                // Hierarchical income
                if (!monthIncomes.incomes[income.category]) {
                    monthIncomes.incomes[income.category] = {};
                }
                monthIncomes.incomes[income.category][income.subcategory] = income.amount;
            } else {
                // Flat income
                monthIncomes.incomes[income.category] = income.amount;
            }
        });

        return monthlyIncomes;
    }

    /**
     * Merge monthly data from expenses and incomes
     * @param {Object} expensesData - Expenses monthly data
     * @param {Object} incomesData - Incomes monthly data
     * @returns {Object} Merged monthly data
     */
    mergeMonthlyData(expensesData, incomesData) {
        const merged = {};

        // Get all unique months from both expenses and incomes
        const allMonths = new Set([...Object.keys(expensesData), ...Object.keys(incomesData)]);

        allMonths.forEach(month => {
            const expenseMonth = expensesData[month] || { expenses: {}, total: 0 };
            const incomeMonth = incomesData[month] || { incomes: {} };

            merged[month] = {
                expenses: expenseMonth.expenses || {},
                incomes: incomeMonth.incomes || {},
                total: (expenseMonth.total || 0) + this.calculateMonthTotal(incomeMonth.incomes),  // Sum expense total + income total
            };
        });

        return merged;
    }

    /**
     * Calculate total for a month
     * @param {Object} expenses - Month expenses
     * @returns {number} Total amount
     */
    calculateMonthTotal(expenses) {
        let total = 0;

        if (!expenses || typeof expenses !== 'object') {
            return total;
        }

        for (const [category, value] of Object.entries(expenses)) {
            if (typeof value === 'object' && value !== null) {
                // Sum hierarchical values
                total += Object.values(value).reduce((sum, val) => sum + (val || 0), 0);
            } else {
                total += value || 0;
            }
        }

        return total;
    }


    /**
     * Calculate expenses from monthly data
     * @param {Object} monthlyData - Monthly data object
     * @returns {Object} Expenses object
     */
    calculateExpensesFromMonthly(monthlyData) {
        const expenses = {};

        if (!monthlyData) {return expenses;}

        // Get the most recent value for each category
        const months = Object.keys(monthlyData).sort((a, b) => {
            const [aMonth, aYear] = a.split(' ');
            const [bMonth, bYear] = b.split(' ');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const aIndex = monthNames.indexOf(aMonth);
            const bIndex = monthNames.indexOf(bMonth);
            const aDate = new Date(parseInt(aYear), aIndex);
            const bDate = new Date(parseInt(bYear), bIndex);
            return bDate - aDate; // latest first
        });

        for (const month of months) {
            if (monthlyData[month]?.expenses) {
                for (const [category, value] of Object.entries(monthlyData[month].expenses)) {
                    if (!(category in expenses)) {
                        expenses[category] = value;
                    }
                }
            }
        }

        return expenses;
    }

    /**
     * Calculate incomes from monthly data
     * @param {Object} monthlyData - Monthly data object
     * @returns {Object} Incomes object
     */
    calculateIncomesFromMonthly(monthlyData) {
        const incomes = {};

        if (!monthlyData) {return incomes;}

        // Get the most recent month
        const months = Object.keys(monthlyData).sort((a, b) => {
            const [aMonth, aYear] = a.split(' ');
            const [bMonth, bYear] = b.split(' ');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const aIndex = monthNames.indexOf(aMonth);
            const bIndex = monthNames.indexOf(bMonth);
            const aDate = new Date(parseInt(aYear), aIndex);
            const bDate = new Date(parseInt(bYear), bIndex);
            return aDate - bDate;
        });
        const latestMonth = months[months.length - 1];

        if (latestMonth && monthlyData[latestMonth]?.incomes) {
            Object.assign(incomes, monthlyData[latestMonth].incomes);
        }

        return incomes;
    }

    /**
     * Save data using Dexie database as primary storage
     * @param {Object} data - Data to save
     * @returns {boolean} Success status
     */
    async save(data) {
        // Use Dexie database as primary storage
        if (this.db) {
            const dbSuccess = await this.saveToDatabase(data);
            if (dbSuccess) {
                console.log('[STORAGE] Data saved to Dexie database successfully');
                return true;
            }
        }

        // Fallback to localStorage only if database is unavailable
        console.warn('[STORAGE] Database unavailable, falling back to localStorage');
        const localSuccess = this.saveToLocalStorage(data);
        return localSuccess;
    }

    /**
     * Load data using Dexie database as primary storage
     * @returns {Object|null} Loaded data
     */
    async load() {
        console.log('[STORAGE] Loading data from storage...');

        // Use Dexie database as primary storage
        if (this.db) {
            const data = await this.loadFromDatabase();
            if (data) {
                console.log('[STORAGE] Data loaded from Dexie database successfully:', {
                    properties: data.properties?.length || 0,
                    categories: data.expenseCategories?.length || 0,
                });
                return data;
            }
        }

        // Fallback to localStorage only if database is unavailable or empty
        console.warn('[STORAGE] Database unavailable or empty, falling back to localStorage');
        const data = this.loadFromLocalStorage();
        if (data) {
            console.log('[STORAGE] Data loaded from localStorage fallback:', {
                properties: data.properties?.length || 0,
                categories: data.expenseCategories?.length || 0,
            });
        } else {
            console.log('[STORAGE] No data found in any storage method');
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
            console.log('[STORAGE] Saving history snapshot:', {
                name: snapshot.name,
                timestamp: snapshot.timestamp,
                dataSize: JSON.stringify(snapshot).length,
            });

            // Save to database as primary storage
            if (this.db) {
                await this.db.history.add({
                    timestamp: snapshot.timestamp,
                    name: snapshot.name,
                    description: snapshot.description,
                    data: snapshot.data,
                    user_id: 'default', // Add user_id for consistency
                });
                console.log('[STORAGE] History saved to Dexie database');

                // Clean up old history items to maintain limit
                const historyCount = await this.db.history.count();
                if (historyCount > this.maxHistoryItems) {
                    const excessCount = historyCount - this.maxHistoryItems;
                    const oldItems = await this.db.history.orderBy('timestamp').limit(excessCount).toArray();
                    await this.db.history.bulkDelete(oldItems.map(item => item.id));
                    console.log(`[STORAGE] Cleaned up ${excessCount} old history items`);
                }

                return true;
            }

            // Fallback to localStorage only if database is unavailable
            console.warn('[STORAGE] Database unavailable, falling back to localStorage for history');
            const history = await this.loadHistoryFromStorage() || [];
            console.log('[STORAGE] Current history length before save:', history.length);

            history.unshift(snapshot);

            // Keep only recent items
            if (history.length > this.maxHistoryItems) {
                history.splice(this.maxHistoryItems);
            }

            localStorage.setItem(this.historyStorageKey, JSON.stringify(history));
            console.log('[STORAGE] History saved to localStorage, new length:', history.length);

            console.log('[STORAGE] History snapshot saved successfully');
            return true;
        } catch (error) {
            console.error('[STORAGE] Failed to save history snapshot:', error);
            return false;
        }
    }

    /**
     * Load history from storage
     * @returns {Array} History snapshots
     */
    async loadHistoryFromStorage() {
        try {
            // Try database first
            if (this.db) {
                const history = await this.db.history
                    .where('user_id').equals('default')
                    .reverse()
                    .sortBy('timestamp');

                console.log('[STORAGE] History loaded from Dexie database:', {
                    length: history.length,
                    firstItem: history[0] ? {
                        name: history[0].name,
                        timestamp: history[0].timestamp,
                    } : null,
                });

                // Convert database format to expected format
                return history.map(item => ({
                    name: item.name,
                    timestamp: item.timestamp,
                    description: item.description,
                    data: item.data,
                }));
            }

            // Fallback to localStorage
            console.warn('[STORAGE] Database unavailable, loading history from localStorage');
            const historyString = localStorage.getItem(this.historyStorageKey);
            console.log('[STORAGE] Loading history from localStorage:', {
                key: this.historyStorageKey,
                hasData: !!historyString,
                dataLength: historyString ? historyString.length : 0,
            });

            if (!historyString) {
                console.log('[STORAGE] No history data found in localStorage');
                return [];
            }

            const history = JSON.parse(historyString);
            console.log('[STORAGE] History loaded successfully:', {
                length: history.length,
                firstItem: history[0] ? {
                    name: history[0].name,
                    timestamp: history[0].timestamp,
                } : null,
            });

            return history;
        } catch (error) {
            console.error('[STORAGE] Failed to load history:', error);
            return [];
        }
    }

    /**
     * Save settings
     * @param {Object} settings - Settings object
     * @returns {boolean} Success status
     */
    async saveSettings(settings) {
        if (!settings || typeof settings !== 'object' || Object.keys(settings).length === 0) {
            return false;
        }

        try {
            // Save to database as primary storage
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

                console.log('[STORAGE] Settings saved to Dexie database');
                return true;
            }

            // Fallback to localStorage only if database is unavailable
            console.warn('[STORAGE] Database unavailable, falling back to localStorage for settings');
            localStorage.setItem(this.settingsStorageKey, JSON.stringify(settings));
            console.log('[STORAGE] Settings saved to localStorage');
            return true;
        } catch (error) {
            console.error('[STORAGE] Failed to save settings:', error);
            return false;
        }
    }

    /**
     * Load settings
     * @returns {Object} Settings object
     */
    async loadSettings() {
        try {
            // Try database first
            if (this.db) {
                const settingsRecords = await this.db.settings.where('user_id').equals('default').toArray();
                const settings = {};

                settingsRecords.forEach(record => {
                    settings[record.key] = record.value;
                });

                console.log('[STORAGE] Settings loaded from Dexie database:', Object.keys(settings));
                return settings;
            }

            // Fallback to localStorage
            console.warn('[STORAGE] Database unavailable, loading settings from localStorage');
            const settingsString = localStorage.getItem(this.settingsStorageKey);
            const settings = settingsString ? JSON.parse(settingsString) : {};
            console.log('[STORAGE] Settings loaded from localStorage:', Object.keys(settings));
            return settings;
        } catch (error) {
            console.error('[STORAGE] Failed to load settings:', error);
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
            console.log('[STORAGE] Backup created');
            return true;
        } catch (error) {
            console.error('[STORAGE] Failed to create backup:', error);
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
            console.log('[STORAGE] Backup loaded');
            return backup.data;
        } catch (error) {
            console.error('[STORAGE] Failed to load backup:', error);
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
            console.log('[STORAGE] Starting data clearing process...');

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
                console.log(`[STORAGE] Cleared localStorage key: ${key}`);
            });

            // Clear database if available - make this synchronous
            if (this.db) {
                console.log('[STORAGE] Clearing Dexie database...');
                try {
                    await this.db.delete();
                    console.log('[STORAGE] Database deleted successfully');
                    this.db = null;
                    // Don't reinitialize here - let the page reload handle it
                } catch (dbError) {
                    console.error('[STORAGE] Error deleting database:', dbError);
                    // Continue with the process even if DB deletion fails
                }
            }

            // Also clear any other potential storage keys that might exist
            const allKeys = Object.keys(localStorage);
            allKeys.forEach(key => {
                if (key.includes('sankey') || key.includes('ExpenseDashboard') || key.includes('property-dashboard')) {
                    localStorage.removeItem(key);
                    console.log(`[STORAGE] Cleared additional key: ${key}`);
                }
            });

            console.log('[STORAGE] All data cleared successfully');
            return true;
        } catch (error) {
            console.error('[STORAGE] Failed to clear data:', error);
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
            history: await this.loadHistoryFromStorage(),
            settings: await this.loadSettings(),
            exportDate: new Date().toISOString(),
            version: '2.0',
        };

        // Add database data if available
        if (this.db) {
            try {
                const dbData = await this.db.export();
                exportData.database = dbData;
            } catch (error) {
                console.warn('[STORAGE] Failed to export database data:', error);
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

        console.log('[STORAGE] Importing data with structure:', Object.keys(importData));

        try {
            // Handle different data formats
            let dataToSave = null;

            // Check if it's export format (with currentData, history, settings)
            if (importData.currentData) {
                console.log('[STORAGE] Detected export format');
                dataToSave = importData.currentData;

                // Import history if present
                if (importData.history && Array.isArray(importData.history)) {
                    // Save history to database
                    if (this.db) {
                        for (const historyItem of importData.history) {
                            await this.db.history.add({
                                timestamp: historyItem.timestamp,
                                name: historyItem.name,
                                description: historyItem.description,
                                data: historyItem.data,
                                user_id: 'default',
                            });
                        }
                        console.log('[STORAGE] Imported history data to database');
                    } else {
                        // Fallback to localStorage
                        localStorage.setItem(this.historyStorageKey, JSON.stringify(importData.history));
                        console.log('[STORAGE] Imported history data to localStorage');
                    }
                }

                // Import settings if present
                if (importData.settings) {
                    await this.saveSettings(importData.settings);
                    console.log('[STORAGE] Imported settings data');
                }
            }
            // Check if it's direct data format (properties, expenseCategories)
            else if (importData.properties || importData.expenseCategories) {
                console.log('[STORAGE] Detected direct data format');
                dataToSave = importData;
            }
            else {
                console.error('[STORAGE] Unknown data format');
                return false;
            }

            // Save the main data
            if (dataToSave) {
                console.log('[STORAGE] Saving data:', {
                    properties: dataToSave.properties?.length || 0,
                    categories: dataToSave.expenseCategories?.length || 0,
                });
                const saveResult = await this.save(dataToSave);
                console.log('[STORAGE] Save result:', saveResult);

                if (!saveResult) {
                    console.error('[STORAGE] Failed to save imported data');
                    return false;
                }
            }

            // Import database data if available
            if (importData.database && this.db) {
                await this.db.import(importData.database);
                console.log('[STORAGE] Imported database data');
            }

            console.log('[STORAGE] Data imported successfully');
            return true;
        } catch (error) {
            console.error('[STORAGE] Failed to import data:', error);
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
        if (str == null) {return 0;}
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
            console.log('[STORAGE] Already initialized, skipping');
            return;
        }
        this._initialized = true;

        // Initialize Dexie database
        await this.initDatabase();
        console.log('[STORAGE] Storage initialized');
    }

    /**
     * Get chronological expenses for a property
     * @param {number} propertyId - Property ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {string} userId - User ID
     * @returns {Array} Chronological expenses
     */
    async getChronologicalExpenses(propertyId, startDate, endDate, userId = 'default') {
        if (!this.db) {
            console.warn('[STORAGE] Database not available for chronological queries');
            return [];
        }

        try {
            const expenses = await this.db.expenses
                .where('[property_id+expense_date]')
                .between([propertyId, startDate], [propertyId, endDate])
                .and(expense => expense.user_id === userId)
                .sortBy('expense_date');

            console.log(`[STORAGE] Found ${expenses.length} chronological expenses for property ${propertyId}`);
            return expenses;
        } catch (error) {
            console.error('[STORAGE] Failed to get chronological expenses:', error);
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
    async getMonthlyExpenseSummary(year, month, userId = 'default') {
        if (!this.db) {
            console.warn('[STORAGE] Database not available for monthly summary');
            return {};
        }

        try {
            const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

            const expenses = await this.db.expenses
                .where('user_id').equals(userId)
                .and(expense => expense.expense_date >= startDate && expense.expense_date <= endDate)
                .toArray();

            const summary = {};
            expenses.forEach(expense => {
                const category = expense.category;
                if (!summary[category]) {
                    summary[category] = 0;
                }
                summary[category] += expense.amount;
            });

            console.log(`[STORAGE] Monthly summary for ${year}-${month}:`, summary);
            return summary;
        } catch (error) {
            console.error('[STORAGE] Failed to get monthly summary:', error);
            return {};
        }
    }

    /**
     * Add or update user
     * @param {Object} userData - User data
     * @returns {boolean} Success status
     */
    async saveUser(userData) {
        if (!this.db) {
            console.warn('[STORAGE] Database not available for user operations');
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

            console.log('[STORAGE] User saved:', userData.username);
            return true;
        } catch (error) {
            console.error('[STORAGE] Failed to save user:', error);
            return false;
        }
    }

    /**
     * Get user by ID
     * @param {string} userId - User ID
     * @returns {Object|null} User data
     */
    async getUser(userId) {
        if (!this.db) {
            console.warn('[STORAGE] Database not available for user queries');
            return null;
        }

        try {
            const user = await this.db.users.get(userId);
            return user || null;
        } catch (error) {
            console.error('[STORAGE] Failed to get user:', error);
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
    async logAuditEvent(action, entityType, entityId, userId = 'default') {
        if (!this.db) {
            console.warn('[STORAGE] Database not available for audit logging');
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

            console.log(`[STORAGE] Audit logged: ${action} on ${entityType}:${entityId}`);
            return true;
        } catch (error) {
            console.error('[STORAGE] Failed to log audit event:', error);
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
    async getAuditTrail(entityType, entityId, userId = 'default') {
        if (!this.db) {
            console.warn('[STORAGE] Database not available for audit queries');
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

            console.log(`[STORAGE] Found ${auditTrail.length} audit entries for ${entityType}:${entityId}`);
            return auditTrail;
        } catch (error) {
            console.error('[STORAGE] Failed to get audit trail:', error);
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
            console.warn('[STORAGE] Database not available for export');
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

            console.log(`[STORAGE] Exported data for user ${userId}:`, {
                properties: properties.length,
                categories: categories.length,
                expenses: expenses.length,
                auditEntries: auditTrail.length,
            });

            return exportData;
        } catch (error) {
            console.error('[STORAGE] Failed to export user data:', error);
            return null;
        }
    }

    /**
     * Debug storage information
     */
    async debug() {
        console.log('[STORAGE DEBUG] === STORAGE INFORMATION ===');
        console.log('[STORAGE DEBUG] localStorage available:', this.isStorageAvailable('localStorage'));
        console.log('[STORAGE DEBUG] Database available:', this.isStorageAvailable('database'));
        console.log('[STORAGE DEBUG] Storage usage:', this.getStorageUsage());
        const stats = await this.getStorageStats();
        console.log('[STORAGE DEBUG] Storage stats:', stats);
        console.log('[STORAGE DEBUG] === END DEBUG ===');
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

// Expose globally for Babel standalone transpilation
window.Storage = Storage;
