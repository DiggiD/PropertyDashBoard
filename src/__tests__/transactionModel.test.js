import {
    parseNonZeroAmount,
    parseTransaction,
} from '../modules/core/transactionModel.js';

const id = () => 'txn_test';

function baseTxn(amount) {
    return {
        propertyId: 1,
        category: 'Rent',
        amount,
        date: '2025-01-15',
        type: 'expense',
    };
}

describe('parseNonZeroAmount', () => {
    test('rejects NaN', () => {
        expect(parseNonZeroAmount(NaN)).toBeNull();
    });

    test('rejects Infinity and -Infinity', () => {
        expect(parseNonZeroAmount(Infinity)).toBeNull();
        expect(parseNonZeroAmount(-Infinity)).toBeNull();
    });

    test('rejects 0 and -0', () => {
        expect(parseNonZeroAmount(0)).toBeNull();
        expect(parseNonZeroAmount(-0)).toBeNull();
    });

    test('rejects non-numbers', () => {
        expect(parseNonZeroAmount('1200')).toBeNull();
        expect(parseNonZeroAmount(null)).toBeNull();
        expect(parseNonZeroAmount(undefined)).toBeNull();
    });

    test('accepts finite non-zero amounts', () => {
        expect(parseNonZeroAmount(-1200)).toBe(-1200);
        expect(parseNonZeroAmount(5000)).toBe(5000);
    });
});

describe('parseTransaction amount boundary', () => {
    test('returns null for NaN amount', () => {
        expect(parseTransaction(baseTxn(NaN), id)).toBeNull();
    });

    test('returns null for non-finite amounts', () => {
        expect(parseTransaction(baseTxn(Infinity), id)).toBeNull();
        expect(parseTransaction(baseTxn(-Infinity), id)).toBeNull();
    });

    test('returns null for zero amount', () => {
        expect(parseTransaction(baseTxn(0), id)).toBeNull();
    });

    test('parses a finite expense amount', () => {
        const parsed = parseTransaction(baseTxn(-1500), id);
        expect(parsed).not.toBeNull();
        expect(parsed.amount).toBe(-1500);
        expect(parsed.type).toBe('expense');
    });
});
