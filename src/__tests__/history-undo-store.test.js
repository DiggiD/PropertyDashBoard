import DataManager from '../modules/core/DataManager.js';
import HistoryManager from '../modules/core/HistoryManager.js';
import PropertiesManager from '../modules/PropertiesManager.js';
import Formatter from '../modules/utils/Formatter.js';
import Validator from '../modules/utils/Validator.js';

describe('Undo restores TransactionStore after Properties save', () => {
    let dataManager;
    let historyManager;
    let propertiesManager;

    beforeEach(async () => {
        const storage = {
            load: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockResolvedValue(true),
            initialize: jest.fn().mockResolvedValue(),
            loadHistoryFromStorage: jest.fn().mockResolvedValue([]),
            saveHistorySnapshot: jest.fn().mockResolvedValue(true),
            updateHistorySnapshot: jest.fn().mockResolvedValue(true),
        };
        dataManager = new DataManager(storage, new Validator(), new Formatter());
        await dataManager.initialize({
            transactions: [],
            properties: [{ id: 1, name: 'Office', created: '2024-01-01T00:00:00.000Z' }],
            expenseCategories: ['Rent', 'Utilities'],
            incomeCategories: ['Salary'],
        });

        historyManager = new HistoryManager(storage, dataManager);
        await historyManager.initialize();

        const uiManager = {
            showToast: jest.fn(),
            getElement: jest.fn(() => document.createElement('div')),
            updateDataDisplay: jest.fn(),
            formatter: new Formatter(),
        };
        propertiesManager = new PropertiesManager(dataManager, uiManager, historyManager);
        propertiesManager.currentPropertyId = 1;
        document.body.innerHTML = '<div id="propertiesDashboard"></div><div id="overviewChartContent"></div>';
    });

    test('undo after saveExpenseValue reverts store query and Sankey totals', async () => {
        expect(dataManager.getAggregatedSankeyData('all', 'all').propExpenses.get(1) || 0).toBe(0);

        await propertiesManager.saveExpenseValue('Rent', null, 1500);

        expect(dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'expense',
        })).toHaveLength(1);
        expect(dataManager.getAggregatedSankeyData('all', 'all').propExpenses.get(1)).toBe(1500);
        expect(historyManager.canUndo()).toBe(true);

        const saved = historyManager.history[historyManager.historyIndex];
        expect(Array.isArray(saved.data.transactions)).toBe(true);
        expect(saved.data.transactions.some(t => t.category === 'Rent' && t.amount === -1500)).toBe(true);
        expect(saved.data.properties[0]).toEqual(expect.objectContaining({
            id: 1,
            name: 'Office',
        }));
        expect(saved.data.properties[0].expenses).toBeUndefined();

        const result = await historyManager.undo();
        expect(result.success).toBe(true);

        const afterUndo = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'expense',
        });
        const afterAgg = dataManager.getAggregatedSankeyData('all', 'all');
        expect(afterUndo).toHaveLength(0);
        expect(afterAgg.propExpenses.get(1) || 0).toBe(0);
        expect(afterAgg.catTotals.get('Rent') || 0).toBe(0);
        expect(historyManager.canRedo()).toBe(true);

        const redo = await historyManager.redo();
        expect(redo.success).toBe(true);
        expect(dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'expense',
        })).toHaveLength(1);
        expect(dataManager.getAggregatedSankeyData('all', 'all').propExpenses.get(1)).toBe(1500);
        expect(dataManager.store.queryAggregatedSankey('all', 'all').propExpenses.get(1)).toBe(1500);
    });
});
