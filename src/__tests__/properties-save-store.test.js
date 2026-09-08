import DataManager from '../modules/core/DataManager.js';
import PropertiesManager from '../modules/PropertiesManager.js';
import ChartRenderer from '../modules/core/ChartRenderer.js';
import ThemeManager from '../modules/core/ThemeManager.js';
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
        const historyManager = {
            createSnapshot: jest.fn(),
            capture: jest.fn().mockResolvedValue(true),
            saveState: jest.fn().mockResolvedValue(true),
            history: [{ id: 'baseline' }],
        };
        propertiesManager = new PropertiesManager(dataManager, uiManager, historyManager);
        propertiesManager.currentPropertyId = 1;
        document.body.innerHTML = '<div id="propertiesDashboard"></div><div id="overviewChartContent"></div>';
    });

    test('saveExpenseValue adds a store transaction and Sankey expenses', async () => {
        await propertiesManager.saveExpenseValue('Rent', null, 1500);

        const txns = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'expense',
        });
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

    test('income list includes store income categories before a line is written', () => {
        const names = propertiesManager.getPropertyIncomeNames(dataManager.getPropertyById(1));
        expect(names).toContain('Salary');
    });

    test('addIncome uses an existing store income category and edit/delete leave expense Rent', async () => {
        await propertiesManager.saveExpenseValue('Rent', null, 1500);
        await propertiesManager.addIncome('Rent', 5000);

        let income = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'income',
        });
        let expense = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'expense',
        });
        expect(income).toHaveLength(1);
        expect(income[0].amount).toBe(5000);
        expect(expense).toHaveLength(1);
        expect(expense[0].amount).toBe(-1500);

        await propertiesManager.saveExpenseValue('Rent', null, 6000, 'income');
        income = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'income',
        });
        expense = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'expense',
        });
        expect(income[0].amount).toBe(6000);
        expect(expense[0].amount).toBe(-1500);
        expect(dataManager.getAggregatedSankeyData('all', 'all').sources.get('Rent')).toBe(6000);

        await propertiesManager.deleteIncome('Rent');
        income = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'income',
        });
        expense = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'expense',
        });
        expect(income).toHaveLength(0);
        expect(expense).toHaveLength(1);
        expect(expense[0].amount).toBe(-1500);
        expect(dataManager.getAggregatedSankeyData('all', 'all').hasIncome).toBe(false);
    });

    test('addIncome writes a positive income transaction visible on Overview Sankey', async () => {
        await propertiesManager.addIncome('Parking', 800);

        const txns = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Parking',
            type: 'income',
        });
        expect(txns).toHaveLength(1);
        expect(txns[0].amount).toBe(800);
        expect(txns[0].type).toBe('income');

        const aggregated = dataManager.getAggregatedSankeyData('all', 'all');
        expect(aggregated.hasIncome).toBe(true);
        expect(aggregated.sources.get('Parking')).toBe(800);
        expect(aggregated.propIncomes.get(1)).toBe(800);
        expect(storage.save).toHaveBeenCalled();
        const payload = storage.save.mock.calls[storage.save.mock.calls.length - 1][0];
        expect(payload.transactions.some(
            t => t.type === 'income' && t.category === 'Parking' && t.amount === 800,
        )).toBe(true);
        expect(propertiesManager.historyManager.capture).toHaveBeenCalled();
        expect(propertiesManager.historyManager.saveState).toHaveBeenCalled();
    });

    test('addIncome refreshes Overview Sankey from store aggregations', async () => {
        const renderOverviewSankey = jest.fn().mockImplementation(async () => {
            const aggregated = dataManager.getAggregatedSankeyData('all', 'all');
            expect(aggregated.hasIncome).toBe(true);
            expect(aggregated.sources.get('Parking')).toBe(800);
        });
        propertiesManager.chartRenderer = { renderOverviewSankey };

        await propertiesManager.addIncome('Parking', 800);

        expect(renderOverviewSankey).toHaveBeenCalled();
        expect(dataManager.getAggregatedSankeyData('all', 'all').propIncomes.get(1)).toBe(800);
    });

    test('addIncome rejects 0 and NaN without writing a transaction', async () => {
        await propertiesManager.addIncome('Parking', 0);
        await propertiesManager.addIncome('Parking', NaN);
        const txns = dataManager.store.queryTransactions({
            propertyId: 1,
            type: 'income',
        });
        expect(txns).toHaveLength(0);
        expect(propertiesManager.uiManager.showToast).toHaveBeenCalled();
    });

    test('after addIncome, ChartRenderer keeps income-source nodes on Overview', async () => {
        global.ResizeObserver = jest.fn().mockImplementation(function ResizeObserverStub() {
            this.observe = jest.fn();
            this.disconnect = jest.fn();
            this.unobserve = jest.fn();
        });
        const uiManager = {
            showToast: jest.fn(),
            getElement: key => document.getElementById(key),
            updateDataDisplay: jest.fn(),
            showLoadingState: jest.fn(),
            hideLoadingState: jest.fn(),
            showError: jest.fn(),
            formatter: new Formatter(),
        };
        const chart = new ChartRenderer(dataManager, uiManager, new Formatter(), new ThemeManager());
        await chart.initialize();
        propertiesManager = new PropertiesManager(
            dataManager,
            uiManager,
            { createSnapshot: jest.fn() },
            chart,
        );
        propertiesManager.currentPropertyId = 1;

        await propertiesManager.saveExpenseValue('Rent', null, 1500);
        await propertiesManager.addIncome('Parking', 800);

        const aggregated = dataManager.getAggregatedSankeyData('all', 'all');
        expect(aggregated.hasIncome).toBe(true);
        const built = chart.buildSankeyData(
            dataManager.getProperties(),
            aggregated.sources,
            aggregated.propIncomes,
            aggregated.propExpenses,
            dataManager.getExpenseCategories(),
            aggregated.hasIncome,
            aggregated.catTotals,
            aggregated.subTotals,
            800,
            400,
        );
        expect(built.nodes.some(n => n.type === 'income-source' && n.name === 'PARKING')).toBe(true);
        expect(built.nodes.some(n => n.type === 'earnings')).toBe(true);
        const container = document.getElementById('overviewChartContent');
        expect(container.querySelector('svg')).not.toBeNull();
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

    test('after save, Overview Sankey render uses store aggregations', async () => {
        const renderOverviewSankey = jest.fn().mockImplementation(async () => {
            const aggregated = dataManager.getAggregatedSankeyData('all', 'all');
            expect(aggregated.propExpenses.get(1)).toBe(1500);
        });
        propertiesManager.chartRenderer = { renderOverviewSankey };

        await propertiesManager.saveExpenseValue('Rent', null, 1500);

        expect(renderOverviewSankey).toHaveBeenCalled();
        expect(dataManager.getAggregatedSankeyData('all', 'all').propExpenses.get(1)).toBe(1500);
    });

    test('after save, ChartRenderer Overview SVG is built from store data', async () => {
        global.ResizeObserver = jest.fn().mockImplementation(function ResizeObserverStub() {
            this.observe = jest.fn();
            this.disconnect = jest.fn();
            this.unobserve = jest.fn();
        });
        const uiManager = {
            showToast: jest.fn(),
            getElement: key => document.getElementById(key),
            updateDataDisplay: jest.fn(),
            showLoadingState: jest.fn(),
            hideLoadingState: jest.fn(),
            showError: jest.fn(),
            formatter: new Formatter(),
        };
        const chart = new ChartRenderer(dataManager, uiManager, new Formatter(), new ThemeManager());
        await chart.initialize();
        propertiesManager = new PropertiesManager(
            dataManager,
            uiManager,
            { createSnapshot: jest.fn() },
            chart,
        );
        propertiesManager.currentPropertyId = 1;

        await propertiesManager.saveExpenseValue('Rent', null, 1500);

        expect(dataManager.getAggregatedSankeyData('all', 'all').propExpenses.get(1)).toBe(1500);
        const container = document.getElementById('overviewChartContent');
        expect(container.querySelector('svg')).not.toBeNull();
    });

    test('expense edit changes store.queryTransactions and aggregated Sankey data', async () => {
        const beforeTxns = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'expense',
        });
        const beforeAgg = dataManager.getAggregatedSankeyData('all', 'all');
        expect(beforeTxns).toHaveLength(0);
        expect(beforeAgg.propExpenses.get(1) || 0).toBe(0);
        expect(beforeAgg.catTotals.get('Rent') || 0).toBe(0);

        await propertiesManager.saveExpenseValue('Rent', null, 1500);

        const afterInsert = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'expense',
        });
        const afterInsertAgg = dataManager.getAggregatedSankeyData('all', 'all');
        const storeAgg = dataManager.store.queryAggregatedSankey('all', 'all');
        expect(afterInsert).toHaveLength(1);
        expect(afterInsert[0].amount).toBe(-1500);
        expect(afterInsertAgg.propExpenses.get(1)).toBe(1500);
        expect(afterInsertAgg.catTotals.get('Rent')).toBe(1500);
        expect(storeAgg.propExpenses.get(1)).toBe(afterInsertAgg.propExpenses.get(1));

        await propertiesManager.saveExpenseValue('Rent', null, 2000);

        const afterEdit = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Rent',
            type: 'expense',
        });
        const afterEditAgg = dataManager.getAggregatedSankeyData('all', 'all');
        expect(afterEdit).toHaveLength(1);
        expect(afterEdit[0].id).toBe(afterInsert[0].id);
        expect(afterEdit[0].amount).toBe(-2000);
        expect(afterEditAgg.propExpenses.get(1)).toBe(2000);
        expect(afterEditAgg.catTotals.get('Rent')).toBe(2000);
        expect(afterEditAgg.propExpenses.get(1)).not.toBe(afterInsertAgg.propExpenses.get(1));
    });

    test('addSubcategory writes a store line and refreshes Overview from store agg', async () => {
        const renderOverviewSankey = jest.fn().mockImplementation(async () => {
            const aggregated = dataManager.getAggregatedSankeyData('all', 'all');
            expect(aggregated.propExpenses.get(1)).toBe(400);
            expect(aggregated.catTotals.get('Utilities')).toBe(400);
        });
        propertiesManager.chartRenderer = { renderOverviewSankey };
        propertiesManager.currentCategoryPath = { category: 'Utilities' };

        await propertiesManager.addSubcategory('Electricity', 400);

        const txns = dataManager.store.queryTransactions({
            propertyId: 1,
            category: 'Utilities',
            type: 'expense',
        });
        expect(txns).toHaveLength(1);
        expect(txns[0].subcategory).toBe('Electricity');
        expect(dataManager.getAggregatedSankeyData('all', 'all').propExpenses.get(1)).toBe(400);
        expect(dataManager.store.queryAggregatedSankey('all', 'all').catTotals.get('Utilities')).toBe(400);
        expect(renderOverviewSankey).toHaveBeenCalled();
    });
});
