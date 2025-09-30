// filepath: src/__mocks__/Formatter.js

export default class MockFormatter {
    constructor() {
        // Mock formatting options
    }

    async initialize() {
        console.log('[FORMATTER] Formatter initialized');
    }

    formatCurrency(amount) {
        return `₹${amount}`;
    }

    formatNumber(value) {
        return value.toString();
    }

    formatPercentage(value) {
        return `${value}%`;
    }
}