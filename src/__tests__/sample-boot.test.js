import { readFileSync } from 'fs';
import DataManager from '../modules/core/DataManager.js';
import ChartRenderer from '../modules/core/ChartRenderer.js';
import Formatter from '../modules/utils/Formatter.js';
import ThemeManager from '../modules/core/ThemeManager.js';

const sample = JSON.parse(readFileSync('sample-expense-data-3-years.json', 'utf8'));

describe('sample JSON boot', () => {
    let dataManager;

    beforeEach(() => {
        global.ResizeObserver = jest.fn().mockImplementation(function ResizeObserverStub() {
            this.observe = jest.fn();
            this.disconnect = jest.fn();
            this.unobserve = jest.fn();
        });
        document.body.innerHTML = '<div id="chart-container"><div id="overviewChartContent"></div></div>';
    });

    afterEach(() => {
        if (dataManager && typeof dataManager.cleanup === 'function') {
            dataManager.cleanup();
        }
    });

    test('imports sample JSON as flat transactions and properties', async () => {
        const storage = {
            load: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockResolvedValue(true),
            initialize: jest.fn().mockResolvedValue(),
        };
        const validator = {
            validatePropertyName: () => ({ isValid: true }),
            validateAmount: () => ({ isValid: true }),
            validateDashboardData: () => ({ isValid: true, errors: [] }),
        };
        dataManager = new DataManager(storage, validator, new Formatter());
        await dataManager.initialize(sample);

        const exported = dataManager.getData();
        expect(exported.transactions.length).toBe(2261);
        expect(exported.properties).toHaveLength(3);
        expect(exported.properties[0]).toEqual(expect.objectContaining({
            id: 1,
            name: 'Downtown Office Complex',
        }));
        expect(Array.isArray(exported.properties[0])).toBe(false);
        expect(exported.expenseCategories).toEqual(expect.arrayContaining(['Utilities', 'Rent']));
        expect(exported.expenseCategories.every(name => typeof name === 'string')).toBe(true);
    });

    test('renders SVG from sample JSON', async () => {
        const storage = {
            load: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockResolvedValue(true),
            initialize: jest.fn().mockResolvedValue(),
        };
        const validator = {
            validatePropertyName: () => ({ isValid: true }),
            validateAmount: () => ({ isValid: true }),
            validateDashboardData: () => ({ isValid: true, errors: [] }),
        };
        dataManager = new DataManager(storage, validator, new Formatter());
        await dataManager.initialize(sample);

        const uiManager = {
            getElement: key => document.getElementById(key),
            showLoadingState: jest.fn(),
            hideLoadingState: jest.fn(),
            showError: jest.fn(),
        };
        const themeManager = new ThemeManager();
        const aggregated = dataManager.getAggregatedSankeyData('all', 'all');
        expect(aggregated.propExpenses.size).toBeGreaterThan(0);

        const chart = new ChartRenderer(dataManager, uiManager, new Formatter(), themeManager);
        await chart.initialize();
        await chart.renderOverviewSankey();

        const container = document.getElementById('overviewChartContent');
        expect(container.querySelector('svg')).not.toBeNull();
    });
});
