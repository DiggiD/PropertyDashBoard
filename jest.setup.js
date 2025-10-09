import { jest } from '@jest/globals';

// Fix Date issue in jsdom
global.Date = Date;

// Ensure Date is available in jsdom window
if (typeof window !== 'undefined') {
    window.Date = Date;
}

// Mock Event to avoid Date.now() issues
global.Event = class Event {
    constructor(type, options = {}) {
        this.type = type;
        this.timeStamp = Date.now();
        this.bubbles = options.bubbles || false;
        this.cancelable = options.cancelable || false;
    }
};

// Mock CustomEvent
global.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
        super(type, options);
        this.detail = options.detail;
    }
};

// Mock PerformanceObserver for browser performance monitoring
global.PerformanceObserver = class PerformanceObserver {
    constructor(callback) {
        this.callback = callback;
    }

    observe(options) {
        // Mock implementation - do nothing in tests
    }

    disconnect() {
        // Mock implementation - do nothing in tests
    }
};

// Also add to window object for modules that check 'PerformanceObserver' in window
if (typeof window !== 'undefined') {
    window.PerformanceObserver = global.PerformanceObserver;
}


// Make Jest globals available
global.jest = jest;
global.describe = jest.describe;
global.it = jest.it;
global.test = jest.test;
global.expect = jest.expect;
global.beforeEach = jest.beforeEach;
global.afterEach = jest.afterEach;
global.beforeAll = jest.beforeAll;
global.afterAll = jest.afterAll;
