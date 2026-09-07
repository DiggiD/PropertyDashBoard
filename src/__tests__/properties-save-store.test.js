import DataManager from '../modules/core/DataManager.js';
import PropertiesManager from '../modules/PropertiesManager.js';
import Formatter from '../modules/utils/Formatter.js';
import Validator from '../modules/utils/Validator.js';

describe('Properties save writes TransactionStore', () => {
    let dataManager;
    let propertiesManager;
    let storage;

    beforeEach(async () => {
        storage = {
            load: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockResolvedValue(true),
            initialize: jest.fn().mockResolvedValue(),
        };
        dataManager = new DataManager(storage, new Validator(), new Formatter());
        await dataManager.initialize({
            transactions: [],
            properties: [{ id: 1, name: 'Office', created: '2024-01-01T00:00:00.000Z' }],
            expenseCategories: ['Rent', 'Utilities'],
            incomeCategories: ['Salary'],
        });

        const uiManager = {
            showToast: jest.fn(),
            getElement: jest.fn(() => document.createElement('div')),
            updateDataDisplay: jest.fn(),
            formatter: new Formatter(),
        };
        const historyManager = { createSnapshot: jest.fn() };
        propertiesManager = new PropertiesManager(dataManager, uiManager, historyManager);
        propertiesManager.currentPropertyId = 1;
        document.body.innerHTML = '<div id="propertiesDashboard"></div>';
    });

    test('saveExpenseValue adds a store transaction and Sankey expenses', async () => {
        await propertiesManager.saveExpenseValue('Rent', null, 1500);

        const txns = dataManager.store.transactions.filter(t => t.propertyId === 1 && t.category === 'Rent');
        expect(txns).toHaveLength(1);
        expect(txns[0].amount).toBe(-1500);
        expect(txns[0].type).toBe('expense');

        const aggregated = dataManager.getAggregatedSankeyData('all', 'all');
        expect(aggregated.propExpenses.get(1)).toBe(1500);
        expect(storage.save).toHaveBeenCalled();
        const payload = storage.save.mock.calls[storage.save.mock.calls.length - 1][0];
        expect(payload.transactions.some(t => t.category === 'Rent' && t.amount === -1500)).toBe(true);
    });

    test('saveExpenseValue with subcategory writes subcategory on the transaction', async () => {
        await propertiesManager.saveExpenseValue('Utilities', 'Electricity', 400);

        const txns = dataManager.store.transactions.filter(
            t => t.propertyId === 1 && t.category === 'Utilities' && t.subcategory === 'Electricity',
        );
        expect(txns).toHaveLength(1);
        expect(txns[0].amount).toBe(-400);
    });

    test('saveExpenseValue income category writes a positive income transaction', async () => {
        await propertiesManager.saveExpenseValue('Salary', null, 2000);

        const txns = dataManager.store.transactions.filter(t => t.propertyId === 1 && t.category === 'Salary');
        expect(txns).toHaveLength(1);
        expect(txns[0].amount).toBe(2000);
        expect(txns[0].type).toBe('income');

        const aggregated = dataManager.getAggregatedSankeyData('all', 'all');
        expect(aggregated.propIncomes.get(1)).toBe(2000);
        expect(aggregated.hasIncome).toBe(true);
    });

    test('updateCategoryName renames the transaction category and persists', async () => {
        await propertiesManager.saveExpenseValue('Rent', null, 1500);
        propertiesManager.updateCategoryName('Rent', 'Lease');

        const txns = dataManager.store.transactions.filter(t => t.propertyId === 1);
        expect(txns).toHaveLength(1);
        expect(txns[0].category).toBe('Lease');
        await dataManager.save();
        const payload = storage.save.mock.calls[storage.save.mock.calls.length - 1][0];
        expect(payload.transactions.some(t => t.category === 'Lease')).toBe(true);
    });

    test('deleteCategory removes matching transactions and persists', async () => {
        await propertiesManager.saveExpenseValue('Rent', null, 1500);
        propertiesManager.deleteCategory('Rent');

        const txns = dataManager.store.transactions.filter(t => t.propertyId === 1 && t.category === 'Rent');
        expect(txns).toHaveLength(0);
        await dataManager.save();
        const payload = storage.save.mock.calls[storage.save.mock.calls.length - 1][0];
        expect(payload.transactions.some(t => t.category === 'Rent')).toBe(false);
    });
});
