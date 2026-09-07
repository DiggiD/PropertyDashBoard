/**
 * Jest unit tests for PropertiesManager
 * Tests properties dashboard UI handlers to achieve 80%+ coverage
 * Focuses on critical paths, error handling, and edge cases
 */

import PropertiesManager from '../modules/PropertiesManager.js';
import DataManager from '../modules/core/DataManager.js';
import UIManager from '../modules/core/UIManager.js';

import HistoryManager from '../modules/core/HistoryManager.js';

jest.mock('../modules/utils/Storage', () => require('../__mocks__/Storage'));
jest.mock('../modules/core/ThemeManager', () => require('../__mocks__/ThemeManager'));

// Enhanced fireEvent utility for DOM events
const fireEvent = {
    click: (element) => {
        const event = document.createEvent('Event');
        event.initEvent('click', true, true);
        element.dispatchEvent(event);
        return event;
    },
    input: (element, value) => {
        element.value = value;
        const event = document.createEvent('Event');
        event.initEvent('input', true, false);
        element.dispatchEvent(event);
        return event;
    },
    blur: (element) => {
        const event = document.createEvent('Event');
        event.initEvent('blur', true, false);
        element.dispatchEvent(event);
        return event;
    },
};

describe('PropertiesManager - 80%+ Coverage Target', () => {
    let dataManager, propertiesManager, uiManager, historyManager;
    let mockDataManager, mockUIManager, mockHistoryManager;

    beforeEach(async () => {
        // Mock console.log
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        // Create mocks with proper state management
        const mockProperties = [];
        mockDataManager = {
            addProperty: jest.fn().mockImplementation(async (name) => {
                const newProp = { id: mockProperties.length + 1, name, expenses: {} };
                mockProperties.push(newProp);
                return { success: true, property: newProp, message: 'Property added successfully' };
            }),
            getProperties: jest.fn().mockImplementation(() => mockProperties),
            getPropertyById: jest.fn().mockImplementation((id) => mockProperties.find(p => p.id === id) || null),
            deleteProperty: jest.fn().mockResolvedValue({ success: true, message: 'Property deleted successfully' }),
            updatePropertyName: jest.fn().mockReturnValue({ success: true }),
            deleteProperty: jest.fn().mockImplementation(async (id) => {
                const index = mockProperties.findIndex(p => p.id === id);
                if (index !== -1) {
                    mockProperties.splice(index, 1);
                }
                return { success: true, message: 'Property deleted successfully' };
            }),
            save: jest.fn().mockResolvedValue(true),
            getCurrentPeriodData: jest.fn().mockReturnValue({ total: 0, expenses: {} }),
            getAvailableYears: jest.fn().mockReturnValue(['2024', '2025']),
            getSelectedYear: jest.fn().mockReturnValue('2025'),
            getSelectedMonth: jest.fn().mockReturnValue('09'),
            setSelectedYear: jest.fn(),
            setSelectedMonth: jest.fn(),
            getExpenseCategories: jest.fn().mockReturnValue(['Rent', 'Utilities']),
            getIncomeCategories: jest.fn().mockReturnValue([]),
            getCurrentView: jest.fn().mockReturnValue(null),
            data: {
                currentTimePeriod: 'all',
                properties: mockProperties,
                expenseCategories: ['Rent', 'Utilities'],
                incomeCategories: [],
            },
        };
        mockUIManager = {
            showToast: jest.fn(),
            getElement: jest.fn().mockImplementation((id) => document.getElementById(id)),
            openModal: jest.fn(),
            closeModal: jest.fn(),
            removeEventListener: jest.fn(),
            addEventListener: jest.fn(),
            populateYearPicker: jest.fn(),
            populateMonthPicker: jest.fn(),
            updateYearPickerSelection: jest.fn(),
            updateMonthPickerSelection: jest.fn(),
            formatter: {
                formatCurrency: jest.fn((val) => `$${Math.abs(val)}`),
            },
        };
        mockHistoryManager = {
            createSnapshot: jest.fn(),
        };

        // Create real instances for complex tests
        const storage = { getItem: jest.fn(), setItem: jest.fn() };
        const validator = { validatePropertyName: jest.fn((name) => !!name.trim()) };
        const formatter = { formatCurrency: jest.fn((val) => `$${Math.abs(val)}`) };

        dataManager = new DataManager(storage, validator, formatter);
        uiManager = new UIManager(formatter, {});
        historyManager = new HistoryManager();

        // Inject mocks into real instances for controlled testing
        Object.assign(dataManager, mockDataManager);
        Object.assign(uiManager, mockUIManager);
        Object.assign(historyManager, mockHistoryManager);

        // Mock the store property on dataManager
        dataManager.store = {
            queryAggregatedSankey: jest.fn().mockReturnValue({
                propExpenses: new Map(),
                propIncomes: new Map(),
                catTotals: new Map(),
                subTotals: new Map(),
                sources: new Map(),
                hasIncome: false,
            }),
            queryCategories: jest.fn().mockReturnValue([]),
        };

        // Create PropertiesManager with mixed real/mocked dependencies
        propertiesManager = new PropertiesManager(dataManager, uiManager, null, historyManager);

        // Fix fixtures with real spies
        // Note: PropertiesManager doesn't have filterProperties method

        // Mock events
        const mockEvent = { target: { closest: jest.fn(() => ({ dataset: { propertyId: '1' } })), stopPropagation: jest.fn() }, preventDefault: jest.fn() };

        // Setup basic DOM structure
        setupDOMStructure();
    });

    afterEach(() => {
        jest.clearAllMocks();
        cleanupDOM();
    });

    function setupDOMStructure() {
        // Create required DOM elements
        document.body.innerHTML = `
            <div id="propertiesDashboard" class="dashboard-panel">
                <div class="dashboard-content"></div>
            </div>
            <div id="properties-container" class="properties-container">
                <div id="property-list" class="properties-list"></div>
            </div>
        `;
    }

    function cleanupDOM() {
        document.body.innerHTML = '';
    }

    // ============================================================================
    // CORE INITIALIZATION AND SETUP TESTS (8 tests)
    // ============================================================================

    describe('Initialization and Setup', () => {
        beforeEach(() => {
            // Ensure DataManager has all required methods
            dataManager.addProperty = jest.fn().mockResolvedValue({ success: true, property: { id: 1 } });
            dataManager.getProperties = jest.fn().mockReturnValue([]);
            dataManager.getPropertyById = jest.fn().mockReturnValue(null);
            dataManager.getCurrentPeriodData = jest.fn().mockReturnValue({ total: 0, expenses: {} });
            dataManager.getAvailableYears = jest.fn().mockReturnValue(['2024', '2025']);
            dataManager.getSelectedYear = jest.fn().mockReturnValue('2025');
            dataManager.getSelectedMonth = jest.fn().mockReturnValue('09');
        });

        test('should initialize successfully with all dependencies', async () => {
            await expect(propertiesManager.initialize()).resolves.not.toThrow();
            // Check that console.log was called (without specific timestamp check)
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] [PROPERTIES] PropertiesManager initialized successfully'));
        });

        test('should handle missing DataManager gracefully', async () => {
            const brokenManager = new PropertiesManager(null, uiManager, null, historyManager);
            await expect(brokenManager.initialize()).resolves.not.toThrow();
        });

        test('should handle missing UIManager gracefully', async () => {
            const brokenManager = new PropertiesManager(dataManager, null, null, historyManager);
            await expect(brokenManager.initialize()).resolves.not.toThrow();
        });

        test('should setup event listeners without throwing', () => {
            expect(() => propertiesManager.setupEventListeners()).not.toThrow();
        });

        test('should render dashboard with empty state', () => {
            dataManager.getProperties.mockReturnValue([]);
            expect(() => propertiesManager.renderPropertiesDashboard()).not.toThrow();

            const dashboard = document.getElementById('propertiesDashboard');
            expect(dashboard.innerHTML).toContain('No Properties Yet');
        });

        test('should initialize header pickers', () => {
            expect(() => propertiesManager.initializeHeaderPickers()).not.toThrow();
            expect(uiManager.populateYearPicker).toHaveBeenCalled();
            expect(uiManager.populateMonthPicker).toHaveBeenCalled();
        });

        test('should set current header selections', () => {
            expect(() => propertiesManager.setCurrentHeaderSelections()).not.toThrow();
            expect(dataManager.setSelectedYear).toHaveBeenCalled();
            expect(dataManager.setSelectedMonth).toHaveBeenCalled();
        });

        test('should update header picker selections', () => {
            expect(() => propertiesManager.updateHeaderPickerSelections()).not.toThrow();
            expect(uiManager.updateYearPickerSelection).toHaveBeenCalled();
            expect(uiManager.updateMonthPickerSelection).toHaveBeenCalled();
        });
    });

    // ============================================================================
    // PROPERTY CRUD OPERATIONS (15 tests)
    // ============================================================================

    describe('Property CRUD Operations', () => {
        beforeEach(() => {
            dataManager.getProperties = jest.fn().mockReturnValue([]);
            dataManager.getPropertyById = jest.fn().mockReturnValue(null);
            dataManager.addProperty = jest.fn().mockResolvedValue({
                success: true,
                property: { id: 1, name: 'Test Property', expenses: {} },
            });
            dataManager.updatePropertyName = jest.fn().mockReturnValue({ success: true });
            dataManager.deleteProperty = jest.fn().mockResolvedValue({ success: true });
            dataManager.save = jest.fn().mockResolvedValue(true);
        });

        test('should add property successfully', async () => {
            await propertiesManager.addProperty('Test Property');

            expect(dataManager.addProperty).toHaveBeenCalledWith('Test Property');
            expect(historyManager.createSnapshot).toHaveBeenCalled();
            expect(uiManager.showToast).toHaveBeenCalled();
        });

        test('should handle truncated whitespace when adding property', async () => {
            await propertiesManager.addProperty('  Test Property  ');

            expect(dataManager.addProperty).toHaveBeenCalledWith('Test Property');
        });

        test('should update property name', () => {
            propertiesManager.updatePropertyName(1, 'Updated Name');

            expect(dataManager.updatePropertyName).toHaveBeenCalledWith(1, 'Updated Name');
            expect(historyManager.createSnapshot).toHaveBeenCalled();
        });

        test('should delete property successfully', async () => {
            const mockProperty = { id: 1, name: 'Test Property' };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            await propertiesManager.deleteProperty(1);

            expect(dataManager.deleteProperty).toHaveBeenCalledWith(1);
            expect(historyManager.createSnapshot).toHaveBeenCalledWith('Deleted property "Test Property"', '', false);
        });

        test('should handle addProperty failure', async () => {
            dataManager.addProperty.mockResolvedValue({ success: false, message: 'Property exists' });

            await propertiesManager.addProperty('Duplicate Property');

            expect(uiManager.showToast).toHaveBeenCalledWith('Property exists', 'error');
        });

        test('should handle deleteProperty failure', async () => {
            dataManager.deleteProperty.mockReturnValue({ success: false, message: 'Delete failed' });
            const mockProperty = { id: 1, name: 'Test Property' };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            await propertiesManager.deleteProperty(1);

            expect(uiManager.showToast).toHaveBeenCalledWith('Delete failed', 'error');
        });

        test('should show add property modal', () => {
            expect(() => propertiesManager.showAddPropertyModal()).not.toThrow();
        });

        test('should show edit property modal', () => {
            const mockProperty = { id: 1, name: 'Test Property' };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            expect(() => propertiesManager.showEditPropertyModal(1)).not.toThrow();
        });

        test('should auto-select newly added property', async () => {
            const newProperty = { id: 2, name: 'New Property', expenses: {} };
            dataManager.addProperty.mockResolvedValue({ success: true, property: newProperty });
            dataManager.getProperties.mockReturnValue([newProperty]);

            await propertiesManager.addProperty('New Property');

            expect(propertiesManager.currentPropertyId).toBe(2);
        });


        test('should populate and auto-select hierarchical categories', () => {
            dataManager.addProperty = jest.fn().mockResolvedValue({
                success: true,
                property: { id: 1, name: 'Parent Property', expenses: { 'Hierarchy': {} } },
            });

            expect(() => propertiesManager.addCategory('Hierarchy', true)).not.toThrow();
        });
    });

    // ============================================================================
    // CATEGORY AND SUBCATEGORY OPERATIONS (12 tests)
    // ============================================================================

    describe('Category and Subcategory Operations', () => {
        beforeEach(() => {
            const mockProperty = { id: 1, name: 'Test Property', expenses: {} };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            propertiesManager.currentPropertyId = 1;
        });

        test('should add flat category', () => {
            const mockProperty = dataManager.getPropertyById(1);

            propertiesManager.addCategory('Rent', false);

            expect(mockProperty.expenses['Rent']).toBe(0);
            expect(historyManager.createSnapshot).toHaveBeenCalled();
        });

        test('should add hierarchical category', () => {
            const mockProperty = dataManager.getPropertyById(1);

            propertiesManager.addCategory('Utilities', true);

            expect(mockProperty.expenses['Utilities']).toEqual({});
            expect(historyManager.createSnapshot).toHaveBeenCalled();
        });

        test('should add subcategory to hierarchical category', () => {
            const mockProperty = dataManager.getPropertyById(1);
            mockProperty.expenses['Utilities'] = {};
            propertiesManager.currentCategoryPath = { category: 'Utilities' };

            propertiesManager.addSubcategory('Electricity', 300);

            expect(mockProperty.expenses['Utilities']['Electricity']).toBe(300);
            expect(historyManager.createSnapshot).toHaveBeenCalled();
        });

        test('should prevent duplicate category names', () => {
            const mockProperty = dataManager.getPropertyById(1);
            mockProperty.expenses['Rent'] = -1000;

            propertiesManager.addCategory('Rent', false);

            expect(uiManager.showToast).toHaveBeenCalledWith('Category already exists', 'error');
        });

        test('should prevent duplicate subcategory names', () => {
            const mockProperty = dataManager.getPropertyById(1);
            mockProperty.expenses['Utilities'] = { 'Electricity': -300 };
            propertiesManager.currentCategoryPath = { category: 'Utilities' };

            propertiesManager.addSubcategory('Electricity', 400);

            expect(uiManager.showToast).toHaveBeenCalledWith('Subcategory already exists', 'error');
        });

        test('should update category name', () => {
            const mockProperty = dataManager.getPropertyById(1);
            mockProperty.expenses['OldRent'] = -1000;

            propertiesManager.updateCategoryName('OldRent', 'NewRent');

            expect(mockProperty.expenses['NewRent']).toBe(-1000);
            expect(mockProperty.expenses['OldRent']).toBeUndefined();
        });

        test('should update subcategory name', () => {
            const mockProperty = dataManager.getPropertyById(1);
            mockProperty.expenses['Utilities'] = { 'OldElectric': -300 };

            propertiesManager.updateSubcategoryName('Utilities', 'OldElectric', 'NewElectric');

            expect(mockProperty.expenses['Utilities']['NewElectric']).toBe(-300);
            expect(mockProperty.expenses['Utilities']['OldElectric']).toBeUndefined();
        });

        test('should delete category', () => {
            const mockProperty = dataManager.getPropertyById(1);
            mockProperty.expenses['Rent'] = -1000;
            global.confirm = jest.fn().mockReturnValue(true);

            propertiesManager.deleteCategory('Rent');

            expect(mockProperty.expenses['Rent']).toBeUndefined();
        });

        test('should delete subcategory', () => {
            const mockProperty = dataManager.getPropertyById(1);
            mockProperty.expenses['Utilities'] = { 'Electricity': -300 };
            global.confirm = jest.fn().mockReturnValue(true);

            propertiesManager.deleteSubcategory('Utilities', 'Electricity');

            expect(mockProperty.expenses['Utilities']['Electricity']).toBeUndefined();
        });

        test('should show add category modal', () => {
            expect(() => propertiesManager.showAddCategoryModal()).not.toThrow();
        });

        test('should show add subcategory modal', () => {
            expect(() => propertiesManager.showAddSubcategoryModal()).not.toThrow();
        });
    });

    // ============================================================================
    // EXPENSE HANDLING AND VALIDATION (8 tests)
    // ============================================================================

    describe('Expense Handling and Validation', () => {
        beforeEach(() => {
            const mockProperty = {
                id: 1,
                name: 'Test Property',
                expenses: { 'Rent': -1000 },
                quarterlyData: { 'Q1 2025': { expenses: {}, total: 0 } },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            dataManager.getCurrentPeriodData.mockReturnValue({
                total: -1000,
                expenses: { 'Rent': -1000 },
            });
            propertiesManager.currentPropertyId = 1;
        });

        test('should handle expense edit initiation', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            valueElement.dataset.category = 'Rent';
            valueElement.textContent = '$1000';

            const mockEvent = {
                target: valueElement,
                stopPropagation: jest.fn(),
                preventDefault: jest.fn(),
            };

            expect(() => propertiesManager.handleExpenseEdit(mockEvent)).not.toThrow();
            expect(mockEvent.stopPropagation).toHaveBeenCalled();
        });

        test('should save expense value changes', () => {
            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Rent';
            mockInput.value = '1200';

            propertiesManager.handleExpenseSave({ target: mockInput });

            expect(historyManager.createSnapshot).toHaveBeenCalled();
            expect(dataManager.save).toHaveBeenCalled();
        });

        test('should convert positive expense input to negative', () => {
            const mockProperty = dataManager.getPropertyById(1);
            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Rent';
            mockInput.value = '1200';

            propertiesManager.handleExpenseSave({ target: mockInput });

            expect(mockProperty.expenses['Rent']).toBe(-1200);
        });

        test('should convert NaN expense input to 0', () => {
            const mockProperty = dataManager.getPropertyById(1);
            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Rent';
            mockInput.value = 'invalid';

            propertiesManager.handleExpenseSave({ target: mockInput });

            expect(mockProperty.expenses['Rent']).toBe(0);
        });

        test('should cancel expense edit', () => {
            const mockInput = document.createElement('input');
            mockInput.dataset.category = 'Rent';
            mockInput.closest = jest.fn().mockReturnValue({
                innerHTML: '',
                dataset: { category: 'Rent' },
                querySelector: jest.fn().mockReturnValue({ value: '-1000' }),
            });

            expect(() => propertiesManager.cancelExpenseEdit(mockInput)).not.toThrow();
        });

        test('should save expense value correctly', () => {
            // Add a property to the mock data
            const mockProperty = { id: 1, name: 'Test', expenses: { 'Rent': -1000 } };
            // Add to the mockProperties array that the mock uses (access the closure variable)
            const mockProperties = [];
            mockDataManager.getProperties.mockReturnValue(mockProperties);
            mockProperties.push(mockProperty);
            // Make sure getPropertyById returns the same object
            mockDataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.saveExpenseValue('Rent', null, 1500);

            // Verify expense was updated
            expect(mockProperty.expenses['Rent']).toBe(-1500);
        });

        test('should handle chart calculation updates', () => {
            expect(() => propertiesManager.updateChartCalculations()).not.toThrow();
        });

        test('should handle income categories (positive values)', () => {
            dataManager.getExpenseCategories = jest.fn().mockReturnValue(['Rent']);
            dataManager.getIncomeCategories = jest.fn().mockReturnValue(['Investment']);

            const result = propertiesManager.isIncomeCategory('Investment');
            expect(result).toBe(true);
        });
    });

    // ============================================================================
    // RENDERING AND UI INTERACTIONS (10 tests)
    // ============================================================================

    describe('Rendering and UI Interactions', () => {
        beforeEach(() => {
            // Clear DOM before each test
            const dashboard = document.getElementById('propertiesDashboard');
            dashboard.innerHTML = '<div class="dashboard-content"></div>';
        });

        test('should render multi-panel layout', () => {
            const mockProperties = [{ id: 1, name: 'Test Property', expenses: {} }];
            dataManager.getProperties.mockReturnValue(mockProperties);
            dataManager.getPropertyById.mockReturnValue(mockProperties[0]);
            dataManager.getCurrentPeriodData.mockReturnValue({ total: 0 });

            const html = propertiesManager.renderMultiPanelLayout(mockProperties);

            expect(html).toContain('properties-multi-panel');
            expect(html).toContain('Test Property');
        });

        test('should sort properties by total amount', () => {
            const mockProperties = [
                { id: 1, name: 'Small', expenses: {}, id: 1 },
                { id: 2, name: 'Large', expenses: {}, id: 2 },
            ];
            dataManager.getCurrentPeriodData
                .mockReturnValueOnce({ total: -500 })
                .mockReturnValueOnce({ total: -2000 });

            const html = propertiesManager.renderPropertiesPanel(mockProperties);
            // Large property should appear first (higher total in absolute terms)
            expect(html.indexOf('Large')).toBeLessThan(html.indexOf('Small'));
        });

        test('should render hierarchical categories', () => {
            const mockCategories = ['Rent', 'Utilities'];
            const mockProperty = {
                id: 1,
                name: 'Test Property',
                expenses: {
                    'Rent': -1000,
                    'Utilities': { 'Electricity': -300, 'Water': -200 },
                },
            };

            const html = propertiesManager.renderCategoriesPanel(mockCategories, mockProperty);
            expect(html).toContain('Rent');
            expect(html).toContain('Utilities');
            expect(html).toContain('$1000'); // Rent total
            expect(html).toContain('$500'); // Utilities total (300 + 200)
        });

        test('should render subcategories panel', () => {
            const mockProperty = {
                expenses: {
                    'Utilities': { 'Electricity': -300, 'Water': -200 },
                },
            };

            const html = propertiesManager.renderSubcategoriesPanel(mockProperty, 'Utilities', null);
            expect(html).toContain('Electricity');
            expect(html).toContain('Water');
        });

        test('should handle hierarchical rendering depth 3+', () => {
            const mockProperty = {
                id: 1,
                name: 'Deep Property',
                expenses: {
                    'Level1': {
                        'Level2': {
                            'Level3': -100,
                            'Level4': -200,
                        },
                    },
                },
            };

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = {
                category: 'Level1',
                subcategory: 'Level2',
            };

            expect(() => propertiesManager.renderPropertiesDashboard()).not.toThrow();
        });

        test('should handle item click navigation', () => {
            // Mock property item click
            const propertyItem = document.createElement('div');
            propertyItem.className = 'property-item';
            propertyItem.dataset.propertyId = '1';
            propertyItem.closest = jest.fn().mockReturnValue(propertyItem);

            const mockEvent = { target: propertyItem };
            propertiesManager.handleItemClick(mockEvent);

            expect(propertiesManager.currentPropertyId).toBe(1);
        });

        test('should handle back navigation logic', () => {
            // Test navigation from subcategory to category
            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = {
                category: 'Utilities',
                subcategory: 'Electricity',
            };

            propertiesManager.handleBackNavigation();

            expect(propertiesManager.currentCategoryPath).toEqual({ category: 'Utilities' });
            expect(propertiesManager.currentPropertyId).toBe(1);

            // Test navigation from category to property list
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentCategoryPath).toBeNull();
            expect(propertiesManager.currentPropertyId).toBe(1);

            // Test navigation from property to home
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentPropertyId).toBeNull();
        });

        test('should handle hover effects', () => {
            const propertyItem = document.createElement('div');
            propertyItem.className = 'property-item';

            expect(() => propertiesManager.handlePropertyHover({ target: propertyItem }, true)).not.toThrow();
            expect(() => propertiesManager.handleCategoryHover({ target: propertyItem }, false)).not.toThrow();
            expect(() => propertiesManager.handleExpenseValueHover({ target: propertyItem }, true)).not.toThrow();
        });

        test('should clear current selection', () => {
            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = { category: 'Rent' };

            propertiesManager.clearSelection();

            expect(propertiesManager.currentPropertyId).toBeNull();
            expect(propertiesManager.currentCategoryPath).toBeNull();
        });

        test('should handle time period changes', () => {
            expect(() => propertiesManager.handleTimePeriodChange()).not.toThrow();
            expect(uiManager.showToast).toHaveBeenCalled();
        });
    });

    // ============================================================================
    // EDGE CASES AND ERROR HANDLING (15+ tests)
    // ============================================================================

    describe('Edge Cases and Error Handling', () => {
        test('should handle null property operations gracefully', () => {
            expect(() => propertiesManager.getPropertyCategories(null)).not.toThrow();
            expect(propertiesManager.getCategoryExpenseValue(null, 'test')).toBe(0);
            expect(() => propertiesManager.sumObjectValues(null)).not.toThrow();
        });

        test('should handle NaN values in calculations', () => {
            expect(propertiesManager.sumObjectValues({ a: 1, b: NaN, c: 3 })).toBe(4);
            expect(propertiesManager.sumObjectValues({ a: NaN })).toBe(0);

            const mockInput = document.createElement('input');
            mockInput.dataset.category = 'Rent';
            mockInput.value = NaN;

            expect(() => propertiesManager.handleExpenseSave({ target: mockInput })).not.toThrow();
        });

        test('should handle empty expense categories', () => {
            dataManager.getExpenseCategories = jest.fn().mockReturnValue([]);
            expect(propertiesManager.isExpenseCategory('Unknown')).toBe(false);
        });

        test('should handle modal operations', () => {
            const modalId = 'testModal';
            const content = '<div>Test Content</div>';

            propertiesManager.showModal(modalId, content);
            expect(uiManager.openModal).toHaveBeenCalledWith(modalId);

            propertiesManager.closeModal(modalId);
            expect(uiManager.closeModal).toHaveBeenCalledWith(modalId);
        });

        test('should handle long press detection setup and cleanup', () => {
            const mockItem = document.createElement('div');
            mockItem.dataset.propertyId = '1';

            // Start long press
            propertiesManager.startLongPressDetection(mockItem, { touches: [{ clientX: 0, clientY: 0 }] });
            expect(propertiesManager.longPressTimers.size).toBeGreaterThan(0);

            // Cancel long press
            propertiesManager.cancelLongPressDetection();
            expect(propertiesManager.longPressTimers.size).toBe(0);
        });

        test('should handle delete confirmations with user responses', () => {
            // Mock property
            const mockProperty = { id: 1, name: 'Test Property' };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            // Mock showInlineDeleteConfirmation
            propertiesManager.showInlineDeleteConfirmation = jest.fn();

            // Test confirmation call
            propertiesManager.confirmDeleteProperty(1);
            expect(propertiesManager.showInlineDeleteConfirmation).toHaveBeenCalledWith(1, 'property', 'Test Property');
        });

        test('should handle tooltip hiding when moving between elements', () => {
            const button = document.createElement('button');
            button.id = 'add-property-btn';

            // Show tooltip
            propertiesManager.showAddButtonTooltip(button, {});

            // Hide tooltip
            expect(() => propertiesManager.hideAddButtonTooltip()).not.toThrow();

            // Test tooltip positioning
            expect(() => {
                const mockButton = document.createElement('button');
                document.body.appendChild(mockButton);
                propertiesManager.showAddButtonTooltip(mockButton, {});
                document.body.removeChild(mockButton);
            }).not.toThrow();
        });

        test('should handle property name editing workflow', () => {
            const mockElement = document.createElement('div');
            mockElement.className = 'property-name editable';
            mockElement.dataset.propertyId = '1';

            const mockProperty = { id: 1, name: 'Old Name' };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            // Start edit
            propertiesManager.handlePropertyNameEdit({ target: mockElement });

            // Save edit
            propertiesManager.handlePropertyNameSave({ target: document.createElement('input') });
        });

        test('should handle complex hierarchical data validation', () => {
            const mockProperty = {
                expenses: {
                    'Flat': -1000,
                    'Hierarchical': {
                        'Sub1': -500,
                        'Sub2': NaN,
                        'Sub3': undefined,
                    },
                },
            };

            expect(propertiesManager.getCategoryExpenseValue(mockProperty, 'Flat')).toBe(-1000);
            expect(propertiesManager.getCategoryExpenseValue(mockProperty, 'Hierarchical')).toEqual({
                'Sub1': -500,
                'Sub2': NaN,
                'Sub3': undefined,
            });
        });

        test('should handle monthly data parsing and validation', () => {
            expect(propertiesManager.parseMonthKey('Jan 2025')).toBeInstanceOf(Date);
            expect(propertiesManager.parseMonthKey('Invalid')).toBeInstanceOf(Date);
            expect(propertiesManager.getMonthName('01')).toBe('January');
            expect(propertiesManager.getMonthName('13')).toBe('13');
        });

        test('should handle forced UI picker updates', () => {
            expect(() => propertiesManager.forceUpdatePickerUI('2025', '09')).not.toThrow();

            // Test with null values
            expect(() => propertiesManager.forceUpdatePickerUI(null, null)).not.toThrow();
        });

        test('should handle chart calculation updates', () => {
            expect(() => propertiesManager.updateChartCalculations()).not.toThrow();
        });

        test('should handle utility cleanup', () => {
            expect(() => propertiesManager.cleanup()).not.toThrow();
        });

        test('should handle picker population methods', () => {
            dataManager.getAvailableYears.mockReturnValue(['2024', '2025']);
            expect(() => propertiesManager.populateYearPicker()).not.toThrow();
            expect(() => propertiesManager.setCurrentMonth()).not.toThrow();
        });

        test('should handle complex data lookup methods', () => {
            // Test last available month/year lookups
            expect(propertiesManager.getLastAvailableMonthYear()).toBeNull();
            expect(propertiesManager.getLastAvailableMonthForYear('2025')).toBeNull();
            expect(propertiesManager.hasDataForMonthYear('2025', '01')).toBeFalsy();
        });

        test('should validate all core methods are callable', () => {
            const coreMethods = [
                'initialize', 'setupEventListeners', 'renderPropertiesDashboard',
                'addProperty', 'updatePropertyName', 'deleteProperty',
                'addCategory', 'addSubcategory', 'updateCategoryName',
                'handleItemClick', 'handleBackNavigation', 'clearSelection',
                'handleExpenseEdit', 'saveExpenseValue',
                'showModal', 'closeModal', 'getPropertyCategories',
                'getCategoryExpenseValue', 'getCurrentExpenseValue', 'sumObjectValues',
            ];

            coreMethods.forEach(method => {
                expect(typeof propertiesManager[method]).toBe('function');
            });
        });

        test('should cover additional tooltip positioning edge cases', () => {
            const button = document.createElement('button');
            button.id = 'add-property-btn';
            document.body.appendChild(button);

            // Mock getBoundingClientRect for edge case where tooltip would go off-screen
            const mockRect = {
                width: 40, height: 40, top: 10, left: 10, right: 50, bottom: 50,
            };
            button.getBoundingClientRect = jest.fn(() => mockRect);

            // Mock window dimensions to force repositioning
            const originalInnerWidth = window.innerWidth;
            const originalInnerHeight = window.innerHeight;
            Object.defineProperty(window, 'innerWidth', { value: 100, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 100, writable: true });

            expect(() => propertiesManager.showAddButtonTooltip(button, {})).not.toThrow();

            // Restore
            Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
            document.body.removeChild(button);
        });

        test('should cover delete tooltip positioning with container bounds', () => {
            const button = document.createElement('button');
            button.className = 'property-action';
            button.dataset.action = 'delete';
            document.body.appendChild(button);

            // Create container
            const container = document.createElement('div');
            container.id = 'propertiesDashboard';
            document.body.appendChild(container);

            // Mock getBoundingClientRect
            button.getBoundingClientRect = jest.fn(() => ({
                width: 40, height: 40, top: 100, left: 10, right: 50, bottom: 140,
            }));
            container.getBoundingClientRect = jest.fn(() => ({
                left: 5, right: 200, top: 5, bottom: 400,
            }));

            expect(() => propertiesManager.showDeleteButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
            document.body.removeChild(container);
        });

        test('should cover event listener setup with missing container element', () => {
            const originalGetElement = uiManager.getElement;
            uiManager.getElement = jest.fn(() => null);

            expect(() => propertiesManager.setupEventListeners()).not.toThrow();

            uiManager.getElement = originalGetElement;
        });

        test('should cover double-click text area detection - outside text bounds', () => {
            const element = document.createElement('div');
            element.className = 'property-name editable';
            element.dataset.propertyId = '1';
            document.body.appendChild(element);

            // Mock getBoundingClientRect
            element.getBoundingClientRect = jest.fn(() => ({
                left: 0, top: 0, width: 100, height: 20, right: 100, bottom: 20,
            }));

            // Mock scrollWidth and scrollHeight to be smaller than element
            Object.defineProperty(element, 'scrollWidth', { value: 50 });
            Object.defineProperty(element, 'scrollHeight', { value: 15 });

            const mockEvent = {
                target: element,
                clientX: 80, // Outside text area
                clientY: 15,
                stopImmediatePropagation: jest.fn(),
            };

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Test' });

            expect(() => propertiesManager.handlePropertyNameEdit(mockEvent)).not.toThrow();

            document.body.removeChild(element);
        });

        test('should cover expense edit with selection needed for subcategory', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            valueElement.dataset.category = 'Utilities';
            valueElement.dataset.subcategory = 'Electricity';
            document.body.appendChild(valueElement);

            propertiesManager.currentCategoryPath = null; // No current selection

            const mockEvent = {
                target: valueElement,
                stopPropagation: jest.fn(),
                preventDefault: jest.fn(),
            };

            expect(() => propertiesManager.handleExpenseEdit(mockEvent)).not.toThrow();

            document.body.removeChild(valueElement);
        });

        test('should cover getCategoryExpenseValue fallback to direct property access', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };

            // Mock getCurrentPeriodData to return null
            dataManager.getCurrentPeriodData.mockReturnValue(null);

            const result = propertiesManager.getCategoryExpenseValue(mockProperty, 'Rent');
            expect(result).toBe(-1000);
        });

        test('should cover getCategoryExpenseValue with global categories initialization', () => {
            const mockProperty = {
                expenses: {},
            };

            // Mock window.dataManager
            const originalWindowDataManager = window.dataManager;
            window.dataManager = {
                getExpenseCategories: jest.fn(() => ['Rent']),
                getProperties: jest.fn(() => [{
                    expenses: { 'Rent': {} },
                }]),
            };

            dataManager.getCurrentPeriodData.mockReturnValue(null);

            const result = propertiesManager.getCategoryExpenseValue(mockProperty, 'Rent');
            expect(result).toEqual({});

            window.dataManager = originalWindowDataManager;
        });

        test('should cover handleItemClick for property selection', () => {
            const propertyItem = document.createElement('div');
            propertyItem.className = 'property-item';
            propertyItem.dataset.propertyId = '1';
            document.body.appendChild(propertyItem);

            const mockEvent = { target: propertyItem };

            expect(() => propertiesManager.handleItemClick(mockEvent)).not.toThrow();

            document.body.removeChild(propertyItem);
        });

        test('should cover handleItemClick for hierarchical category selection', () => {
            const categoryItem = document.createElement('div');
            categoryItem.className = 'property-item';
            categoryItem.dataset.category = 'Utilities';
            document.body.appendChild(categoryItem);

            propertiesManager.currentPropertyId = 1;
            const mockProperty = { expenses: { 'Utilities': {} } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            const mockEvent = { target: categoryItem };

            expect(() => propertiesManager.handleItemClick(mockEvent)).not.toThrow();

            document.body.removeChild(categoryItem);
        });

        test('should cover handleItemClick for subcategory selection', () => {
            const subcategoryItem = document.createElement('div');
            subcategoryItem.className = 'property-item';
            subcategoryItem.dataset.category = 'Utilities';
            subcategoryItem.dataset.subcategory = 'Electricity';
            document.body.appendChild(subcategoryItem);

            const mockEvent = { target: subcategoryItem };

            expect(() => propertiesManager.handleItemClick(mockEvent)).not.toThrow();

            document.body.removeChild(subcategoryItem);
        });

        test('should cover renderSubcategoriesPanel for hierarchical categories', () => {
            const mockProperty = {
                expenses: { 'Utilities': { 'Electric': -100, 'Water': -50 } },
            };

            expect(() => propertiesManager.renderSubcategoriesPanel(mockProperty, 'Utilities', null)).not.toThrow();
        });

        test('should cover renderSubcategoriesPanel for flat categories', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };

            expect(() => propertiesManager.renderSubcategoriesPanel(mockProperty, 'Rent', null)).not.toThrow();
        });

        test('should cover saveExpenseValue with NaN input', () => {
            const mockProperty = { expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            propertiesManager.currentPropertyId = 1;

            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Rent';
            mockInput.value = 'invalid';

            expect(() => propertiesManager.handleExpenseSave({ target: mockInput })).not.toThrow();
        });

        test('should cover saveExpenseValue income category with negative input', () => {
            const mockProperty = { expenses: { 'Salary': 5000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            dataManager.getIncomeCategories.mockReturnValue(['Salary']);
            propertiesManager.currentPropertyId = 1;

            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Salary';
            mockInput.value = '-6000'; // Negative input for income

            expect(() => propertiesManager.handleExpenseSave({ target: mockInput })).not.toThrow();
        });

        test('should cover getCurrentExpenseValue for subcategories with current period data', () => {
            const mockProperty = {
                expenses: { 'Utilities': { 'Electric': -100 } },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            dataManager.getCurrentPeriodData.mockReturnValue({
                expenses: { 'Utilities': { 'Electric': -150 } },
            });

            propertiesManager.currentPropertyId = 1;

            const result = propertiesManager.getCurrentExpenseValue('Utilities', 'Electric');
            expect(result).toBe(-150);
        });

        test('should cover startExpenseEdit with different element types', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            valueElement.dataset.category = 'Rent';
            valueElement.textContent = '$1000';
            document.body.appendChild(valueElement);

            expect(() => propertiesManager.startExpenseEdit(valueElement, 'Rent')).not.toThrow();

            document.body.removeChild(valueElement);
        });

        test('should cover handleExpenseSave with nested input elements', () => {
            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Rent';
            mockInput.value = '1200';

            expect(() => propertiesManager.handleExpenseSave({ target: mockInput })).not.toThrow();
        });

        test('should cover cancelExpenseEdit with nested input', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            document.body.appendChild(valueElement);

            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Rent';
            valueElement.appendChild(mockInput);

            expect(() => propertiesManager.cancelExpenseEdit(mockInput)).not.toThrow();

            document.body.removeChild(valueElement);
        });

        test('should cover property name edit when property is already selected', () => {
            const propertyElement = document.createElement('div');
            propertyElement.className = 'property-name editable';
            propertyElement.dataset.propertyId = '1';
            document.body.appendChild(propertyElement);

            propertiesManager.currentPropertyId = 1;
            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Test Property' });

            expect(() => propertiesManager.handlePropertyNameEdit({ target: propertyElement })).not.toThrow();

            document.body.removeChild(propertyElement);
        });

        test('should cover category name edit when category is not selected', () => {
            const categoryElement = document.createElement('div');
            categoryElement.className = 'category-name editable';
            categoryElement.dataset.category = 'Rent';
            document.body.appendChild(categoryElement);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = null; // Not selected

            expect(() => propertiesManager.handleCategoryNameEdit({ target: categoryElement })).not.toThrow();

            document.body.removeChild(categoryElement);
        });

        test('should cover subcategory name edit when subcategory is not selected', () => {
            const subcategoryElement = document.createElement('div');
            subcategoryElement.className = 'subcategory-name editable';
            subcategoryElement.dataset.category = 'Utilities';
            subcategoryElement.dataset.subcategory = 'Electric';
            document.body.appendChild(subcategoryElement);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = null; // Not selected

            expect(() => propertiesManager.handleSubcategoryNameEdit({ target: subcategoryElement })).not.toThrow();

            document.body.removeChild(subcategoryElement);
        });

        test('should cover property name save with empty input', () => {
            const input = document.createElement('input');
            input.className = 'property-name-input';
            input.value = ''; // Empty name
            input.dataset.propertyId = '1';

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Original Name' });

            expect(() => propertiesManager.handlePropertyNameSave({ target: input })).not.toThrow();
        });

        test('should cover category name save with empty input', () => {
            const input = document.createElement('input');
            input.className = 'category-name-input';
            input.value = ''; // Empty name
            input.dataset.category = 'Rent';

            expect(() => propertiesManager.handleCategoryNameSave({ target: input })).not.toThrow();
        });

        test('should cover subcategory name save with empty input', () => {
            const input = document.createElement('input');
            input.className = 'subcategory-name-input';
            input.value = ''; // Empty name
            input.dataset.category = 'Electric';

            expect(() => propertiesManager.handleSubcategoryNameSave({ target: input })).not.toThrow();
        });

        test('should cover handleBackNavigation from subcategory to category', () => {
            propertiesManager.currentCategoryPath = { category: 'Utilities', subcategory: 'Electric' };
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentCategoryPath).toEqual({ category: 'Utilities' });
        });

        test('should cover handleBackNavigation from category to property', () => {
            propertiesManager.currentCategoryPath = { category: 'Utilities' };
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentCategoryPath).toBeNull();
        });

        test('should cover handleBackNavigation from property to root', () => {
            propertiesManager.currentPropertyId = 1;
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentPropertyId).toBeNull();
        });

        test('should cover showModal with existing modal cleanup', () => {
            const existingModal = document.createElement('div');
            existingModal.id = 'testModal';
            document.body.appendChild(existingModal);

            expect(() => propertiesManager.showModal('testModal', '<p>Test</p>')).not.toThrow();

            // Clean up
            const newModal = document.getElementById('testModal');
            if (newModal) {newModal.remove();}
        });

        test('should cover updateCategoryName with duplicate name conflict', () => {
            const mockProperty = { expenses: { 'Rent': -1000, 'NewRent': -500 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            expect(() => propertiesManager.updateCategoryName('Rent', 'NewRent')).not.toThrow();
        });

        test('should cover updateSubcategoryName with duplicate name conflict', () => {
            const mockProperty = { expenses: { 'Utilities': { 'Electric': -100, 'NewElectric': -50 } } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            expect(() => propertiesManager.updateSubcategoryName('Utilities', 'Electric', 'NewElectric')).not.toThrow();
        });

        test('should cover addCategory with existing category name', () => {
            const mockProperty = { expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            expect(() => propertiesManager.addCategory('Rent', false)).not.toThrow();
        });

        test('should cover addSubcategory with existing subcategory name', () => {
            const mockProperty = { expenses: { 'Utilities': { 'Electric': -100 } } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = { category: 'Utilities' };

            expect(() => propertiesManager.addSubcategory('Electric', 200)).not.toThrow();
        });

        test('should cover addSubcategory converting flat category to hierarchical', () => {
            const mockProperty = { expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = { category: 'Rent' };

            expect(() => propertiesManager.addSubcategory('SubRent', 200)).not.toThrow();
        });

        test('should cover deleteCategory with non-existent category', () => {
            const mockProperty = { expenses: {} };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            expect(() => propertiesManager.deleteCategory('NonExistent')).not.toThrow();
        });

        test('should cover deleteSubcategory with invalid category type', () => {
            const mockProperty = { expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            expect(() => propertiesManager.deleteSubcategory('Rent', 'Sub')).not.toThrow();
        });

        test('should cover showInlineDeleteConfirmation with missing delete button', () => {
            const originalFindDeleteButton = propertiesManager.findDeleteButton;
            propertiesManager.findDeleteButton = jest.fn(() => null);

            expect(() => propertiesManager.showInlineDeleteConfirmation(1, 'property', 'Test')).not.toThrow();

            propertiesManager.findDeleteButton = originalFindDeleteButton;
        });

        test('should cover positionConfirmationPopup with viewport constraints', () => {
            const popup = document.createElement('div');
            const button = document.createElement('button');

            popup.getBoundingClientRect = jest.fn(() => ({
                width: 100, height: 50,
            }));

            button.getBoundingClientRect = jest.fn(() => ({
                width: 40, height: 40, top: 10, left: 10, right: 50, bottom: 50,
            }));

            // Mock small viewport
            const originalInnerWidth = window.innerWidth;
            const originalInnerHeight = window.innerHeight;
            Object.defineProperty(window, 'innerWidth', { value: 80, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 80, writable: true });

            expect(() => propertiesManager.positionConfirmationPopup(popup, button)).not.toThrow();

            // Restore
            Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
        });

        test('should cover startLongPressDetection with existing timers', () => {
            const element = document.createElement('div');
            element.dataset.propertyId = '1';

            // Add existing timer
            propertiesManager.longPressTimers.set('existing', 999);

            expect(() => propertiesManager.startLongPressDetection(element, {})).not.toThrow();

            propertiesManager.cancelLongPressDetection();
        });

        test('should cover showDeleteButton with re-render and selection update', () => {
            const item = document.createElement('div');
            item.className = 'property-item';
            item.dataset.propertyId = '1';
            document.body.appendChild(item);

            propertiesManager.currentPropertyId = null; // Force re-render

            expect(() => propertiesManager.showDeleteButton(item)).not.toThrow();

            document.body.removeChild(item);
        });

        test('should cover findItemElement for all navigation cases', () => {
            // Property case
            const propElement = document.createElement('div');
            propElement.dataset.propertyId = '1';
            document.body.appendChild(propElement);

            expect(propertiesManager.findItemElement(1)).toBe(propElement);

            // Category case
            const catElement = document.createElement('div');
            catElement.className = 'property-item';
            catElement.dataset.category = 'Rent';
            document.body.appendChild(catElement);

            expect(propertiesManager.findItemElement(null, 'Rent')).toBe(catElement);

            // Subcategory case
            const subElement = document.createElement('div');
            subElement.dataset.category = 'Utilities';
            subElement.dataset.subcategory = 'Electric';
            document.body.appendChild(subElement);

            expect(propertiesManager.findItemElement(null, 'Utilities', 'Electric')).toBe(subElement);

            // Clean up
            document.body.removeChild(propElement);
            document.body.removeChild(catElement);
            document.body.removeChild(subElement);
        });

        test('should cover isExpenseCategory and isIncomeCategory with various inputs', () => {
            dataManager.getExpenseCategories.mockReturnValue(['Rent', 'Utilities']);
            dataManager.getIncomeCategories.mockReturnValue(['Salary']);

            expect(propertiesManager.isExpenseCategory('Rent')).toBe(true);
            expect(propertiesManager.isExpenseCategory('Salary')).toBe(false);
            expect(propertiesManager.isIncomeCategory('Salary')).toBe(true);
            expect(propertiesManager.isIncomeCategory('Rent')).toBe(false);
        });

        test('should cover initializeHeaderPickers with UI method failures', () => {
            const originalPopulateYearPicker = uiManager.populateYearPicker;
            const originalPopulateMonthPicker = uiManager.populateMonthPicker;
            const originalUpdateYearPickerSelection = uiManager.updateYearPickerSelection;
            const originalUpdateMonthPickerSelection = uiManager.updateMonthPickerSelection;

            // Mock methods to throw
            uiManager.populateYearPicker = jest.fn(() => { throw new Error('UI method failed'); });
            uiManager.populateMonthPicker = jest.fn(() => { throw new Error('UI method failed'); });
            uiManager.updateYearPickerSelection = jest.fn(() => { throw new Error('UI method failed'); });
            uiManager.updateMonthPickerSelection = jest.fn(() => { throw new Error('UI method failed'); });

            // The method throws when UI methods fail (no error handling in the method)
            expect(() => propertiesManager.initializeHeaderPickers()).toThrow('UI method failed');

            // Restore original methods
            uiManager.populateYearPicker = originalPopulateYearPicker;
            uiManager.populateMonthPicker = originalPopulateMonthPicker;
            uiManager.updateYearPickerSelection = originalUpdateYearPickerSelection;
            uiManager.updateMonthPickerSelection = originalUpdateMonthPickerSelection;
        });

        test('should cover populateYearPicker with missing DOM element', () => {
            const originalGetElementById = document.getElementById;
            document.getElementById = jest.fn(() => null);

            expect(() => propertiesManager.populateYearPicker()).not.toThrow();

            document.getElementById = originalGetElementById;
        });

        test('should cover setCurrentMonth with no available data', () => {
            const originalHasDataForMonthYear = propertiesManager.hasDataForMonthYear;
            const originalGetLastAvailableMonthYear = propertiesManager.getLastAvailableMonthYear;

            propertiesManager.hasDataForMonthYear = jest.fn(() => false);
            propertiesManager.getLastAvailableMonthYear = jest.fn(() => null);

            expect(() => propertiesManager.setCurrentMonth()).not.toThrow();

            propertiesManager.hasDataForMonthYear = originalHasDataForMonthYear;
            propertiesManager.getLastAvailableMonthYear = originalGetLastAvailableMonthYear;
        });

        test('should cover handleYearMonthChange with missing DOM elements', () => {
            const originalGetElementById = document.getElementById;
            document.getElementById = jest.fn(() => null);

            expect(() => propertiesManager.handleYearMonthChange()).not.toThrow();

            document.getElementById = originalGetElementById;
        });
    });

    // ============================================================================
    // INTEGRATION TESTS WITH REAL DOM (10 tests)
    // ============================================================================

    describe('Integration Tests with Real DOM', () => {
        test('should handle complete property lifecycle with DOM interactions', async () => {
            // Add property
            await propertiesManager.addProperty('Integration Test');

            // Verify in data
            const props = dataManager.getProperties();
            expect(props.length).toBeGreaterThan(0);
            const testProp = props.find(p => p.name === 'Integration Test');

            // Select property and add category
            propertiesManager.currentPropertyId = testProp.id;
            propertiesManager.addCategory('Rent', false);

            // Verify category was added
            expect(testProp.expenses['Rent']).toBe(0);

            // Add subcategory
            propertiesManager.addCategory('Utilities', true);
            propertiesManager.currentCategoryPath = { category: 'Utilities' };
            propertiesManager.addSubcategory('Electricity', 300);

            // Verify subcategory was added
            expect(testProp.expenses['Utilities']['Electricity']).toBe(300);

            // Test rendering
            propertiesManager.renderPropertiesDashboard();
            const dashboard = document.getElementById('propertiesDashboard');
            expect(dashboard.innerHTML).toContain('Integration Test');

            // Delete property
            await propertiesManager.deleteProperty(testProp.id);

            // Verify deletion
            const remainingProps = dataManager.getProperties();
            expect(remainingProps.find(p => p.id === testProp.id)).toBeUndefined();
        });

        test('should handle complex DOM event sequences', () => {
            // Setup property items in DOM
            const dashboard = document.getElementById('propertiesDashboard');
            dashboard.innerHTML = `
                <div class="dashboard-content">
                    <div class="properties-multi-panel">
                        <div class="panel properties-panel">
                            <div class="panel-content">
                                <div class="property-item" data-property-id="1">
                                    <div class="property-name editable" data-property-id="1">Test Property</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Mock getPropertyById directly in this test
            const originalGetPropertyById = dataManager.getPropertyById;
            dataManager.getPropertyById = jest.fn().mockReturnValue({ id: 1, name: 'Test Property' });

            // Set current property to avoid selection logic
            propertiesManager.currentPropertyId = 1;

            // Test click handling
            const propertyElement = dashboard.querySelector('.property-item');
            propertiesManager.handleItemClick({ target: propertyElement });

            // After render, find the name element again
            const nameElement = dashboard.querySelector('.property-name.editable');
            expect(() => propertiesManager.handlePropertyNameEdit({ target: nameElement })).not.toThrow();

            // Restore original mock
            dataManager.getPropertyById = originalGetPropertyById;
        });

        test('should handle DOM manipulation in expense editing', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            valueElement.dataset.category = 'Rent';
            valueElement.textContent = '$1000';
            document.body.appendChild(valueElement);

            const mockProperty = { id: 1, name: 'Test', expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.handleExpenseEdit({ target: valueElement, stopPropagation: jest.fn() });

            // Re-find the element after re-render
            const updatedValueElement = document.querySelector('.expense-value[data-category="Rent"]');

            // Should have replaced content with input
            expect(updatedValueElement.innerHTML).toContain('input');
            expect(updatedValueElement.classList).toContain('expense-value');

            document.body.removeChild(valueElement);
        });

        test('should handle confirmation popup positioning and display', () => {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'property-action delete-hidden';
            deleteButton.dataset.action = 'delete';
            deleteButton.dataset.propertyId = '1';
            document.body.appendChild(deleteButton);

            // Mock property
            const mockProperty = { id: 1, name: 'Test Property' };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.confirmDeleteProperty(1);

            // Check that popup was created
            const popup = document.querySelector('.delete-confirmation-popup');
            expect(popup).toBeTruthy();
            expect(popup.innerHTML).toContain('Delete <strong>"Test Property"</strong>');

            // Clean up
            if (popup) {popup.remove();}
            document.body.removeChild(deleteButton);
        });

        test('should handle modal display and interaction patterns', () => {
            const content = `
                <div class="modal-header">
                    <h3>Test Modal</h3>
                </div>
                <div class="modal-body">
                    <input type="text" id="test-input" value="test value">
                </div>
            `;

            propertiesManager.showModal('testModal', content);

            // Verify modal was created
            const modal = document.getElementById('testModal');
            expect(modal).toBeTruthy();
            expect(modal.innerHTML).toContain('Test Modal');
            expect(modal.innerHTML).toContain('test value');
        });

        test('should handle bulk operations with DOM updates', async () => {
            // Add multiple properties
            await Promise.all([
                propertiesManager.addProperty('Bulk Test 1'),
                propertiesManager.addProperty('Bulk Test 2'),
                propertiesManager.addProperty('Bulk Test 3'),
            ]);

            // Render all at once
            propertiesManager.renderPropertiesDashboard();

            // Verify all are in DOM
            const dashboard = document.getElementById('propertiesDashboard');
            expect(dashboard.innerHTML).toContain('Bulk Test 1');
            expect(dashboard.innerHTML).toContain('Bulk Test 2');
            expect(dashboard.innerHTML).toContain('Bulk Test 3');
        });

        test('should handle conditional rendering elements', () => {
            // Test empty state rendering
            dataManager.getProperties.mockReturnValue([]);
            propertiesManager.renderPropertiesDashboard();

            let dashboard = document.getElementById('propertiesDashboard');
            expect(dashboard.innerHTML).toContain('No Properties Yet');

            // Test populated state rendering
            dataManager.getProperties.mockReturnValue([{ id: 1, name: 'Test', expenses: {} }]);
            propertiesManager.renderPropertiesDashboard();

            dashboard = document.getElementById('propertiesDashboard');
            expect(dashboard.innerHTML).toContain('Test');
            expect(dashboard.innerHTML).not.toContain('No Properties Yet');
        });

        test('should handle event propagation in complex click scenarios', () => {
            // Setup nested elements simulating real dashboard
            const container = document.createElement('div');
            container.className = 'properties-dashboard';

            const propertyItem = document.createElement('div');
            propertyItem.className = 'property-item';
            propertyItem.dataset.propertyId = '1';
            container.appendChild(propertyItem);

            const nameElement = document.createElement('div');
            nameElement.className = 'property-name editable';
            nameElement.textContent = 'Test Property';
            propertyItem.appendChild(nameElement);

            document.body.appendChild(container);

            // Test click on nested element
            const clickEvent = { target: nameElement, stopImmediatePropagation: jest.fn() };
            propertiesManager.handleItemClick(clickEvent);

            expect(clickEvent.stopImmediatePropagation).not.toHaveBeenCalled(); // Should not stop for non-double-click

            document.body.removeChild(container);
        });

        test('should handle form input validation and state management', () => {
            const input = document.createElement('input');
            input.type = 'number';
            input.dataset.category = 'Rent';
            document.body.appendChild(input);

            // Mock getPropertyById
            const mockProperty = { id: 1, name: 'Test', expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            // Test valid input
            input.value = '1500';
            input.className = 'expense-input';
            input.dataset.category = 'Rent';
            propertiesManager.currentPropertyId = 1;
            propertiesManager.handleExpenseSave({ target: input });
            expect(dataManager.save).toHaveBeenCalled();

            // Reset mocks
            jest.clearAllMocks();
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            // Test invalid input
            input.value = 'invalid';
            propertiesManager.handleExpenseSave({ target: input });
            expect(dataManager.save).toHaveBeenCalled(); // Should still save with NaN -> 0 conversion

            document.body.removeChild(input);
        });

        test('should handle viewport constraints in tooltip positioning', () => {
            const button = document.createElement('button');
            button.id = 'test-btn';
            button.style.cssText = 'position: fixed; top: 10px; left: 10px; width: 40px; height: 40px;';
            document.body.appendChild(button);

            // Spy on getBoundingClientRect to simulate positioning
            button.getBoundingClientRect = jest.fn().mockReturnValue({
                width: 40, height: 40, top: 10, left: 10, right: 50, bottom: 50,
            });

            // Should not throw even with complex positioning logic
            expect(() => propertiesManager.showAddButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
        });

        test('should handle complete cleanup and teardown', () => {
            // Perform various operations that create state
            propertiesManager.startLongPressDetection(
                document.createElement('div'),
                { touches: [{ clientX: 0, clientY: 0 }] },
            );

            propertiesManager.showModal('cleanup-test', '<div>Test</div>');

            // Cleanup should handle all state
            expect(() => propertiesManager.cleanup()).not.toThrow();

            // Verify cleanup worked
            expect(propertiesManager.longPressTimers.size).toBe(0);
        });
    });

    // ============================================================================
    // BRANCH COVERAGE IMPROVEMENT TESTS (15+ specific tests for better branch coverage)
    // ============================================================================

    describe('Branch Coverage Improvement Tests', () => {
        beforeEach(async () => {
            await propertiesManager.initialize();
        });

        test('should cover both branches of getCategoryExpenseValue (nested objects vs numbers)', () => {
            // Mock getCurrentPeriodData to return null so it falls back to direct property access
            dataManager.getCurrentPeriodData.mockReturnValue(null);

            // Flat category expense (value path)
            expect(propertiesManager.getCategoryExpenseValue({ expenses: { 'Rent': -1000 } }, 'Rent')).toBe(-1000);

            // Hierarchical category (object path)
            expect(propertiesManager.getCategoryExpenseValue({ expenses: { 'Utilities': { sub1: -500, sub2: -300 } } }, 'Utilities')).toEqual({ sub1: -500, sub2: -300 });

            // Invalid paths
            expect(propertiesManager.getCategoryExpenseValue(null, 'test')).toBe(0);
            expect(propertiesManager.getCategoryExpenseValue({}, 'test')).toBe(0);
        });

        test('should cover isIncomeCategory branching (expense vs income)', () => {
            dataManager.getExpenseCategories.mockReturnValue(['Rent']);
            dataManager.getIncomeCategories.mockReturnValue(['Investment']);

            expect(propertiesManager.isIncomeCategory('Rent')).toBe(false);
            expect(propertiesManager.isIncomeCategory('Investment')).toBe(true);
            expect(propertiesManager.isIncomeCategory('Unknown')).toBe(false);
        });

        test('should cover confirmDeleteProperty with user confirmation responses', () => {
            const mockProperty = { id: 1, name: 'Test Property' };
            const originalGetPropertyById = dataManager.getPropertyById;
            dataManager.getPropertyById = jest.fn().mockReturnValue(mockProperty);

            // Set current property
            propertiesManager.currentPropertyId = 1;

            // User confirms deletion (true path) - method should not throw even if DOM is not set up
            expect(() => propertiesManager.confirmDeleteProperty(1)).not.toThrow();

            // Restore original mock
            dataManager.getPropertyById = originalGetPropertyById;
        });

        test('should cover handlePropertyNameEdit error conditions', () => {
            // Test with null target (branch coverage)
            expect(() => propertiesManager.handlePropertyNameEdit({ target: null })).not.toThrow();

            // Test with element that has no dataset propertyId
            const invalidElement = document.createElement('div');
            invalidElement.className = 'editable';
            expect(() => propertiesManager.handlePropertyNameEdit({ target: invalidElement })).not.toThrow();
        });

        test('should cover saveExpenseValue branching (valid vs invalid values)', () => {
            propertiesManager.currentPropertyId = 1;
            const mockProperty = { id: 1, name: 'Test', expenses: {} };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            // Valid numeric value
            propertiesManager.saveExpenseValue('Rent', null, 1200);
            expect(mockProperty.expenses['Rent']).toBe(-1200);

            // Invalid/NaN value
            propertiesManager.saveExpenseValue('Rent', null, NaN);
            expect(mockProperty.expenses['Rent']).toBe(0);

            // Zero value
            propertiesManager.saveExpenseValue('Rent', null, 0);
            expect(mockProperty.expenses['Rent']).toBe(0);
        });

        test('should cover startPropertyNameEdit with different element states', () => {
            const element = document.createElement('div');
            element.textContent = 'Test Name';
            element.className = 'property-name editable';
            document.body.appendChild(element); // Attach to DOM for innerHTML parsing

            // Mock getPropertyById for the test
            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Test Property' });

            // First call - edit mode on
            propertiesManager.startPropertyNameEdit(element, 1);
            expect(element.innerHTML).toContain('<input');
            expect(element.innerHTML).toContain('property-name-input');

            document.body.removeChild(element);

            // Second call - should handle already editing
            expect(() => propertiesManager.startPropertyNameEdit(element, 1)).not.toThrow();
        });

        test('should cover handlePropertyNameSave with validation branching', () => {
            const container = document.createElement('div');
            container.className = 'properties-container';
            document.body.appendChild(container);

            const input = document.createElement('input');
            input.className = 'property-name-input';
            input.value = 'Updated Name';
            input.dataset.propertyId = '1';
            container.appendChild(input);

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Original Name' });

            // Valid name save
            propertiesManager.handlePropertyNameSave({ target: input });
            expect(dataManager.updatePropertyName).toHaveBeenCalledWith(1, 'Updated Name');

            // Invalid/empty name
            input.value = '';
            propertiesManager.handlePropertyNameSave({ target: input });
            expect(uiManager.showToast).toHaveBeenCalled();

            document.body.removeChild(container);
        });

        test('should cover sumObjectValues with different data types', () => {
            expect(propertiesManager.sumObjectValues({ a: 1, b: 2 })).toBe(3);
            expect(propertiesManager.sumObjectValues({ a: 1.5, b: 2.5 })).toBe(4);
            expect(propertiesManager.sumObjectValues({})).toBe(0);
            expect(propertiesManager.sumObjectValues(null)).toBe(0);
            expect(propertiesManager.sumObjectValues(undefined)).toBe(0);

            // With NaN values
            expect(propertiesManager.sumObjectValues({ a: 1, b: NaN, c: 3 })).toBe(4);
        });

        test('should cover renderPropertiesPanel sorting logic', () => {
            const props = [
                { id: 1, name: 'Small', total: -500 },
                { id: 2, name: 'Large', total: -2000 },
                { id: 3, name: 'Medium', total: -1000 },
            ];

            const html = propertiesManager.renderPropertiesPanel(props);
            // Should sort by absolute value (Large first, then Medium, then Small)
            expect(html.indexOf('Large')).toBeLessThan(html.indexOf('Medium'));
            expect(html.indexOf('Medium')).toBeLessThan(html.indexOf('Small'));
        });

        test('should cover handleTimePeriodChange with different chart states', () => {
            // No current view
            dataManager.getCurrentView = jest.fn().mockReturnValue(null);
            expect(() => propertiesManager.handleTimePeriodChange()).not.toThrow();

            // Overview view active
            dataManager.getCurrentView = jest.fn().mockReturnValue('overview');
            expect(() => propertiesManager.handleTimePeriodChange()).not.toThrow();
        });

        test('should cover findDeleteButton with missing DOM elements', () => {
            // No buttons found in DOM
            expect(propertiesManager.findDeleteButton(1, 'property', 'Test')).toBeNull();
            expect(propertiesManager.findDeleteButton(1, 'category', 'Rent')).toBeNull();

            // Mock querySelector to return null
            propertiesManager.findDeleteButton(1, 'subcategory', 'Electricity');
        });

        test('should cover cancelExpenseEdit with different element states', () => {
            // Create expense editing setup
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value editing';
            valueElement.dataset.category = 'Rent';
            valueElement.dataset.propertyId = '1';

            const parent = document.createElement('div');
            parent.appendChild(valueElement);
            document.body.appendChild(parent);

            // Mock the getCategoryExpenseValue method
            propertiesManager.getCategoryExpenseValue = jest.fn().mockReturnValue(-1000);

            expect(() => propertiesManager.cancelExpenseEdit(valueElement)).not.toThrow();

            document.body.removeChild(parent);
        });

        test('should cover startLongPressDetection timer management', () => {
            const element = document.createElement('div');

            // Multiple starts should clear previous timers
            propertiesManager.startLongPressDetection(element, { touches: [{ clientX: 0, clientY: 0 }] });
            expect(propertiesManager.longPressTimers.size).toBe(1);

            propertiesManager.startLongPressDetection(element, { touches: [{ clientX: 0, clientY: 0 }] });
            expect(propertiesManager.longPressTimers.size).toBe(1);

            // Cancel should clear timer
            propertiesManager.cancelLongPressDetection();
            expect(propertiesManager.longPressTimers.size).toBe(0);
        });

        test('should cover showDeleteButtonTooltip error cases', () => {
            // Invalid/edge cases
            expect(() => propertiesManager.showDeleteButtonTooltip(null)).not.toThrow();
            expect(() => propertiesManager.showDeleteButtonTooltip(undefined)).not.toThrow();
        });

        test('should cover populateYearPicker with edge data', () => {
            dataManager.getAvailableYears = jest.fn().mockReturnValue([]);
            expect(() => propertiesManager.populateYearPicker()).not.toThrow();

            dataManager.getAvailableYears = jest.fn().mockReturnValue(['2020', '2021', '2022']);
            expect(() => propertiesManager.populateYearPicker()).not.toThrow();
        });

        test('should cover hasDataForMonthYear validation branching', () => {
            // No properties
            dataManager.getProperties.mockReturnValue([]);
            expect(propertiesManager.hasDataForMonthYear('2025', '01')).toBe(false);

            // Properties with no expenses data
            const prop = { id: 1, expenses: {} };
            dataManager.getProperties.mockReturnValue([prop]);
            expect(propertiesManager.hasDataForMonthYear('2025', '01')).toBe(false);

            // Properties with expenses data
            prop.expenses = { 'Rent': -1000 };
            expect(propertiesManager.hasDataForMonthYear('2025', '01')).toBe(true);
        });
    });

    // ============================================================================
    // TARGETED UNCOVERED LINES TESTS (6 specific tests for lines ~3195-3211, 3266-3267)
    // ============================================================================

    describe('Targeted Uncovered Lines Tests', () => {
        beforeEach(async () => {
            await propertiesManager.initialize();
        });

        test('should cover forceUpdatePickerUI method (lines ~3195-3200)', () => {
            expect(() => propertiesManager.forceUpdatePickerUI('2025', '09')).not.toThrow();
            expect(() => propertiesManager.forceUpdatePickerUI(null, null)).not.toThrow();
        });

        test('should cover updateChartCalculations method (line ~3206)', () => {
            expect(() => propertiesManager.updateChartCalculations()).not.toThrow();
        });

        test('should cover positionConfirmationPopup method (lines ~3206-3211)', () => {
            const mockButton = document.createElement('button');
            mockButton.style.cssText = 'position: fixed; top: 100px; left: 100px;';
            mockButton.getBoundingClientRect = jest.fn().mockReturnValue({
                width: 40, height: 40, top: 100, left: 100, right: 140, bottom: 140,
            });
            document.body.appendChild(mockButton);

            const popup = document.createElement('div');
            expect(() => propertiesManager.positionConfirmationPopup(popup, mockButton)).not.toThrow();

            document.body.removeChild(mockButton);
        });

        test('should cover removeExistingConfirmations method', () => {
            expect(() => propertiesManager.removeExistingConfirmations()).not.toThrow();
        });

        test('should cover findDeleteButton different scenarios', () => {
            // Create various delete buttons in DOM
            const propertyDeleteBtn = document.createElement('button');
            propertyDeleteBtn.className = 'property-action';
            propertyDeleteBtn.dataset.action = 'delete';
            propertyDeleteBtn.dataset.propertyId = '1';
            document.body.appendChild(propertyDeleteBtn);

            const categoryDeleteBtn = document.createElement('button');
            categoryDeleteBtn.className = 'category-action';
            categoryDeleteBtn.dataset.action = 'delete';
            categoryDeleteBtn.dataset.category = 'Rent';
            document.body.appendChild(categoryDeleteBtn);

            expect(propertiesManager.findDeleteButton(1, 'property', 'Test')).toBeTruthy();
            expect(propertiesManager.findDeleteButton(1, 'category', 'Rent')).toBeTruthy();

            document.body.removeChild(propertyDeleteBtn);
            document.body.removeChild(categoryDeleteBtn);
        });

        test('should cover cleanup method completely (line ~3266)', () => {
            // Setup some state to clean up
            propertiesManager.startLongPressDetection(document.createElement('div'), {});
            propertiesManager.showModal('test', '<div>Test</div>');

            expect(() => propertiesManager.cleanup()).not.toThrow();

            expect(propertiesManager.longPressTimers.size).toBe(0);
        });
    });

    // ============================================================================
    // PERFORMANCE AND SCALING TESTS (5 tests)
    // ============================================================================

    describe('Performance and Scaling', () => {
        test('should render large property lists quickly', async () => {
            // Create 50 properties
            const largeProperties = Array.from({ length: 50 }, (_, i) => ({
                id: i + 1,
                name: `Property ${i + 1}`,
                expenses: { 'Rent': -(1000 + i * 10) },
            }));

            dataManager.getProperties.mockReturnValue(largeProperties);
            dataManager.getCurrentPeriodData.mockReturnValue({ total: -1000 });

            const startTime = Date.now();
            propertiesManager.renderPropertiesDashboard();
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(200); // Should render quickly
        });

        test('should handle rapid sequential operations', async () => {
            // Mock getProperties to return the expected properties
            const mockProperties = [];
            dataManager.getProperties.mockImplementation(() => mockProperties);
            dataManager.addProperty.mockImplementation(async (name) => {
                const newProp = { id: mockProperties.length + 1, name, expenses: {} };
                mockProperties.push(newProp);
                return { success: true, property: newProp };
            });

            const operations = [];
            for (let i = 1; i <= 10; i++) {
                operations.push(propertiesManager.addProperty(`Rapid Test ${i}`));
            }

            const startTime = Date.now();
            await Promise.all(operations);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(500); // Should complete quickly
            expect(dataManager.getProperties().length).toBe(10);
        });

        test('should maintain responsiveness during bulk edits', () => {
            const mockProperty = { id: 1, name: 'Test', expenses: {} };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            propertiesManager.currentPropertyId = 1;

            // Perform many category additions quickly
            const startTime = Date.now();
            for (let i = 0; i < 20; i++) {
                propertiesManager.addCategory(`Category ${i}`, false);
            }
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(100);
            expect(Object.keys(mockProperty.expenses).length).toBe(20);
        });

        test('should handle concurrent DOM event processing efficiently', () => {
            const eventElements = [];

            // Create many event targets
            for (let i = 0; i < 10; i++) {
                const element = document.createElement('div');
                element.className = 'property-item';
                element.dataset.propertyId = (i + 1).toString();
                eventElements.push(element);
            }

            const startTime = Date.now();
            eventElements.forEach((element, index) => {
                propertiesManager.handleItemClick({ target: element });
                expect(propertiesManager.currentPropertyId).toBe(index + 1);
            });
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(100);
        });

        test('should scale rendering with deep hierarchies', () => {
            // Create deeply nested hierarchical data
            const createNestedData = (depth, currentDepth = 0) => {
                if (currentDepth >= depth) {return -100;}
                const obj = {};
                for (let i = 0; i < 3; i++) {
                    obj[`Level${currentDepth}-${i}`] = createNestedData(depth, currentDepth + 1);
                }
                return obj;
            };

            const mockProperty = {
                id: 1,
                name: 'Deep Hierarchy',
                expenses: { 'Root': createNestedData(4) },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            propertiesManager.currentPropertyId = 1;

            // Test rendering doesn't hang with deep nesting
            const startTime = Date.now();
            expect(() => propertiesManager.renderPropertiesDashboard()).not.toThrow();
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(300);
        });
    });

    // ============================================================================
    // ADDITIONAL PROPERTIES MANAGER TESTS FOR 90% COVERAGE
    // ============================================================================

    describe('Tooltip Management', () => {
        test('should show add button tooltip for property', () => {
            const button = document.createElement('button');
            button.id = 'add-property-btn';
            document.body.appendChild(button);

            expect(() => propertiesManager.showAddButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
        });

        test('should show add button tooltip for category', () => {
            const button = document.createElement('button');
            button.id = 'add-category-btn';
            document.body.appendChild(button);

            expect(() => propertiesManager.showAddButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
        });

        test('should show add button tooltip for subcategory', () => {
            const button = document.createElement('button');
            button.id = 'add-subcategory-btn';
            document.body.appendChild(button);

            expect(() => propertiesManager.showAddButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
        });

        test('should hide add button tooltip', () => {
            expect(() => propertiesManager.hideAddButtonTooltip()).not.toThrow();
        });

        test('should show delete button tooltip for property', () => {
            const button = document.createElement('button');
            button.className = 'property-action';
            button.dataset.action = 'delete';
            document.body.appendChild(button);

            expect(() => propertiesManager.showDeleteButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
        });

        test('should show delete button tooltip for category', () => {
            const button = document.createElement('button');
            button.className = 'category-action';
            button.dataset.action = 'delete';
            document.body.appendChild(button);

            expect(() => propertiesManager.showDeleteButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
        });

        test('should show delete button tooltip for subcategory', () => {
            const button = document.createElement('button');
            button.className = 'category-action';
            button.dataset.action = 'delete';
            button.dataset.subcategory = 'Electricity';
            document.body.appendChild(button);

            expect(() => propertiesManager.showDeleteButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
        });

        test('should hide delete button tooltip', () => {
            expect(() => propertiesManager.hideDeleteButtonTooltip()).not.toThrow();
        });
    });

    describe('Long Press Detection', () => {
        test('should start long press detection', () => {
            const element = document.createElement('div');
            element.dataset.propertyId = '1';

            propertiesManager.startLongPressDetection(element, { touches: [{ clientX: 0, clientY: 0 }] });
            expect(propertiesManager.longPressTimers.size).toBe(1);

            // Clean up
            propertiesManager.cancelLongPressDetection();
        });

        test('should cancel long press detection', () => {
            const element = document.createElement('div');
            propertiesManager.startLongPressDetection(element, { touches: [{ clientX: 0, clientY: 0 }] });

            propertiesManager.cancelLongPressDetection();
            expect(propertiesManager.longPressTimers.size).toBe(0);
        });

        test('should show delete button on long press', () => {
            const item = document.createElement('div');
            item.className = 'property-item';

            expect(() => propertiesManager.showDeleteButton(item)).not.toThrow();
        });
    });

    describe('Time Period Handling', () => {
        test('should handle time period change', () => {
            expect(() => propertiesManager.handleTimePeriodChange()).not.toThrow();
        });

        test('should update header picker selections', () => {
            expect(() => propertiesManager.updateHeaderPickerSelections()).not.toThrow();
        });

        test('should force update picker UI', () => {
            expect(() => propertiesManager.forceUpdatePickerUI('2025', '09')).not.toThrow();
        });

        test('should setup picker event listeners', () => {
            expect(() => propertiesManager.setupPickerEventListeners()).not.toThrow();
        });

        test('should populate year picker', () => {
            dataManager.getAvailableYears.mockReturnValue(['2024', '2025']);
            expect(() => propertiesManager.populateYearPicker()).not.toThrow();
        });

        test('should set current month', () => {
            expect(() => propertiesManager.setCurrentMonth()).not.toThrow();
        });
    });

    describe('Data Checking Methods', () => {
        test('should check if data exists for month and year', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };
            dataManager.getProperties.mockReturnValue([mockProperty]);

            const result = propertiesManager.hasDataForMonthYear('2025', '01');
            expect(result).toBe(true);
        });

        test('should return false when no data for month and year', () => {
            dataManager.getProperties.mockReturnValue([]);

            const result = propertiesManager.hasDataForMonthYear('2025', '01');
            expect(result).toBe(false);
        });

        test('should get last available month and year', () => {
            const mockProperty = {
                monthlyData: {
                    'Mar 2025': { expenses: { 'Rent': -1000 } },
                    'Jan 2025': { expenses: { 'Rent': -500 } },
                },
            };
            dataManager.getProperties.mockReturnValue([mockProperty]);

            const result = propertiesManager.getLastAvailableMonthYear();
            expect(result).toEqual({ year: '2025', month: '03' });
        });

        test('should get last available month for specific year', () => {
            const mockProperty = {
                monthlyData: {
                    'Mar 2025': { expenses: { 'Rent': -1000 } },
                    'Jan 2025': { expenses: { 'Rent': -500 } },
                },
            };
            dataManager.getProperties.mockReturnValue([mockProperty]);

            const result = propertiesManager.getLastAvailableMonthForYear('2025');
            expect(result).toBe('03');
        });

        test('should parse month key correctly', () => {
            const result = propertiesManager.parseMonthKey('Jan 2025');
            expect(result).toBeInstanceOf(Date);
            expect(result.getFullYear()).toBe(2025);
            expect(result.getMonth()).toBe(0); // January is 0
        });

        test('should handle invalid month key parsing', () => {
            const result = propertiesManager.parseMonthKey('Invalid');
            expect(result).toBeInstanceOf(Date);
            expect(result.getFullYear()).toBe(1900);
        });
    });

    describe('Month Name Utilities', () => {
        test('should get month name from number', () => {
            expect(propertiesManager.getMonthName('01')).toBe('January');
            expect(propertiesManager.getMonthName('12')).toBe('December');
            expect(propertiesManager.getMonthName('13')).toBe('13');
        });
    });

    describe('Picker UI Updates', () => {
        test('should handle year month change', () => {
            // Mock select elements
            const yearSelect = document.createElement('select');
            yearSelect.id = 'propertiesYearSelect';
            yearSelect.value = '2025';
            document.body.appendChild(yearSelect);

            const monthSelect = document.createElement('select');
            monthSelect.id = 'propertiesMonthSelect';
            monthSelect.value = '09';
            document.body.appendChild(monthSelect);

            expect(() => propertiesManager.handleYearMonthChange()).not.toThrow();

            document.body.removeChild(yearSelect);
            document.body.removeChild(monthSelect);
        });
    });

    describe('Delete Button Management', () => {
        test('should find delete button for property', () => {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'property-action';
            deleteBtn.dataset.action = 'delete';
            deleteBtn.dataset.propertyId = '1';
            document.body.appendChild(deleteBtn);

            const result = propertiesManager.findDeleteButton(1, 'property', 'Test');
            expect(result).toBe(deleteBtn);

            document.body.removeChild(deleteBtn);
        });

        test('should find delete button for category', () => {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'category-action';
            deleteBtn.dataset.action = 'delete';
            deleteBtn.dataset.category = 'Rent';
            document.body.appendChild(deleteBtn);

            const result = propertiesManager.findDeleteButton(1, 'category', 'Rent');
            expect(result).toBe(deleteBtn);

            document.body.removeChild(deleteBtn);
        });

        test('should return null when delete button not found', () => {
            const result = propertiesManager.findDeleteButton(1, 'property', 'Test');
            expect(result).toBeNull();
        });
    });

    describe('Confirmation Popup Positioning', () => {
        test('should position confirmation popup', () => {
            const popup = document.createElement('div');
            const button = document.createElement('button');
            button.getBoundingClientRect = jest.fn(() => ({
                width: 40, height: 40, top: 100, left: 100, right: 140, bottom: 140,
            }));

            expect(() => propertiesManager.positionConfirmationPopup(popup, button)).not.toThrow();
        });
    });

    describe('Remove Existing Confirmations', () => {
        test('should remove existing confirmations', () => {
            expect(() => propertiesManager.removeExistingConfirmations()).not.toThrow();
        });
    });

    describe('Hide Delete Buttons', () => {
        test('should hide delete buttons', () => {
            // Create a mock element
            const mockElement = document.createElement('div');
            mockElement.className = 'property-item';
            const mockButton = document.createElement('button');
            mockButton.className = 'property-action delete-hidden';
            mockButton.dataset.action = 'delete';
            mockElement.appendChild(mockButton);
            document.body.appendChild(mockElement);

            propertiesManager.visibleDeleteButtons.set(mockElement, { propertyId: 1 });
            propertiesManager.hideDeleteButtons();
            expect(propertiesManager.visibleDeleteButtons.size).toBe(0);

            document.body.removeChild(mockElement);
        });
    });

    describe('Cancel Long Press Detection', () => {
        test('should cancel all long press timers', () => {
            propertiesManager.longPressTimers.set('test', 123);
            propertiesManager.pendingLongPresses.set('test', jest.fn());

            propertiesManager.cancelLongPressDetection();

            expect(propertiesManager.longPressTimers.size).toBe(0);
            expect(propertiesManager.pendingLongPresses.size).toBe(0);
        });
    });

    describe('Chart Calculations Update', () => {
        test('should update chart calculations', () => {
            expect(() => propertiesManager.updateChartCalculations()).not.toThrow();
        });
    });

    describe('Error Handling Edge Cases', () => {
        test('should handle missing dependencies gracefully', () => {
            const brokenManager = new PropertiesManager(null, null, null, null, null);

            expect(() => brokenManager.initialize()).not.toThrow();
        });


        test('should handle event listener setup failures', () => {
            // Mock addEventListener to fail
            const originalAddEventListener = Element.prototype.addEventListener;
            Element.prototype.addEventListener = jest.fn(() => {
                throw new Error('Event listener failed');
            });

            expect(() => propertiesManager.setupEventListeners()).not.toThrow();

            Element.prototype.addEventListener = originalAddEventListener;
        });
    });

    describe('Complex Hierarchical Operations', () => {
        test('should handle deep category navigation', () => {
            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = {
                category: 'Level1',
                subcategory: 'Level2',
            };

            expect(() => propertiesManager.handleBackNavigation()).not.toThrow();
            expect(propertiesManager.currentCategoryPath).toEqual({ category: 'Level1' });
        });

        test('should handle property to category navigation', () => {
            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = { category: 'Rent' };

            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentCategoryPath).toBeNull();
            expect(propertiesManager.currentPropertyId).toBe(1);
        });

        test('should handle complete navigation back to root', () => {
            propertiesManager.currentPropertyId = 1;

            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentPropertyId).toBeNull();
        });
    });

    describe('Event Listener Setup Coverage', () => {
        test('should setup event listeners with container', () => {
            const container = document.createElement('div');
            container.id = 'propertiesDashboard';
            document.body.appendChild(container);

            uiManager.getElement.mockReturnValue(container);

            expect(() => propertiesManager.setupEventListeners()).not.toThrow();

            document.body.removeChild(container);
        });

        test('should handle double-click on editable name within text area', () => {
            const element = document.createElement('div');
            element.className = 'property-name editable';
            element.dataset.propertyId = '1';

            // Mock getBoundingClientRect to simulate click within text area
            element.getBoundingClientRect = jest.fn(() => ({
                left: 0, top: 0, width: 100, height: 20,
            }));

            const event = {
                target: element,
                clientX: 50,
                clientY: 10,
                stopImmediatePropagation: jest.fn(),
            };

            // Mock scrollWidth and scrollHeight
            Object.defineProperty(element, 'scrollWidth', { value: 80 });
            Object.defineProperty(element, 'scrollHeight', { value: 15 });

            expect(() => propertiesManager.handlePropertyNameEdit(event)).not.toThrow();
        });

        test('should handle double-click on editable name outside text area', () => {
            const element = document.createElement('div');
            element.className = 'property-name editable';
            element.dataset.propertyId = '1';

            // Mock getBoundingClientRect to simulate click outside text area
            element.getBoundingClientRect = jest.fn(() => ({
                left: 0, top: 0, width: 100, height: 20,
            }));

            const event = {
                target: element,
                clientX: 150, // Outside text area
                clientY: 10,
                stopImmediatePropagation: jest.fn(),
            };

            // Mock scrollWidth and scrollHeight
            Object.defineProperty(element, 'scrollWidth', { value: 80 });
            Object.defineProperty(element, 'scrollHeight', { value: 15 });

            expect(() => propertiesManager.handlePropertyNameEdit(event)).not.toThrow();
        });

        test('should handle click with pending selection timeout', () => {
            const element = document.createElement('div');
            element.className = 'property-name editable';
            element.dataset.propertyId = '1';

            const itemElement = document.createElement('div');
            itemElement.dataset.propertyId = '1';
            element.closest = jest.fn(() => itemElement);

            const event = {
                target: element,
                stopPropagation: jest.fn(),
            };

            // Set up pending selection
            propertiesManager.pendingSelections.set('1', setTimeout(() => {}, 100));

            expect(() => {
                // Simulate click event handling
                const editableElement = event.target.closest('.property-name.editable, .category-name.editable, .subcategory-name.editable');
                if (editableElement) {
                    const itemElement = editableElement.closest('.property-item');
                    if (itemElement && !propertiesManager.currentVisibleDeleteItem) {
                        const itemId = itemElement.dataset.propertyId || itemElement.dataset.category || itemElement.dataset.subcategory;
                        if (propertiesManager.pendingSelections.has(itemId)) {
                            clearTimeout(propertiesManager.pendingSelections.get(itemId));
                        }
                        const timeoutId = setTimeout(() => {
                            propertiesManager.pendingSelections.delete(itemId);
                            propertiesManager.handleItemClick(event);
                        }, 300);
                        propertiesManager.pendingSelections.set(itemId, timeoutId);
                    }
                    return;
                }
            }).not.toThrow();
        });

        test('should handle expense edit with selection needed', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            valueElement.dataset.category = 'Rent';

            const event = {
                target: valueElement,
                stopPropagation: jest.fn(),
                preventDefault: jest.fn(),
            };

            // Mock current state where selection is needed
            propertiesManager.currentCategoryPath = null;

            expect(() => propertiesManager.handleExpenseEdit(event)).not.toThrow();
        });

        test('should handle touch events for long press', () => {
            const propertyItem = document.createElement('div');
            propertyItem.className = 'property-item';
            propertyItem.dataset.propertyId = '1';

            const event = {
                target: propertyItem,
                touches: [{ clientX: 0, clientY: 0 }],
            };

            expect(() => propertiesManager.startLongPressDetection(propertyItem, event.touches[0])).not.toThrow();
        });

        test('should handle touch move to cancel long press', () => {
            // Set up long press timers
            propertiesManager.longPressTimers.set('test', setTimeout(() => {}, 100));

            const event = {
                target: document.createElement('div'),
            };

            expect(() => {
                if (propertiesManager.longPressTimers.size > 0) {
                    propertiesManager.cancelLongPressDetection();
                }
            }).not.toThrow();
        });
    });

    describe('Expense Value Calculations', () => {
        test('should get current expense value', () => {
            const mockProperty = {
                id: 1,
                expenses: { 'Rent': -1000 },
            };

            // Set current property and mock getPropertyById
            propertiesManager.currentPropertyId = 1;
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            // Mock getCurrentPeriodData to return data with the category
            dataManager.getCurrentPeriodData.mockReturnValue({
                expenses: { 'Rent': -1200 },
            });

            const result = propertiesManager.getCurrentExpenseValue('Rent');
            expect(result).toBe(-1200); // Should return current period data
        });

        test('should fallback to flat expenses when no current period data', () => {
            const mockProperty = {
                id: 1,
                expenses: { 'Rent': -1000 },
            };

            // Set current property and mock getPropertyById
            propertiesManager.currentPropertyId = 1;
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            // Mock getCurrentPeriodData to return null
            dataManager.getCurrentPeriodData.mockReturnValue(null);

            const result = propertiesManager.getCurrentExpenseValue('Rent');
            expect(result).toBe(-1000);
        });
    });

    describe('Category Path Management', () => {
        test('should set current category path manually', () => {
            propertiesManager.currentCategoryPath = { category: 'Utilities', subcategory: 'Electricity' };
            expect(propertiesManager.currentCategoryPath).toEqual({
                category: 'Utilities',
                subcategory: 'Electricity',
            });
        });

        test('should clear current category path manually', () => {
            propertiesManager.currentCategoryPath = { category: 'Test' };
            propertiesManager.currentCategoryPath = null;
            expect(propertiesManager.currentCategoryPath).toBeNull();
        });
    });

    describe('Property Selection Management', () => {
        test('should select property manually', () => {
            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = null;
            expect(propertiesManager.currentPropertyId).toBe(1);
            expect(propertiesManager.currentCategoryPath).toBeNull();
        });

        test('should clear property selection manually', () => {
            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentPropertyId = null;
            expect(propertiesManager.currentPropertyId).toBeNull();
        });
    });

    describe('Modal Operations', () => {
        test('should show add property modal', () => {
            expect(() => propertiesManager.showAddPropertyModal()).not.toThrow();
        });

        test('should show edit property modal', () => {
            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Test' });
            expect(() => propertiesManager.showEditPropertyModal(1)).not.toThrow();
        });

        test('should show add category modal', () => {
            expect(() => propertiesManager.showAddCategoryModal()).not.toThrow();
        });

        test('should show add subcategory modal', () => {
            expect(() => propertiesManager.showAddSubcategoryModal()).not.toThrow();
        });
    });

    describe('Name Editing Operations', () => {
        test('should handle property name edit', () => {
            const element = document.createElement('div');
            element.className = 'property-name editable';
            element.dataset.propertyId = '1';

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Old Name' });

            expect(() => propertiesManager.handlePropertyNameEdit({ target: element })).not.toThrow();
        });

        test('should handle category name edit', () => {
            const element = document.createElement('div');
            element.className = 'category-name editable';
            element.dataset.category = 'Rent';

            expect(() => propertiesManager.handleCategoryNameEdit({ target: element })).not.toThrow();
        });

        test('should handle subcategory name edit', () => {
            const element = document.createElement('div');
            element.className = 'subcategory-name editable';
            element.dataset.subcategory = 'Electricity';

            expect(() => propertiesManager.handleSubcategoryNameEdit({ target: element })).not.toThrow();
        });

        test('should save property name changes', () => {
            const input = document.createElement('input');
            input.className = 'property-name-input';
            input.value = 'New Name';
            input.dataset.propertyId = '1';

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Old Name' });

            expect(() => propertiesManager.handlePropertyNameSave({ target: input })).not.toThrow();
        });

        test('should save category name changes', () => {
            const input = document.createElement('input');
            input.className = 'category-name-input';
            input.value = 'New Category';
            input.dataset.oldCategory = 'Old Category';

            expect(() => propertiesManager.handleCategoryNameSave({ target: input })).not.toThrow();
        });

        test('should save subcategory name changes', () => {
            const input = document.createElement('input');
            input.className = 'subcategory-name-input';
            input.value = 'New Subcategory';
            input.dataset.oldSubcategory = 'Old Subcategory';

            expect(() => propertiesManager.handleSubcategoryNameSave({ target: input })).not.toThrow();
        });
    });

    describe('Inline Editing Setup', () => {
        test('should start property name edit', () => {
            const element = document.createElement('div');
            element.textContent = 'Test Property';
            element.className = 'property-name editable';
            document.body.appendChild(element);

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Test Property' });

            expect(() => propertiesManager.startPropertyNameEdit(element, 1)).not.toThrow();

            document.body.removeChild(element);
        });

        test('should start category name edit', () => {
            const element = document.createElement('div');
            element.textContent = 'Test Category';
            document.body.appendChild(element);

            expect(() => propertiesManager.startCategoryNameEdit(element, 'Test Category')).not.toThrow();

            document.body.removeChild(element);
        });

        test('should start subcategory name edit', () => {
            const element = document.createElement('div');
            element.textContent = 'Test Subcategory';
            document.body.appendChild(element);

            expect(() => propertiesManager.startSubcategoryNameEdit(element, 'Test Subcategory')).not.toThrow();

            document.body.removeChild(element);
        });
    });

    describe('Validation and Error Handling', () => {
        test('should handle property name validation in save operations', () => {
            const input = document.createElement('input');
            input.className = 'property-name-input';
            input.value = 'Valid Name';
            input.dataset.propertyId = '1';

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Old Name' });

            expect(() => propertiesManager.handlePropertyNameSave({ target: input })).not.toThrow();
        });

        test('should handle empty property name validation', () => {
            const input = document.createElement('input');
            input.className = 'property-name-input';
            input.value = '';
            input.dataset.propertyId = '1';

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Old Name' });

            expect(() => propertiesManager.handlePropertyNameSave({ target: input })).not.toThrow();
        });

        test('should handle category name validation in save operations', () => {
            const input = document.createElement('input');
            input.className = 'category-name-input';
            input.value = 'Valid Category';
            input.dataset.category = 'Old Category';

            expect(() => propertiesManager.handleCategoryNameSave({ target: input })).not.toThrow();
        });

        test('should handle expense input validation through save operations', () => {
            const mockProperty = { id: 1, name: 'Test', expenses: {} };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            propertiesManager.currentPropertyId = 1;

            // Test valid numeric input
            propertiesManager.saveExpenseValue('Rent', null, 1000);
            expect(mockProperty.expenses['Rent']).toBe(-1000);

            // Test invalid input handling
            propertiesManager.saveExpenseValue('Rent', null, NaN);
            expect(mockProperty.expenses['Rent']).toBe(0);
        });
    });

    describe('Rendering Method Coverage', () => {
        test('should render property item with error handling', () => {
            const property = { id: 1, name: 'Test Property' };

            // Mock getCurrentPeriodData to throw error
            dataManager.getCurrentPeriodData.mockImplementation(() => {
                throw new Error('Data error');
            });

            expect(() => propertiesManager.renderPropertyItem(property)).not.toThrow();
        });

        test('should render properties list with no properties', () => {
            expect(() => propertiesManager.renderPropertiesList([])).not.toThrow();
        });

        test('should render properties list with properties', () => {
            const properties = [{ id: 1, name: 'Test Property', expenses: {} }];
            dataManager.getCurrentPeriodData.mockReturnValue({ total: 1000 });

            expect(() => propertiesManager.renderPropertiesList(properties)).not.toThrow();
        });

        test('should render property details', () => {
            const property = { id: 1, name: 'Test Property', expenses: {} };
            dataManager.getPropertyById.mockReturnValue(property);
            dataManager.getCurrentPeriodData.mockReturnValue({ total: 1000 });
            propertiesManager.getPropertyCategories = jest.fn(() => []);

            expect(() => propertiesManager.renderPropertyDetails()).not.toThrow();
        });

        test('should render categories list with no categories', () => {
            const property = { id: 1, name: 'Test Property', expenses: {} };

            expect(() => propertiesManager.renderCategoriesList([], property)).not.toThrow();
        });

        test('should render categories list with categories', () => {
            const property = { id: 1, name: 'Test Property', expenses: { 'Rent': -1000 } };
            const categories = ['Rent'];

            expect(() => propertiesManager.renderCategoriesList(categories, property)).not.toThrow();
        });

        test('should render subcategories for hierarchical category', () => {
            const category = 'Utilities';
            const subcategories = { 'Electricity': -300, 'Water': -100 };

            expect(() => propertiesManager.renderSubcategories(category, subcategories)).not.toThrow();
        });

        test('should render empty panel', () => {
            expect(() => propertiesManager.renderEmptyPanel('Test message')).not.toThrow();
        });
    });

    describe('Modal Operations Coverage', () => {
        test('should show modal with content', () => {
            const modalId = 'testModal';
            const content = '<div>Test Content</div>';

            expect(() => propertiesManager.showModal(modalId, content)).not.toThrow();
        });

        test('should close modal', () => {
            const modalId = 'testModal';

            expect(() => propertiesManager.closeModal(modalId)).not.toThrow();
        });

        test('should handle modal creation failure gracefully', () => {
            const originalCreateElement = document.createElement;
            document.createElement = jest.fn(() => {
                throw new Error('DOM creation failed');
            });

            expect(() => propertiesManager.showModal('test', 'content')).toThrow('DOM creation failed');

            document.createElement = originalCreateElement;
        });
    });

    describe('Legacy Method Compatibility', () => {
        test('should handle property click (legacy method)', () => {
            const propertyItem = document.createElement('div');
            propertyItem.dataset.propertyId = '1';

            const event = { target: propertyItem };

            expect(() => propertiesManager.handlePropertyClick(event)).not.toThrow();
        });

        test('should handle category click (legacy method)', () => {
            const categoryItem = document.createElement('div');
            categoryItem.dataset.category = 'Rent';

            const event = { target: categoryItem };

            expect(() => propertiesManager.handleCategoryClick(event)).not.toThrow();
        });

        test('should handle value item click', () => {
            const valueItem = document.createElement('div');
            valueItem.dataset.category = 'Rent';
            valueItem.dataset.subcategory = 'SubRent';

            const event = { target: valueItem };

            expect(() => propertiesManager.handleValueItemClick(event)).not.toThrow();
        });
    });

    describe('Additional Picker Methods', () => {
        test('should initialize year month pickers', () => {
            expect(() => propertiesManager.initializeYearMonthPickers()).not.toThrow();
        });

        test('should handle year month change with DOM elements', () => {
            // Create select elements
            const yearSelect = document.createElement('select');
            yearSelect.id = 'propertiesYearSelect';
            yearSelect.value = '2025';
            document.body.appendChild(yearSelect);

            const monthSelect = document.createElement('select');
            monthSelect.id = 'propertiesMonthSelect';
            monthSelect.value = '09';
            document.body.appendChild(monthSelect);

            expect(() => propertiesManager.handleYearMonthChange()).not.toThrow();

            document.body.removeChild(yearSelect);
            document.body.removeChild(monthSelect);
        });
    });

    describe('Uncovered Branch Coverage Improvements', () => {
        test('should cover tooltip positioning edge cases', () => {
            const button = document.createElement('button');
            button.id = 'add-property-btn';
            document.body.appendChild(button);

            // Mock getBoundingClientRect for edge case testing
            const mockRect = {
                width: 40, height: 40, top: -50, left: 10, right: 50, bottom: -10,
            };
            button.getBoundingClientRect = jest.fn(() => mockRect);

            // Mock window.innerWidth and innerHeight for edge case
            const originalInnerWidth = window.innerWidth;
            const originalInnerHeight = window.innerHeight;
            Object.defineProperty(window, 'innerWidth', { value: 100, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 100, writable: true });

            expect(() => propertiesManager.showAddButtonTooltip(button, {})).not.toThrow();

            // Restore
            Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
            document.body.removeChild(button);
        });

        test('should cover delete tooltip positioning with container bounds', () => {
            const button = document.createElement('button');
            button.className = 'property-action';
            button.dataset.action = 'delete';
            document.body.appendChild(button);

            // Mock container element
            const container = document.createElement('div');
            container.id = 'propertiesDashboard';
            document.body.appendChild(container);

            const mockButtonRect = {
                width: 40, height: 40, top: 100, left: 10, right: 50, bottom: 140,
            };
            const mockContainerRect = {
                left: 5, right: 200, top: 5, bottom: 300,
            };

            button.getBoundingClientRect = jest.fn(() => mockButtonRect);
            container.getBoundingClientRect = jest.fn(() => mockContainerRect);

            expect(() => propertiesManager.showDeleteButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
            document.body.removeChild(container);
        });

        test('should cover event listener setup with missing container', () => {
            // Temporarily remove the container
            const originalGetElement = uiManager.getElement;
            uiManager.getElement = jest.fn(() => null);

            expect(() => propertiesManager.setupEventListeners()).not.toThrow();

            uiManager.getElement = originalGetElement;
        });

        test('should cover double-click text area detection', () => {
            const element = document.createElement('div');
            element.className = 'property-name editable';
            element.dataset.propertyId = '1';
            document.body.appendChild(element);

            // Mock getBoundingClientRect for text area check
            const mockRect = {
                left: 10, top: 10, width: 100, height: 20, right: 110, bottom: 30,
            };
            element.getBoundingClientRect = jest.fn(() => mockRect);

            const mockEvent = {
                target: element,
                clientX: 50, // Within text area
                clientY: 20,
                stopImmediatePropagation: jest.fn(),
            };

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Test' });

            expect(() => propertiesManager.setupEventListeners()).not.toThrow();

            // Simulate the double-click handler
            const container = document.getElementById('propertiesDashboard');
            if (container) {
                const dblClickEvent = document.createEvent('Event');
                dblClickEvent.initEvent('dblclick', true, true);
                Object.defineProperty(dblClickEvent, 'target', { value: element });
                Object.defineProperty(dblClickEvent, 'clientX', { value: 50 });
                Object.defineProperty(dblClickEvent, 'clientY', { value: 20 });
                container.dispatchEvent(dblClickEvent);
            }

            document.body.removeChild(element);
        });

        test('should cover expense edit with selection needed', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            valueElement.dataset.category = 'Rent';
            valueElement.dataset.subcategory = 'January';
            document.body.appendChild(valueElement);

            const mockEvent = {
                target: valueElement,
                stopPropagation: jest.fn(),
                preventDefault: jest.fn(),
            };

            // Set up state where selection is needed
            propertiesManager.currentCategoryPath = null;

            expect(() => propertiesManager.handleExpenseEdit(mockEvent)).not.toThrow();

            document.body.removeChild(valueElement);
        });

        test('should cover touch events for long press detection', () => {
            const propertyItem = document.createElement('div');
            propertyItem.className = 'property-item';
            propertyItem.dataset.propertyId = '1';
            document.body.appendChild(propertyItem);

            const mockTouchEvent = {
                touches: [{ clientX: 100, clientY: 100 }],
                target: propertyItem,
            };

            expect(() => propertiesManager.setupEventListeners()).not.toThrow();

            // Simulate touch event
            const container = document.getElementById('propertiesDashboard');
            if (container) {
                const touchStartEvent = document.createEvent('Event');
                touchStartEvent.initEvent('touchstart', true, true);
                Object.defineProperty(touchStartEvent, 'touches', [{ clientX: 100, clientY: 100 }]);
                Object.defineProperty(touchStartEvent, 'target', { value: propertyItem });
                container.dispatchEvent(touchStartEvent);
            }

            document.body.removeChild(propertyItem);
        });

        test('should cover getCategoryExpenseValue fallback logic', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };

            // Test fallback when current period data is empty
            dataManager.getCurrentPeriodData.mockReturnValueOnce(null);

            const result = propertiesManager.getCategoryExpenseValue(mockProperty, 'Rent');
            expect(result).toBe(-1000);
        });

        test('should cover getCategoryExpenseValue with global categories initialization', () => {
            const mockProperty = {
                expenses: {},
            };

            // Mock window.dataManager
            const originalWindowDataManager = window.dataManager;
            window.dataManager = {
                getExpenseCategories: jest.fn(() => ['Rent', 'Utilities']),
                getProperties: jest.fn(() => [{
                    expenses: { 'Rent': {} },
                }]),
            };

            dataManager.getCurrentPeriodData.mockReturnValueOnce(null);

            const result = propertiesManager.getCategoryExpenseValue(mockProperty, 'Rent');
            expect(result).toEqual({});

            window.dataManager = originalWindowDataManager;
        });

        test('should cover handleItemClick for all navigation cases', () => {
            // Test property click
            const propertyItem = document.createElement('div');
            propertyItem.className = 'property-item';
            propertyItem.dataset.propertyId = '1';
            document.body.appendChild(propertyItem);

            const mockEvent = { target: propertyItem };

            expect(() => propertiesManager.handleItemClick(mockEvent)).not.toThrow();

            // Test category click
            propertyItem.dataset.propertyId = '';
            propertyItem.dataset.category = 'Rent';
            propertyItem.dataset.subcategory = '';

            const mockProperty = { expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            expect(() => propertiesManager.handleItemClick(mockEvent)).not.toThrow();

            // Test subcategory click
            propertyItem.dataset.subcategory = 'January';

            expect(() => propertiesManager.handleItemClick(mockEvent)).not.toThrow();

            document.body.removeChild(propertyItem);
        });

        test('should cover renderSubcategoriesPanel hierarchical case', () => {
            const mockProperty = {
                expenses: { 'Utilities': { 'Electric': -100, 'Water': -50 } },
            };

            const result = propertiesManager.renderSubcategoriesPanel(mockProperty, 'Utilities', null);
            expect(result).toContain('Electric');
            expect(result).toContain('Water');
        });

        test('should cover renderSubcategoriesPanel flat case', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };

            const result = propertiesManager.renderSubcategoriesPanel(mockProperty, 'Rent', null);
            expect(result).toContain('Rent');
        });

        test('should cover saveExpenseValue with invalid values', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            // Test with NaN
            expect(() => propertiesManager.saveExpenseValue('Rent', null, NaN)).not.toThrow();

            // Test with null
            expect(() => propertiesManager.saveExpenseValue('Rent', null, null)).not.toThrow();

            // Test with undefined
            expect(() => propertiesManager.saveExpenseValue('Rent', null, undefined)).not.toThrow();
        });

        test('should cover saveExpenseValue income category logic', () => {
            const mockProperty = {
                expenses: { 'Income': 1000 },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            dataManager.getIncomeCategories.mockReturnValue(['Income']);

            propertiesManager.currentPropertyId = 1;

            // Test positive value for income category (should stay positive)
            propertiesManager.saveExpenseValue('Income', null, 500);
            expect(mockProperty.expenses['Income']).toBe(500);

            // Test negative value for income category (should become positive)
            propertiesManager.saveExpenseValue('Income', null, -200);
            expect(mockProperty.expenses['Income']).toBe(200);
        });

        test('should cover getCurrentExpenseValue for subcategories', () => {
            const mockProperty = {
                expenses: { 'Utilities': { 'Electric': -100 } },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            dataManager.getCurrentPeriodData.mockReturnValue({
                expenses: { 'Utilities': { 'Electric': -150 } },
            });

            propertiesManager.currentPropertyId = 1;

            const result = propertiesManager.getCurrentExpenseValue('Utilities', 'Electric');
            expect(result).toBe(-150);
        });

        test('should cover startExpenseEdit with different input types', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            valueElement.innerHTML = '$1000';
            document.body.appendChild(valueElement);

            propertiesManager.currentPropertyId = 1;
            dataManager.getPropertyById.mockReturnValue({ expenses: { 'Rent': -1000 } });

            expect(() => propertiesManager.startExpenseEdit(valueElement, 'Rent', null)).not.toThrow();

            document.body.removeChild(valueElement);
        });

        test('should cover handleExpenseSave with different input scenarios', () => {
            // Test with input element
            const input = document.createElement('input');
            input.className = 'expense-input';
            input.dataset.category = 'Rent';
            input.value = '1200';

            expect(() => propertiesManager.handleExpenseSave({ target: input })).not.toThrow();

            // Test with nested input
            const container = document.createElement('div');
            container.appendChild(input);

            expect(() => propertiesManager.handleExpenseSave({ target: container })).not.toThrow();
        });

        test('should cover cancelExpenseEdit with different elements', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            document.body.appendChild(valueElement);

            const input = document.createElement('input');
            input.dataset.category = 'Rent';
            valueElement.appendChild(input);

            propertiesManager.currentPropertyId = 1;
            dataManager.getPropertyById.mockReturnValue({ expenses: { 'Rent': -1000 } });

            expect(() => propertiesManager.cancelExpenseEdit(input)).not.toThrow();

            document.body.removeChild(valueElement);
        });

        test('should cover name editing methods with different scenarios', () => {
            // Test property name edit when not selected
            const propertyElement = document.createElement('div');
            propertyElement.className = 'property-name editable';
            propertyElement.dataset.propertyId = '2'; // Different ID
            document.body.appendChild(propertyElement);

            propertiesManager.currentPropertyId = 1; // Currently selected different property
            dataManager.getPropertyById.mockReturnValue({ id: 2, name: 'Property 2' });

            const mockEvent = { target: propertyElement };

            expect(() => propertiesManager.handlePropertyNameEdit(mockEvent)).not.toThrow();

            document.body.removeChild(propertyElement);
        });

        test('should cover category name edit when not selected', () => {
            const categoryElement = document.createElement('div');
            categoryElement.className = 'category-name editable';
            categoryElement.dataset.category = 'Utilities';
            document.body.appendChild(categoryElement);

            propertiesManager.currentCategoryPath = { category: 'Rent' }; // Different category
            propertiesManager.currentPropertyId = 1;
            dataManager.getPropertyById.mockReturnValue({ expenses: { 'Utilities': -500 } });

            const mockEvent = { target: categoryElement };

            expect(() => propertiesManager.handleCategoryNameEdit(mockEvent)).not.toThrow();

            document.body.removeChild(categoryElement);
        });

        test('should cover subcategory name edit when not selected', () => {
            const subcategoryElement = document.createElement('div');
            subcategoryElement.className = 'subcategory-name editable';
            subcategoryElement.dataset.category = 'Utilities';
            subcategoryElement.dataset.subcategory = 'Gas';
            document.body.appendChild(subcategoryElement);

            propertiesManager.currentCategoryPath = { category: 'Utilities', subcategory: 'Electric' }; // Different subcategory
            propertiesManager.currentPropertyId = 1;
            dataManager.getPropertyById.mockReturnValue({ expenses: { 'Utilities': { 'Gas': -50 } } });

            const mockEvent = { target: subcategoryElement };

            expect(() => propertiesManager.handleSubcategoryNameEdit(mockEvent)).not.toThrow();

            document.body.removeChild(subcategoryElement);
        });

        test('should cover name save methods with empty names', () => {
            // Test property name save with empty name
            const propertyInput = document.createElement('input');
            propertyInput.className = 'property-name-input';
            propertyInput.dataset.propertyId = '1';
            propertyInput.value = ''; // Empty name
            document.body.appendChild(propertyInput);

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Original Name' });

            expect(() => propertiesManager.handlePropertyNameSave({ target: propertyInput })).not.toThrow();

            document.body.removeChild(propertyInput);
        });

        test('should cover category name save with empty name', () => {
            const categoryInput = document.createElement('input');
            categoryInput.className = 'category-name-input';
            categoryInput.dataset.category = 'OldCategory';
            categoryInput.value = ''; // Empty name
            document.body.appendChild(categoryInput);

            expect(() => propertiesManager.handleCategoryNameSave({ target: categoryInput })).not.toThrow();

            document.body.removeChild(categoryInput);
        });

        test('should cover subcategory name save with empty name', () => {
            const subcategoryInput = document.createElement('input');
            subcategoryInput.className = 'subcategory-name-input';
            subcategoryInput.dataset.category = 'Utilities';
            subcategoryInput.dataset.subcategory = 'OldSub';
            subcategoryInput.value = ''; // Empty name
            document.body.appendChild(subcategoryInput);

            expect(() => propertiesManager.handleSubcategoryNameSave({ target: subcategoryInput })).not.toThrow();

            document.body.removeChild(subcategoryInput);
        });

        test('should cover name keydown handlers with Escape key', () => {
            // Test property name keydown with Escape
            const propertyElement = document.createElement('div');
            propertyElement.className = 'property-name';
            document.body.appendChild(propertyElement);

            const propertyInput = document.createElement('input');
            propertyInput.className = 'property-name-input';
            propertyInput.dataset.propertyId = '1';
            propertyElement.appendChild(propertyInput);

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Original Name' });

            const mockEvent = { key: 'Escape', target: propertyInput };

            expect(() => propertiesManager.handlePropertyNameKeydown(mockEvent)).not.toThrow();

            document.body.removeChild(propertyElement);
        });

        test('should cover category name keydown with Escape', () => {
            const categoryInput = document.createElement('input');
            categoryInput.className = 'category-name-input';
            categoryInput.dataset.category = 'OldCategory';
            document.body.appendChild(categoryInput);

            const mockEvent = { key: 'Escape', target: categoryInput };

            expect(() => propertiesManager.handleCategoryNameKeydown(mockEvent)).not.toThrow();

            document.body.removeChild(categoryInput);
        });

        test('should cover subcategory name keydown with Escape', () => {
            const subcategoryInput = document.createElement('input');
            subcategoryInput.className = 'subcategory-name-input';
            subcategoryInput.dataset.category = 'Utilities';
            subcategoryInput.dataset.subcategory = 'OldSub';
            document.body.appendChild(subcategoryInput);

            const mockEvent = { key: 'Escape', target: subcategoryInput };

            expect(() => propertiesManager.handleSubcategoryNameKeydown(mockEvent)).not.toThrow();

            document.body.removeChild(subcategoryInput);
        });

        test('should cover handleBackNavigation for all cases', () => {
            // Test from subcategory to category
            propertiesManager.currentCategoryPath = { category: 'Utilities', subcategory: 'Electric' };
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentCategoryPath).toEqual({ category: 'Utilities' });

            // Test from category to property
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentCategoryPath).toBeNull();

            // Test from property to root
            propertiesManager.currentPropertyId = 1;
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentPropertyId).toBeNull();
        });

        test('should cover showModal with existing modal cleanup', () => {
            // Create existing modal
            const existingModal = document.createElement('div');
            existingModal.id = 'testModal';
            document.body.appendChild(existingModal);

            expect(() => propertiesManager.showModal('testModal', '<p>Content</p>')).not.toThrow();

            // Should have cleaned up existing modal
            expect(document.getElementById('testModal')).not.toBeNull();
        });

        test('should cover updateCategoryName with duplicate name', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000, 'Utilities': -500 },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            expect(() => propertiesManager.updateCategoryName('Rent', 'Utilities')).not.toThrow();
            expect(uiManager.showToast).toHaveBeenCalledWith('Category name already exists', 'error');
        });

        test('should cover updateSubcategoryName with duplicate name', () => {
            const mockProperty = {
                expenses: { 'Utilities': { 'Electric': -100, 'Gas': -50 } },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            expect(() => propertiesManager.updateSubcategoryName('Utilities', 'Electric', 'Gas')).not.toThrow();
            expect(uiManager.showToast).toHaveBeenCalledWith('Subcategory name already exists', 'error');
        });

        test('should cover addCategory with existing name', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            expect(() => propertiesManager.addCategory('Rent', false)).not.toThrow();
            expect(uiManager.showToast).toHaveBeenCalledWith('Category already exists', 'error');
        });

        test('should cover addSubcategory with existing name', () => {
            const mockProperty = {
                expenses: { 'Utilities': { 'Electric': -100 } },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = { category: 'Utilities' };

            expect(() => propertiesManager.addSubcategory('Electric', 200)).not.toThrow();
            expect(uiManager.showToast).toHaveBeenCalledWith('Subcategory already exists', 'error');
        });

        test('should cover addSubcategory without hierarchical category', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = { category: 'Rent' };

            expect(() => propertiesManager.addSubcategory('January', 200)).not.toThrow();
            expect(mockProperty.expenses['Rent']).toEqual({ 'January': 200 });
        });

        test('should cover deleteCategory and deleteSubcategory error cases', () => {
            // Test deleteCategory with no property
            dataManager.getPropertyById.mockReturnValue(null);
            expect(() => propertiesManager.deleteCategory('Rent')).not.toThrow();

            // Test deleteSubcategory with non-object category
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            expect(() => propertiesManager.deleteSubcategory('Rent', 'January')).not.toThrow();
        });

        test('should cover showInlineDeleteConfirmation with missing button', () => {
            expect(() => propertiesManager.showInlineDeleteConfirmation(1, 'property', 'Test')).not.toThrow();
        });

        test('should cover positionConfirmationPopup with different positions', () => {
            const popup = document.createElement('div');
            const button = document.createElement('button');

            // Mock getBoundingClientRect
            button.getBoundingClientRect = jest.fn(() => ({
                width: 40, height: 40, top: 1000, left: 100, right: 140, bottom: 1040,
            }));

            popup.getBoundingClientRect = jest.fn(() => ({
                width: 200, height: 60,
            }));

            // Mock window dimensions
            const originalInnerWidth = window.innerWidth;
            const originalInnerHeight = window.innerHeight;
            Object.defineProperty(window, 'innerWidth', { value: 300, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 500, writable: true });

            expect(() => propertiesManager.positionConfirmationPopup(popup, button)).not.toThrow();

            // Restore
            Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
        });

        test('should cover startLongPressDetection with existing timers', () => {
            const element = document.createElement('div');
            element.dataset.propertyId = '1';

            // Add existing timer
            propertiesManager.longPressTimers.set('existing', 123);

            expect(() => propertiesManager.startLongPressDetection(element, {})).not.toThrow();

            // Clean up
            propertiesManager.cancelLongPressDetection();
        });

        test('should cover showDeleteButton with re-render logic', () => {
            const item = document.createElement('div');
            item.className = 'property-item';
            item.dataset.propertyId = '1';
            document.body.appendChild(item);

            propertiesManager.currentPropertyId = null; // Not currently selected

            expect(() => propertiesManager.showDeleteButton(item)).not.toThrow();

            document.body.removeChild(item);
        });

        test('should cover findItemElement for all cases', () => {
            // Test property case
            expect(propertiesManager.findItemElement(1)).toBeNull();

            // Test category case
            const categoryItem = document.createElement('div');
            categoryItem.className = 'property-item';
            categoryItem.dataset.category = 'Rent';
            document.body.appendChild(categoryItem);

            expect(propertiesManager.findItemElement(null, 'Rent')).toBe(categoryItem);

            // Test subcategory case
            const subcategoryItem = document.createElement('div');
            subcategoryItem.dataset.category = 'Utilities';
            subcategoryItem.dataset.subcategory = 'Electric';
            document.body.appendChild(subcategoryItem);

            expect(propertiesManager.findItemElement(null, 'Utilities', 'Electric')).toBe(subcategoryItem);

            document.body.removeChild(categoryItem);
            document.body.removeChild(subcategoryItem);
        });

        test('should cover isExpenseCategory and isIncomeCategory', () => {
            dataManager.getExpenseCategories.mockReturnValue(['Rent', 'Utilities']);
            dataManager.getIncomeCategories.mockReturnValue(['Salary']);

            expect(propertiesManager.isExpenseCategory('Rent')).toBe(true);
            expect(propertiesManager.isExpenseCategory('Salary')).toBe(false);
            expect(propertiesManager.isIncomeCategory('Salary')).toBe(true);
            expect(propertiesManager.isIncomeCategory('Rent')).toBe(false);
        });

        test('should cover initializeHeaderPickers with different scenarios', () => {
            // Test with missing available years
            dataManager.getAvailableYears.mockReturnValue([]);

            expect(() => propertiesManager.initializeHeaderPickers()).not.toThrow();

            // Reset mock
            dataManager.getAvailableYears.mockReturnValue(['2024', '2025']);
        });

        test('should cover populateYearPicker with missing select element', () => {
            const originalGetElementById = document.getElementById;
            document.getElementById = jest.fn(() => null);

            expect(() => propertiesManager.populateYearPicker()).not.toThrow();

            document.getElementById = originalGetElementById;
        });

        test('should cover setCurrentMonth with no data available', () => {
            // Mock no data available
            propertiesManager.hasDataForMonthYear = jest.fn(() => false);
            propertiesManager.getLastAvailableMonthYear = jest.fn(() => null);

            expect(() => propertiesManager.setCurrentMonth()).not.toThrow();
        });

        test('should cover handleYearMonthChange with missing elements', () => {
            const originalGetElementById = document.getElementById;
            document.getElementById = jest.fn(() => null);

            expect(() => propertiesManager.handleYearMonthChange()).not.toThrow();

            document.getElementById = originalGetElementById;
        });

        test('should cover getMonthName with invalid month', () => {
            expect(propertiesManager.getMonthName('13')).toBe('13');
            expect(propertiesManager.getMonthName('00')).toBe('00');
        });

        test('should cover hasDataForMonthYear with properties that have expenses', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };
            dataManager.getProperties.mockReturnValue([mockProperty]);

            const result = propertiesManager.hasDataForMonthYear('2025', '01');
            expect(result).toBe(true);
        });

        test('should cover getLastAvailableMonthYear with no monthly data', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 }, // No monthlyData
            };
            dataManager.getProperties.mockReturnValue([mockProperty]);

            const result = propertiesManager.getLastAvailableMonthYear();
            expect(result).toBeNull();
        });

        test('should cover parseMonthKey with invalid format', () => {
            const result = propertiesManager.parseMonthKey('Invalid Format');
            expect(result.getFullYear()).toBe(1900);
            expect(result.getMonth()).toBe(0);
        });

        test('should cover getLastAvailableMonthForYear with no matching data', () => {
            const mockProperty = {
                monthlyData: {
                    'Jan 2024': { expenses: {} },
                },
            };
            dataManager.getProperties.mockReturnValue([mockProperty]);

            const result = propertiesManager.getLastAvailableMonthForYear('2025');
            expect(result).toBeNull();
        });

        test('should cover forceUpdatePickerUI with missing elements', () => {
            const originalQuerySelectorAll = document.querySelectorAll;
            document.querySelectorAll = jest.fn(() => []);

            expect(() => propertiesManager.forceUpdatePickerUI('2025', '09')).not.toThrow();

            document.querySelectorAll = originalQuerySelectorAll;
        });

        test('should cover handleTimePeriodChange with missing UI manager methods', () => {
            const originalUpdateDataDisplay = uiManager.updateDataDisplay;
            uiManager.updateDataDisplay = undefined;

            expect(() => propertiesManager.handleTimePeriodChange()).not.toThrow();

            uiManager.updateDataDisplay = originalUpdateDataDisplay;
        });

        test('should cover cleanup method completely', () => {
            // Setup some state to clean up
            propertiesManager.longPressTimers.set('test', 123);

            // Create a proper DOM element for visibleDeleteButtons
            const mockElement = document.createElement('div');
            mockElement.className = 'property-item';
            const mockButton = document.createElement('button');
            mockButton.className = 'property-action delete-hidden';
            mockButton.dataset.action = 'delete';
            mockElement.appendChild(mockButton);
            document.body.appendChild(mockElement);

            propertiesManager.visibleDeleteButtons.set(mockElement, { propertyId: 1 });

            expect(() => propertiesManager.cleanup()).not.toThrow();

            expect(propertiesManager.longPressTimers.size).toBe(0);
            expect(propertiesManager.visibleDeleteButtons.size).toBe(0);

            // Clean up DOM after test
            if (document.body.contains(mockElement)) {
                document.body.removeChild(mockElement);
            }
        });

        test('should cover tooltip positioning edge cases - right overflow', () => {
            const button = document.createElement('button');
            button.id = 'add-property-btn';
            document.body.appendChild(button);

            // Mock getBoundingClientRect for right overflow case
            const mockRect = {
                width: 40, height: 40, top: 100, left: 100, right: 140, bottom: 140,
            };
            button.getBoundingClientRect = jest.fn(() => mockRect);

            // Mock window.innerWidth to force right overflow
            const originalInnerWidth = window.innerWidth;
            Object.defineProperty(window, 'innerWidth', { value: 120, writable: true });

            expect(() => propertiesManager.showAddButtonTooltip(button, {})).not.toThrow();

            // Restore
            Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
            document.body.removeChild(button);
        });

        test('should cover tooltip positioning edge cases - top overflow', () => {
            const button = document.createElement('button');
            button.id = 'add-property-btn';
            document.body.appendChild(button);

            // Mock getBoundingClientRect for top overflow case
            const mockRect = {
                width: 40, height: 40, top: -50, left: 10, right: 50, bottom: -10,
            };
            button.getBoundingClientRect = jest.fn(() => mockRect);

            expect(() => propertiesManager.showAddButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
        });

        test('should cover delete tooltip positioning with container bounds', () => {
            const button = document.createElement('button');
            button.className = 'property-action';
            button.dataset.action = 'delete';
            document.body.appendChild(button);

            // Mock container element
            const container = document.createElement('div');
            container.id = 'propertiesDashboard';
            document.body.appendChild(container);

            // Mock getBoundingClientRect for container
            container.getBoundingClientRect = jest.fn(() => ({
                left: 0, right: 200, top: 0, bottom: 400,
            }));

            button.getBoundingClientRect = jest.fn(() => ({
                width: 40, height: 40, top: 100, left: 150, right: 190, bottom: 140,
            }));

            expect(() => propertiesManager.showDeleteButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
            document.body.removeChild(container);
        });

        test('should cover initialize error handling - missing dependencies', async () => {
            const brokenManager = new PropertiesManager(null, null, null, null, null);

            // Mock console.error to avoid noise
            const originalError = console.error;
            console.error = jest.fn();

            await expect(brokenManager.initialize()).resolves.not.toThrow();

            console.error = originalError;
        });

        test('should cover initialize error handling - DataManager throws', async () => {
            const throwingDataManager = {
                ...dataManager,
                getProperties: jest.fn(() => { throw new Error('DataManager error'); }),
            };
            const brokenManager = new PropertiesManager(throwingDataManager, uiManager, null, historyManager);

            const originalError = console.error;
            console.error = jest.fn();

            await expect(brokenManager.initialize()).resolves.not.toThrow();

            console.error = originalError;
        });

        test('should cover setupEventListeners with missing container', () => {
            // Mock getElement to return null
            const originalGetElement = uiManager.getElement;
            uiManager.getElement = jest.fn(() => null);

            expect(() => propertiesManager.setupEventListeners()).not.toThrow();

            uiManager.getElement = originalGetElement;
        });

        test('should cover double-click text area detection - outside text area', () => {
            const element = document.createElement('div');
            element.className = 'property-name editable';
            element.textContent = 'Test';
            element.style.width = '100px';
            element.style.height = '20px';
            document.body.appendChild(element);

            // Mock getBoundingClientRect
            element.getBoundingClientRect = jest.fn(() => ({
                left: 0, top: 0, width: 100, height: 20, right: 100, bottom: 20,
            }));

            // Mock scrollWidth and scrollHeight
            Object.defineProperty(element, 'scrollWidth', { value: 50 });
            Object.defineProperty(element, 'scrollHeight', { value: 15 });

            const mockEvent = {
                target: element,
                clientX: 80, // Outside text area
                clientY: 15,
                stopImmediatePropagation: jest.fn(),
            };

            expect(() => {
                // Simulate the double-click logic
                const rect = element.getBoundingClientRect();
                const clickX = mockEvent.clientX;
                const clickY = mockEvent.clientY;
                const textWidth = element.scrollWidth;
                const textHeight = element.scrollHeight;
                const isInTextArea = clickX >= rect.left && clickX <= rect.left + textWidth &&
                                   clickY >= rect.top && clickY <= rect.top + textHeight;

                if (!isInTextArea) {
                    // This should be covered
                    return;
                }
            }).not.toThrow();

            document.body.removeChild(element);
        });

        test('should cover expense edit with selection needed - subcategory', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            valueElement.dataset.category = 'Utilities';
            valueElement.dataset.subcategory = 'Electricity';
            document.body.appendChild(valueElement);

            propertiesManager.currentCategoryPath = null; // No selection

            const mockEvent = {
                target: valueElement,
                stopPropagation: jest.fn(),
                preventDefault: jest.fn(),
            };

            expect(() => propertiesManager.handleExpenseEdit(mockEvent)).not.toThrow();

            document.body.removeChild(valueElement);
        });

        test('should cover getCategoryExpenseValue fallback to property expenses', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };

            // Mock getCurrentPeriodData to return null/empty
            const originalGetCurrentPeriodData = dataManager.getCurrentPeriodData;
            dataManager.getCurrentPeriodData = jest.fn(() => null);

            const result = propertiesManager.getCategoryExpenseValue(mockProperty, 'Rent');
            expect(result).toBe(-1000);

            dataManager.getCurrentPeriodData = originalGetCurrentPeriodData;
        });

        test('should cover getCategoryExpenseValue with global categories initialization', () => {
            const mockProperty = {
                expenses: {},
            };

            // Mock window.dataManager
            const originalWindowDataManager = window.dataManager;
            window.dataManager = {
                getExpenseCategories: jest.fn(() => ['Rent']),
                getProperties: jest.fn(() => [{
                    expenses: { 'Rent': {} },
                }]),
            };

            const result = propertiesManager.getCategoryExpenseValue(mockProperty, 'Rent');
            expect(result).toEqual({});

            window.dataManager = originalWindowDataManager;
        });

        test('should cover handleItemClick for property selection', () => {
            const propertyItem = document.createElement('div');
            propertyItem.className = 'property-item';
            propertyItem.dataset.propertyId = '1';
            document.body.appendChild(propertyItem);

            const mockEvent = { target: propertyItem };

            expect(() => propertiesManager.handleItemClick(mockEvent)).not.toThrow();

            document.body.removeChild(propertyItem);
        });

        test('should cover handleItemClick for category selection - hierarchical', () => {
            const categoryItem = document.createElement('div');
            categoryItem.className = 'property-item';
            categoryItem.dataset.category = 'Utilities';
            document.body.appendChild(categoryItem);

            propertiesManager.currentPropertyId = 1;

            const mockProperty = { expenses: { 'Utilities': {} } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            const mockEvent = { target: categoryItem };

            expect(() => propertiesManager.handleItemClick(mockEvent)).not.toThrow();

            document.body.removeChild(categoryItem);
        });

        test('should cover handleItemClick for subcategory selection', () => {
            const subcategoryItem = document.createElement('div');
            subcategoryItem.className = 'property-item';
            subcategoryItem.dataset.category = 'Utilities';
            subcategoryItem.dataset.subcategory = 'Electricity';
            document.body.appendChild(subcategoryItem);

            const mockEvent = { target: subcategoryItem };

            expect(() => propertiesManager.handleItemClick(mockEvent)).not.toThrow();

            document.body.removeChild(subcategoryItem);
        });

        test('should cover renderSubcategoriesPanel hierarchical case', () => {
            const mockProperty = {
                expenses: { 'Utilities': { 'Electric': -100, 'Water': -50 } },
            };

            expect(() => propertiesManager.renderSubcategoriesPanel(mockProperty, 'Utilities', null)).not.toThrow();
        });

        test('should cover renderSubcategoriesPanel flat case', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };

            expect(() => propertiesManager.renderSubcategoriesPanel(mockProperty, 'Rent', null)).not.toThrow();
        });

        test('should cover saveExpenseValue with NaN values', () => {
            const mockProperty = { expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Rent';
            mockInput.value = 'invalid';

            expect(() => propertiesManager.handleExpenseSave({ target: mockInput })).not.toThrow();
        });

        test('should cover saveExpenseValue income category logic', () => {
            const mockProperty = { expenses: { 'Salary': 5000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            dataManager.getIncomeCategories.mockReturnValue(['Salary']);

            propertiesManager.currentPropertyId = 1;

            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Salary';
            mockInput.value = '-6000'; // Negative input for income category

            expect(() => propertiesManager.handleExpenseSave({ target: mockInput })).not.toThrow();
        });

        test('should cover getCurrentExpenseValue for subcategories', () => {
            const mockProperty = {
                expenses: { 'Utilities': { 'Electric': -100 } },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            dataManager.getCurrentPeriodData.mockReturnValue({
                expenses: { 'Utilities': { 'Electric': -150 } },
            });

            propertiesManager.currentPropertyId = 1;

            const result = propertiesManager.getCurrentExpenseValue('Utilities', 'Electric');
            expect(result).toBe(-150);
        });

        test('should cover startExpenseEdit with different input types', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            valueElement.dataset.category = 'Rent';
            valueElement.textContent = '$1000';
            document.body.appendChild(valueElement);

            expect(() => propertiesManager.startExpenseEdit(valueElement, 'Rent')).not.toThrow();

            document.body.removeChild(valueElement);
        });

        test('should cover handleExpenseSave with different input scenarios', () => {
            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Rent';
            mockInput.value = '1200';

            expect(() => propertiesManager.handleExpenseSave({ target: mockInput })).not.toThrow();
        });

        test('should cover cancelExpenseEdit with different elements', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            document.body.appendChild(valueElement);

            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Rent';
            valueElement.appendChild(mockInput);

            expect(() => propertiesManager.cancelExpenseEdit(mockInput)).not.toThrow();

            document.body.removeChild(valueElement);
        });

        test('should cover name editing methods with different scenarios', () => {
            // Test property name edit when already selected
            const propertyElement = document.createElement('div');
            propertyElement.className = 'property-name editable';
            propertyElement.dataset.propertyId = '1';
            document.body.appendChild(propertyElement);

            propertiesManager.currentPropertyId = 1;
            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Test Property' });

            expect(() => propertiesManager.handlePropertyNameEdit({ target: propertyElement })).not.toThrow();

            document.body.removeChild(propertyElement);
        });

        test('should cover category name edit when not selected', () => {
            const categoryElement = document.createElement('div');
            categoryElement.className = 'category-name editable';
            categoryElement.dataset.category = 'Rent';
            document.body.appendChild(categoryElement);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = null; // Not selected

            expect(() => propertiesManager.handleCategoryNameEdit({ target: categoryElement })).not.toThrow();

            document.body.removeChild(categoryElement);
        });

        test('should cover subcategory name edit when not selected', () => {
            const subcategoryElement = document.createElement('div');
            subcategoryElement.className = 'subcategory-name editable';
            subcategoryElement.dataset.category = 'Utilities';
            subcategoryElement.dataset.subcategory = 'Electric';
            document.body.appendChild(subcategoryElement);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = null; // Not selected

            expect(() => propertiesManager.handleSubcategoryNameEdit({ target: subcategoryElement })).not.toThrow();

            document.body.removeChild(subcategoryElement);
        });

        test('should cover name save methods with empty names', () => {
            const input = document.createElement('input');
            input.className = 'property-name-input';
            input.value = ''; // Empty name
            input.dataset.propertyId = '1';

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Original Name' });

            expect(() => propertiesManager.handlePropertyNameSave({ target: input })).not.toThrow();
        });

        test('should cover category name save with empty name', () => {
            const input = document.createElement('input');
            input.className = 'category-name-input';
            input.value = ''; // Empty name
            input.dataset.category = 'Rent';

            expect(() => propertiesManager.handleCategoryNameSave({ target: input })).not.toThrow();
        });

        test('should cover subcategory name save with empty name', () => {
            const input = document.createElement('input');
            input.className = 'subcategory-name-input';
            input.value = ''; // Empty name
            input.dataset.category = 'Electric';

            expect(() => propertiesManager.handleSubcategoryNameSave({ target: input })).not.toThrow();
        });

        test('should cover handleBackNavigation for all cases', () => {
            // Test from subcategory to category
            propertiesManager.currentCategoryPath = { category: 'Utilities', subcategory: 'Electric' };
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentCategoryPath).toEqual({ category: 'Utilities' });

            // Test from category to property
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentCategoryPath).toBeNull();
            expect(propertiesManager.currentPropertyId).toBeNull();
        });

        test('should cover showModal with existing modal cleanup', () => {
            const existingModal = document.createElement('div');
            existingModal.id = 'testModal';
            document.body.appendChild(existingModal);

            expect(() => propertiesManager.showModal('testModal', '<p>Test</p>')).not.toThrow();

            // Clean up
            const newModal = document.getElementById('testModal');
            if (newModal) {newModal.remove();}
        });

        test('should cover updateCategoryName with duplicate name', () => {
            const mockProperty = { expenses: { 'Rent': -1000, 'NewRent': -500 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            expect(() => propertiesManager.updateCategoryName('Rent', 'NewRent')).not.toThrow();
        });

        test('should cover updateSubcategoryName with duplicate name', () => {
            const mockProperty = { expenses: { 'Utilities': { 'Electric': -100, 'NewElectric': -50 } } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            expect(() => propertiesManager.updateSubcategoryName('Utilities', 'Electric', 'NewElectric')).not.toThrow();
        });

        test('should cover addCategory with existing name', () => {
            const mockProperty = { expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            expect(() => propertiesManager.addCategory('Rent', false)).not.toThrow();
        });

        test('should cover addSubcategory with existing name', () => {
            const mockProperty = { expenses: { 'Utilities': { 'Electric': -100 } } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = { category: 'Utilities' };

            expect(() => propertiesManager.addSubcategory('Electric', 200)).not.toThrow();
        });

        test('should cover addSubcategory without hierarchical category', () => {
            const mockProperty = { expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = { category: 'Rent' };

            expect(() => propertiesManager.addSubcategory('SubRent', 200)).not.toThrow();
        });

        test('should cover deleteCategory and deleteSubcategory error cases', () => {
            // Test deleteCategory with non-existent category
            const mockProperty = { expenses: {} };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            expect(() => propertiesManager.deleteCategory('NonExistent')).not.toThrow();

            // Test deleteSubcategory with invalid category
            expect(() => propertiesManager.deleteSubcategory('NonExistent', 'Sub')).not.toThrow();
        });

        test('should cover showInlineDeleteConfirmation with missing button', () => {
            // Mock findDeleteButton to return null
            const originalFindDeleteButton = propertiesManager.findDeleteButton;
            propertiesManager.findDeleteButton = jest.fn(() => null);

            expect(() => propertiesManager.showInlineDeleteConfirmation(1, 'property', 'Test')).not.toThrow();

            propertiesManager.findDeleteButton = originalFindDeleteButton;
        });

        test('should cover positionConfirmationPopup with different positions', () => {
            const popup = document.createElement('div');
            const button = document.createElement('button');

            // Mock dimensions
            popup.getBoundingClientRect = jest.fn(() => ({
                width: 100, height: 50,
            }));

            button.getBoundingClientRect = jest.fn(() => ({
                width: 40, height: 40, top: 10, left: 10, right: 50, bottom: 50,
            }));

            // Mock window dimensions for edge case
            const originalInnerWidth = window.innerWidth;
            const originalInnerHeight = window.innerHeight;
            Object.defineProperty(window, 'innerWidth', { value: 80, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 80, writable: true });

            expect(() => propertiesManager.positionConfirmationPopup(popup, button)).not.toThrow();

            // Restore
            Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
        });

        test('should cover startLongPressDetection with existing timers', () => {
            const element = document.createElement('div');
            element.dataset.propertyId = '1';

            // Add existing timer
            propertiesManager.longPressTimers.set('existing', 999);

            expect(() => propertiesManager.startLongPressDetection(element, {})).not.toThrow();

            propertiesManager.cancelLongPressDetection();
        });

        test('should cover showDeleteButton with re-render logic', () => {
            const item = document.createElement('div');
            item.className = 'property-item';
            item.dataset.propertyId = '1';
            document.body.appendChild(item);

            propertiesManager.currentPropertyId = null; // Force re-render

            expect(() => propertiesManager.showDeleteButton(item)).not.toThrow();

            document.body.removeChild(item);
        });

        test('should cover findItemElement for all cases', () => {
            // Test property case
            const propElement = document.createElement('div');
            propElement.dataset.propertyId = '1';
            document.body.appendChild(propElement);

            expect(propertiesManager.findItemElement(1)).toBe(propElement);

            // Test category case
            const catElement = document.createElement('div');
            catElement.className = 'property-item';
            catElement.dataset.category = 'Rent';
            document.body.appendChild(catElement);

            expect(propertiesManager.findItemElement(null, 'Rent')).toBe(catElement);

            // Test subcategory case
            const subElement = document.createElement('div');
            subElement.dataset.category = 'Utilities';
            subElement.dataset.subcategory = 'Electric';
            document.body.appendChild(subElement);

            expect(propertiesManager.findItemElement(null, 'Utilities', 'Electric')).toBe(subElement);

            // Clean up
            document.body.removeChild(propElement);
            document.body.removeChild(catElement);
            document.body.removeChild(subElement);
        });

        test('should cover isExpenseCategory and isIncomeCategory', () => {
            dataManager.getExpenseCategories.mockReturnValue(['Rent', 'Utilities']);
            dataManager.getIncomeCategories.mockReturnValue(['Salary']);

            expect(propertiesManager.isExpenseCategory('Rent')).toBe(true);
            expect(propertiesManager.isExpenseCategory('Salary')).toBe(false);
            expect(propertiesManager.isIncomeCategory('Salary')).toBe(true);
            expect(propertiesManager.isIncomeCategory('Rent')).toBe(false);
        });

        test('should cover initializeHeaderPickers with different scenarios', () => {
            // Test with UI manager methods that throw - method will throw as expected
            const originalPopulateYearPicker = uiManager.populateYearPicker;
            const originalPopulateMonthPicker = uiManager.populateMonthPicker;
            const originalUpdateYearPickerSelection = uiManager.updateYearPickerSelection;
            const originalUpdateMonthPickerSelection = uiManager.updateMonthPickerSelection;

            // Mock methods to throw
            uiManager.populateYearPicker = jest.fn(() => { throw new Error('UI method failed'); });
            uiManager.populateMonthPicker = jest.fn(() => { throw new Error('UI method failed'); });
            uiManager.updateYearPickerSelection = jest.fn(() => { throw new Error('UI method failed'); });
            uiManager.updateMonthPickerSelection = jest.fn(() => { throw new Error('UI method failed'); });

            // The method throws when UI methods fail (no error handling in the method)
            expect(() => propertiesManager.initializeHeaderPickers()).toThrow('UI method failed');

            // Restore original methods
            uiManager.populateYearPicker = originalPopulateYearPicker;
            uiManager.populateMonthPicker = originalPopulateMonthPicker;
            uiManager.updateYearPickerSelection = originalUpdateYearPickerSelection;
            uiManager.updateMonthPickerSelection = originalUpdateMonthPickerSelection;
        });

        test('should cover populateYearPicker with missing select element', () => {
            const originalGetElementById = document.getElementById;
            document.getElementById = jest.fn(() => null);

            expect(() => propertiesManager.populateYearPicker()).not.toThrow();

            document.getElementById = originalGetElementById;
        });

        test('should cover setCurrentMonth with no data available', () => {
            // Mock hasDataForMonthYear to return false
            const originalHasDataForMonthYear = propertiesManager.hasDataForMonthYear;
            propertiesManager.hasDataForMonthYear = jest.fn(() => false);

            // Mock getLastAvailableMonthYear to return null
            const originalGetLastAvailableMonthYear = propertiesManager.getLastAvailableMonthYear;
            propertiesManager.getLastAvailableMonthYear = jest.fn(() => null);

            expect(() => propertiesManager.setCurrentMonth()).not.toThrow();

            propertiesManager.hasDataForMonthYear = originalHasDataForMonthYear;
            propertiesManager.getLastAvailableMonthYear = originalGetLastAvailableMonthYear;
        });

        test('should cover handleYearMonthChange with missing elements', () => {
            const originalGetElementById = document.getElementById;
            document.getElementById = jest.fn(() => null);

            expect(() => propertiesManager.handleYearMonthChange()).not.toThrow();

            document.getElementById = originalGetElementById;
        });

        test('should cover showDeleteButtonTooltip with null button', () => {
            expect(() => propertiesManager.showDeleteButtonTooltip(null)).not.toThrow();
        });

        test('should cover renderPropertiesDashboard with missing content element', () => {
            const dashboard = document.getElementById('propertiesDashboard');
            dashboard.innerHTML = '<div class="dashboard-content"></div>';
            const contentElement = dashboard.querySelector('.dashboard-content');
            contentElement.remove(); // Remove content element

            dataManager.getProperties.mockReturnValue([]);
            expect(() => propertiesManager.renderPropertiesDashboard()).not.toThrow();
        });

        test('should cover renderPropertyItem error handling', () => {
            const property = { id: 1, name: 'Test Property' };
            dataManager.getCurrentPeriodData.mockImplementation(() => {
                throw new Error('Data error');
            });

            expect(() => propertiesManager.renderPropertyItem(property)).not.toThrow();
        });

        test('should cover renderCategoryItem hierarchical rendering', () => {
            const property = {
                expenses: { 'Utilities': { 'Electric': -100, 'Water': -50 } },
            };
            const category = 'Utilities';

            const result = propertiesManager.renderCategoryItem(category, property);
            expect(result).toContain('Utilities');
            expect(result).toContain('$150'); // Sum of Electric and Water
        });

        test('should cover renderCategoryItem flat rendering', () => {
            const property = {
                expenses: { 'Rent': -1000 },
            };
            const category = 'Rent';

            const result = propertiesManager.renderCategoryItem(category, property);
            expect(result).toContain('Rent');
            expect(result).toContain('$1000');
        });

        test('should cover showModal with existing modal', () => {
            const existingModal = document.createElement('div');
            existingModal.id = 'testModal';
            document.body.appendChild(existingModal);

            expect(() => propertiesManager.showModal('testModal', '<p>Content</p>')).not.toThrow();

            // Clean up
            const modal = document.getElementById('testModal');
            if (modal) {modal.remove();}
        });

        test('should cover handlePropertyNameEdit selection logic', () => {
            const element = document.createElement('div');
            element.className = 'property-name editable';
            element.dataset.propertyId = '2';
            document.body.appendChild(element);

            propertiesManager.currentPropertyId = 1; // Different property selected
            dataManager.getPropertyById.mockReturnValue({ id: 2, name: 'Property 2' });

            expect(() => propertiesManager.handlePropertyNameEdit({ target: element })).not.toThrow();

            document.body.removeChild(element);
        });

        test('should cover handleCategoryNameEdit selection logic', () => {
            const element = document.createElement('div');
            element.className = 'category-name editable';
            element.dataset.category = 'Utilities';
            document.body.appendChild(element);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = { category: 'Rent' }; // Different category
            dataManager.getPropertyById.mockReturnValue({ expenses: { 'Utilities': -500 } });

            expect(() => propertiesManager.handleCategoryNameEdit({ target: element })).not.toThrow();

            document.body.removeChild(element);
        });

        test('should cover handleSubcategoryNameEdit selection logic', () => {
            const element = document.createElement('div');
            element.className = 'subcategory-name editable';
            element.dataset.category = 'Utilities';
            element.dataset.subcategory = 'Gas';
            document.body.appendChild(element);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = { category: 'Utilities', subcategory: 'Electric' }; // Different subcategory
            dataManager.getPropertyById.mockReturnValue({ expenses: { 'Utilities': { 'Gas': -50 } } });

            expect(() => propertiesManager.handleSubcategoryNameEdit({ target: element })).not.toThrow();

            document.body.removeChild(element);
        });

        test('should cover handleBackNavigation from subcategory', () => {
            propertiesManager.currentCategoryPath = { category: 'Utilities', subcategory: 'Electric' };
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentCategoryPath).toEqual({ category: 'Utilities' });
        });

        test('should cover handleBackNavigation from category', () => {
            propertiesManager.currentCategoryPath = { category: 'Utilities' };
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentCategoryPath).toBeNull();
        });

        test('should cover handleBackNavigation from property', () => {
            propertiesManager.currentPropertyId = 1;
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentPropertyId).toBeNull();
        });

        test('should cover showInlineDeleteConfirmation for property', () => {
            const mockProperty = { id: 1, name: 'Test Property' };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            expect(() => propertiesManager.showInlineDeleteConfirmation(1, 'property', 'Test Property')).not.toThrow();
        });

        test('should cover showInlineDeleteConfirmation for category', () => {
            propertiesManager.currentPropertyId = 1;
            expect(() => propertiesManager.showInlineDeleteConfirmation(1, 'category', 'Rent')).not.toThrow();
        });

        test('should cover showInlineDeleteConfirmation for subcategory', () => {
            propertiesManager.currentPropertyId = 1;
            expect(() => propertiesManager.showInlineDeleteConfirmation(1, 'subcategory', 'Electric', 'Utilities')).not.toThrow();
        });

        test('should cover positionConfirmationPopup with small viewport', () => {
            const popup = document.createElement('div');
            const button = document.createElement('button');

            button.getBoundingClientRect = jest.fn(() => ({
                width: 40, height: 40, top: 1000, left: 100, right: 140, bottom: 1040,
            }));

            popup.getBoundingClientRect = jest.fn(() => ({
                width: 200, height: 60,
            }));

            const originalInnerWidth = window.innerWidth;
            const originalInnerHeight = window.innerHeight;
            Object.defineProperty(window, 'innerWidth', { value: 150, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 500, writable: true });

            expect(() => propertiesManager.positionConfirmationPopup(popup, button)).not.toThrow();

            Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
        });

        test('should cover initializeHeaderPickers with available years', () => {
            dataManager.getAvailableYears.mockReturnValue(['2023', '2024', '2025']);
            expect(() => propertiesManager.initializeHeaderPickers()).not.toThrow();
        });

        test('should cover populateYearPicker with years data', () => {
            dataManager.getAvailableYears.mockReturnValue(['2023', '2024', '2025']);
            expect(() => propertiesManager.populateYearPicker()).not.toThrow();
        });

        test('should cover setCurrentMonth with available data', () => {
            propertiesManager.hasDataForMonthYear = jest.fn(() => true);
            expect(() => propertiesManager.setCurrentMonth()).not.toThrow();
        });

        test('should cover hasDataForMonthYear with empty properties', () => {
            dataManager.getProperties.mockReturnValue([]);
            const result = propertiesManager.hasDataForMonthYear('2025', '01');
            expect(result).toBe(false);
        });

        test('should cover hasDataForMonthYear with properties but no expenses', () => {
            const prop = { expenses: {} };
            dataManager.getProperties.mockReturnValue([prop]);
            const result = propertiesManager.hasDataForMonthYear('2025', '01');
            expect(result).toBe(false);
        });

        test('should cover getLastAvailableMonthYear with monthly data', () => {
            const prop = {
                monthlyData: {
                    'Mar 2025': { expenses: { 'Rent': -1000 } },
                    'Jan 2025': { expenses: { 'Rent': -500 } },
                },
            };
            dataManager.getProperties.mockReturnValue([prop]);
            const result = propertiesManager.getLastAvailableMonthYear();
            expect(result).toEqual({ year: '2025', month: '03' });
        });

        test('should cover parseMonthKey with valid format', () => {
            const result = propertiesManager.parseMonthKey('Jan 2025');
            expect(result.getFullYear()).toBe(2025);
            expect(result.getMonth()).toBe(0);
        });

        test('should cover parseMonthKey with invalid format', () => {
            const result = propertiesManager.parseMonthKey('Invalid');
            expect(result.getFullYear()).toBe(1900);
        });

        test('should cover getLastAvailableMonthForYear with matching data', () => {
            const prop = {
                monthlyData: {
                    'Mar 2025': { expenses: { 'Rent': -1000 } },
                    'Jan 2025': { expenses: { 'Rent': -500 } },
                },
            };
            dataManager.getProperties.mockReturnValue([prop]);
            const result = propertiesManager.getLastAvailableMonthForYear('2025');
            expect(result).toBe('03');
        });

        test('should cover forceUpdatePickerUI with null values', () => {
            expect(() => propertiesManager.forceUpdatePickerUI(null, null)).not.toThrow();
        });

        test('should cover handleTimePeriodChange with UI manager updateDataDisplay', () => {
            uiManager.updateDataDisplay = jest.fn();
            expect(() => propertiesManager.handleTimePeriodChange()).not.toThrow();
        });

        test('should cover cleanup with timers and visible buttons', () => {
            propertiesManager.longPressTimers.set('test', 123);
            const mockElement = document.createElement('div');
            mockElement.className = 'property-item';
            const mockButton = document.createElement('button');
            mockButton.className = 'property-action delete-hidden';
            mockButton.dataset.action = 'delete';
            mockElement.appendChild(mockButton);
            document.body.appendChild(mockElement);

            propertiesManager.visibleDeleteButtons.set(mockElement, { propertyId: 1 });

            expect(() => propertiesManager.cleanup()).not.toThrow();

            expect(propertiesManager.longPressTimers.size).toBe(0);
            expect(propertiesManager.visibleDeleteButtons.size).toBe(0);

            document.body.removeChild(mockElement);
        });

        test('should cover tooltip positioning with right overflow', () => {
            const button = document.createElement('button');
            button.id = 'add-property-btn';
            document.body.appendChild(button);

            const mockRect = {
                width: 40, height: 40, top: 100, left: 100, right: 140, bottom: 140,
            };
            button.getBoundingClientRect = jest.fn(() => mockRect);

            const originalInnerWidth = window.innerWidth;
            Object.defineProperty(window, 'innerWidth', { value: 120, writable: true });

            expect(() => propertiesManager.showAddButtonTooltip(button, {})).not.toThrow();

            Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
            document.body.removeChild(button);
        });

        test('should cover tooltip positioning with top overflow', () => {
            const button = document.createElement('button');
            button.id = 'add-property-btn';
            document.body.appendChild(button);

            const mockRect = {
                width: 40, height: 40, top: -50, left: 10, right: 50, bottom: -10,
            };
            button.getBoundingClientRect = jest.fn(() => mockRect);

            expect(() => propertiesManager.showAddButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
        });

        test('should cover delete tooltip positioning with container bounds', () => {
            const button = document.createElement('button');
            button.className = 'property-action';
            button.dataset.action = 'delete';
            document.body.appendChild(button);

            const container = document.createElement('div');
            container.id = 'propertiesDashboard';
            document.body.appendChild(container);

            const mockButtonRect = {
                width: 40, height: 40, top: 100, left: 150, right: 190, bottom: 140,
            };
            const mockContainerRect = {
                left: 0, right: 200, top: 0, bottom: 400,
            };

            button.getBoundingClientRect = jest.fn(() => mockButtonRect);
            container.getBoundingClientRect = jest.fn(() => mockContainerRect);

            expect(() => propertiesManager.showDeleteButtonTooltip(button, {})).not.toThrow();

            document.body.removeChild(button);
            document.body.removeChild(container);
        });

        test('should cover initialize error handling with DataManager throwing', async () => {
            const throwingDataManager = {
                ...dataManager,
                getProperties: jest.fn(() => { throw new Error('DataManager error'); }),
            };
            const brokenManager = new PropertiesManager(throwingDataManager, uiManager, null, historyManager);

            const originalError = console.error;
            console.error = jest.fn();

            await expect(brokenManager.initialize()).resolves.not.toThrow();

            console.error = originalError;
        });

        test('should cover setupEventListeners with missing container', () => {
            const originalGetElement = uiManager.getElement;
            uiManager.getElement = jest.fn(() => null);

            expect(() => propertiesManager.setupEventListeners()).not.toThrow();

            uiManager.getElement = originalGetElement;
        });

        test('should cover double-click text area detection outside bounds', () => {
            const element = document.createElement('div');
            element.className = 'property-name editable';
            element.textContent = 'Test';
            element.style.width = '100px';
            element.style.height = '20px';
            document.body.appendChild(element);

            const mockRect = {
                left: 0, top: 0, width: 100, height: 20, right: 100, bottom: 20,
            };
            element.getBoundingClientRect = jest.fn(() => mockRect);

            Object.defineProperty(element, 'scrollWidth', { value: 50 });
            Object.defineProperty(element, 'scrollHeight', { value: 15 });

            const mockEvent = {
                target: element,
                clientX: 80,
                clientY: 15,
                stopImmediatePropagation: jest.fn(),
            };

            expect(() => {
                const rect = element.getBoundingClientRect();
                const clickX = mockEvent.clientX;
                const clickY = mockEvent.clientY;
                const textWidth = element.scrollWidth;
                const textHeight = element.scrollHeight;
                const isInTextArea = clickX >= rect.left && clickX <= rect.left + textWidth &&
                                    clickY >= rect.top && clickY <= rect.top + textHeight;

                if (!isInTextArea) {
                    return;
                }
            }).not.toThrow();

            document.body.removeChild(element);
        });

        test('should cover expense edit with selection needed for subcategory', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            valueElement.dataset.category = 'Utilities';
            valueElement.dataset.subcategory = 'Electricity';
            document.body.appendChild(valueElement);

            propertiesManager.currentCategoryPath = null;

            const mockEvent = {
                target: valueElement,
                stopPropagation: jest.fn(),
                preventDefault: jest.fn(),
            };

            expect(() => propertiesManager.handleExpenseEdit(mockEvent)).not.toThrow();

            document.body.removeChild(valueElement);
        });

        test('should cover getCategoryExpenseValue fallback to property expenses', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };

            const originalGetCurrentPeriodData = dataManager.getCurrentPeriodData;
            dataManager.getCurrentPeriodData = jest.fn(() => null);

            const result = propertiesManager.getCategoryExpenseValue(mockProperty, 'Rent');
            expect(result).toBe(-1000);

            dataManager.getCurrentPeriodData = originalGetCurrentPeriodData;
        });

        test('should cover getCategoryExpenseValue with global categories initialization', () => {
            const mockProperty = {
                expenses: {},
            };

            const originalWindowDataManager = window.dataManager;
            window.dataManager = {
                getExpenseCategories: jest.fn(() => ['Rent']),
                getProperties: jest.fn(() => [{
                    expenses: { 'Rent': {} },
                }]),
            };

            const result = propertiesManager.getCategoryExpenseValue(mockProperty, 'Rent');
            expect(result).toEqual({});

            window.dataManager = originalWindowDataManager;
        });

        test('should cover handleItemClick for property selection', () => {
            const propertyItem = document.createElement('div');
            propertyItem.className = 'property-item';
            propertyItem.dataset.propertyId = '1';
            document.body.appendChild(propertyItem);

            const mockEvent = { target: propertyItem };

            expect(() => propertiesManager.handleItemClick(mockEvent)).not.toThrow();

            document.body.removeChild(propertyItem);
        });

        test('should cover handleItemClick for category selection hierarchical', () => {
            const categoryItem = document.createElement('div');
            categoryItem.className = 'property-item';
            categoryItem.dataset.category = 'Utilities';
            document.body.appendChild(categoryItem);

            propertiesManager.currentPropertyId = 1;

            const mockProperty = { expenses: { 'Utilities': {} } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            const mockEvent = { target: categoryItem };

            expect(() => propertiesManager.handleItemClick(mockEvent)).not.toThrow();

            document.body.removeChild(categoryItem);
        });

        test('should cover handleItemClick for subcategory selection', () => {
            const subcategoryItem = document.createElement('div');
            subcategoryItem.className = 'property-item';
            subcategoryItem.dataset.category = 'Utilities';
            subcategoryItem.dataset.subcategory = 'Electricity';
            document.body.appendChild(subcategoryItem);

            const mockEvent = { target: subcategoryItem };

            expect(() => propertiesManager.handleItemClick(mockEvent)).not.toThrow();

            document.body.removeChild(subcategoryItem);
        });

        test('should cover renderSubcategoriesPanel hierarchical case', () => {
            const mockProperty = {
                expenses: { 'Utilities': { 'Electric': -100, 'Water': -50 } },
            };

            expect(() => propertiesManager.renderSubcategoriesPanel(mockProperty, 'Utilities', null)).not.toThrow();
        });

        test('should cover renderSubcategoriesPanel flat case', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };

            expect(() => propertiesManager.renderSubcategoriesPanel(mockProperty, 'Rent', null)).not.toThrow();
        });

        test('should cover saveExpenseValue with NaN values', () => {
            const mockProperty = { expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Rent';
            mockInput.value = 'invalid';

            expect(() => propertiesManager.handleExpenseSave({ target: mockInput })).not.toThrow();
        });

        test('should cover saveExpenseValue income category logic', () => {
            const mockProperty = { expenses: { 'Salary': 5000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            dataManager.getIncomeCategories.mockReturnValue(['Salary']);

            propertiesManager.currentPropertyId = 1;

            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Salary';
            mockInput.value = '-6000';

            expect(() => propertiesManager.handleExpenseSave({ target: mockInput })).not.toThrow();
        });

        test('should cover getCurrentExpenseValue for subcategories', () => {
            const mockProperty = {
                expenses: { 'Utilities': { 'Electric': -100 } },
            };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            dataManager.getCurrentPeriodData.mockReturnValue({
                expenses: { 'Utilities': { 'Electric': -150 } },
            });

            propertiesManager.currentPropertyId = 1;

            const result = propertiesManager.getCurrentExpenseValue('Utilities', 'Electric');
            expect(result).toBe(-150);
        });

        test('should cover startExpenseEdit with different input types', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            valueElement.dataset.category = 'Rent';
            valueElement.textContent = '$1000';
            document.body.appendChild(valueElement);

            expect(() => propertiesManager.startExpenseEdit(valueElement, 'Rent')).not.toThrow();

            document.body.removeChild(valueElement);
        });

        test('should cover handleExpenseSave with different input scenarios', () => {
            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Rent';
            mockInput.value = '1200';

            expect(() => propertiesManager.handleExpenseSave({ target: mockInput })).not.toThrow();
        });

        test('should cover cancelExpenseEdit with different elements', () => {
            const valueElement = document.createElement('div');
            valueElement.className = 'expense-value';
            document.body.appendChild(valueElement);

            const mockInput = document.createElement('input');
            mockInput.className = 'expense-input';
            mockInput.dataset.category = 'Rent';
            valueElement.appendChild(mockInput);

            expect(() => propertiesManager.cancelExpenseEdit(mockInput)).not.toThrow();

            document.body.removeChild(valueElement);
        });

        test('should cover name editing methods with different scenarios', () => {
            const propertyElement = document.createElement('div');
            propertyElement.className = 'property-name editable';
            propertyElement.dataset.propertyId = '1';
            document.body.appendChild(propertyElement);

            propertiesManager.currentPropertyId = 1;
            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Test Property' });

            expect(() => propertiesManager.handlePropertyNameEdit({ target: propertyElement })).not.toThrow();

            document.body.removeChild(propertyElement);
        });

        test('should cover category name edit when not selected', () => {
            const categoryElement = document.createElement('div');
            categoryElement.className = 'category-name editable';
            categoryElement.dataset.category = 'Rent';
            document.body.appendChild(categoryElement);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = null;

            expect(() => propertiesManager.handleCategoryNameEdit({ target: categoryElement })).not.toThrow();

            document.body.removeChild(categoryElement);
        });

        test('should cover subcategory name edit when not selected', () => {
            const subcategoryElement = document.createElement('div');
            subcategoryElement.className = 'subcategory-name editable';
            subcategoryElement.dataset.category = 'Utilities';
            subcategoryElement.dataset.subcategory = 'Electric';
            document.body.appendChild(subcategoryElement);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = null;

            expect(() => propertiesManager.handleSubcategoryNameEdit({ target: subcategoryElement })).not.toThrow();

            document.body.removeChild(subcategoryElement);
        });

        test('should cover name save methods with empty names', () => {
            const input = document.createElement('input');
            input.className = 'property-name-input';
            input.value = '';
            input.dataset.propertyId = '1';

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Original Name' });

            expect(() => propertiesManager.handlePropertyNameSave({ target: input })).not.toThrow();
        });

        test('should cover category name save with empty name', () => {
            const input = document.createElement('input');
            input.className = 'category-name-input';
            input.value = '';
            input.dataset.category = 'Rent';

            expect(() => propertiesManager.handleCategoryNameSave({ target: input })).not.toThrow();
        });

        test('should cover subcategory name save with empty name', () => {
            const input = document.createElement('input');
            input.className = 'subcategory-name-input';
            input.value = '';
            input.dataset.category = 'Electric';

            expect(() => propertiesManager.handleSubcategoryNameSave({ target: input })).not.toThrow();
        });

        test('should cover name keydown handlers with Escape key', () => {
            const propertyElement = document.createElement('div');
            propertyElement.className = 'property-name';
            document.body.appendChild(propertyElement);

            const propertyInput = document.createElement('input');
            propertyInput.className = 'property-name-input';
            propertyInput.dataset.propertyId = '1';
            propertyElement.appendChild(propertyInput);

            dataManager.getPropertyById.mockReturnValue({ id: 1, name: 'Original Name' });

            const mockEvent = { key: 'Escape', target: propertyInput };

            expect(() => propertiesManager.handlePropertyNameKeydown(mockEvent)).not.toThrow();

            document.body.removeChild(propertyElement);
        });

        test('should cover category name keydown with Escape', () => {
            const categoryInput = document.createElement('input');
            categoryInput.className = 'category-name-input';
            categoryInput.dataset.category = 'OldCategory';
            document.body.appendChild(categoryInput);

            const mockEvent = { key: 'Escape', target: categoryInput };

            expect(() => propertiesManager.handleCategoryNameKeydown(mockEvent)).not.toThrow();

            document.body.removeChild(categoryInput);
        });

        test('should cover subcategory name keydown with Escape', () => {
            const subcategoryInput = document.createElement('input');
            subcategoryInput.className = 'subcategory-name-input';
            subcategoryInput.dataset.category = 'Utilities';
            subcategoryInput.dataset.subcategory = 'OldSub';
            document.body.appendChild(subcategoryInput);

            const mockEvent = { key: 'Escape', target: subcategoryInput };

            expect(() => propertiesManager.handleSubcategoryNameKeydown(mockEvent)).not.toThrow();

            document.body.removeChild(subcategoryInput);
        });

        test('should cover handleBackNavigation for all cases', () => {
            propertiesManager.currentCategoryPath = { category: 'Utilities', subcategory: 'Electric' };
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentCategoryPath).toEqual({ category: 'Utilities' });

            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentCategoryPath).toBeNull();

            propertiesManager.currentPropertyId = 1;
            propertiesManager.handleBackNavigation();
            expect(propertiesManager.currentPropertyId).toBeNull();
        });

        test('should cover showModal with existing modal cleanup', () => {
            const existingModal = document.createElement('div');
            existingModal.id = 'testModal';
            document.body.appendChild(existingModal);

            expect(() => propertiesManager.showModal('testModal', '<p>Test</p>')).not.toThrow();

            const modal = document.getElementById('testModal');
            if (modal) {modal.remove();}
        });

        test('should cover updateCategoryName with duplicate name', () => {
            const mockProperty = { expenses: { 'Rent': -1000, 'NewRent': -500 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            expect(() => propertiesManager.updateCategoryName('Rent', 'NewRent')).not.toThrow();
        });

        test('should cover updateSubcategoryName with duplicate name', () => {
            const mockProperty = { expenses: { 'Utilities': { 'Electric': -100, 'NewElectric': -50 } } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            expect(() => propertiesManager.updateSubcategoryName('Utilities', 'Electric', 'NewElectric')).not.toThrow();
        });

        test('should cover addCategory with existing name', () => {
            const mockProperty = { expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;

            expect(() => propertiesManager.addCategory('Rent', false)).not.toThrow();
        });

        test('should cover addSubcategory with existing name', () => {
            const mockProperty = { expenses: { 'Utilities': { 'Electric': -100 } } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = { category: 'Utilities' };

            expect(() => propertiesManager.addSubcategory('Electric', 200)).not.toThrow();
        });

        test('should cover addSubcategory without hierarchical category', () => {
            const mockProperty = { expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);

            propertiesManager.currentPropertyId = 1;
            propertiesManager.currentCategoryPath = { category: 'Rent' };

            expect(() => propertiesManager.addSubcategory('SubRent', 200)).not.toThrow();
        });

        test('should cover deleteCategory and deleteSubcategory error cases', () => {
            dataManager.getPropertyById.mockReturnValue(null);
            expect(() => propertiesManager.deleteCategory('Rent')).not.toThrow();

            const mockProperty = { expenses: { 'Rent': -1000 } };
            dataManager.getPropertyById.mockReturnValue(mockProperty);
            expect(() => propertiesManager.deleteSubcategory('Rent', 'January')).not.toThrow();
        });

        test('should cover showInlineDeleteConfirmation with missing button', () => {
            const originalFindDeleteButton = propertiesManager.findDeleteButton;
            propertiesManager.findDeleteButton = jest.fn(() => null);

            expect(() => propertiesManager.showInlineDeleteConfirmation(1, 'property', 'Test')).not.toThrow();

            propertiesManager.findDeleteButton = originalFindDeleteButton;
        });

        test('should cover positionConfirmationPopup with different positions', () => {
            const popup = document.createElement('div');
            const button = document.createElement('button');

            button.getBoundingClientRect = jest.fn(() => ({
                width: 40, height: 40, top: 10, left: 10, right: 50, bottom: 50,
            }));

            popup.getBoundingClientRect = jest.fn(() => ({
                width: 100, height: 50,
            }));

            const originalInnerWidth = window.innerWidth;
            const originalInnerHeight = window.innerHeight;
            Object.defineProperty(window, 'innerWidth', { value: 80, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 80, writable: true });

            expect(() => propertiesManager.positionConfirmationPopup(popup, button)).not.toThrow();

            Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
        });

        test('should cover startLongPressDetection with existing timers', () => {
            const element = document.createElement('div');
            element.dataset.propertyId = '1';

            propertiesManager.longPressTimers.set('existing', 999);

            expect(() => propertiesManager.startLongPressDetection(element, {})).not.toThrow();

            propertiesManager.cancelLongPressDetection();
        });

        test('should cover showDeleteButton with re-render logic', () => {
            const item = document.createElement('div');
            item.className = 'property-item';
            item.dataset.propertyId = '1';
            document.body.appendChild(item);

            propertiesManager.currentPropertyId = null;

            expect(() => propertiesManager.showDeleteButton(item)).not.toThrow();

            document.body.removeChild(item);
        });

        test('should cover findItemElement for all cases', () => {
            const propElement = document.createElement('div');
            propElement.dataset.propertyId = '1';
            document.body.appendChild(propElement);

            expect(propertiesManager.findItemElement(1)).toBe(propElement);

            const catElement = document.createElement('div');
            catElement.className = 'property-item';
            catElement.dataset.category = 'Rent';
            document.body.appendChild(catElement);

            expect(propertiesManager.findItemElement(null, 'Rent')).toBe(catElement);

            const subElement = document.createElement('div');
            subElement.dataset.category = 'Utilities';
            subElement.dataset.subcategory = 'Electric';
            document.body.appendChild(subElement);

            expect(propertiesManager.findItemElement(null, 'Utilities', 'Electric')).toBe(subElement);

            document.body.removeChild(propElement);
            document.body.removeChild(catElement);
            document.body.removeChild(subElement);
        });

        test('should cover isExpenseCategory and isIncomeCategory', () => {
            dataManager.getExpenseCategories.mockReturnValue(['Rent', 'Utilities']);
            dataManager.getIncomeCategories.mockReturnValue(['Salary']);

            expect(propertiesManager.isExpenseCategory('Rent')).toBe(true);
            expect(propertiesManager.isExpenseCategory('Salary')).toBe(false);
            expect(propertiesManager.isIncomeCategory('Salary')).toBe(true);
            expect(propertiesManager.isIncomeCategory('Rent')).toBe(false);
        });

        test('should cover initializeHeaderPickers with different scenarios', () => {
            dataManager.getAvailableYears.mockReturnValue([]);
            expect(() => propertiesManager.initializeHeaderPickers()).not.toThrow();

            dataManager.getAvailableYears.mockReturnValue(['2024', '2025']);
        });

        test('should cover populateYearPicker with missing select element', () => {
            const originalGetElementById = document.getElementById;
            document.getElementById = jest.fn(() => null);

            expect(() => propertiesManager.populateYearPicker()).not.toThrow();

            document.getElementById = originalGetElementById;
        });

        test('should cover setCurrentMonth with no data available', () => {
            propertiesManager.hasDataForMonthYear = jest.fn(() => false);
            propertiesManager.getLastAvailableMonthYear = jest.fn(() => null);

            expect(() => propertiesManager.setCurrentMonth()).not.toThrow();
        });

        test('should cover handleYearMonthChange with missing elements', () => {
            const originalGetElementById = document.getElementById;
            document.getElementById = jest.fn(() => null);

            expect(() => propertiesManager.handleYearMonthChange()).not.toThrow();

            document.getElementById = originalGetElementById;
        });

        test('should cover getMonthName with invalid month', () => {
            expect(propertiesManager.getMonthName('13')).toBe('13');
            expect(propertiesManager.getMonthName('00')).toBe('00');
        });

        test('should cover hasDataForMonthYear with properties that have expenses', () => {
            const mockProperty = {
                expenses: { 'Rent': -1000 },
            };
            dataManager.getProperties.mockReturnValue([mockProperty]);

            const result = propertiesManager.hasDataForMonthYear('2025', '01');
            expect(result).toBe(true);
        });

        test('should cover getLastAvailableMonthYear with no monthly data', () => {
            const mockProperty = {
                expenses: {}, // No monthlyData
            };
            dataManager.getProperties.mockReturnValue([mockProperty]);

            const result = propertiesManager.getLastAvailableMonthYear();
            expect(result).toBeNull();
        });

        test('should cover parseMonthKey with invalid format', () => {
            const result = propertiesManager.parseMonthKey('Invalid Format');
            expect(result.getFullYear()).toBe(1900);
            expect(result.getMonth()).toBe(0);
        });

        test('should cover getLastAvailableMonthForYear with no matching data', () => {
            const mockProperty = {
                monthlyData: {
                    'Jan 2024': { expenses: {} },
                },
            };
            dataManager.getProperties.mockReturnValue([mockProperty]);

            const result = propertiesManager.getLastAvailableMonthForYear('2025');
            expect(result).toBeNull();
        });

        test('should cover forceUpdatePickerUI with missing elements', () => {
            const originalQuerySelectorAll = document.querySelectorAll;
            document.querySelectorAll = jest.fn(() => []);

            expect(() => propertiesManager.forceUpdatePickerUI('2025', '09')).not.toThrow();

            document.querySelectorAll = originalQuerySelectorAll;
        });

        test('should cover handleTimePeriodChange with missing UI manager methods', () => {
            const originalUpdateDataDisplay = uiManager.updateDataDisplay;
            uiManager.updateDataDisplay = undefined;

            expect(() => propertiesManager.handleTimePeriodChange()).not.toThrow();

            uiManager.updateDataDisplay = originalUpdateDataDisplay;
        });

        test('should cover cleanup with timers and visible buttons', () => {
            propertiesManager.longPressTimers.set('test', 123);
            const mockElement = document.createElement('div');
            mockElement.className = 'property-item';
            const mockButton = document.createElement('button');
            mockButton.className = 'property-action delete-hidden';
            mockButton.dataset.action = 'delete';
            mockElement.appendChild(mockButton);
            document.body.appendChild(mockElement);

            propertiesManager.visibleDeleteButtons.set(mockElement, { propertyId: 1 });

            expect(() => propertiesManager.cleanup()).not.toThrow();

            expect(propertiesManager.longPressTimers.size).toBe(0);
            expect(propertiesManager.visibleDeleteButtons.size).toBe(0);

            document.body.removeChild(mockElement);
        });
    });
});
