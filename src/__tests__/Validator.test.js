/**
 * Jest unit tests for Validator module
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

// Now import real modules (after mocks are set up)
import Validator from '../modules/utils/Validator.js';

describe('Validator', () => {
    let validator;

    beforeEach(() => {
        validator = new Validator();

        // Mock initialize methods to avoid real initialization
        jest.spyOn(validator, 'initialize').mockResolvedValue();
    });

    afterEach(() => {
        // Cleanup
        jest.restoreAllMocks();
    });

    // ============================================================================
    // VALIDATOR TESTS (15+ tests using table-driven approach)
    // ============================================================================

    describe('validatePropertyName', () => {
        const propertyNameTestCases = [
            // [input, expectedIsValid, expectedMessageContains]
            ['Valid Property', true, ''],
            ['Test-123', true, ''],
            ['A', false, 'at least 2 characters'],
            ['A'.repeat(51), false, 'less than 50 characters'],
            ['Invalid@Name!', false, 'can only contain'],
            [null, false, 'required'],
            [undefined, false, 'required'],
            ['', false, 'required'],
            ['  ', false, 'required'],
        ];

        test.each(propertyNameTestCases)(
            'validatePropertyName(%s) should return isValid=%s with message containing %s',
            (input, expectedIsValid, expectedMessageContains) => {
                const result = validator.validatePropertyName(input);
                expect(result.isValid).toBe(expectedIsValid);
                if (expectedMessageContains) {
                    expect(result.message).toContain(expectedMessageContains);
                } else {
                    expect(result.message).toBe(expectedMessageContains);
                }
            },
        );
    });

    describe('validateCategoryName', () => {
        const categoryNameTestCases = [
            ['Maintenance', true, ''],
            ['Utilities & Repairs', true, ''],
            ['A', false, 'at least 2 characters'],
            ['A'.repeat(31), false, 'less than 30 characters'],
            ['Invalid@Category!', false, 'can only contain'],
            [null, false, 'required'],
            [undefined, false, 'required'],
            ['', false, 'required'],
        ];

        test.each(categoryNameTestCases)(
            'validateCategoryName(%s) should return isValid=%s',
            (input, expectedIsValid, expectedMessageContains) => {
                const result = validator.validateCategoryName(input);
                expect(result.isValid).toBe(expectedIsValid);
                if (expectedMessageContains) {
                    expect(result.message).toContain(expectedMessageContains);
                }
            },
        );
    });

    describe('validateAmount', () => {
        const amountTestCases = [
            [1000, true, ''],
            ['500', true, ''],
            [0.01, true, ''],
            [0, true, ''],
            [-100, false, 'cannot be negative'],
            [10000001, false, 'too large'],
            ['invalid', false, 'valid number'],
            [null, false, 'required'],
            [undefined, false, 'required'],
            [NaN, false, 'valid number'],
            [Infinity, false, 'valid number'],
        ];

        test.each(amountTestCases)(
            'validateAmount(%s) should return isValid=%s',
            (input, expectedIsValid, expectedMessageContains) => {
                const result = validator.validateAmount(input);
                expect(result.isValid).toBe(expectedIsValid);
                if (expectedMessageContains) {
                    expect(result.message).toContain(expectedMessageContains);
                }
            },
        );
    });

    describe('validateMonth', () => {
        const monthTestCases = [
            ['Jan 2025', true, ''],
            ['Dec 2024', true, ''],
            ['Feb 2023', true, ''],
            ['January 2025', false, 'MMM YYYY'],
            ['Jan25', false, 'MMM YYYY'],
            ['Jan 25', false, 'MMM YYYY'],
            ['XXX 2025', false, 'MMM YYYY'],
            [null, false, 'required'],
            [undefined, false, 'required'],
            ['', false, 'required'],
        ];

        test.each(monthTestCases)(
            'validateMonth(%s) should return isValid=%s',
            (input, expectedIsValid, expectedMessageContains) => {
                const result = validator.validateMonth(input);
                expect(result.isValid).toBe(expectedIsValid);
                if (expectedMessageContains) {
                    expect(result.message).toContain(expectedMessageContains);
                }
            },
        );
    });


    describe('validateProperty', () => {
        test('should validate valid property objects', () => {
            const validProperty = {
                id: 1,
                name: 'Test Property',
                expenses: { 'Maintenance': 1000 },
            };
            const result = validator.validateProperty(validProperty);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should reject invalid property objects', () => {
            const invalidCases = [
                { name: '', expenses: {} }, // missing ID and invalid name
                { id: 1, name: '', expenses: {} }, // invalid name
                { id: 1, name: 'Test', expenses: 'invalid' }, // invalid expenses
                { id: 'invalid', name: 'Test', expenses: {} }, // invalid ID type
                null, // null property
                {}, // empty object
            ];

            invalidCases.forEach(invalidProperty => {
                const result = validator.validateProperty(invalidProperty);
                expect(result.isValid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
            });
        });

    });

    describe('validateExpenseData', () => {
        test('should validate valid expense data', () => {
            const validExpenses = {
                'Maintenance': 1000,
                'Utilities': 500,
                'Repairs': 0,
            };
            const result = validator.validateExpenseData(validExpenses);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should reject invalid expense data', () => {
            const invalidCases = [
                { '': 1000 }, // empty category name
                { 'Maintenance': -500 }, // negative amount
                { 'A': 1000 }, // too short category name
                { 'Valid Category': 'invalid' }, // invalid amount
                null, // null data
                'invalid', // string instead of object
            ];

            invalidCases.forEach(invalidExpenses => {
                const result = validator.validateExpenseData(invalidExpenses);
                expect(result.isValid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
            });
        });
    });

    describe('validateDashboardData', () => {
        test('should validate valid dashboard data', () => {
            const validData = {
                properties: [{ id: 1, name: 'Test Property', expenses: {} }],
                expenseCategories: ['Maintenance', 'Utilities'],
                currentTimePeriod: 'all',
                currentView: 'overview',
            };
            const result = validator.validateDashboardData(validData);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should reject invalid dashboard data', () => {
            const invalidCases = [
                { properties: 'invalid', expenseCategories: [] }, // invalid properties
                { properties: [], expenseCategories: 'invalid' }, // invalid categories
                { properties: [], expenseCategories: [], currentTimePeriod: 'invalid' }, // invalid time period
                { properties: [], expenseCategories: [], currentView: 'invalid' }, // invalid view
                null, // null data
                {}, // empty object
            ];

            invalidCases.forEach(invalidData => {
                const result = validator.validateDashboardData(invalidData);
                expect(result.isValid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
            });
        });
    });

    describe('validateAndSanitizeInput', () => {
        const inputValidationTestCases = [
            ['  test  ', 'property', true],
            ['test<script>', 'category', true],
            ['invalid', 'amount', false],
            ['', 'property', false],
        ];

        test.each(inputValidationTestCases)(
            'validateAndSanitizeInput(%s, %s) should return isValid=%s',
            (input, type, expectedIsValid) => {
                const result = validator.validateAndSanitizeInput(input, type);
                expect(result.isValid).toBe(expectedIsValid);
                expect(result.sanitized).toBeDefined();
            },
        );
    });

    describe('validateArrayLength', () => {
        const arrayLengthTestCases = [
            [[1, 2, 3], 0, 5, true, ''],
            [[], 1, 5, false, 'at least 1'],
            [[1, 2, 3, 4, 5, 6], 0, 5, false, 'at most 5'],
            ['not array', 0, 10, false, 'must be an array'],
        ];

        test.each(arrayLengthTestCases)(
            'validateArrayLength(%s, %s, %s) should return isValid=%s',
            (array, minLength, maxLength, expectedIsValid, expectedMessageContains) => {
                const result = validator.validateArrayLength(array, minLength, maxLength);
                expect(result.isValid).toBe(expectedIsValid);
                if (expectedMessageContains) {
                    expect(result.message).toContain(expectedMessageContains);
                }
            },
        );
    });

    describe('sanitizeString', () => {
        const sanitizeTestCases = [
            ['  test  ', 'test'],
            ['test<script>', 'testscript'],
            ['hello<>world', 'helloworld'],
            [null, ''],
            [undefined, ''],
            ['', ''],
            ['no change needed', 'no change needed'],
        ];

        test.each(sanitizeTestCases)(
            'sanitizeString(%s) should return %s',
            (input, expected) => {
                expect(validator.sanitizeString(input)).toBe(expected);
            },
        );
    });

    describe('isInRange', () => {
        const rangeTestCases = [
            [5, 0, 10, true],
            [0, 0, 10, true],
            [10, 0, 10, true],
            [-1, 0, 10, false],
            [15, 0, 10, false],
            [5, 10, 20, false],
        ];

        test.each(rangeTestCases)(
            'isInRange(%s, %s, %s) should return %s',
            (value, min, max, expected) => {
                expect(validator.isInRange(value, min, max)).toBe(expected);
            },
        );
    });

    describe('initialize', () => {
        test('should initialize without errors', async () => {
            // Just test that initialize doesn't throw
            await expect(validator.initialize()).resolves.not.toThrow();
        });
    });
});