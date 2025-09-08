/**
 * Formatter Module
 * Handles all formatting operations for the expense dashboard
 * - Currency formatting
 * - Date formatting
 * - Number formatting
 * - Percentage calculations
 */

class Formatter {
    constructor() {
        // Currency formatting options for Indian Rupees
        this.currencyOptions = {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        };

        // Compact currency formatting for small spaces
        this.currencyCompactOptions = {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
            notation: 'compact',
            compactDisplay: 'short',
        };
    }

    /**
     * Format a number as Indian Rupees
     * @param {number} amount - The amount to format
     * @param {boolean} compact - Whether to use compact notation
     * @returns {string} Formatted currency string
     */
    formatCurrency(amount, compact = false) {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return '₹0';
        }

        const options = compact ? this.currencyCompactOptions : this.currencyOptions;

        try {
            return new Intl.NumberFormat('en-IN', options).format(amount);
        } catch (error) {
            console.warn('Currency formatting failed, using fallback:', error);
            return `₹${Math.round(amount).toLocaleString('en-IN')}`;
        }
    }

    /**
     * Format a number with specified decimal places
     * @param {number} value - The value to format
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted number string
     */
    formatNumber(value, decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) {
            return '0';
        }

        return value.toFixed(decimals);
    }

    /**
     * Format a percentage
     * @param {number} value - The decimal value (e.g., 0.15 for 15%)
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted percentage string
     */
    formatPercentage(value, decimals = 1) {
        if (value === null || value === undefined || isNaN(value)) {
            return '0%';
        }

        return `${(value * 100).toFixed(decimals)}%`;
    }

    /**
     * Format a change value with +/- sign
     * @param {number} change - The change value
     * @param {boolean} showSign - Whether to show + for positive values
     * @returns {string} Formatted change string
     */
    formatChange(change, showSign = true) {
        if (change === null || change === undefined || isNaN(change)) {
            return '';
        }

        const sign = showSign && change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(1)}%`;
    }

    /**
     * Format a date for display
     * @param {Date|string} date - The date to format
     * @param {string} format - Format type ('short', 'long', 'iso')
     * @returns {string} Formatted date string
     */
    formatDate(date, format = 'short') {
        if (!date) {return '';}

        const dateObj = typeof date === 'string' ? new Date(date) : date;

        if (isNaN(dateObj.getTime())) {
            return '';
        }

        switch (format) {
            case 'long':
                return dateObj.toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                });
            case 'iso':
                return dateObj.toISOString().split('T')[0];
            case 'short':
            default:
                return dateObj.toLocaleDateString('en-IN');
        }
    }

    /**
     * Format a datetime for display
     * @param {Date|string} dateTime - The datetime to format
     * @returns {string} Formatted datetime string
     */
    formatDateTime(dateTime) {
        if (!dateTime) {return '';}

        const dateObj = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;

        if (isNaN(dateObj.getTime())) {
            return '';
        }

        return dateObj.toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    /**
     * Format file size in human readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size string
     */
    formatFileSize(bytes) {
        if (bytes === 0) {return '0 B';}

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    }

    /**
     * Format a quarter string (e.g., "Q1 2023")
     * @param {string} quarter - Quarter string
     * @returns {string} Formatted quarter string
     */
    formatQuarter(quarter) {
        if (!quarter || typeof quarter !== 'string') {
            return '';
        }

        // Ensure proper format (Q1 2023)
        if (!quarter.match(/^Q[1-4]\s\d{4}$/)) {
            return quarter;
        }

        return quarter;
    }

    /**
     * Get quarter name from quarter string
     * @param {string} quarter - Quarter string (e.g., "Q1 2023")
     * @returns {string} Quarter name (e.g., "Q1 2023")
     */
    getQuarterName(quarter) {
        return this.formatQuarter(quarter);
    }

    /**
     * Calculate and format percentage of total
     * @param {number} value - The value
     * @param {number} total - The total
     * @param {number} decimals - Decimal places
     * @returns {string} Formatted percentage string
     */
    formatPercentageOfTotal(value, total, decimals = 1) {
        if (!total || total === 0) {
            return '0%';
        }

        const percentage = (value / total) * 100;
        return this.formatPercentage(percentage / 100, decimals);
    }

    /**
     * Format trend indicator
     * @param {string} trend - Trend type ('increasing', 'decreasing', 'stable')
     * @param {number} change - Change percentage
     * @returns {string} Formatted trend string with emoji
     */
    formatTrend(trend, change = 0) {
        const trendEmojis = {
            increasing: '📈',
            decreasing: '📉',
            stable: '➡️',
        };

        const emoji = trendEmojis[trend] || '➡️';
        const changeText = change !== 0 ? ` ${this.formatChange(change)}` : '';

        return `${emoji}${changeText}`;
    }

    /**
     * Format a tooltip value with proper formatting
     * @param {string} label - The label
     * @param {number} value - The value
     * @param {boolean} isCurrency - Whether it's a currency value
     * @returns {string} Formatted tooltip string
     */
    formatTooltipValue(label, value, isCurrency = true) {
        const formattedValue = isCurrency ? this.formatCurrency(value) : this.formatNumber(value);
        return `${label}: ${formattedValue}`;
    }

    /**
     * Format axis labels for charts
     * @param {number} value - The value to format
     * @param {boolean} compact - Whether to use compact notation
     * @returns {string} Formatted axis label
     */
    formatAxisLabel(value, compact = false) {
        if (value >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}K`;
        } else {
            return compact ? this.formatCurrency(value, true) : this.formatCurrency(value);
        }
    }

    /**
     * Initialize the formatter (no-op for utility class)
     * @returns {Promise<void>}
     */
    async initialize() {
        // No initialization needed for formatter
        console.log('🔧 [FORMATTER] Formatter initialized');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Formatter;
} else {
    window.Formatter = Formatter;
}
