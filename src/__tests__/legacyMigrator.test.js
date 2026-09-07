import { migrateToFlat, normalizeProperties } from '../modules/utils/legacyMigrator.js';

describe('legacyMigrator', () => {
    test('normalizes Object.entries properties and categories alias', () => {
        const flat = migrateToFlat({
            categories: ['Rent'],
            properties: [[1, { id: 1, name: 'Office', expenses: { Rent: 100 } }]],
        });
        expect(flat.expenseCategories).toEqual(['Rent']);
        expect(flat.properties).toEqual([
            expect.objectContaining({ id: 1, name: 'Office' }),
        ]);
        expect(flat.transactions).toHaveLength(1);
        expect(flat.transactions[0]).toMatchObject({
            propertyId: 1,
            category: 'Rent',
            type: 'expense',
            amount: -100,
        });
    });

    test('keeps existing transactions and object properties', () => {
        const input = {
            transactions: [{ propertyId: 1, category: 'Rent', amount: -10, date: '2024-01-01', type: 'expense' }],
            properties: [{ id: 1, name: 'Office' }],
            expenseCategories: ['Rent'],
        };
        const flat = migrateToFlat(input);
        expect(flat.transactions).toHaveLength(1);
        expect(normalizeProperties(flat.properties)[0].name).toBe('Office');
    });
});
