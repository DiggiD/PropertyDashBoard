/**
 * Validator Module
 * Handles all data validation operations for the expense dashboard
 * - Property validation
 * - Category validation
 * - Expense data validation
 * - Input sanitization
 */

class Validator {
    constructor() {
        // Validation rules
        this.rules = {
            propertyName: {
                minLength: 2,
                maxLength: 50,
                pattern: /^[a-zA-Z0-9\s\-']+$/,
                message: 'Property name can only contain letters, numbers, spaces, hyphens, and apostrophes',
            },
            categoryName: {
                minLength: 2,
                maxLength: 30,
                pattern: /^[a-zA-Z0-9\s\-&]+$/,
                message: 'Category name can only contain letters, numbers, spaces, hyphens, and ampersands',
            },
            amount: {
                min: 0,
                max: 10000000, // 1 crore
                message: 'Amount must be between ₹0 and ₹1,00,00,000',
            },
            quarter: {
                pattern: /^Q[1-4]\s\d{4}$/,
                message: 'Quarter must be in format Q1-Q4 YYYY',
            },
        };
    }

    /**
     * Validate property name
     * @param {string} name - Property name to validate
     * @returns {Object} Validation result {isValid: boolean, message: string}
     */
    validatePropertyName(name) {
        if (!name || typeof name !== 'string') {
            return { isValid: false, message: 'Property name is required' };
        }

        const trimmed = name.trim();

        if (trimmed.length < this.rules.propertyName.minLength) {
            return {
                isValid: false,
                message: `Property name must be at least ${this.rules.propertyName.minLength} characters long`,
            };
        }

        if (trimmed.length > this.rules.propertyName.maxLength) {
            return {
                isValid: false,
                message: `Property name must be less than ${this.rules.propertyName.maxLength} characters`,
            };
        }

        if (!this.rules.propertyName.pattern.test(trimmed)) {
            return { isValid: false, message: this.rules.propertyName.message };
        }

        return { isValid: true, message: '' };
    }

    /**
     * Validate category name
     * @param {string} name - Category name to validate
     * @returns {Object} Validation result {isValid: boolean, message: string}
     */
    validateCategoryName(name) {
        if (!name || typeof name !== 'string') {
            return { isValid: false, message: 'Category name is required' };
        }

        const trimmed = name.trim();

        if (trimmed.length < this.rules.categoryName.minLength) {
            return {
                isValid: false,
                message: `Category name must be at least ${this.rules.categoryName.minLength} characters long`,
            };
        }

        if (trimmed.length > this.rules.categoryName.maxLength) {
            return {
                isValid: false,
                message: `Category name must be less than ${this.rules.categoryName.maxLength} characters`,
            };
        }

        if (!this.rules.categoryName.pattern.test(trimmed)) {
            return { isValid: false, message: this.rules.categoryName.message };
        }

        return { isValid: true, message: '' };
    }

    /**
     * Validate expense amount
     * @param {number|string} amount - Amount to validate
     * @returns {Object} Validation result {isValid: boolean, message: string}
     */
    validateAmount(amount) {
        if (amount === null || amount === undefined || amount === '') {
            return { isValid: false, message: 'Amount is required' };
        }

        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

        if (isNaN(numAmount)) {
            return { isValid: false, message: 'Please enter a valid number' };
        }

        if (numAmount < this.rules.amount.min) {
            return { isValid: false, message: 'Amount cannot be negative' };
        }

        if (numAmount > this.rules.amount.max) {
            return { isValid: false, message: 'Amount is too large. Please enter a smaller value.' };
        }

        return { isValid: true, message: '' };
    }

    /**
     * Validate quarter format
     * @param {string} quarter - Quarter string to validate
     * @returns {Object} Validation result {isValid: boolean, message: string}
     */
    validateQuarter(quarter) {
        if (!quarter || typeof quarter !== 'string') {
            return { isValid: false, message: 'Quarter is required' };
        }

        if (!this.rules.quarter.pattern.test(quarter)) {
            return { isValid: false, message: this.rules.quarter.message };
        }

        return { isValid: true, message: '' };
    }

    /**
     * Validate property data structure
     * @param {Object} property - Property object to validate
     * @returns {Object} Validation result {isValid: boolean, message: string, errors: Array}
     */
    validateProperty(property) {
        const errors = [];

        if (!property || typeof property !== 'object') {
            return {
                isValid: false,
                message: 'Property data is invalid',
                errors: ['Property must be an object'],
            };
        }

        // Validate required fields
        if (!property.id) {
            errors.push('Property ID is required');
        }

        if (!property.name || typeof property.name !== 'string') {
            errors.push('Property name is required and must be a string');
        } else {
            const nameValidation = this.validatePropertyName(property.name);
            if (!nameValidation.isValid) {
                errors.push(nameValidation.message);
            }
        }

        // Validate expenses structure
        if (!property.expenses || typeof property.expenses !== 'object') {
            errors.push('Property expenses must be an object');
        }

        // Validate quarterly data if present
        if (property.quarterlyData) {
            if (typeof property.quarterlyData !== 'object') {
                errors.push('Quarterly data must be an object');
            } else {
                // Validate each quarter
                Object.entries(property.quarterlyData).forEach(([quarter, data]) => {
                    const quarterValidation = this.validateQuarter(quarter);
                    if (!quarterValidation.isValid) {
                        errors.push(`Invalid quarter format: ${quarter}`);
                    }

                    if (!data || typeof data !== 'object') {
                        errors.push(`Quarter ${quarter} data is invalid`);
                    } else {
                        if (typeof data.total !== 'number' || data.total < 0) {
                            errors.push(`Quarter ${quarter} total must be a non-negative number`);
                        }

                        if (!data.expenses || typeof data.expenses !== 'object') {
                            errors.push(`Quarter ${quarter} expenses must be an object`);
                        }
                    }
                });
            }
        }

        return {
            isValid: errors.length === 0,
            message: errors.length > 0 ? `Property validation failed: ${errors.join(', ')}` : '',
            errors,
        };
    }

    /**
     * Validate category data
     * @param {string} category - Category name to validate
     * @returns {Object} Validation result {isValid: boolean, message: string}
     */
    validateCategory(category) {
        return this.validateCategoryName(category);
    }

    /**
     * Validate expense data structure
     * @param {Object} expenseData - Expense data to validate
     * @returns {Object} Validation result {isValid: boolean, message: string, errors: Array}
     */
    validateExpenseData(expenseData) {
        const errors = [];

        if (!expenseData || typeof expenseData !== 'object') {
            return {
                isValid: false,
                message: 'Expense data is invalid',
                errors: ['Expense data must be an object'],
            };
        }

        // Validate each expense category
        Object.entries(expenseData).forEach(([category, amount]) => {
            const categoryValidation = this.validateCategoryName(category);
            if (!categoryValidation.isValid) {
                errors.push(`Invalid category name: ${category} - ${categoryValidation.message}`);
            }

            const amountValidation = this.validateAmount(amount);
            if (!amountValidation.isValid) {
                errors.push(`Invalid amount for ${category}: ${amountValidation.message}`);
            }
        });

        return {
            isValid: errors.length === 0,
            message: errors.length > 0 ? `Expense data validation failed: ${errors.join(', ')}` : '',
            errors,
        };
    }

    /**
     * Validate complete dashboard data structure
     * @param {Object} data - Complete dashboard data to validate
     * @returns {Object} Validation result {isValid: boolean, message: string, errors: Array}
     */
    validateDashboardData(data) {
        const errors = [];

        if (!data || typeof data !== 'object') {
            return {
                isValid: false,
                message: 'Dashboard data is invalid',
                errors: ['Data must be an object'],
            };
        }

        // Validate properties array
        if (!Array.isArray(data.properties)) {
            errors.push('Properties must be an array');
        } else {
            data.properties.forEach((property, index) => {
                const propertyValidation = this.validateProperty(property);
                if (!propertyValidation.isValid) {
                    errors.push(`Property ${index + 1}: ${propertyValidation.message}`);
                }
            });
        }

        // Validate expense categories array
        if (!Array.isArray(data.expenseCategories)) {
            errors.push('Expense categories must be an array');
        } else {
            data.expenseCategories.forEach((category, index) => {
                const categoryValidation = this.validateCategory(category);
                if (!categoryValidation.isValid) {
                    errors.push(`Category ${index + 1}: ${categoryValidation.message}`);
                }
            });
        }

        // Validate current time period
        const validTimePeriods = ['all', 'year', 'quarter', 'month'];
        if (data.currentTimePeriod && !validTimePeriods.includes(data.currentTimePeriod)) {
            errors.push(`Invalid time period: ${data.currentTimePeriod}`);
        }

        // Validate current view
        const validViews = ['overview', 'trends', 'comparison', 'categories'];
        if (data.currentView && !validViews.includes(data.currentView)) {
            errors.push(`Invalid view: ${data.currentView}`);
        }

        return {
            isValid: errors.length === 0,
            message: errors.length > 0 ? `Dashboard data validation failed: ${errors.join('; ')}` : '',
            errors,
        };
    }

    /**
     * Sanitize input string
     * @param {string} input - Input string to sanitize
     * @returns {string} Sanitized string
     */
    sanitizeString(input) {
        if (!input || typeof input !== 'string') {
            return '';
        }

        return input
            .trim()
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .replace(/\s+/g, ' ') // Normalize whitespace
            .substring(0, 1000); // Limit length
    }

    /**
     * Validate and sanitize user input
     * @param {string} input - User input to validate and sanitize
     * @param {string} type - Input type ('property', 'category', 'amount')
     * @returns {Object} Validation result with sanitized value
     */
    validateAndSanitizeInput(input, type) {
        const sanitized = this.sanitizeString(input);

        let validation;
        switch (type) {
            case 'property':
                validation = this.validatePropertyName(sanitized);
                break;
            case 'category':
                validation = this.validateCategoryName(sanitized);
                break;
            case 'amount':
                validation = this.validateAmount(sanitized);
                break;
            default:
                validation = { isValid: true, message: '' };
        }

        return {
            ...validation,
            sanitized,
        };
    }

    /**
     * Check if a value is within acceptable range
     * @param {number} value - Value to check
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {boolean} Whether value is in range
     */
    isInRange(value, min, max) {
        return value >= min && value <= max;
    }

    /**
     * Validate array length
     * @param {Array} array - Array to validate
     * @param {number} minLength - Minimum length
     * @param {number} maxLength - Maximum length
     * @returns {Object} Validation result
     */
    validateArrayLength(array, minLength = 0, maxLength = Infinity) {
        if (!Array.isArray(array)) {
            return { isValid: false, message: 'Value must be an array' };
        }

        if (array.length < minLength) {
            return { isValid: false, message: `Array must have at least ${minLength} items` };
        }

        if (array.length > maxLength) {
            return { isValid: false, message: `Array must have at most ${maxLength} items` };
        }

        return { isValid: true, message: '' };
    }

    /**
     * Initialize the validator (no-op for utility class)
     * @returns {Promise<void>}
     */
    async initialize() {
        // No initialization needed for validator
        console.log('[VALIDATOR] Validator initialized');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validator;
} else {
    window.Validator = Validator;
}
