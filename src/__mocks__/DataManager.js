// filepath: src/__mocks__/DataManager.js

let shouldThrow = false;

export function setDataManagerShouldThrow(value) {
    shouldThrow = value;
}

export default class MockDataManager {
    constructor(storage, validator, formatter) {
        this.storage = storage;
        this.validator = validator;
        this.formatter = formatter;
        this.properties = [];
        console.log('[DATAMANAGER] DataManager initialized');
    }

    async initialize() {
        if (shouldThrow) {
            throw new Error('DataManager initialization failed');
        }
        console.log('[DATAMANAGER] DataManager initialized');
    }

    getProperties() {
        return this.properties;
    }

    setProperties(properties) {
        this.properties = properties;
    }

    addProperty(name) {
        return { success: true, message: 'Property added', property: { id: 1, name } };
    }

    getCurrentTimePeriod() {
        return 'all';
    }

    getSelectedYear() {
        return 'all';
    }

    getAggregatedSankeyData(period, year) {
        return {
            propExpenses: new Map(),
            sources: {},
            propIncomes: new Map(),
            hasIncome: false,
            catTotals: new Map(),
            subTotals: new Map()
        };
    }

    hasData(property, period, year) {
        return false;
    }
}