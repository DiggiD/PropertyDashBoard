// I/O mocks only
jest.mock('node-fetch', () => jest.fn().mockResolvedValue({ json: jest.fn().mockResolvedValue({}) }));
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Ensure Date is available globally
global.Date = Date;

// Jest already provides jsdom environment, so we don't need to create JSDOM
// Just ensure window and document are available
if (typeof window !== 'undefined') {
    window.Date = Date;
}
if (typeof document !== 'undefined') {
    // document is already provided by jest jsdom
}

// Ensure Date is available globally
global.Date = Date;
global.CustomEvent = class {
    constructor(type) { this.type = type; }
    stopPropagation() {}
    preventDefault() {}
};

// Mock IndexedDB minimally
global.indexedDB = {
    open: jest.fn(() => ({
        onupgradeneeded: jest.fn(),
        onsuccess: jest.fn(),
        onerror: jest.fn(),
    })),
};

// Set locale
global.navigator = { language: 'en-US' };

// Ensure Date is available for jsdom
global.Date = Date;

// Mock localStorage minimally
global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};

// Scaffold DB setup
global.Dexie = require('dexie');

jest.useRealTimers();

// ...existing code...

// Mock Intl.NumberFormat for US
const originalNumberFormat = Intl.NumberFormat;
Intl.NumberFormat = jest.fn((locale, options) => {
    const mockFormat = (num) => {
        // Handle special cases first
        if (isNaN(num) || num === null || num === undefined) {return '$0';}
        if (!isFinite(num)) {return num < 0 ? `$-${Math.abs(num)}` : `$${num}`;}

        if (options && options.notation === 'compact') {
            if (num >= 1000000) {return `$${Math.round(num/1000000)}M`;}
            if (num >= 1000) {return `$${Math.round(num/1000)}K`;}
            return `$${num}`;
        }

        // Standard formatting - always use en-US locale for consistency
        const absNum = Math.abs(num);
        const formatted = absNum.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });

        return num < 0 ? `-$${formatted}` : `$${formatted}`;
    };

    return { format: mockFormat };
});
jest.useRealTimers(); // Default to real for authentic execution

// Shim events
global.Event = class Event {
    constructor(type, options = {}) {
        this.type = type;
        this.bubbles = options.bubbles || false;
        this.cancelable = options.cancelable || false;
    }
    stopPropagation() {}
    preventDefault() {}
};
global.CustomEvent = class CustomEvent extends global.Event {
    constructor(type, options = {}) {
        super(type, options);
        this.detail = options.detail;
    }
};

// Setup global window mocks for tests
beforeAll(() => {
    if (typeof window !== 'undefined') {
        window.DataManager = jest.fn();
        window.dataManager = {
            initialize: jest.fn().mockResolvedValue(),
            getAggregatedSankeyData: jest.fn(),
        };
        window.chartRenderer = {
            renderOverviewSankey: jest.fn(),
        };
        window.uiManager = {
            hideLoadingState: jest.fn(),
        };
        window.eventHandler = {
            setupEventHandlers: jest.fn(),
        };
        window.themeManager = jest.fn();
    }
});

import '@testing-library/jest-dom';

// Global sample data for tests
const sampleTxns = [{propertyId:1, amount:-1000, category:'Rent', date:'2025-09-01'}];

// Light mocks
jest.spyOn(console, 'error').mockImplementation(() => {});

// Window snapshot for isolation (only for index.js tests)
let windowSnapshot;
let shouldSnapshot = false;

beforeAll(() => {
    // Only snapshot for index.js related tests
    shouldSnapshot = expect.getState().testPath?.includes('index.test.js') ?? false;
    if (shouldSnapshot) {
        windowSnapshot = {
            DataManager: window.DataManager,
            dataManager: window.dataManager,
            chartRenderer: window.chartRenderer,
            uiManager: window.uiManager,
            themeManager: window.themeManager,
        };
    }
});

afterEach(() => {
    // Only restore for index.js related tests
    if (shouldSnapshot) {
        if (windowSnapshot && typeof window !== 'undefined') {
            Object.keys(windowSnapshot).forEach(key => {
                if (windowSnapshot[key] === undefined) {
                    delete window[key];
                } else {
                    window[key] = windowSnapshot[key];
                }
            });
        }

        // Clear any additional window properties that might have been added
        if (typeof window !== 'undefined') {
            ['DataManager', 'dataManager', 'chartRenderer', 'uiManager', 'themeManager'].forEach(prop => {
                if (!windowSnapshot || !(prop in windowSnapshot)) {
                    delete window[prop];
                }
            });
        }
    }

    // Reset DOM completely
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = '';
    }

    // Clear all mocks
    jest.clearAllMocks();
});
