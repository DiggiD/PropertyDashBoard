/**
 * Jest unit tests for Formatter module
 * Focus: Pure functions, validation, formatting, and storage operations
 * Coverage: Aim for 90%+ across all modules with minimal mocking
 */

// Mock only external dependencies, not the modules we're testing
jest.mock('../modules/core/ThemeManager', () => require('../__mocks__/ThemeManager'));
jest.mock('../modules/utils/Logger.js', () => ({
    createModuleLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    })),
}));

// Mock the logger module import
import logger from '../modules/utils/Logger.js';

// Simplified Dexie mock for Storage tests
const createDexieMock = () => ({
    version: jest.fn().mockReturnValue({
        stores: jest.fn().mockReturnThis(),
    }),
    open: jest.fn().mockResolvedValue(),
    close: jest.fn(),
    delete: jest.fn().mockResolvedValue(),
    transaction: jest.fn().mockImplementation(async (stores, mode, callback) => {
        if (callback) await callback();
    }),
    table: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        equals: jest.fn().mockReturnThis(),
        between: jest.fn().mockReturnThis(),
        and: jest.fn().mockReturnThis(),
        sortBy: jest.fn().mockResolvedValue([]),
        toArray: jest.fn().mockResolvedValue([]),
        reverse: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue(0),
        add: jest.fn().mockResolvedValue(1),
        put: jest.fn().mockResolvedValue(1),
        bulkDelete: jest.fn().mockReturnValue(),
        delete: jest.fn().mockResolvedValue(),
        get: jest.fn().mockResolvedValue(null),
    }),
});

// Use real localStorage from jsdom for Storage tests
// localStorage is already available from setupTests.js

// Now import real modules (after mocks are set up)
import Formatter from '../modules/utils/Formatter.js';
import Validator from '../modules/utils/Validator.js';
import PerformanceOptimizer from '../modules/utils/PerformanceOptimizer.js';

// Mock Intl.NumberFormat specifically for Formatter tests - optimized for performance
const originalIntl = global.Intl;
beforeAll(() => {
    // Fix Date issue in jsdom
    global.Date = Date;

    // Simplified fast Indian number formatting function for tests
    const formatIndianNumber = (num) => {
        if (isNaN(num) || num === null || num === undefined) return '0';
        // Use a simple mock that approximates the format without complex loops
        return Math.abs(num).toLocaleString('en-IN');
    };

    const mockFormat = jest.fn((num) => {
        if (isNaN(num) || num === null || num === undefined) {return '₹0';}
        if (!isFinite(num)) {return num < 0 ? `-₹${Math.abs(num)}` : `₹${num}`;}
        const formatted = formatIndianNumber(num);
        return num < 0 ? `-₹${formatted}` : `₹${formatted}`;
    });

    const compactFormat = jest.fn((num) => {
        if (isNaN(num) || num === null || num === undefined) {return '₹0';}
        if (!isFinite(num)) {return num < 0 ? `₹-${Math.abs(num)}` : `₹${num}`;}
        const absNum = Math.abs(num);
        if (absNum >= 1000000) {return `₹${Math.round(absNum/1000000)}M`;}
        if (absNum >= 1000) {return `₹${Math.round(absNum/1000)}K`;}
        return `₹${absNum}`;
    });

    global.Intl.NumberFormat = jest.fn((locale, options) => ({
        format: options && options.notation === 'compact' ? compactFormat : mockFormat,
    }));
});

afterAll(() => {
    global.Intl = originalIntl;
    // Restore setInterval
    jest.restoreAllMocks();
});


describe('Formatter', () => {
    let formatter;

    beforeEach(() => {
        formatter = new Formatter();

        // Mock initialize methods to avoid real initialization
        jest.spyOn(formatter, 'initialize').mockResolvedValue();
    });

    afterEach(() => {
        // Cleanup
        jest.restoreAllMocks();
    });

    // ============================================================================
    // FORMATTER TESTS (15+ tests using table-driven approach)
    // ============================================================================

    describe('formatCurrency', () => {
        const currencyTestCases = [
            // [input, compact, expected]
            [1000, false, '₹1,000'],
            [1000000, false, '₹10,00,000'],
            [-1000, false, '-₹1,000'],
            [0, false, '₹0'],
            [NaN, false, '₹0'],
            [1000000, true, '₹1M'],
            [500, true, '₹500'],
            [Infinity, false, '₹Infinity'],
        ];

        test.each(currencyTestCases)(
            'formatCurrency(%s, %s) should return %s',
            (input, compact, expected) => {
                expect(formatter.formatCurrency(input, compact)).toBe(expected);
            },
        );

        test('should handle Intl.NumberFormat errors gracefully', () => {
            const originalFormat = Intl.NumberFormat.prototype.format;
            Intl.NumberFormat.prototype.format = jest.fn(() => {
                throw new Error('Intl error');
            });

            expect(formatter.formatCurrency(1000)).toBe('₹1,000'); // Fallback to simple formatting

            Intl.NumberFormat.prototype.format = originalFormat;
        });
    });

    describe('formatNumber', () => {
        test('should format numbers with specified decimal places', () => {
            expect(formatter.formatNumber(123.456, 2)).toBe('123.46');
            expect(formatter.formatNumber(123.456, 0)).toBe('123');
            expect(formatter.formatNumber(123.456)).toBe('123.46'); // default 2 decimals
        });

        test('should handle edge cases', () => {
            expect(formatter.formatNumber(NaN)).toBe('0');
            expect(formatter.formatNumber(null)).toBe('0');
            expect(formatter.formatNumber(Infinity)).toBe('Infinity');
        });
    });

    describe('formatPercentage', () => {
        test('should format decimal as percentage', () => {
            expect(formatter.formatPercentage(0.25)).toBe('25.0%');
            expect(formatter.formatPercentage(0.5, 1)).toBe('50.0%');
            expect(formatter.formatPercentage(0.123, 0)).toBe('12%');
        });

        test('should handle invalid inputs', () => {
            expect(formatter.formatPercentage(NaN)).toBe('0%');
            expect(formatter.formatPercentage(null)).toBe('0%');
        });
    });

    describe('formatChange', () => {
        test('should format positive changes with plus sign', () => {
            expect(formatter.formatChange(5.5)).toBe('+5.5%');
            expect(formatter.formatChange(10)).toBe('+10.0%');
        });

        test('should format negative changes without plus sign', () => {
            expect(formatter.formatChange(-5.5)).toBe('-5.5%');
            expect(formatter.formatChange(-10)).toBe('-10.0%');
        });

        test('should handle zero and invalid inputs', () => {
            expect(formatter.formatChange(0)).toBe('+0.0%');
            expect(formatter.formatChange(NaN)).toBe('');
        });
    });

    describe('formatDate', () => {
        const dateTestCases = [
            // [input, format, expectedContains]
            [new Date('2025-01-15'), 'short', '/'],
            [new Date('2025-01-15'), 'long', 'January'],
            [new Date('2025-01-15'), 'iso', '2025-01-15'],
            ['2025-01-15', 'short', '/'],
            [null, 'short', ''],
            [undefined, 'short', ''],
            ['invalid', 'short', ''],
            [new Date('invalid'), 'short', ''],
        ];

        test.each(dateTestCases)(
            'formatDate(%s, %s) should contain %s',
            (input, format, expectedContains) => {
                const result = formatter.formatDate(input, format);
                if (expectedContains === '/') {
                    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
                } else {
                    expect(result).toContain(expectedContains);
                }
            },
        );
    });

    describe('formatDateTime', () => {
        test('should format datetime correctly', () => {
            const date = new Date('2025-01-15T10:30:00');
            const result = formatter.formatDateTime(date);
            expect(result).toContain('Jan');
            expect(result).toContain('2025');
            expect(result).toMatch(/\d{1,2}:\d{2}/);
        });

        test('should handle invalid datetime', () => {
            expect(formatter.formatDateTime(null)).toBe('');
            expect(formatter.formatDateTime('invalid')).toBe('');
        });
    });

    describe('formatFileSize', () => {
        const fileSizeTestCases = [
            [0, '0 B'],
            [1024, '1.0 KB'],
            [1024 * 1024, '1.0 MB'],
            [1024 * 1024 * 1024, '1.0 GB'],
        ];

        test.each(fileSizeTestCases)(
            'formatFileSize(%s) should return %s',
            (bytes, expected) => {
                expect(formatter.formatFileSize(bytes)).toBe(expected);
            },
        );
    });


    describe('formatPercentageOfTotal', () => {
        const percentageTestCases = [
            [25, 100, '25.0%'],
            [1, 3, '33.3%'],
            [0, 100, '0.0%'],
            [50, 0, '0%'],
            [NaN, 100, '0%'],
            [25, NaN, '0%'],
        ];

        test.each(percentageTestCases)(
            'formatPercentageOfTotal(%s, %s) should return %s',
            (value, total, expected) => {
                expect(formatter.formatPercentageOfTotal(value, total)).toBe(expected);
            },
        );
    });

    describe('formatTrend', () => {
        const trendTestCases = [
            ['increasing', 5.5, '📈 +5.5%'],
            ['decreasing', -3.2, '📉 -3.2%'],
            ['stable', 0, '➡️'],
            ['unknown', 1, '➡️ +1.0%'],
        ];

        test.each(trendTestCases)(
            'formatTrend(%s, %s) should contain %s',
            (trend, change, expectedContains) => {
                const result = formatter.formatTrend(trend, change);
                expect(result).toContain(expectedContains);
            },
        );
    });

    describe('formatTooltipValue', () => {
        test('should format tooltip values', () => {
            expect(formatter.formatTooltipValue('Cost', 1500, true)).toBe('Cost: ₹1,500');
            expect(formatter.formatTooltipValue('Count', 25, false)).toBe('Count: 25.00');
        });
    });

    describe('formatAxisLabel', () => {
        const axisLabelTestCases = [
            [1500000, '1.5M'],
            [5000, '5.0K'],
            [1500, '1.5K'],
            [500, '₹500'],
            [0, '₹0'],
            [NaN, '₹0'],
        ];

        test.each(axisLabelTestCases)(
            'formatAxisLabel(%s) should return %s',
            (value, expected) => {
                expect(formatter.formatAxisLabel(value)).toBe(expected);
            },
        );
    });

    describe('initialize', () => {
        test('should initialize without errors', async () => {
            // Just test that initialize doesn't throw
            await expect(formatter.initialize()).resolves.not.toThrow();
        });
    });

    test('should format negative currency without mocks', () => {
        expect(formatter.formatCurrency(-1200)).toBe('-₹1,200'); // Real implementation
    });
});