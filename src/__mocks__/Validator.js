// filepath: src/__mocks__/Validator.js

export default class MockValidator {
    constructor() {
        // Mock validation rules
    }

    async initialize() {
        console.log('[VALIDATOR] Validator initialized');
    }

    validatePropertyName(name) {
        return { isValid: true, message: '' };
    }

    validateCategoryName(name) {
        return { isValid: true, message: '' };
    }

    validateAmount(amount) {
        return { isValid: true, message: '' };
    }

    validateDashboardData(data) {
        return { isValid: true, message: '', errors: [] };
    }
}