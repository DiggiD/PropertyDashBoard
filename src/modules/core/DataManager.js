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
            currentTimePeriod: 'all',
            currentView: 'overview',
        };

        // Change tracking
        this.hasUnsavedChanges = false;
        this.lastSaved = null;

        console.log('🔧 [DATAMANAGER] DataManager initialized');
    }

    /**
     * Initialize data manager with existing data
     * @param {Object} initialData - Initial data to load
     */
    async initialize(initialData = null) {
        if (initialData) {
            this.data = { ...initialData };
        } else {
            // Load from storage
            const loadedData = await this.storage.load();
            if (loadedData) {
                this.data = { ...loadedData };
            } else {
                // Initialize with empty state
                this.initializeEmptyState();
            }
        }

        this.lastSaved = new Date();
        this.hasUnsavedChanges = false;

        console.log('🔧 [DATAMANAGER] Data initialized with', this.data.properties.length, 'properties');
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
        };
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
     * Add a new property
     * @param {string} name - Property name
     * @returns {Object} Result with success status and property data
     */
    addProperty(name) {
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
            quarterlyData: {},
            categoryTrends: {},
        };

        // Initialize expenses for all categories
        this.data.expenseCategories.forEach(category => {
            newProperty.expenses[category] = 0;
        });

        // Add to data
        this.data.properties.push(newProperty);
        this.markAsChanged();

        console.log('🔧 [DATAMANAGER] Property added:', newProperty.name);

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

        console.log('🔧 [DATAMANAGER] Property renamed:', oldName, '->', newName);

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

        console.log('🔧 [DATAMANAGER] Property deleted:', property.name);

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

        console.log('🔧 [DATAMANAGER] Category added:', name);

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

        console.log('🔧 [DATAMANAGER] Category renamed:', oldName, '->', newName);

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
        });

        this.markAsChanged();

        console.log('🔧 [DATAMANAGER] Category deleted:', categoryName);

        return {
            success: true,
            message: `Category "${categoryName}" deleted successfully`,
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

        console.log('🔧 [DATAMANAGER] Expense updated:', property.name, category, oldAmount, '->', numAmount);

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
     * @returns {Object} Current period data
     */
    getCurrentPeriodData(property, timePeriod = null) {
        const period = timePeriod || this.data.currentTimePeriod;

        if (!property) {
            console.error('🔧 [DATAMANAGER] Property is undefined in getCurrentPeriodData');
            return { total: 0, expenses: {} };
        }

        if (!property.quarterlyData) {
            console.warn('🔧 [DATAMANAGER] Property.quarterlyData is undefined for property:', property.name);
            return { total: 0, expenses: {} };
        }

        if (period === 'all') {
            // Calculate totals across all quarters
            const allQuarters = Object.values(property.quarterlyData || {});
            const totalExpenses = {};
            let grandTotal = 0;

            this.data.expenseCategories.forEach(category => {
                let categoryTotal = 0;
                allQuarters.forEach(quarter => {
                    categoryTotal += quarter.expenses[category] || 0;
                });
                totalExpenses[category] = categoryTotal;
                grandTotal += categoryTotal;
            });

            return { total: grandTotal, expenses: totalExpenses };
        }

        // Get all available quarters for this property
        const allQuarters = Object.keys(property.quarterlyData || {});

        if (allQuarters.length === 0) {
            console.warn('🔧 [DATAMANAGER] No quarters found for property:', property.name);
            return { total: 0, expenses: {} };
        }

        let quartersToInclude = [];

        // Filter quarters based on time period
        if (period === 'year') {
            // Find the latest year available in the data
            const years = [...new Set(allQuarters.map(q => q.split(' ')[1]))].sort();
            const latestYear = years[years.length - 1];
            quartersToInclude = allQuarters.filter(quarter => quarter.includes(latestYear));
        } else if (period === 'quarter' || period === 'month') {
            // Include only the latest quarter
            quartersToInclude = [allQuarters[allQuarters.length - 1]];
        }

        // Fallback: if no quarters match the filter, use latest quarter
        if (quartersToInclude.length === 0) {
            console.warn('🔧 [DATAMANAGER] No quarters found for time period:', period, 'for property:', property.name, '- using latest quarter as fallback');
            quartersToInclude = [allQuarters[allQuarters.length - 1]];
        }

        // Aggregate data from selected quarters
        const totalExpenses = {};
        let grandTotal = 0;

        this.data.expenseCategories.forEach(category => {
            let categoryTotal = 0;
            quartersToInclude.forEach(quarter => {
                const quarterData = property.quarterlyData[quarter];
                if (quarterData && quarterData.expenses) {
                    categoryTotal += quarterData.expenses[category] || 0;
                }
            });
            totalExpenses[category] = categoryTotal;
            grandTotal += categoryTotal;
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
        const success = await this.storage.importData(importData);
        if (success) {
            await this.initialize();
        }
        return success;
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
     * Debug data information
     */
    debug() {
        console.log('🔧 [DATAMANAGER DEBUG] === DATA MANAGER INFO ===');
        console.log('🔧 [DATAMANAGER DEBUG] Properties:', this.data.properties.length);
        console.log('🔧 [DATAMANAGER DEBUG] Categories:', this.data.expenseCategories.length);
        console.log('🔧 [DATAMANAGER DEBUG] Current period:', this.data.currentTimePeriod);
        console.log('🔧 [DATAMANAGER DEBUG] Current view:', this.data.currentView);
        console.log('🔧 [DATAMANAGER DEBUG] Has unsaved changes:', this.hasUnsavedChanges);
        console.log('🔧 [DATAMANAGER DEBUG] Last saved:', this.lastSaved);
        console.log('🔧 [DATAMANAGER DEBUG] Statistics:', this.getDataStatistics());
        console.log('🔧 [DATAMANAGER DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
} else {
    window.DataManager = DataManager;
}
