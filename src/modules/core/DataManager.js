/**
 * DataManager Module
 * Handles all data operations, validation, and business logic for the Property Expense Dashboard
 *
 * @class DataManager
 *
 * Core Responsibilities:
 * - Property and category CRUD operations
 * - Data persistence and retrieval (localStorage + Dexie)
 * - Business rule validation and data integrity
 * - Time period calculations and filtering
 * - Historical data management and snapshots
 *
 * Key Features:
 * - Comprehensive data validation
 * - Multi-time period support (all, year, quarter, month)
 * - Automatic data integrity checks
 * - Efficient caching and performance optimization
 * - Undo/redo support through snapshots
 *
 * Dependencies:
 * - Storage: For data persistence
 * - Validator: For data validation
 * - Formatter: For data formatting
 *
 * @example
 * ```javascript
 * const dataManager = new DataManager(storage, validator);
 * await dataManager.initialize();
 *
 * // Add a new property
 * const propertyId = await dataManager.addProperty({
 *   name: 'Downtown Office',
 *   expenses: { 'Maintenance': 5000, 'Utilities': 2000 }
 * });
 *
 * // Get current period data
 * const data = dataManager.getCurrentPeriodData(propertyId);
 * console.log('Total expenses:', data.total);
 * ```
 */

class DataManager {
    constructor(storage, validator, formatter) {
        this.storage = storage;
        this.validator = validator;
        this.formatter = formatter;

        // Data structure
        this.data = {
            properties: [],
            expenseCategories: [],
            incomeCategories: [], // Future feature: income categories
            currentTimePeriod: 'all',
            currentView: 'overview',
            selectedYear: 'all', // New: selected year for filtering
            selectedMonth: 'all', // New: selected month for filtering
        };

        // Income data structure for future feature
        this.incomeData = {
            categories: [],
            propertyIncomes: {}, // property_id -> income data
        };

        // Change tracking
        this.hasUnsavedChanges = false;
        this.lastSaved = null;

        console.log('[DATAMANAGER] DataManager initialized');
    }

    /**
     * Initialize data manager with existing data
     * @param {Object} initialData - Initial data to load
     */
    async initialize(initialData = null) {
        try {
            console.log('[DATAMANAGER] Starting data initialization...');

            if (initialData) {
                console.log('[DATAMANAGER] Initializing with provided data');
                this.data = this.validateAndNormalizeData(initialData);
            } else {
                // Load from storage
                console.log('[DATAMANAGER] Loading data from storage...');
                const loadedData = await this.storage.load();
                if (loadedData) {
                    console.log('[DATAMANAGER] Data loaded from storage, validating...');
                    this.data = this.validateAndNormalizeData(loadedData);
                } else {
                    console.log('[DATAMANAGER] No data found in storage, initializing empty state');
                    // Initialize with empty state
                    this.initializeEmptyState();
                }
            }

            // Ensure all properties have proper expense initialization
            this.ensurePropertyExpensesInitialized();

            this.lastSaved = new Date();
            this.hasUnsavedChanges = false;

            console.log('[DATAMANAGER] Data initialization complete');
            console.log('[DATAMANAGER] Properties:', this.data.properties.length);
            console.log('[DATAMANAGER] Categories:', this.data.expenseCategories.length);

            // Debug: Log property details
            this.data.properties.forEach((property, index) => {
                console.log(`[DATAMANAGER] Property ${index + 1}: ${property.name}, Expenses:`, Object.keys(property.expenses || {}));
            });

        } catch (error) {
            console.error('[DATAMANAGER] Error during initialization:', error);
            // Fallback to empty state on error
            this.initializeEmptyState();
            this.lastSaved = new Date();
            this.hasUnsavedChanges = false;
        }
    }

    /**
     * Load data from storage (alias for initialize)
     * @returns {Promise<void>}
     */
    async loadData() {
        await this.initialize();
    }

    /**
     * Initialize empty state
     */
    initializeEmptyState() {
        this.data = {
            properties: [],
            expenseCategories: [],
            currentTimePeriod: 'all',
            currentView: 'overview',
            selectedYear: 'all',
            selectedMonth: 'all',
        };
    }

    /**
     * Validate and normalize loaded data
     * @param {Object} data - Raw data to validate and normalize
     * @returns {Object} Validated and normalized data
     */
    validateAndNormalizeData(data) {
        console.log('[DATAMANAGER] Validating and normalizing data...');

        if (!data || typeof data !== 'object') {
            console.warn('[DATAMANAGER] Invalid data structure, using empty state');
            return this.getEmptyDataStructure();
        }

        const normalizedData = {
            properties: [],
            expenseCategories: [],
            currentTimePeriod: 'all',
            currentView: 'overview',
            ...data,
        };

        // Validate and normalize properties
        if (Array.isArray(data.properties)) {
            normalizedData.properties = data.properties.map((property, index) => {
                if (!property || typeof property !== 'object') {
                    console.warn(`[DATAMANAGER] Invalid property at index ${index}, skipping`);
                    return null;
                }

                const normalizedProperty = {
                    id: property.id || this.generatePropertyId(),
                    name: property.name || `Property ${index + 1}`,
                    expenses: {},
                    monthlyData: property.monthlyData || {},
                };

                // Ensure expenses is an object and convert positive values to negative (expenses)
                if (property.expenses && typeof property.expenses === 'object') {
                    normalizedProperty.expenses = this.convertToExpenseValues(property.expenses);
                }

                return normalizedProperty;
            }).filter(property => property !== null);
        } else {
            console.warn('[DATAMANAGER] Properties is not an array, initializing empty');
            normalizedData.properties = [];
        }

        // Validate and normalize expense categories
        if (Array.isArray(data.expenseCategories)) {
            normalizedData.expenseCategories = data.expenseCategories.filter(category =>
                typeof category === 'string' && category.trim().length > 0
            );
        } else {
            console.warn('[DATAMANAGER] Expense categories is not an array, initializing empty');
            normalizedData.expenseCategories = [];
        }

        // Validate time period
        const validPeriods = ['all', 'year', 'quarter', 'month'];
        if (!validPeriods.includes(normalizedData.currentTimePeriod)) {
            console.warn('[DATAMANAGER] Invalid time period, defaulting to "all"');
            normalizedData.currentTimePeriod = 'all';
        }

        // Validate view
        const validViews = ['overview', 'trends', 'comparison', 'categories'];
        if (!validViews.includes(normalizedData.currentView)) {
            console.warn('[DATAMANAGER] Invalid view, defaulting to "overview"');
            normalizedData.currentView = 'overview';
        }

        console.log('[DATAMANAGER] Data validation and normalization complete');
        return normalizedData;
    }

    /**
     * Convert positive values to negative (expenses)
     * @param {Object} expenses - Expenses object to convert
     * @returns {Object} Expenses with negative values
     */
    convertToExpenseValues(expenses) {
        const convertedExpenses = {};

        Object.entries(expenses).forEach(([category, value]) => {
            if (typeof value === 'object' && value !== null) {
                // Handle hierarchical expenses
                convertedExpenses[category] = {};
                Object.entries(value).forEach(([subcategory, subValue]) => {
                    // Convert positive values to negative for expenses
                    convertedExpenses[category][subcategory] = typeof subValue === 'number' && subValue > 0 ? -subValue : subValue;
                });
            } else if (typeof value === 'number') {
                // Convert positive values to negative for expenses
                convertedExpenses[category] = value > 0 ? -value : value;
            } else {
                // Keep non-numeric values as-is
                convertedExpenses[category] = value;
            }
        });

        return convertedExpenses;
    }

    /**
     * Get empty data structure
     * @returns {Object} Empty data structure
     */
    getEmptyDataStructure() {
        return {
            properties: [],
            expenseCategories: [],
            currentTimePeriod: 'all',
            currentView: 'overview',
            selectedYear: 'all',
            selectedMonth: 'all',
        };
    }

    /**
     * Ensure all properties have proper expense initialization
     */
    ensurePropertyExpensesInitialized() {
        console.log('[DATAMANAGER] Ensuring property expenses are initialized...');

        if (!Array.isArray(this.data.properties)) {
            console.warn('[DATAMANAGER] Properties is not an array');
            return;
        }

        this.data.properties.forEach((property, index) => {
            if (!property || typeof property !== 'object') {
                console.warn(`[DATAMANAGER] Property at index ${index} is invalid`);
                return;
            }

            // Ensure expenses object exists
            if (!property.expenses || typeof property.expenses !== 'object') {
                console.log(`[DATAMANAGER] Initializing expenses for property: ${property.name}`);
                property.expenses = {};
            }

            // Initialize from monthly data if expenses are empty
            if (Object.keys(property.expenses).length === 0 && property.monthlyData) {
                console.log(`[DATAMANAGER] Initializing expenses from monthly data for: ${property.name}`);
                this.initializeExpensesFromMonthlyData(property);
            }

            // Ensure all categories have entries in expenses
            if (Array.isArray(this.data.expenseCategories)) {
                this.data.expenseCategories.forEach(category => {
                    if (!(category in property.expenses)) {
                        console.log(`[DATAMANAGER] Adding missing category "${category}" to property: ${property.name}`);
                        property.expenses[category] = 0;
                    }
                });
            }

            // Validate expense values
            Object.keys(property.expenses).forEach(category => {
                const value = property.expenses[category];
                if (typeof value === 'object' && value !== null) {
                    // Handle hierarchical expenses - keep hierarchical if latest month has hierarchical data
                    const latestMonthData = property.monthlyData?.[Object.keys(property.monthlyData).sort().pop()];
                    const latestExpenseData = latestMonthData?.expenses?.[category];
                    const hasLatestHierarchical = typeof latestExpenseData === 'object' && latestExpenseData !== null;

                    if (hasLatestHierarchical) {
                        // Keep hierarchical structure from latest month and ensure all values are negative (expenses)
                        console.log(`[DATAMANAGER] Keeping hierarchical expense ${category} for ${property.name}`);
                        property.expenses[category] = {};
                        Object.entries(latestExpenseData).forEach(([subcategory, subValue]) => {
                            // Ensure hierarchical subcategory values are negative for expenses
                            property.expenses[category][subcategory] = typeof subValue === 'number' && subValue > 0 ? -subValue : subValue;
                        });
                    } else {
                        // Convert to total if no hierarchical data in latest month
                        const total = Object.values(value).reduce((sum, val) => sum + (val || 0), 0);
                        // Ensure the total is negative for expenses
                        const expenseTotal = total > 0 ? -total : total;
                        console.log(`[DATAMANAGER] Converting hierarchical expense ${category} to total: ${expenseTotal}`);
                        property.expenses[category] = expenseTotal;
                    }
                } else if (typeof value === 'number') {
                    // Ensure flat category values are negative for expenses
                    property.expenses[category] = value > 0 ? -value : value;
                } else if (typeof value !== 'number' || isNaN(value)) {
                    console.warn(`[DATAMANAGER] Invalid expense value for ${property.name} - ${category}: ${value}, setting to 0`);
                    property.expenses[category] = 0;
                }
            });
        });

        console.log('[DATAMANAGER] Property expenses initialization complete');
    }

    /**
     * Manually initialize expenses from monthly data for a property
     * This should only be called when explicitly requested by the user
     * @param {Object} property - Property object
     * @param {boolean} force - Whether to force initialization even if expenses already exist
     */
    initializeExpensesFromMonthlyData(property, force = false) {
        if (!property.monthlyData || typeof property.monthlyData !== 'object') {
            console.warn('[DATAMANAGER] Invalid monthly data for property:', property.name);
            return;
        }

        try {
            // Get all months and sort them
            const months = Object.keys(property.monthlyData).sort();

            if (months.length === 0) {
                console.warn('[DATAMANAGER] No months found in monthly data for property:', property.name);
                return;
            }

            // Use the most recent month
            const latestMonth = months[months.length - 1];
            const latestMonthData = property.monthlyData[latestMonth];

            if (!latestMonthData || !latestMonthData.expenses) {
                console.warn('[DATAMANAGER] No expenses found in latest month for property:', property.name);
                return;
            }

            console.log(`[DATAMANAGER] Initializing expenses from month: ${latestMonth} for property: ${property.name}`);

            // Copy expenses from the latest month
            Object.entries(latestMonthData.expenses).forEach(([category, value]) => {
                if (typeof value === 'object' && value !== null) {
                    // Handle hierarchical expenses - sum the values and ensure negative for expenses
                    const total = Object.values(value).reduce((sum, val) => sum + (val || 0), 0);
                    // Ensure the total is negative for expenses
                    property.expenses[category] = total > 0 ? -total : total;
                    console.log(`[DATAMANAGER] Hierarchical expense ${category}: ${property.expenses[category]}`);
                } else if (typeof value === 'number') {
                    // Ensure flat values are negative for expenses
                    property.expenses[category] = value > 0 ? -value : value;
                    console.log(`[DATAMANAGER] Flat expense ${category}: ${property.expenses[category]}`);
                } else {
                    console.warn(`[DATAMANAGER] Invalid expense value for ${category}: ${value}`);
                    property.expenses[category] = 0;
                }
            });

        } catch (error) {
            console.error('[DATAMANAGER] Error initializing expenses from monthly data:', error);
        }
    }

    /**
     * Manually initialize expenses from quarterly data for a property
     * This should only be called when explicitly requested by the user
     * @param {Object} property - Property object
     * @param {boolean} force - Whether to force initialization even if expenses already exist
     */
    initializeExpensesFromQuarterlyData(property, force = false) {
        if (!property.quarterlyData || typeof property.quarterlyData !== 'object') {
            console.warn('[DATAMANAGER] Invalid quarterly data for property:', property.name);
            return;
        }

        try {
            // Get all quarters and sort them
            const quarters = Object.keys(property.quarterlyData).sort();

            if (quarters.length === 0) {
                console.warn('[DATAMANAGER] No quarters found in quarterly data for property:', property.name);
                return;
            }

            // Use the most recent quarter
            const latestQuarter = quarters[quarters.length - 1];
            const latestQuarterData = property.quarterlyData[latestQuarter];

            if (!latestQuarterData || !latestQuarterData.expenses) {
                console.warn('[DATAMANAGER] No expenses found in latest quarter for property:', property.name);
                return;
            }

            console.log(`[DATAMANAGER] Initializing expenses from quarter: ${latestQuarter} for property: ${property.name}`);

            // Copy expenses from the latest quarter
            Object.entries(latestQuarterData.expenses).forEach(([category, value]) => {
                if (typeof value === 'object' && value !== null) {
                    // Handle hierarchical expenses - sum the values and ensure negative for expenses
                    const total = Object.values(value).reduce((sum, val) => sum + (val || 0), 0);
                    // Ensure the total is negative for expenses
                    property.expenses[category] = total > 0 ? -total : total;
                    console.log(`[DATAMANAGER] Hierarchical expense ${category}: ${property.expenses[category]}`);
                } else if (typeof value === 'number') {
                    // Ensure flat values are negative for expenses
                    property.expenses[category] = value > 0 ? -value : value;
                    console.log(`[DATAMANAGER] Flat expense ${category}: ${property.expenses[category]}`);
                } else {
                    console.warn(`[DATAMANAGER] Invalid expense value for ${category}: ${value}`);
                    property.expenses[category] = 0;
                }
            });

        } catch (error) {
            console.error('[DATAMANAGER] Error initializing expenses from quarterly data:', error);
        }
    }

    /**
     * Get current data
     * @returns {Object} Current data
     */
    getData() {
        return { ...this.data };
    }

    /**
     * Get properties
     * @returns {Array} Properties array
     */
    getProperties() {
        return [...this.data.properties];
    }

    /**
     * Get expense categories
     * @returns {Array} Categories array
     */
    getExpenseCategories() {
        return [...this.data.expenseCategories];
    }

    /**
     * Get income categories
     * @returns {Array} Income categories array
     */
    getIncomeCategories() {
        return [...(this.data.incomeCategories || [])];
    }

    /**
     * Get current time period
     * @returns {string} Current time period
     */
    getCurrentTimePeriod() {
        return this.data.currentTimePeriod;
    }

    /**
     * Get current view
     * @returns {string} Current view
     */
    getCurrentView() {
        return this.data.currentView;
    }

    /**
     * Set current time period
     * @param {string} timePeriod - Time period to set
     */
    setCurrentTimePeriod(timePeriod) {
        const validPeriods = ['all', 'year', 'quarter', 'month'];
        if (validPeriods.includes(timePeriod)) {
            this.data.currentTimePeriod = timePeriod;
            this.markAsChanged();
        }
    }

    /**
     * Set current view
     * @param {string} view - View to set
     */
    setCurrentView(view) {
        const validViews = ['overview', 'trends', 'comparison', 'categories'];
        if (validViews.includes(view)) {
            this.data.currentView = view;
            this.markAsChanged();
        }
    }

    /**
     * Get selected year
     * @returns {string} Selected year
     */
    getSelectedYear() {
        return this.data.selectedYear;
    }

    /**
     * Set selected year
     * @param {string} year - Year to set ('all' for all years)
     */
    setSelectedYear(year) {
        this.data.selectedYear = year;
        this.markAsChanged();
        console.log('[DATAMANAGER] Selected year set to:', year);
    }

    /**
     * Get selected month
     * @returns {string} Selected month
     */
    getSelectedMonth() {
        return this.data.selectedMonth;
    }

    /**
     * Set selected month
     * @param {string} month - Month to set ('all' for all months)
     */
    setSelectedMonth(month) {
        this.data.selectedMonth = month;
        this.markAsChanged();
        console.log('[DATAMANAGER] Selected month set to:', month);
    }

    /**
     * Get available years from the data
     * @returns {Array} Array of available years
     */
    getAvailableYears() {
        const years = new Set();

        // Scan through all properties to find years in monthly data
        this.data.properties.forEach(property => {
            if (property.monthlyData) {
                Object.keys(property.monthlyData).forEach(monthKey => {
                    // Extract year from month key (format: "MMM YYYY")
                    const parts = monthKey.split(' ');
                    if (parts.length === 2) {
                        const year = parts[1];
                        if (!isNaN(year) && year.length === 4) {
                            years.add(year);
                        }
                    }
                });
            }
        });

        // Return sorted years
        return Array.from(years).sort();
    }

    /**
     * Add a new property
     * @param {string} name - Property name
     * @returns {Object} Result with success status and property data
     */
    async addProperty(name) {
        // Validate input
        const validation = this.validator.validatePropertyName(name);
        if (!validation.isValid) {
            return {
                success: false,
                message: validation.message,
                property: null,
            };
        }

        // Check for duplicate names
        const existingProperty = this.data.properties.find(p =>
            p.name.toLowerCase() === name.toLowerCase(),
        );

        if (existingProperty) {
            return {
                success: false,
                message: 'A property with this name already exists',
                property: null,
            };
        }

        // Check limits
        if (this.data.properties.length >= 20) {
            return {
                success: false,
                message: 'Maximum of 20 properties allowed',
                property: null,
            };
        }

        // Create new property
        const newProperty = {
            id: this.generatePropertyId(),
            name: name.trim(),
            expenses: {},
            monthlyData: {},
        };

        // Initialize expenses for all categories, preserving hierarchical structure
        this.data.expenseCategories.forEach(category => {
            // Check if any existing property has hierarchical data for this category
            const existingHierarchicalProperty = this.data.properties.find(prop => {
                return prop.expenses[category] && typeof prop.expenses[category] === 'object';
            });

            if (existingHierarchicalProperty) {
                // Copy the hierarchical structure from existing property
                newProperty.expenses[category] = {};
                const hierarchicalData = existingHierarchicalProperty.expenses[category];
                Object.keys(hierarchicalData).forEach(subcategory => {
                    newProperty.expenses[category][subcategory] = 0;
                });
            } else {
                // Initialize as flat category
                newProperty.expenses[category] = 0;
            }
        });

        // Initialize monthly data structure for the new property
        this.initializeMonthlyDataForNewProperty(newProperty);

        // Add to data
        this.data.properties.push(newProperty);
        this.markAsChanged();

        // Save to storage immediately
        const saveResult = await this.save();
        if (!saveResult) {
            console.error('[DATAMANAGER] Failed to save new property to storage');
            // Remove the property from memory if save failed
            this.data.properties.pop();
            return {
                success: false,
                message: 'Failed to save property to storage',
                property: null,
            };
        }

        console.log('[DATAMANAGER] Property added and saved:', newProperty.name);

        return {
            success: true,
            message: `Property "${newProperty.name}" added successfully`,
            property: newProperty,
        };
    }

    /**
     * Update property name
     * @param {number} propertyId - Property ID
     * @param {string} newName - New property name
     * @returns {Object} Result with success status
     */
    updatePropertyName(propertyId, newName) {
        const property = this.data.properties.find(p => p.id === propertyId);
        if (!property) {
            return {
                success: false,
                message: 'Property not found',
            };
        }

        // Validate new name
        const validation = this.validator.validatePropertyName(newName);
        if (!validation.isValid) {
            return {
                success: false,
                message: validation.message,
            };
        }

        // Check for duplicate names (excluding current property)
        const existingProperty = this.data.properties.find(p =>
            p.id !== propertyId && p.name.toLowerCase() === newName.toLowerCase(),
        );

        if (existingProperty) {
            return {
                success: false,
                message: 'A property with this name already exists',
            };
        }

        const oldName = property.name;
        property.name = newName.trim();
        this.markAsChanged();

        console.log('[DATAMANAGER] Property renamed:', oldName, '->', newName);

        return {
            success: true,
            message: `Property renamed from "${oldName}" to "${newName}"`,
        };
    }

    /**
     * Delete property
     * @param {number} propertyId - Property ID to delete
     * @returns {Object} Result with success status
     */
    deleteProperty(propertyId) {
        const propertyIndex = this.data.properties.findIndex(p => p.id === propertyId);
        if (propertyIndex === -1) {
            return {
                success: false,
                message: 'Property not found',
            };
        }

        const property = this.data.properties[propertyIndex];
        this.data.properties.splice(propertyIndex, 1);
        this.markAsChanged();

        console.log('[DATAMANAGER] Property deleted:', property.name);

        return {
            success: true,
            message: `Property "${property.name}" deleted successfully`,
        };
    }

    /**
     * Get property by ID
     * @param {number} propertyId - Property ID
     * @returns {Object|null} Property object or null if not found
     */
    getPropertyById(propertyId) {
        return this.data.properties.find(p => p.id === propertyId) || null;
    }

    /**
     * Add expense category
     * @param {string} name - Category name
     * @returns {Object} Result with success status
     */
    addExpenseCategory(name) {
        // Validate input
        const validation = this.validator.validateCategoryName(name);
        if (!validation.isValid) {
            return {
                success: false,
                message: validation.message,
            };
        }

        // Check for duplicates
        const existingCategory = this.data.expenseCategories.find(c =>
            c.toLowerCase() === name.toLowerCase(),
        );

        if (existingCategory) {
            return {
                success: false,
                message: 'A category with this name already exists',
            };
        }

        // Check limits
        if (this.data.expenseCategories.length >= 15) {
            return {
                success: false,
                message: 'Maximum of 15 categories allowed',
            };
        }

        // Add category
        this.data.expenseCategories.push(name.trim());

        // Initialize expenses for all properties
        this.data.properties.forEach(property => {
            property.expenses[name] = 0;
        });

        this.markAsChanged();

        console.log('[DATAMANAGER] Category added:', name);

        return {
            success: true,
            message: `Category "${name}" added successfully`,
        };
    }

    /**
     * Update expense category name
     * @param {string} oldName - Old category name
     * @param {string} newName - New category name
     * @returns {Object} Result with success status
     */
    updateExpenseCategory(oldName, newName) {
        const categoryIndex = this.data.expenseCategories.indexOf(oldName);
        if (categoryIndex === -1) {
            return {
                success: false,
                message: 'Category not found',
            };
        }

        // Validate new name
        const validation = this.validator.validateCategoryName(newName);
        if (!validation.isValid) {
            return {
                success: false,
                message: validation.message,
            };
        }

        // Check for duplicates
        const existingCategory = this.data.expenseCategories.find(c =>
            c !== oldName && c.toLowerCase() === newName.toLowerCase(),
        );

        if (existingCategory) {
            return {
                success: false,
                message: 'A category with this name already exists',
            };
        }

        // Update category name
        this.data.expenseCategories[categoryIndex] = newName.trim();

        // Update all property expenses
        this.data.properties.forEach(property => {
            if (property.expenses.hasOwnProperty(oldName)) {
                property.expenses[newName] = property.expenses[oldName];
                delete property.expenses[oldName];
            }
        });

        this.markAsChanged();

        console.log('[DATAMANAGER] Category renamed:', oldName, '->', newName);

        return {
            success: true,
            message: `Category renamed from "${oldName}" to "${newName}"`,
        };
    }

    /**
     * Delete expense category
     * @param {string} categoryName - Category name to delete
     * @returns {Object} Result with success status
     */
    deleteExpenseCategory(categoryName) {
        const categoryIndex = this.data.expenseCategories.indexOf(categoryName);
        if (categoryIndex === -1) {
            return {
                success: false,
                message: 'Category not found',
            };
        }

        // Remove category
        this.data.expenseCategories.splice(categoryIndex, 1);

        // Remove from all properties
        this.data.properties.forEach(property => {
            if (property.expenses.hasOwnProperty(categoryName)) {
                delete property.expenses[categoryName];
            }

            // Also remove from quarterly data to prevent cached hierarchical data from persisting
            if (property.quarterlyData) {
                Object.keys(property.quarterlyData).forEach(quarter => {
                    if (property.quarterlyData[quarter] && property.quarterlyData[quarter].expenses) {
                        delete property.quarterlyData[quarter].expenses[categoryName];
                    }
                });
            }
        });

        this.markAsChanged();

        console.log('[DATAMANAGER] Category deleted:', categoryName);

        return {
            success: true,
            message: `Category "${categoryName}" deleted successfully`,
        };
    }

    /**
     * Add income category
     * @param {string} name - Category name
     * @returns {Object} Result with success status
     */
    addIncomeCategory(name) {
        // Validate input
        const validation = this.validator.validateCategoryName(name);
        if (!validation.isValid) {
            return {
                success: false,
                message: validation.message,
            };
        }

        // Initialize incomeCategories array if it doesn't exist
        if (!this.data.incomeCategories) {
            this.data.incomeCategories = [];
        }

        // Check for duplicates
        const existingCategory = this.data.incomeCategories.find(c =>
            c.toLowerCase() === name.toLowerCase(),
        );

        if (existingCategory) {
            return {
                success: false,
                message: 'An income category with this name already exists',
            };
        }

        // Check limits
        if (this.data.incomeCategories.length >= 10) {
            return {
                success: false,
                message: 'Maximum of 10 income categories allowed',
            };
        }

        // Add category
        this.data.incomeCategories.push(name.trim());

        this.markAsChanged();

        console.log('[DATAMANAGER] Income category added:', name);

        return {
            success: true,
            message: `Income category "${name}" added successfully`,
        };
    }

    /**
     * Update income category name
     * @param {string} oldName - Old category name
     * @param {string} newName - New category name
     * @returns {Object} Result with success status
     */
    updateIncomeCategory(oldName, newName) {
        if (!this.data.incomeCategories) {
            this.data.incomeCategories = [];
        }

        const categoryIndex = this.data.incomeCategories.indexOf(oldName);
        if (categoryIndex === -1) {
            return {
                success: false,
                message: 'Income category not found',
            };
        }

        // Validate new name
        const validation = this.validator.validateCategoryName(newName);
        if (!validation.isValid) {
            return {
                success: false,
                message: validation.message,
            };
        }

        // Check for duplicates
        const existingCategory = this.data.incomeCategories.find(c =>
            c !== oldName && c.toLowerCase() === newName.toLowerCase(),
        );

        if (existingCategory) {
            return {
                success: false,
                message: 'An income category with this name already exists',
            };
        }

        // Update category name
        this.data.incomeCategories[categoryIndex] = newName.trim();

        this.markAsChanged();

        console.log('[DATAMANAGER] Income category renamed:', oldName, '->', newName);

        return {
            success: true,
            message: `Income category renamed from "${oldName}" to "${newName}"`,
        };
    }

    /**
     * Delete income category
     * @param {string} categoryName - Category name to delete
     * @returns {Object} Result with success status
     */
    deleteIncomeCategory(categoryName) {
        if (!this.data.incomeCategories) {
            this.data.incomeCategories = [];
        }

        const categoryIndex = this.data.incomeCategories.indexOf(categoryName);
        if (categoryIndex === -1) {
            return {
                success: false,
                message: 'Income category not found',
            };
        }

        // Remove category
        this.data.incomeCategories.splice(categoryIndex, 1);

        this.markAsChanged();

        console.log('[DATAMANAGER] Income category deleted:', categoryName);

        return {
            success: true,
            message: `Income category "${categoryName}" deleted successfully`,
        };
    }

    /**
     * Update property expense
     * @param {number} propertyId - Property ID
     * @param {string} category - Expense category
     * @param {number} amount - Expense amount
     * @returns {Object} Result with success status
     */
    updatePropertyExpense(propertyId, category, amount) {
        const property = this.data.properties.find(p => p.id === propertyId);
        if (!property) {
            return {
                success: false,
                message: 'Property not found',
            };
        }

        // Validate amount
        const validation = this.validator.validateAmount(amount);
        if (!validation.isValid) {
            return {
                success: false,
                message: validation.message,
            };
        }

        const numAmount = parseFloat(amount);
        const oldAmount = property.expenses[category] || 0;

        property.expenses[category] = numAmount;
        this.markAsChanged();

        console.log('[DATAMANAGER] Expense updated:', property.name, category, oldAmount, '->', numAmount);

        return {
            success: true,
            message: `Expense updated for ${property.name} - ${category}`,
            oldAmount,
            newAmount: numAmount,
        };
    }

    /**
     * Get current period data for a property
     * @param {Object} property - Property object
     * @param {string} timePeriod - Time period ('all', 'year', 'quarter', 'month')
     * @param {boolean} preserveHierarchy - Whether to preserve hierarchical structure for sankey charts
     * @returns {Object} Current period data
     */
    getCurrentPeriodData(property, timePeriod = null, preserveHierarchy = false) {
        const period = timePeriod || this.data.currentTimePeriod;

        if (!property) {
            console.error('[DATAMANAGER] Property is undefined in getCurrentPeriodData');
            return { total: 0, expenses: {} };
        }

        // If no monthly data exists, fall back to property expenses
        if (!property.monthlyData || Object.keys(property.monthlyData).length === 0) {
            console.log('[DATAMANAGER] No monthly data found for property:', property.name, '- using property expenses directly');
            return this.getPropertyExpenseData(property, preserveHierarchy);
        }

        if (period === 'all') {
            // Calculate totals across all months
            const allMonths = Object.values(property.monthlyData || {});
            const totalExpenses = {};
            let grandTotal = 0;

            // Find the most recent month for hierarchical data
            const months = Object.keys(property.monthlyData || {}).sort();
            const latestMonth = months.length > 0 ? property.monthlyData[months[months.length - 1]] : null;

            this.data.expenseCategories.forEach(category => {
                let categoryTotal = 0;

                // Check if the latest month has hierarchical data for this category
                const latestExpenseData = latestMonth?.expenses?.[category];
                const hasLatestHierarchical = preserveHierarchy && typeof latestExpenseData === 'object' && latestExpenseData !== null;

                if (hasLatestHierarchical) {
                    // Aggregate hierarchical data from all months, but only include subcategories that exist in the latest month
                    const aggregatedHierarchical = {};
                    Object.keys(latestExpenseData).forEach(subCategory => {
                        let subTotal = 0;
                        allMonths.forEach(month => {
                            const monthExpenseData = month.expenses?.[category];
                            if (typeof monthExpenseData === 'object' && monthExpenseData !== null && monthExpenseData[subCategory]) {
                                subTotal += monthExpenseData[subCategory] || 0;
                            }
                        });
                        if (subTotal !== 0) { // Include both positive and negative values
                            aggregatedHierarchical[subCategory] = subTotal;
                        }
                    });
                    totalExpenses[category] = aggregatedHierarchical;
                    Object.values(aggregatedHierarchical).forEach(value => {
                        categoryTotal += value || 0;
                    });
                } else {
                    // Aggregate flat data from all months
                    allMonths.forEach(month => {
                        const expenseData = month.expenses[category];
                        if (typeof expenseData === 'object' && expenseData !== null) {
                            Object.values(expenseData).forEach(subAmount => {
                                categoryTotal += subAmount || 0;
                            });
                        } else {
                            categoryTotal += expenseData || 0;
                        }
                    });
                    // Set the aggregated value for non-hierarchical categories
                    totalExpenses[category] = categoryTotal;
                }

                // Calculate grand total
                if (hasLatestHierarchical) {
                    // For hierarchical categories, sum the subcategory totals
                    const hierarchicalTotal = Object.values(totalExpenses[category]).reduce((sum, val) => sum + val, 0);
                    grandTotal += hierarchicalTotal;
                } else {
                    grandTotal += categoryTotal;
                }
            });

            return { total: grandTotal, expenses: totalExpenses };
        }

        // Get all available months for this property
        const allMonths = Object.keys(property.monthlyData || {});

        if (allMonths.length === 0) {
            console.warn('[DATAMANAGER] No months found for property:', property.name);
            return { total: 0, expenses: {} };
        }

        let monthsToInclude = [];

        // Filter months based on time period
        if (period === 'year') {
            // Use selected year if available, otherwise use latest year
            const selectedYear = this.data.selectedYear !== 'all' ? this.data.selectedYear : null;
            if (selectedYear) {
                monthsToInclude = allMonths.filter(month => month.includes(selectedYear));
            } else {
                // Find the latest year available in the data
                const years = [...new Set(allMonths.map(m => m.split(' ')[1]))].sort();
                const latestYear = years[years.length - 1];
                monthsToInclude = allMonths.filter(month => month.includes(latestYear));
            }
        } else if (period === 'quarter') {
            // Get the latest 3 months for quarter view
            const sortedMonths = allMonths.sort();
            monthsToInclude = sortedMonths.slice(-3);
        } else if (period === 'month') {
            // Use selected month/year if available, otherwise use latest month
            const selectedYear = this.data.selectedYear !== 'all' ? this.data.selectedYear : null;
            const selectedMonth = this.data.selectedMonth !== 'all' ? this.data.selectedMonth : null;

            if (selectedYear && selectedMonth) {
                // Convert month number to month name
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthIndex = parseInt(selectedMonth) - 1;
                const monthName = monthNames[monthIndex];

                if (monthName) {
                    const targetMonthKey = `${monthName} ${selectedYear}`;
                    const foundMonth = allMonths.find(month => month === targetMonthKey);
                    if (foundMonth) {
                        monthsToInclude = [foundMonth];
                    } else {
                        // If selected month/year combination doesn't exist, fall back to latest month
                        monthsToInclude = [allMonths[allMonths.length - 1]];
                    }
                } else {
                    // Invalid month, fall back to latest month
                    monthsToInclude = [allMonths[allMonths.length - 1]];
                }
            } else {
                // Include only the latest month
                monthsToInclude = [allMonths[allMonths.length - 1]];
            }
        }

        // Fallback: if no months match the filter, use latest month
        if (monthsToInclude.length === 0) {
            console.warn('[DATAMANAGER] No months found for time period:', period, 'for property:', property.name, '- using latest month as fallback');
            monthsToInclude = [allMonths[allMonths.length - 1]];
        }

        // Aggregate data from selected months
        const totalExpenses = {};
        let grandTotal = 0;

        this.data.expenseCategories.forEach(category => {
            let categoryTotal = 0;
            monthsToInclude.forEach(month => {
                const monthData = property.monthlyData[month];
                if (monthData && monthData.expenses) {
                    const expenseData = monthData.expenses[category];
                    if (preserveHierarchy && typeof expenseData === 'object' && expenseData !== null) {
                        // Preserve hierarchical structure
                        if (!totalExpenses[category]) {
                            totalExpenses[category] = {};
                        }
                        Object.entries(expenseData).forEach(([subCategory, value]) => {
                            totalExpenses[category][subCategory] = (totalExpenses[category][subCategory] || 0) + value;
                            categoryTotal += value;
                        });
                    } else {
                        // Sum hierarchical data or use flat value
                        if (typeof expenseData === 'object' && expenseData !== null) {
                            Object.values(expenseData).forEach(subAmount => {
                                categoryTotal += subAmount || 0;
                            });
                        } else {
                            categoryTotal += expenseData || 0;
                        }
                        if (!preserveHierarchy) {
                            totalExpenses[category] = categoryTotal;
                        }
                    }
                }
            });

            if (!preserveHierarchy) {
                totalExpenses[category] = categoryTotal;
                grandTotal += categoryTotal;
            } else if (typeof totalExpenses[category] !== 'object') {
                totalExpenses[category] = categoryTotal;
                grandTotal += categoryTotal;
            } else {
                // For hierarchical categories, sum the subcategory totals
                const hierarchicalTotal = Object.values(totalExpenses[category]).reduce((sum, val) => sum + val, 0);
                grandTotal += hierarchicalTotal;
            }
        });

        return { total: grandTotal, expenses: totalExpenses };
    }

    /**
     * Calculate total expenses across all properties
     * @param {string} timePeriod - Time period (optional)
     * @returns {number} Total expenses
     */
    calculateTotalExpenses(timePeriod = null) {
        const period = timePeriod || this.data.currentTimePeriod;
        let total = 0;

        this.data.properties.forEach(property => {
            const currentData = this.getCurrentPeriodData(property, period);
            total += currentData.total || 0;
        });

        return total;
    }

    /**
     * Calculate average expense per property
     * @param {string} timePeriod - Time period (optional)
     * @returns {number} Average expense per property
     */
    calculateAverageExpensePerProperty(timePeriod = null) {
        const period = timePeriod || this.data.currentTimePeriod;
        const totalExpenses = this.calculateTotalExpenses(period);
        const propertyCount = this.data.properties.length;

        return propertyCount > 0 ? totalExpenses / propertyCount : 0;
    }

    /**
     * Get top expense category
     * @param {string} timePeriod - Time period (optional)
     * @returns {Object} Top category data
     */
    getTopExpenseCategory(timePeriod = null) {
        const period = timePeriod || this.data.currentTimePeriod;
        const categoryTotals = {};

        this.data.properties.forEach(property => {
            const currentData = this.getCurrentPeriodData(property, period);
            Object.entries(currentData.expenses || {}).forEach(([category, amount]) => {
                categoryTotals[category] = (categoryTotals[category] || 0) + amount;
            });
        });

        const topCategory = Object.entries(categoryTotals).sort(([,a], [,b]) => b - a)[0];

        return topCategory ? {
            name: topCategory[0],
            amount: topCategory[1],
        } : {
            name: 'None',
            amount: 0,
        };
    }

    /**
     * Generate unique property ID
     * @returns {number} Unique property ID
     */
    generatePropertyId() {
        const maxId = this.data.properties.length > 0
            ? Math.max(...this.data.properties.map(p => p.id))
            : 0;
        return maxId + 1;
    }

    /**
     * Mark data as changed
     */
    markAsChanged() {
        this.hasUnsavedChanges = true;
    }

    /**
     * Check if data has unsaved changes
     * @returns {boolean} Whether data has unsaved changes
     */
    hasUnsavedChanges() {
        return this.hasUnsavedChanges;
    }

    /**
     * Save data to storage
     * @returns {boolean} Success status
     */
    async save() {
        const success = await this.storage.save(this.data);
        if (success) {
            this.hasUnsavedChanges = false;
            this.lastSaved = new Date();
        }
        return success;
    }

    /**
     * Validate data integrity
     * @returns {Object} Validation result
     */
    validateDataIntegrity() {
        return this.validator.validateDashboardData(this.data);
    }

    /**
     * Get data statistics
     * @returns {Object} Data statistics
     */
    getDataStatistics() {
        const totalExpenses = this.calculateTotalExpenses();
        const avgPerProperty = this.calculateAverageExpensePerProperty();
        const topCategory = this.getTopExpenseCategory();

        return {
            totalProperties: this.data.properties.length,
            totalCategories: this.data.expenseCategories.length,
            totalExpenses,
            averageExpensePerProperty: avgPerProperty,
            topExpenseCategory: topCategory,
            currentTimePeriod: this.data.currentTimePeriod,
            currentView: this.data.currentView,
            hasUnsavedChanges: this.hasUnsavedChanges,
            lastSaved: this.lastSaved,
        };
    }

    /**
     * Export data
     * @returns {Object} Export data
     */
    async exportData() {
        return await this.storage.exportAllData();
    }

    /**
     * Import data
     * @param {Object} importData - Data to import
     * @returns {boolean} Success status
     */
    async importData(importData) {
        console.log('[DATAMANAGER] Importing data...', {
            hasProperties: !!importData.properties,
            propertiesCount: importData.properties?.length || 0,
            hasCategories: !!importData.expenseCategories,
            categoriesCount: importData.expenseCategories?.length || 0
        });

        try {
            // Validate import data
            if (!importData || typeof importData !== 'object') {
                console.error('[DATAMANAGER] Invalid import data');
                return false;
            }

            // Normalize the data structure
            const normalizedData = this.validateAndNormalizeData(importData);
            console.log('[DATAMANAGER] Data normalized for import:', {
                properties: normalizedData.properties.length,
                categories: normalizedData.expenseCategories.length
            });

            // Save the data to storage
            const success = await this.storage.importData(normalizedData);
            console.log('[DATAMANAGER] Storage import result:', success);

            if (success) {
                // Directly set the data in memory instead of relying on initialize()
                console.log('[DATAMANAGER] Setting data directly in memory...');
                this.data = normalizedData;

                // Ensure all properties have proper expense initialization
                this.ensurePropertyExpensesInitialized();

                // Mark as having unsaved changes (even though we just saved)
                this.hasUnsavedChanges = false;
                this.lastSaved = new Date();

                console.log('[DATAMANAGER] Import complete. Current data:', {
                    properties: this.data.properties.length,
                    categories: this.data.expenseCategories.length,
                    totalExpenses: this.calculateTotalExpenses()
                });

                // Initialize expenses from monthly data for imported properties
                console.log('[DATAMANAGER] Initializing expenses from monthly data for imported properties...');
                this.data.properties.forEach(property => {
                    if (property.monthlyData && Object.keys(property.expenses).length === 0) {
                        console.log(`[DATAMANAGER] Initializing expenses for imported property: ${property.name}`);
                        this.initializeExpensesFromMonthlyData(property, true);
                    }
                });

                // Automatically create a snapshot of the imported data
                console.log('[DATAMANAGER] Creating snapshot of imported data...');
                if (window.historyManager && typeof window.historyManager.createSnapshot === 'function') {
                    try {
                        const snapshotResult = await window.historyManager.createSnapshot(
                            'Imported Data',
                            `Data imported on ${new Date().toLocaleString()}`,
                            true // silent mode
                        );
                        console.log('[DATAMANAGER] Snapshot created for imported data:', snapshotResult);

                        // Force reload history from storage to ensure it's up to date
                        if (typeof window.historyManager.loadHistoryFromStorage === 'function') {
                            await window.historyManager.loadHistoryFromStorage();
                            console.log('[DATAMANAGER] History reloaded from storage after snapshot');
                        }
                    } catch (snapshotError) {
                        console.warn('[DATAMANAGER] Failed to create snapshot:', snapshotError);
                    }
                } else {
                    console.warn('[DATAMANAGER] HistoryManager not available for snapshot creation');
                }

                // Update UI to reflect the imported data
                console.log('[DATAMANAGER] Updating UI with imported data...');
                if (window.uiManager && typeof window.uiManager.updateDataDisplay === 'function') {
                    try {
                        const stats = this.getDataStatistics();
                        await window.uiManager.updateDataDisplay(stats);
                        console.log('[DATAMANAGER] UI updated with imported data');
                    } catch (uiError) {
                        console.warn('[DATAMANAGER] Failed to update UI:', uiError);
                    }
                } else {
                    console.warn('[DATAMANAGER] UIManager not available for UI update');
                }
            } else {
                console.error('[DATAMANAGER] Storage import failed');
            }

            return success;
        } catch (error) {
            console.error('[DATAMANAGER] Error during import:', error);
            return false;
        }
    }

    /**
     * Clear all data
     * @param {boolean} includeBackup - Whether to include backup
     * @returns {boolean} Success status
     */
    async clearAllData(includeBackup = false) {
        const success = this.storage.clearAllData(includeBackup);
        if (success) {
            this.initializeEmptyState();
            this.hasUnsavedChanges = false;
            this.lastSaved = null;
        }
        return success;
    }

    /**
     * Initialize monthly data structure for a new property
     * @param {Object} property - The new property object
     */
    initializeMonthlyDataForNewProperty(property) {
        // Get current date to determine the current month
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

        // Format month as "MMM YYYY" (e.g., "Jan 2025")
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthKey = `${monthNames[currentMonth - 1]} ${currentYear}`;

        // Initialize monthly data structure
        property.monthlyData = {};
        property.monthlyData[monthKey] = {
            expenses: {},
            total: 0,
        };

        // Copy the expense structure to monthly data
        Object.entries(property.expenses).forEach(([category, value]) => {
            if (typeof value === 'object' && value !== null) {
                // Hierarchical category - copy the structure
                property.monthlyData[monthKey].expenses[category] = { ...value };
            } else {
                // Flat category - copy the value
                property.monthlyData[monthKey].expenses[category] = value;
            }
        });

        // Calculate initial total
        property.monthlyData[monthKey].total = this.calculatePropertyTotal(property.expenses);

        console.log(`[DATAMANAGER] Initialized monthly data for new property: ${property.name}, Month: ${monthKey}`);
    }

    /**
     * Initialize quarterly data structure for a new property
     * @param {Object} property - The new property object
     */
    initializeQuarterlyDataForNewProperty(property) {
        // Get current date to determine the current quarter
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

        // Determine current quarter
        let currentQuarter;
        if (currentMonth <= 3) {
            currentQuarter = 'Q1';
        } else if (currentMonth <= 6) {
            currentQuarter = 'Q2';
        } else if (currentMonth <= 9) {
            currentQuarter = 'Q3';
        } else {
            currentQuarter = 'Q4';
        }

        const quarterKey = `${currentQuarter} ${currentYear}`;

        // Initialize quarterly data structure
        property.quarterlyData = {};
        property.quarterlyData[quarterKey] = {
            expenses: {},
            total: 0,
        };

        // Copy the expense structure to quarterly data
        Object.entries(property.expenses).forEach(([category, value]) => {
            if (typeof value === 'object' && value !== null) {
                // Hierarchical category - copy the structure
                property.quarterlyData[quarterKey].expenses[category] = { ...value };
            } else {
                // Flat category - copy the value
                property.quarterlyData[quarterKey].expenses[category] = value;
            }
        });

        // Calculate initial total
        property.quarterlyData[quarterKey].total = this.calculatePropertyTotal(property.expenses);

        console.log(`[DATAMANAGER] Initialized quarterly data for new property: ${property.name}, Quarter: ${quarterKey}`);
    }

    /**
     * Get property expense data directly from expenses object (fallback when no quarterly data)
     * @param {Object} property - Property object
     * @param {boolean} preserveHierarchy - Whether to preserve hierarchical structure
     * @returns {Object} Expense data with total and expenses
     */
    getPropertyExpenseData(property, preserveHierarchy = false) {
        if (!property || !property.expenses) {
            return { total: 0, expenses: {} };
        }

        const expenses = { ...property.expenses };
        let total = 0;

        // Process each category
        Object.keys(expenses).forEach(category => {
            const value = expenses[category];

            if (typeof value === 'object' && value !== null) {
                // Hierarchical category
                if (preserveHierarchy) {
                    // Keep hierarchical structure
                    total += Object.values(value).reduce((sum, val) => sum + (val || 0), 0);
                } else {
                    // Sum hierarchical values
                    const categoryTotal = Object.values(value).reduce((sum, val) => sum + (val || 0), 0);
                    expenses[category] = categoryTotal;
                    total += categoryTotal;
                }
            } else {
                // Flat category
                total += value || 0;
            }
        });

        return { total, expenses };
    }

    /**
     * Calculate total expenses for a property from its expenses object
     * @param {Object} expenses - Expenses object
     * @returns {number} Total amount
     */
    calculatePropertyTotal(expenses) {
        let total = 0;

        Object.values(expenses).forEach(value => {
            if (typeof value === 'object' && value !== null) {
                // Sum hierarchical values
                Object.values(value).forEach(subValue => {
                    total += subValue || 0;
                });
            } else {
                // Add flat value
                total += value || 0;
            }
        });

        return total;
    }

    /**
     * Debug data information
     */
    debug() {
        console.log('[DATAMANAGER DEBUG] === DATA MANAGER INFO ===');
        console.log('[DATAMANAGER DEBUG] Properties:', this.data.properties.length);
        console.log('[DATAMANAGER DEBUG] Categories:', this.data.expenseCategories.length);
        console.log('[DATAMANAGER DEBUG] Current period:', this.data.currentTimePeriod);
        console.log('[DATAMANAGER DEBUG] Current view:', this.data.currentView);
        console.log('[DATAMANAGER DEBUG] Has unsaved changes:', this.hasUnsavedChanges);
        console.log('[DATAMANAGER DEBUG] Last saved:', this.lastSaved);
        console.log('[DATAMANAGER DEBUG] Statistics:', this.getDataStatistics());
        console.log('[DATAMANAGER DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
} else {
    window.DataManager = DataManager;
}
