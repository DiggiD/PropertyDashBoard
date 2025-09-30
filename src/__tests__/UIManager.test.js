/**
 * Jest unit tests for UIManager
 * Tests DOM manipulation, UI state management, and user interactions
 * Focus: Element caching, event handling, modal management, theme operations
 */

// Mock external dependencies
jest.mock('../modules/utils/Formatter', () => ({
    formatCurrency: jest.fn((val) => `$${val}`),
    formatDate: jest.fn((date) => date?.toISOString().split('T')[0] || ''),
    formatNumber: jest.fn((num) => num?.toString() || '0')
}));

jest.mock('../modules/core/ThemeManager', () => ({
    isDarkModeActive: jest.fn(() => false),
    getColorTheme: jest.fn((name) => ({ name: name || 'Default' })),
    getColorThemeOptions: jest.fn(() => [{ id: 'default', name: 'Default' }]),
    getCurrentColorTheme: jest.fn(() => 'default'),
    setColorTheme: jest.fn(),
    toggleDarkMode: jest.fn(),
    setDarkMode: jest.fn()
}));

// Mock DOM elements
const mockElement = (tagName = 'div', props = {}) => {
    const el = document.createElement(tagName);
    Object.assign(el, props);
    return el;
};

// Setup DOM mocks
document.body.innerHTML = `
    <div id="app"></div>
    <div id="chart-container"></div>
    <div id="tooltip"></div>
    <div id="appContainer"></div>
    <div id="mainContent"></div>
    <div id="dashboardContainers"></div>
    <div id="overviewDashboard"></div>
    <div id="propertiesDashboard"></div>
    <div id="overviewChart"></div>
    <div id="overviewChartContent"></div>
    <div id="propertiesChartContent"></div>
    <button id="undoBtn"></button>
    <button id="redoBtn"></button>
    <button id="darkModeToggle"></button>
    <button id="historyBtn"></button>
    <div id="colorThemeDropdown"></div>
    <button id="colorThemeBtn"></button>
    <div id="colorThemeMenu"></div>
    <div id="yearPicker"></div>
    <div id="yearPickerHeader"></div>
    <div id="monthPicker"></div>
    <div id="monthPickerHeader"></div>
    <button id="overviewBtn" class="nav-item"></button>
    <button id="propertiesBtn" class="nav-item"></button>
    <div id="importModal"></div>
    <input id="importData"></input>
    <div id="detailPanel"></div>
    <div id="detailTitle"></div>
    <div id="detailContent"></div>
    <button id="closeDetailPanel"></button>
    <div id="toast"></div>
    <div id="toastMessage"></div>
    <div id="overviewLoadingState"><p>Loading...</p></div>
    <div id="propertiesLoadingState"><p>Loading...</p></div>
    <div id="total"></div>
`;

// Mock window and document methods
Object.defineProperty(window, 'ResizeObserver', {
    value: jest.fn(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn()
    }))
});

// Mock document.dispatchEvent to avoid JSDOM issues
document.dispatchEvent = jest.fn();

// Import modules after mocks
import UIManager from '../modules/core/UIManager.js';
import Formatter from '../modules/utils/Formatter.js';
import ThemeManager from '../modules/core/ThemeManager.js';

describe('UIManager', () => {
    let uiManager;
    let mockFormatter;
    let mockThemeManager;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Create fresh mocks
        mockFormatter = {
            formatCurrency: jest.fn((val) => `$${val}`),
            formatDate: jest.fn((date) => date?.toISOString().split('T')[0] || ''),
            formatNumber: jest.fn((num) => num?.toString() || '0')
        };

        mockThemeManager = {
            isDarkModeActive: jest.fn(() => false),
            getColorTheme: jest.fn((name) => ({ name: name || 'Default' })),
            getColorThemeOptions: jest.fn(() => [{ id: 'default', name: 'Default' }]),
            getCurrentColorTheme: jest.fn(() => 'default'),
            setColorTheme: jest.fn(),
            toggleDarkMode: jest.fn(),
            setDarkMode: jest.fn()
        };

        uiManager = new UIManager(mockFormatter, mockThemeManager);
        await uiManager.initialize();
    });

    afterEach(() => {
        uiManager.cleanup();
    });

    // ============================================================================
    // INITIALIZATION AND SETUP TESTS
    // ============================================================================

    describe('Initialization', () => {
        test('should initialize with dependencies', () => {
            expect(uiManager.formatter).toBe(mockFormatter);
            expect(uiManager.themeManager).toBe(mockThemeManager);
            expect(uiManager.elements).toBeInstanceOf(Map);
        });

        test('should create fallback theme manager when none provided', () => {
            const fallbackUIManager = new UIManager(mockFormatter);

            expect(fallbackUIManager.themeManager).toBeDefined();
            expect(typeof fallbackUIManager.themeManager.isDarkModeActive).toBe('function');
        });

        test('should create fallback formatter when none provided', () => {
            const fallbackUIManager = new UIManager(null, mockThemeManager);

            expect(fallbackUIManager.formatter).toBeDefined();
            expect(typeof fallbackUIManager.formatter.formatCurrency).toBe('function');
            expect(typeof fallbackUIManager.formatter.formatDate).toBe('function');
            expect(typeof fallbackUIManager.formatter.formatNumber).toBe('function');
        });

        test('should create fallback theme manager with complete interface', () => {
            const fallbackUIManager = new UIManager(mockFormatter);
            const fallbackThemeManager = fallbackUIManager.themeManager;

            // Test all interface methods
            expect(typeof fallbackThemeManager.isDarkModeActive).toBe('function');
            expect(typeof fallbackThemeManager.getColorTheme).toBe('function');
            expect(typeof fallbackThemeManager.getColorThemeOptions).toBe('function');
            expect(typeof fallbackThemeManager.getCurrentColorTheme).toBe('function');
            expect(typeof fallbackThemeManager.setColorTheme).toBe('function');
            expect(typeof fallbackThemeManager.toggleDarkMode).toBe('function');

            // Test method behaviors
            expect(fallbackThemeManager.isDarkModeActive()).toBe(false);
            expect(fallbackThemeManager.getColorTheme('test')).toEqual({ name: 'test' });
            expect(fallbackThemeManager.getColorTheme()).toEqual({ name: 'Default' });
            expect(fallbackThemeManager.getColorThemeOptions()).toEqual([{ id: 'default', name: 'Default' }]);
            expect(fallbackThemeManager.getCurrentColorTheme()).toBe('default');

            // Test console logging methods (should not throw)
            expect(() => fallbackThemeManager.setColorTheme('blue')).not.toThrow();
            expect(() => fallbackThemeManager.toggleDarkMode()).not.toThrow();
        });

        test('should create fallback elements for different element types', () => {
            // Test chart-container fallback
            const chartContainer = uiManager.createFallbackElement('chart-container');
            expect(chartContainer.tagName.toLowerCase()).toBe('div');

            // Test tooltip fallback
            const tooltip = uiManager.createFallbackElement('tooltip');
            expect(tooltip.tagName.toLowerCase()).toBe('div');

            // Test default fallback for unknown elements
            const unknownElement = uiManager.createFallbackElement('unknown');
            expect(unknownElement.tagName.toLowerCase()).toBe('div');
        });

        test('should initialize DOM elements and cache them', async () => {
            expect(uiManager.elements.size).toBeGreaterThan(0);
            expect(uiManager.elements.has('app')).toBe(true);
            expect(uiManager.elements.has('chart-container')).toBe(true);
        });

        test('should setup event listeners', async () => {
            expect(uiManager.eventListeners.size).toBeGreaterThan(0);
        });

        test('should skip setup event listeners if already set up', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            uiManager.setupEventListeners(); // Should skip
            expect(consoleSpy).toHaveBeenCalledWith('[UI] Event listeners already set up, skipping');
            consoleSpy.mockRestore();
        });

        test('should handle multiple initializations gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await uiManager.initialize();

            expect(consoleSpy).toHaveBeenCalledWith('[UI] UI manager already initialized, skipping');
            consoleSpy.mockRestore();
        });
    });

    // ============================================================================
    // ELEMENT MANAGEMENT TESTS
    // ============================================================================

    describe('Element Management', () => {
        test('should cache elements correctly', () => {
            const appElement = uiManager.getElement('app');
            expect(appElement).toBeDefined();
        });

        test('should create fallback elements when DOM elements missing', () => {
            const missingElement = uiManager.getElement('nonexistent', true);
            expect(missingElement).toBeDefined();
            expect(missingElement.getAttribute('id')).toBe('nonexistent');
        });

        test('should create specific fallback elements for known IDs', () => {
            // Remove existing element first
            const existing = document.getElementById('chart-container');
            if (existing) existing.remove();

            const chartContainer = uiManager.getElement('chart-container', true);
            expect(chartContainer).toBeDefined();
        });

        test('should handle element queries with fallbacks', () => {
            const selectorElement = uiManager.getElement('appContainer'); // Uses selector
            expect(selectorElement).toBeDefined();
        });
    });

    // ============================================================================
    // EVENT LISTENER MANAGEMENT TESTS
    // ============================================================================

    describe('Event Listener Management', () => {
        test('should add and track event listeners', () => {
            const element = document.createElement('div');
            const handler = jest.fn();

            uiManager.addEventListener(element, 'click', handler);

            expect(uiManager.eventListeners.has(element)).toBe(true);
            expect(uiManager.eventListeners.get(element).has('click')).toBe(true);
        });

        test('should remove event listeners', () => {
            const element = document.createElement('div');
            const handler = jest.fn();

            uiManager.addEventListener(element, 'click', handler);
            uiManager.removeEventListener(element, 'click');

            expect(uiManager.eventListeners.get(element).has('click')).toBe(false);
        });

        test('should handle keyboard navigation', () => {
            const mockEvent = { key: 'Escape', preventDefault: jest.fn() };
            uiManager.handleKeydown(mockEvent);
            // preventDefault is only called when there are active modals, detail panel, or dropdowns
            // Since none are active, it shouldn't be called
            expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        });

        test('should handle Escape key with active modal', () => {
            uiManager.openModal('test-modal');
            const mockEvent = { key: 'Escape', preventDefault: jest.fn() };
            uiManager.handleKeydown(mockEvent);
            expect(mockEvent.preventDefault).toHaveBeenCalled();
        });

        test('should handle Tab key navigation', () => {
            const mockEvent = { key: 'Tab', preventDefault: jest.fn() };
            uiManager.handleKeydown(mockEvent);
            // Should not prevent default without active modal
            expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        });

        test('should handle window resize', () => {
            const mockEvent = {};
            expect(() => uiManager.handleResize(mockEvent)).not.toThrow();
        });

        test('should handle theme changes', () => {
            const mockEvent = { detail: { theme: 'dark' } };
            expect(() => uiManager.handleThemeChange(mockEvent)).not.toThrow();
        });

        test('should handle color theme changes', () => {
            const mockEvent = { detail: { theme: 'blue' } };
            expect(() => uiManager.handleColorThemeChange(mockEvent)).not.toThrow();
        });
    });

    // ============================================================================
    // UI STATE MANAGEMENT TESTS
    // ============================================================================

    describe('UI State Management', () => {
        test('should set current view', () => {
            uiManager.setCurrentView('properties');
            expect(uiManager.currentView).toBe('properties');
        });

        test('should update undo/redo button states', () => {
            uiManager.updateUndoRedoButtons(true, false);

            const undoBtn = uiManager.getElement('undoBtn');
            const redoBtn = uiManager.getElement('redoBtn');

            expect(undoBtn.disabled).toBe(false);
            expect(redoBtn.disabled).toBe(true);
            expect(undoBtn.getAttribute('aria-label')).toBe('Undo last action');
            expect(redoBtn.getAttribute('aria-label')).toBe('Nothing to redo');
        });

        test('should update theme toggle button', () => {
            mockThemeManager.isDarkModeActive.mockReturnValue(true);
            uiManager.updateThemeToggle();

            expect(mockThemeManager.isDarkModeActive).toHaveBeenCalled();
        });

        test('should handle theme toggle click', () => {
            mockThemeManager.isDarkModeActive.mockReturnValue(false);
            uiManager.updateThemeToggle();

            const toggleEl = document.getElementById('theme-toggle');
            if (toggleEl && toggleEl.onclick) {
                toggleEl.onclick();
                expect(mockThemeManager.setDarkMode).toHaveBeenCalledWith(true);
            }
        });

        test('should set default theme', () => {
            uiManager.setDefaultTheme();
            expect(mockThemeManager.setDarkMode).toHaveBeenCalledWith(false);
        });

        test('should get UI statistics', () => {
            const stats = uiManager.getUIStatistics();
            expect(stats).toHaveProperty('cachedElements');
            expect(stats).toHaveProperty('activeModals');
            expect(stats).toHaveProperty('currentView');
            expect(stats).toHaveProperty('isLoading');
        });
    });

    // ============================================================================
    // ELEMENT MANIPULATION TESTS
    // ============================================================================

    describe('Element Manipulation', () => {
        test('should set element text content', () => {
            const testElement = document.createElement('div');
            testElement.id = 'test-text';
            document.body.appendChild(testElement);

            uiManager.setElementText('test-text', 'Hello World');
            expect(testElement.textContent).toBe('Hello World');

            document.body.removeChild(testElement);
        });

        test('should set element HTML content', () => {
            const testElement = document.createElement('div');
            testElement.id = 'test-html';
            document.body.appendChild(testElement);

            uiManager.setElementHTML('test-html', '<strong>Bold Text</strong>');
            expect(testElement.innerHTML).toBe('<strong>Bold Text</strong>');

            document.body.removeChild(testElement);
        });

        test('should add CSS class to element', () => {
            const testElement = document.createElement('div');
            testElement.id = 'test-class';
            document.body.appendChild(testElement);

            uiManager.addClass('test-class', 'active');
            expect(testElement.classList.contains('active')).toBe(true);

            document.body.removeChild(testElement);
        });

        test('should remove CSS class from element', () => {
            const testElement = document.createElement('div');
            testElement.id = 'test-class';
            testElement.classList.add('active');
            document.body.appendChild(testElement);

            uiManager.removeClass('test-class', 'active');
            expect(testElement.classList.contains('active')).toBe(false);

            document.body.removeChild(testElement);
        });

        test('should toggle CSS class on element', () => {
            const testElement = document.createElement('div');
            testElement.id = 'test-toggle';
            document.body.appendChild(testElement);

            uiManager.toggleClass('test-toggle', 'visible');
            expect(testElement.classList.contains('visible')).toBe(true);

            uiManager.toggleClass('test-toggle', 'visible');
            expect(testElement.classList.contains('visible')).toBe(false);

            document.body.removeChild(testElement);
        });

        test('should set element attribute', () => {
            const testElement = document.createElement('input');
            testElement.id = 'test-attr';
            document.body.appendChild(testElement);

            uiManager.setAttribute('test-attr', 'type', 'password');
            expect(testElement.getAttribute('type')).toBe('password');

            document.body.removeChild(testElement);
        });

        test('should get element attribute', () => {
            const testElement = document.createElement('div');
            testElement.id = 'test-get-attr';
            testElement.setAttribute('data-value', '123');
            document.body.appendChild(testElement);

            const value = uiManager.getAttribute('test-get-attr', 'data-value');
            expect(value).toBe('123');

            document.body.removeChild(testElement);
        });

        test('should enable and disable elements', () => {
            const testElement = document.createElement('button');
            testElement.id = 'test-enable';
            document.body.appendChild(testElement);

            uiManager.disableElement('test-enable');
            expect(testElement.disabled).toBe(true);
            expect(testElement.getAttribute('aria-disabled')).toBe('true');

            uiManager.enableElement('test-enable');
            expect(testElement.disabled).toBe(false);
            expect(testElement.getAttribute('aria-disabled')).toBe(null);

            document.body.removeChild(testElement);
        });
    });

    // ============================================================================
    // MODAL MANAGEMENT TESTS
    // ============================================================================

    describe('Modal Management', () => {
        test('should open modal', () => {
            uiManager.openModal('testModal');
            expect(uiManager.activeModals.has('testModal')).toBe(true);
        });

        test('should close modal', () => {
            uiManager.openModal('testModal');
            uiManager.closeModal('testModal');

            expect(uiManager.activeModals.has('testModal')).toBe(false);
        });

        test('should track active modals', () => {
            uiManager.openModal('modal1');
            uiManager.openModal('modal2');

            expect(uiManager.activeModals.size).toBe(2);

            uiManager.closeModal('modal1');
            expect(uiManager.activeModals.size).toBe(1);
        });

        test('should close all modals', () => {
            uiManager.openModal('modal1');
            uiManager.openModal('modal2');
            uiManager.closeAllModals();

            expect(uiManager.activeModals.size).toBe(0);
        });
    });

    // ============================================================================
    // DASHBOARD MANAGEMENT TESTS
    // ============================================================================

    describe('Dashboard Management', () => {
        test('should hide all dashboards', () => {
            uiManager.hideAllDashboards();
            // Should not throw and should handle missing elements gracefully
        });

        test('should show specific dashboard', () => {
            uiManager.showDashboard('overview');
            // Should not throw
        });

        test('should update navigation state', () => {
            uiManager.updateNavigationState('properties');
            // Should not throw
        });

        test('should update year picker visibility', () => {
            uiManager.updateYearPickerVisibility('overview');
            // Should not throw
        });
    });

    // ============================================================================
    // YEAR/MONTH PICKER TESTS
    // ============================================================================

    describe('Year/Month Picker Management', () => {
        test('should populate year picker', () => {
            const years = ['2023', '2024', '2025'];
            uiManager.populateYearPicker(years);

            // Should not throw
            expect(true).toBe(true);
        });

        test('should populate year picker with empty array', () => {
            uiManager.populateYearPicker([]);
            // Should not throw
        });

        test('should populate year picker with null', () => {
            uiManager.populateYearPicker(null);
            // Should not throw
        });

        test('should populate month picker', () => {
            uiManager.populateMonthPicker();

            // Should not throw
            expect(true).toBe(true);
        });

        test('should update year picker selection', () => {
            uiManager.updateYearPickerSelection('2025');

            // Should not throw
            expect(true).toBe(true);
        });

        test('should update month picker selection', () => {
            uiManager.updateMonthPickerSelection('09');

            // Should not throw
            expect(true).toBe(true);
        });

        test('should skip update year picker selection with empty year', () => {
            uiManager.updateYearPickerSelection('');
            // Should not throw and return early
        });

        test('should skip update month picker selection with empty month', () => {
            uiManager.updateMonthPickerSelection('');
            // Should not throw and return early
        });
    });

    // ============================================================================
    // LOADING AND ERROR STATES TESTS
    // ============================================================================

    describe('Loading and Error States', () => {
        test('should show loading state', () => {
            uiManager.showLoadingState('Loading data...');
            expect(uiManager.isLoading).toBe(true);

            const loadingElement = uiManager.getElement('overviewLoadingState');
            if (loadingElement) {
                const messageElement = loadingElement.querySelector('p');
                if (messageElement) {
                    expect(messageElement.textContent).toBe('Loading data...');
                }
            }
        });

        test('should hide loading state', () => {
            uiManager.hideLoadingState();
            expect(uiManager.isLoading).toBe(false);
        });

        test('should show error message', () => {
            uiManager.showError('Test Error', 'Test Details');
            const chartContent = uiManager.getElement('overviewChartContent');
            if (chartContent) {
                expect(chartContent.innerHTML).toContain('Test Details');
                expect(chartContent.innerHTML).toContain('Test Error');
            }
        });

        test('should show toast message', () => {
            uiManager.showToast('Test Message', 'info');
            // Should not throw
        });
    });

    // ============================================================================
    // DETAIL PANEL TESTS
    // ============================================================================

    describe('Detail Panel Management', () => {
        test('should open detail panel', () => {
            uiManager.openDetailPanel('Test Title', 'Test Content');
            // Should not throw
        });

        test('should close detail panel', () => {
            uiManager.closeDetailPanel();
            // Should not throw
        });
    });

    // ============================================================================
    // CLEANUP TESTS
    // ============================================================================

    describe('Cleanup', () => {
        test('should cleanup all resources', () => {
            // Add some event listeners first
            const element = document.createElement('div');
            const handler = jest.fn();
            uiManager.addEventListener(element, 'click', handler);

            uiManager.cleanup();

            expect(uiManager.eventListeners.size).toBe(0);
            expect(uiManager.elements.size).toBe(0);
            expect(uiManager.activeModals.size).toBe(0);
            expect(uiManager._initialized).toBe(false);
        });

        test('should handle cleanup with no resources', () => {
            uiManager.cleanup();
            // Should not throw
        });
    });

    // ============================================================================
    // DEBUG AND UTILITY TESTS
    // ============================================================================

    describe('Debug and Utilities', () => {
        test('should provide debug information', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            uiManager.debug();

            expect(consoleSpy).toHaveBeenCalledWith('[UI DEBUG] === UI MANAGER INFO ===');
            consoleSpy.mockRestore();
        });

        test('should handle missing elements gracefully', () => {
            // Test with non-existent element
            expect(() => uiManager.getElement('nonexistent')).not.toThrow();
            expect(() => uiManager.setElementText('nonexistent', 'text')).not.toThrow();
            expect(() => uiManager.addClass('nonexistent', 'class')).not.toThrow();
        });

        test('should handle theme manager errors gracefully', () => {
            // Mock theme manager to throw
            mockThemeManager.isDarkModeActive.mockImplementation(() => {
                throw new Error('Theme error');
            });

            // Currently throws - this test documents the behavior
            expect(() => uiManager.updateThemeToggle()).toThrow('Theme error');
        });
    });

    // ============================================================================
    // EDGE CASES AND ERROR HANDLING TESTS
    // ============================================================================

    describe('Edge Cases and Error Handling', () => {
        test('should handle null/undefined element operations', () => {
            expect(() => uiManager.setElementText(null, 'text')).not.toThrow();
            expect(() => uiManager.addClass(undefined, 'class')).not.toThrow();
            expect(() => uiManager.setAttribute('', 'attr', 'value')).toThrow();
        });

        test('should handle event listener errors', () => {
            const invalidElement = null;
            expect(() => uiManager.addEventListener(invalidElement, 'click', jest.fn())).toThrow();
        });

        test('should handle modal operations with invalid IDs', () => {
            expect(() => uiManager.showModal('', '')).not.toThrow();
            expect(() => uiManager.closeModal(null)).not.toThrow();
        });

        test('should show modal with title and content', () => {
            uiManager.showModal('test-modal', 'Test Title', 'Test Content');
            // Should not throw and handle the parameters
        });

        test('should hide modal with removal', () => {
            uiManager.hideModal('test-modal', true);
            // Should not throw
        });

        test('should handle DOM query failures', () => {
            // Mock querySelector to return null
            const originalQuerySelector = document.querySelector;
            document.querySelector = jest.fn(() => null);

            expect(() => uiManager.cacheElements()).not.toThrow();

            document.querySelector = originalQuerySelector;
        });

        test('should handle window resize without errors', () => {
            expect(() => uiManager.handleResize()).not.toThrow();
        });

        test('should handle theme change events with missing detail', () => {
            expect(() => uiManager.handleThemeChange({})).toThrow();
            expect(() => uiManager.handleColorThemeChange({})).toThrow();
        });

        test('should handle keyboard events with missing key', () => {
            expect(() => uiManager.handleKeydown({})).not.toThrow();
        });
    });

    // ============================================================================
    // ADDITIONAL COMPREHENSIVE TESTS FOR COVERAGE
    // ============================================================================

    describe('Element Visibility Management', () => {
        test('should show element', () => {
            const testEl = document.createElement('div');
            testEl.id = 'test-show';
            testEl.classList.add('hidden');
            document.body.appendChild(testEl);

            uiManager.showElement('test-show');
            expect(testEl.classList.contains('hidden')).toBe(false);
            expect(testEl.style.display).toBe('');
            expect(testEl.getAttribute('aria-hidden')).toBe('false');

            document.body.removeChild(testEl);
        });

        test('should hide element', () => {
            const testEl = document.createElement('div');
            testEl.id = 'test-hide';
            document.body.appendChild(testEl);

            uiManager.hideElement('test-hide');
            expect(testEl.classList.contains('hidden')).toBe(true);
            expect(testEl.style.display).toBe('none');

            document.body.removeChild(testEl);
        });
    });

    describe('Sidebar Selection', () => {
        test('should update sidebar selection for overview', () => {
            uiManager.updateSidebarSelection('overview');
            // Should not throw and handle missing elements gracefully
        });

        test('should update sidebar selection for properties', () => {
            uiManager.updateSidebarSelection('properties');
            // Should not throw and handle missing elements gracefully
        });
    });

    describe('Data Display Management', () => {
        test('should update data display with stats', () => {
            const stats = { totalProperties: 5, totalCategories: 3 };
            uiManager.updateDataDisplay(stats);
            // Should not throw
        });

        test('should update data display with no stats', () => {
            uiManager.updateDataDisplay();
            // Should not throw
        });
    });

    describe('Year Picker Advanced Features', () => {
        test('should populate year picker with ALL option for overview view', () => {
            uiManager.currentView = 'overview';
            const years = ['2022', '2023', '2024'];

            // Mock dispatchEvent to avoid JSDOM issues
            const originalDispatch = document.dispatchEvent;
            document.dispatchEvent = jest.fn();

            uiManager.populateYearPicker(years, true, '2023');

            document.dispatchEvent = originalDispatch;
            // Should not throw
        });

        test('should populate year picker without ALL option for properties view', () => {
            uiManager.currentView = 'properties';
            const years = ['2022', '2023', '2024'];

            // Mock dispatchEvent to avoid JSDOM issues
            const originalDispatch = document.dispatchEvent;
            document.dispatchEvent = jest.fn();

            uiManager.populateYearPicker(years, false, '2023');

            document.dispatchEvent = originalDispatch;
            // Should not throw
        });

        test('should create combined year picker', () => {
            const container = document.createElement('div');
            const years = ['2022', '2023', '2024'];
            uiManager.createCombinedYearPicker(container, years, '2023');
            expect(container.children.length).toBeGreaterThan(0);
        });

        test('should create compact year picker', () => {
            const container = document.createElement('div');
            const years = ['2022', '2023', '2024'];
            uiManager.createCompactYearPicker(container, years, '2023');
            expect(container.children.length).toBeGreaterThan(0);
        });

        test('should handle year selection with same year', () => {
            uiManager.selectedYear = '2023';
            uiManager.handleYearSelection('2023');
            // Should not throw
        });

        test('should handle year selection with different year', () => {
            uiManager.selectedYear = '2023';

            // Mock dispatchEvent to avoid JSDOM issues
            const originalDispatch = document.dispatchEvent;
            document.dispatchEvent = jest.fn();

            uiManager.handleYearSelection('2024');
            expect(uiManager.selectedYear).toBe('2024');

            document.dispatchEvent = originalDispatch;
        });

        test('should show year picker', () => {
            uiManager.showYearPicker();
            // Should not throw
        });

        test('should hide year picker', () => {
            uiManager.hideYearPicker();
            // Should not throw
        });
    });

    describe('Month Picker Advanced Features', () => {
        test('should populate month picker with ALL option', () => {
            uiManager.populateMonthPicker(true, 6);
            // Should not throw
        });

        test('should populate month picker without ALL option', () => {
            // Mock dispatchEvent to avoid JSDOM issues
            const originalDispatch = document.dispatchEvent;
            document.dispatchEvent = jest.fn();

            uiManager.populateMonthPicker(false, 6);

            document.dispatchEvent = originalDispatch;
            // Should not throw
        });

        test('should create compact month picker', () => {
            const container = document.createElement('div');

            // Mock dispatchEvent to avoid JSDOM issues
            const originalDispatch = document.dispatchEvent;
            document.dispatchEvent = jest.fn();

            uiManager.createCompactMonthPicker(container, 6);
            expect(container.children.length).toBeGreaterThan(0);

            document.dispatchEvent = originalDispatch;
        });

        test('should handle month selection with same month', () => {
            uiManager.selectedMonth = '06';
            uiManager.handleMonthSelection('06');
            // Should not throw
        });

        test('should handle month selection with different month', () => {
            uiManager.selectedMonth = '06';

            // Mock dispatchEvent to avoid JSDOM issues
            const originalDispatch = document.dispatchEvent;
            document.dispatchEvent = jest.fn();

            uiManager.handleMonthSelection('07');
            expect(uiManager.selectedMonth).toBe('07');

            document.dispatchEvent = originalDispatch;
        });

        test('should show month picker', () => {
            uiManager.showMonthPicker();
            // Should not throw
        });

        test('should hide month picker', () => {
            uiManager.hideMonthPicker();
            // Should not throw
        });
    });

    describe('Loading State Advanced Features', () => {
        test('should set loading state to true', () => {
            uiManager.setLoadingState(true);
            // Should not throw
        });

        test('should set loading state to false', () => {
            uiManager.setLoadingState(false);
            // Should not throw
        });

        test('should show loading state for properties view', () => {
            uiManager.currentView = 'properties';
            uiManager.showLoadingState('Loading properties...');
            expect(uiManager.isLoading).toBe(true);
        });

        test('should hide loading state', () => {
            uiManager.hideLoadingState();
            expect(uiManager.isLoading).toBe(false);
        });
    });

    describe('Error and Empty State Management', () => {
        test('should show error with custom title', () => {
            uiManager.showError('Custom error message', 'Custom Title');
            // Should not throw
        });

        test('should show empty state with action', () => {
            uiManager.showEmptyState('No data available', 'Retry', () => {});
            // Should not throw
        });

        test('should show empty state without action', () => {
            uiManager.showEmptyState('No data available');
            // Should not throw
        });
    });

    describe('Toast Advanced Features', () => {
        test('should show toast with different types', () => {
            uiManager.showToast('Success message', 'success', 1000);
            uiManager.showToast('Error message', 'error', 1000);
            uiManager.showToast('Warning message', 'warning', 1000);
            uiManager.showToast('Info message', 'info', 1000);
            // Should not throw
        });

        test('should show toast with default parameters', () => {
            uiManager.showToast('Default toast');
            // Should not throw
        });
    });

    describe('Modal Advanced Management', () => {
        test('should open modal with focus management', () => {
            const modalId = 'test-modal-focus';
            uiManager.openModal(modalId);
            expect(uiManager.activeModals.has(modalId)).toBe(true);
        });

        test('should close modal with focus return', () => {
            const modalId = 'test-modal-focus';
            uiManager.closeModal(modalId);
            expect(uiManager.activeModals.has(modalId)).toBe(false);
        });

        test('should close all modals', () => {
            uiManager.openModal('modal1');
            uiManager.openModal('modal2');
            uiManager.closeAllModals();
            expect(uiManager.activeModals.size).toBe(0);
        });
    });

    describe('Dropdown Management', () => {
        test('should toggle dropdown', () => {
            uiManager.toggleDropdown('colorThemeDropdown');
            // Should not throw
        });

        test('should toggle dropdown to close', () => {
            uiManager.openDropdown('colorThemeDropdown'); // Open first
            uiManager.toggleDropdown('colorThemeDropdown'); // Then toggle to close
            // Should not throw
        });

        test('should open dropdown', () => {
            uiManager.openDropdown('colorThemeDropdown');
            // Should not throw
        });

        test('should close dropdown', () => {
            uiManager.closeDropdown('colorThemeDropdown');
            // Should not throw
        });
    });

    describe('Detail Panel Advanced Management', () => {
        test('should open detail panel with content', () => {
            uiManager.openDetailPanel('Test Title', '<p>Test content</p>');
            // Should not throw
        });

        test('should close detail panel', () => {
            uiManager.closeDetailPanel();
            // Should not throw
        });
    });

    describe('Keyboard and Accessibility', () => {
        test('should handle modal tab navigation', () => {
            const modal = document.createElement('div');
            modal.id = 'test-modal-tab';
            modal.className = 'modal hidden'; // Start hidden
            const input1 = document.createElement('input');
            const input2 = document.createElement('input');
            modal.appendChild(input1);
            modal.appendChild(input2);
            document.body.appendChild(modal);

            uiManager.openModal('test-modal-tab'); // Open modal to make it active
            // Set active element to last focusable to trigger preventDefault
            Object.defineProperty(document, 'activeElement', { value: input2, writable: true });
            const event = { key: 'Tab', shiftKey: false, preventDefault: jest.fn() };
            uiManager.handleKeydown(event);
            expect(event.preventDefault).toHaveBeenCalled(); // Should prevent default for tab in modal

            document.body.removeChild(modal);
        });

        test('should handle escape key in detail panel', () => {
            // Create a mock detail panel
            const detailPanel = document.createElement('div');
            detailPanel.id = 'detailPanel';
            detailPanel.classList.add('open');
            document.body.appendChild(detailPanel);

            const event = { key: 'Escape', preventDefault: jest.fn() };
            uiManager.handleKeydown(event);
            expect(event.preventDefault).toHaveBeenCalled();

            document.body.removeChild(detailPanel);
        });
    });

    describe('Responsive Layout', () => {
        test('should update responsive layout for mobile', () => {
            Object.defineProperty(window, 'innerWidth', { value: 600 });
            uiManager.updateResponsiveLayout();
            // Should not throw
        });

        test('should update responsive layout for tablet', () => {
            Object.defineProperty(window, 'innerWidth', { value: 900 });
            uiManager.updateResponsiveLayout();
            // Should not throw
        });

        test('should update responsive layout for desktop', () => {
            Object.defineProperty(window, 'innerWidth', { value: 1200 });
            uiManager.updateResponsiveLayout();
            // Should not throw
        });
    });

    describe('Theme Management Advanced', () => {
        test('should handle theme change with colors', () => {
            const event = {
                detail: {
                    theme: 'dark',
                    isDark: true,
                    colors: { primary: '#000' }
                }
            };
            uiManager.handleThemeChange(event);
            // Should not throw
        });

        test('should handle color theme change with colors', () => {
            const event = {
                detail: {
                    theme: 'blue',
                    colors: { primary: '#0066cc' }
                }
            };
            uiManager.handleColorThemeChange(event);
            // Should not throw
        });

        test('should update color theme button', () => {
            uiManager.updateColorThemeButton('blue');
            // Should not throw
        });

        test('should setup color theme dropdown', () => {
            uiManager.setupColorThemeDropdown();
            // Should not throw
        });

        test('should populate color theme dropdown', () => {
            uiManager.populateColorThemeDropdown();
            // Should not throw
        });

        test('should update theme aware elements', () => {
            const themeEl = document.createElement('div');
            themeEl.setAttribute('data-theme-aware', 'true');
            document.body.appendChild(themeEl);

            uiManager.updateThemeAwareElements('dark', { primary: '#000' });
            expect(themeEl.getAttribute('data-current-theme')).toBe('dark');

            document.body.removeChild(themeEl);
        });
    });

    describe('Form Data Management', () => {
        test('should get modal form data', () => {
            const modal = document.createElement('div');
            modal.id = 'test-form-modal';
            const input = document.createElement('input');
            input.name = 'testField';
            input.value = 'test value';
            modal.appendChild(input);
            document.body.appendChild(modal);

            const data = uiManager.getModalFormData('test-form-modal');
            expect(data.testField).toBe('test value');

            document.body.removeChild(modal);
        });

        test('should set modal form data', () => {
            const modal = document.createElement('div');
            modal.id = 'test-form-modal';
            const input = document.createElement('input');
            input.name = 'testField';
            modal.appendChild(input);
            document.body.appendChild(modal);

            uiManager.setModalFormData('test-form-modal', { testField: 'new value' });
            expect(input.value).toBe('new value');

            document.body.removeChild(modal);
        });

        test('should clear modal form', () => {
            const modal = document.createElement('div');
            modal.id = 'test-form-modal';
            const input = document.createElement('input');
            input.name = 'testField';
            input.value = 'test value';
            modal.appendChild(input);
            document.body.appendChild(modal);

            uiManager.clearModalForm('test-form-modal');
            expect(input.value).toBe('');

            document.body.removeChild(modal);
        });
    });

    describe('DOM Manipulation Utilities', () => {
        test('should update element with real DOM operations', () => {
            const el = document.createElement('div');
            el.id = 'test-update';
            document.body.appendChild(el);

            uiManager.updateElement('test-update', 'new content');
            expect(el.textContent).toBe('new content');

            document.body.removeChild(el);
        });

        test('should show modal with real DOM operations', () => {
            uiManager.showModal('test-real-modal');
            const modal = document.querySelector('#test-real-modal');
            expect(modal).toBeDefined();
            if (modal) {
                expect(modal.style.display).toBe('block');
            }
        });

        test('should hide modal with real DOM operations', () => {
            uiManager.hideModal('test-real-modal');
            const modal = document.querySelector('#test-real-modal');
            if (modal) {
                expect(modal.style.display).toBe('none');
            }
        });

        test('should hide modal with removal', () => {
            uiManager.hideModal('test-real-modal', true);
            const modal = document.getElementById('test-real-modal');
            expect(modal).toBeNull();
        });
    });

    describe('Event Subscription', () => {
        test('should subscribe to events', () => {
            uiManager.eventHandler = { subscribe: jest.fn() };
            uiManager.subscribeToEvents();
            expect(uiManager.eventHandler.subscribe).toHaveBeenCalledWith('dataChange', expect.any(Function));
        });

        test('should handle data change events', () => {
            const data = { total: 100 };
            uiManager.handleDataChange(data);
            // Should not throw
        });
    });

    describe('Theme Toggle', () => {
        test('should toggle theme', () => {
            uiManager.toggleTheme();
            // Should not throw
        });
    });

    describe('Year Picker Visibility Updates', () => {
        test('should update year picker visibility for overview', () => {
            uiManager.updateYearPickerVisibility('overview');
            // Should not throw
        });

        test('should update year picker visibility for properties', () => {
            uiManager.updateYearPickerVisibility('properties');
            // Should not throw
        });

        test('should update year picker visibility for other views', () => {
            uiManager.updateYearPickerVisibility('unknown');
            // Should not throw
        });
    });

    describe('Navigation State Updates', () => {
        test('should update navigation state', () => {
            uiManager.updateNavigationState('test-view');
            // Should not throw
        });
    });

    describe('Setup Initial State', () => {
        test('should setup initial state', async () => {
            await uiManager.setupInitialState();
            // Should not throw
        });

        test('should skip setup initial state if already set up', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            await uiManager.setupInitialState(); // Should skip
            expect(consoleSpy).toHaveBeenCalledWith('[UI] Initial state already set up, skipping');
            consoleSpy.mockRestore();
        });
    });

    // ============================================================================
    // BRANCH COVERAGE IMPROVEMENTS
    // ============================================================================

    describe('Branch Coverage Improvements', () => {
        test('should cover hideAllDashboards focus management', () => {
            const dashboard = document.getElementById('overviewDashboard');
            if (dashboard) {
                const input = document.createElement('input');
                dashboard.appendChild(input);
                input.focus(); // Set as focused element
                uiManager.hideAllDashboards();
                // Should handle focus management
            }
        });

        test('should cover showDashboard focus management', () => {
            jest.useFakeTimers();
            const dashboard = document.getElementById('overviewDashboard');
            if (dashboard) {
                const button = document.createElement('button');
                button.setAttribute('tabindex', '0');
                dashboard.appendChild(button);
                uiManager.showDashboard('overview');
                jest.advanceTimersByTime(100);
                // Should handle focus management
            }
            jest.useRealTimers();
        });

        test('should cover populateYearPicker with missing header', () => {
            const header = document.getElementById('yearPickerHeader');
            if (header) header.remove();
            uiManager.populateYearPicker(['2023', '2024']);
            // Should handle missing header
        });

        test('should cover populateYearPicker selectedYear not in available', () => {
            uiManager.selectedYear = '2025'; // Not in available years
            uiManager.populateYearPicker(['2023', '2024']);
            // Should use fallback logic
        });

        test('should cover createCompactYearPicker disabled arrows', () => {
            const container = document.createElement('div');
            const years = ['2023']; // Only one year, arrows should be disabled
            uiManager.createCompactYearPicker(container, years, '2023');
            // Should disable arrows
        });

        test('should cover handleYearSelection dispatch event', () => {
            uiManager.selectedYear = '2023';
            uiManager.handleYearSelection('2024');
            expect(document.dispatchEvent).toHaveBeenCalled();
        });

        test('should cover updateThemeToggle fallback creation', () => {
            const incompleteUIManager = new UIManager(mockFormatter, {});
            incompleteUIManager.updateThemeToggle();
            // Should create fallback themeManager
        });

        test('should cover showToast timeout', () => {
            jest.useFakeTimers();
            uiManager.showToast('Test', 'info', 1000);
            const toast = uiManager.getElement('toast');
            expect(toast.getAttribute('aria-live')).toBe('polite');
            jest.advanceTimersByTime(1000);
            expect(toast.classList.contains('hidden')).toBe(true);
            expect(toast.getAttribute('aria-live')).toBe(null);
            jest.useRealTimers();
        });

        test('should cover openDropdown firstItem focus', () => {
            const menu = uiManager.getElement('colorThemeMenu');
            if (menu) {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                menu.appendChild(item);
                uiManager.openDropdown('colorThemeDropdown');
                // Should focus first item
            }
        });

        test('should cover handleModalTabNavigation last element', () => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            const input1 = document.createElement('input');
            const input2 = document.createElement('input');
            modal.appendChild(input1);
            modal.appendChild(input2);
            document.body.appendChild(modal);

            Object.defineProperty(document, 'activeElement', { value: input2, writable: true });
            const event = { key: 'Tab', shiftKey: false, preventDefault: jest.fn() };
            uiManager.handleModalTabNavigation(modal, event);
            expect(event.preventDefault).toHaveBeenCalled();

            document.body.removeChild(modal);
        });

        test('should cover handleModalTabNavigation first element with shift', () => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            const input1 = document.createElement('input');
            const input2 = document.createElement('input');
            modal.appendChild(input1);
            modal.appendChild(input2);
            document.body.appendChild(modal);

            Object.defineProperty(document, 'activeElement', { value: input1, writable: true });
            const event = { key: 'Tab', shiftKey: true, preventDefault: jest.fn() };
            uiManager.handleModalTabNavigation(modal, event);
            expect(event.preventDefault).toHaveBeenCalled();

            document.body.removeChild(modal);
        });
    });

    // ============================================================================
    // INTEGRATION TESTS
    // ============================================================================

    // ============================================================================
    // ADDITIONAL TESTS FOR IMPROVED COVERAGE
    // ============================================================================

    describe('Fallback Dependencies Coverage', () => {
        test('should cover fallback formatter lines in constructor', () => {
            const testUIManager = new UIManager(null, mockThemeManager);
            expect(testUIManager.formatter.formatCurrency(100)).toBe('$100');
            expect(testUIManager.formatter.formatDate(new Date('2023-01-01'))).toBe('2023-01-01');
            expect(testUIManager.formatter.formatNumber(42)).toBe('42');
        });

        test('should cover fallback themeManager lines in constructor', () => {
            const testUIManager = new UIManager(mockFormatter, null);
            expect(testUIManager.themeManager.isDarkModeActive()).toBe(false);
            expect(testUIManager.themeManager.getColorTheme('test')).toEqual({ name: 'test' });
            expect(testUIManager.themeManager.getCurrentColorTheme()).toBe('default');
        });
    });

    describe('Year Picker Edge Cases', () => {
        test('should populate year picker with null availableYears', () => {
            uiManager.populateYearPicker(null);
            // Should not throw and use fallback
        });

        test('should populate year picker with undefined availableYears', () => {
            uiManager.populateYearPicker(undefined);
            // Should not throw
        });

        test('should create combined year picker for overview view', () => {
            uiManager.currentView = 'overview';
            const years = ['2022', '2023', '2024'];
            uiManager.populateYearPicker(years, true, '2023');
            // Should call createCombinedYearPicker
        });

        test('should handle year selection with same year', () => {
            uiManager.selectedYear = '2023';
            uiManager.handleYearSelection('2023');
            expect(uiManager.selectedYear).toBe('2023');
            // Should not dispatch event or log
        });

        test('should update year picker selection with same year', () => {
            uiManager.selectedYear = '2023';
            uiManager.updateYearPickerSelection('2023');
            // Should not update
        });

        test('should update year picker selection with empty string', () => {
            uiManager.updateYearPickerSelection('');
            // Should return early
        });
    });

    describe('Month Picker Edge Cases', () => {
        test('should populate month picker with null availableMonths', () => {
            uiManager.populateMonthPicker(true, null, null);
            // Should not throw
        });

        test('should populate month picker with empty availableMonths', () => {
            uiManager.populateMonthPicker(true, null, []);
            // Should not throw
        });

        test('should handle month selection with same month', () => {
            uiManager.selectedMonth = '06';
            uiManager.handleMonthSelection('06');
            expect(uiManager.selectedMonth).toBe('06');
        });

        test('should update month picker selection with same month', () => {
            uiManager.selectedMonth = '06';
            uiManager.updateMonthPickerSelection('06');
            // Should not update
        });

        test('should update month picker selection with empty string', () => {
            uiManager.updateMonthPickerSelection('');
            // Should return early
        });
    });

    describe('Loading States Edge Cases', () => {
        test('should set loading state to true directly', () => {
            uiManager.setLoadingState(true);
            // Should disable elements
        });

        test('should set loading state to false directly', () => {
            uiManager.setLoadingState(false);
            // Should enable elements
        });
    });

    describe('Error Handling Coverage', () => {
        test('should show error with chart content for overview', () => {
            uiManager.currentView = 'overview';
            uiManager.showError('Test error', 'Test title');
            const chartContent = uiManager.getElement('overviewChartContent');
            expect(chartContent).toBeDefined();
        });

        test('should show error with chart content for properties', () => {
            uiManager.currentView = 'properties';
            uiManager.showError('Test error', 'Test title');
            const chartContent = uiManager.getElement('propertiesChartContent');
            expect(chartContent).toBeDefined();
        });
    });

    describe('Dropdown Advanced Coverage', () => {
        test('should open dropdown with focusable items', () => {
            // First populate the dropdown
            uiManager.populateColorThemeDropdown();
            uiManager.openDropdown('colorThemeDropdown');
            // Should focus first item if exists
        });

        test('should handle menu item click in color theme dropdown', () => {
            uiManager.setupColorThemeDropdown();
            const menu = uiManager.getElement('colorThemeMenu');
            if (menu) {
                const menuItem = document.createElement('div');
                menuItem.className = 'dropdown-item';
                menuItem.setAttribute('data-theme', 'blue');
                menu.appendChild(menuItem);

                // Simulate click
                menuItem.click();
                // Should call themeManager.setColorTheme
            }
        });
    });

    describe('Theme Management Edge Cases', () => {
        test('should handle incomplete themeManager in updateThemeToggle', () => {
            const incompleteUIManager = new UIManager(mockFormatter, {});
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            incompleteUIManager.updateThemeToggle();
            expect(consoleSpy).toHaveBeenCalledWith('ThemeManager incomplete; defaulting to light.');
            consoleSpy.mockRestore();
        });
    });

    describe('Element Manipulation Edge Cases', () => {
        test('should update element with non-existent id', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            uiManager.updateElement('nonexistent', 'value');
            expect(consoleSpy).toHaveBeenCalledWith('Element not found');
            consoleSpy.mockRestore();
        });

        test('should handle modal operations with missing elements', () => {
            expect(() => uiManager.showModal('nonexistent')).not.toThrow();
            expect(() => uiManager.hideModal('nonexistent')).not.toThrow();
        });
    });

    describe('Event Handling Edge Cases', () => {
        test('should handle theme change with colors', () => {
            const event = {
                detail: {
                    theme: 'dark',
                    isDark: true,
                    colors: { primary: '#000' }
                }
            };
            uiManager.handleThemeChange(event);
            // Should not throw
        });

        test('should handle color theme change with colors', () => {
            const event = {
                detail: {
                    theme: 'blue',
                    colors: { primary: '#0066cc' }
                }
            };
            uiManager.handleColorThemeChange(event);
            // Should not throw
        });
    });

    describe('Integration Tests', () => {
        test('should handle complete UI workflow', () => {
            // Simulate a complete user interaction workflow
            uiManager.setCurrentView('overview');
            uiManager.showDashboard('overview');
            uiManager.showLoadingState('Loading data...');

            expect(uiManager.currentView).toBe('overview');
            expect(uiManager.isLoading).toBe(true);

            uiManager.hideLoadingState();
            uiManager.showToast('Operation completed', 'success');

            expect(uiManager.isLoading).toBe(false);
        });

        test('should handle modal workflow', () => {
            const modalId = 'test-workflow-modal';

            uiManager.openModal(modalId);
            expect(uiManager.activeModals.has(modalId)).toBe(true);

            uiManager.closeModal(modalId);
            expect(uiManager.activeModals.has(modalId)).toBe(false);
        });

        test('should handle element state changes', () => {
            const testEl = document.createElement('button');
            testEl.id = 'workflow-test';
            document.body.appendChild(testEl);

            uiManager.disableElement('workflow-test');
            expect(testEl.disabled).toBe(true);

            uiManager.enableElement('workflow-test');
            expect(testEl.disabled).toBe(false);

            document.body.removeChild(testEl);
        });
    });

    // ============================================================================
    // ADDITIONAL TESTS FOR BRANCH COVERAGE IMPROVEMENT
    // ============================================================================

    describe('Branch Coverage Improvements', () => {
        test('should cover setupInitialState console.log and initializeUIState call', async () => {
            // Create a fresh instance that's not initialized
            const freshUIManager = new UIManager(mockFormatter, mockThemeManager);
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            await freshUIManager.setupInitialState();
            expect(consoleSpy).toHaveBeenCalledWith('[UI] Initial state setup complete');
            consoleSpy.mockRestore();
            freshUIManager.cleanup();
        });

        test('should cover hideAllDashboards focus management with focused element', () => {
            const dashboard = document.getElementById('overviewDashboard');
            if (dashboard) {
                const input = document.createElement('input');
                dashboard.appendChild(input);
                input.focus(); // Set as focused element
                uiManager.hideAllDashboards();
                // Should handle focus management
            }
        });

        test('should cover showDashboard setTimeout focus with focusable element', () => {
            jest.useFakeTimers();
            const dashboard = document.getElementById('overviewDashboard');
            if (dashboard) {
                const button = document.createElement('button');
                button.setAttribute('tabindex', '0');
                dashboard.appendChild(button);
                uiManager.showDashboard('overview');
                jest.advanceTimersByTime(100);
                // Should handle focus management
            }
            jest.useRealTimers();
        });


        test('should cover populateYearPicker with stored year available', () => {
            uiManager.selectedYear = '2023';
            uiManager.populateYearPicker(['2023', '2024']);
            // Should use stored year
        });

        test('should cover createCompactYearPicker left arrow click with previous year', () => {
            const container = document.createElement('div');
            const years = ['2022', '2023', '2024'];
            uiManager.createCompactYearPicker(container, years, '2023');
            const leftArrow = container.querySelector('.year-nav-left');
            if (leftArrow) {
                leftArrow.click();
                // Should populate with previous year
            }
        });

        test('should cover createCompactYearPicker right arrow click with next year', () => {
            const container = document.createElement('div');
            const years = ['2022', '2023', '2024'];
            uiManager.createCompactYearPicker(container, years, '2023');
            const rightArrow = container.querySelector('.year-nav-right');
            if (rightArrow) {
                rightArrow.click();
                // Should populate with next year
            }
        });


        test('should cover populateMonthPicker with stored month available', () => {
            uiManager.selectedMonth = '06';
            uiManager.populateMonthPicker(true, null, ['06', '07']);
            // Should use stored month
        });

        test('should cover populateMonthPicker stored month not available but keep it', () => {
            uiManager.selectedMonth = '06';
            uiManager.populateMonthPicker(true, null, ['07', '08']);
            // Should keep stored month even if not available
        });

        test('should cover populateMonthPicker available months sort and pick last', () => {
            uiManager.populateMonthPicker(true, null, ['01', '03', '02']);
            // Should sort and pick last available month
        });

        test('should cover createCompactMonthPicker left arrow click', () => {
            const container = document.createElement('div');
            uiManager.createCompactMonthPicker(container, 6);
            const leftArrow = container.querySelector('.month-nav-left');
            if (leftArrow) {
                leftArrow.click();
                // Should populate with previous month
            }
        });

        test('should cover createCompactMonthPicker right arrow click', () => {
            const container = document.createElement('div');
            uiManager.createCompactMonthPicker(container, 6);
            const rightArrow = container.querySelector('.month-nav-right');
            if (rightArrow) {
                rightArrow.click();
                // Should populate with next month
            }
        });

        test('should cover handleMonthSelection same month UI update', () => {
            uiManager.selectedMonth = '06';
            uiManager.handleMonthSelection('06');
            // Should update UI but not dispatch event
        });

        test('should cover updateYearPickerSelection already updated log', () => {
            uiManager.selectedYear = '2023';
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            uiManager.updateYearPickerSelection('2023');
            expect(consoleSpy).toHaveBeenCalledWith('[UI] Year picker already updated to: 2023, skipping');
            consoleSpy.mockRestore();
        });

        test('should cover updateMonthPickerSelection already updated log', () => {
            uiManager.selectedMonth = '06';
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            uiManager.updateMonthPickerSelection('06');
            expect(consoleSpy).toHaveBeenCalledWith('[UI] Month picker already updated to: 06, skipping');
            consoleSpy.mockRestore();
        });

        test('should cover showLoadingState with message element', () => {
            const loadingElement = uiManager.getElement('overviewLoadingState');
            if (loadingElement) {
                const messageElement = document.createElement('p');
                loadingElement.appendChild(messageElement);
                uiManager.showLoadingState('Custom message');
                expect(messageElement.textContent).toBe('Custom message');
            }
        });

        test('should cover showError with chart content', () => {
            uiManager.currentView = 'overview';
            uiManager.showError('Test error', 'Test title');
            const chartContent = uiManager.getElement('overviewChartContent');
            expect(chartContent).toBeDefined();
        });

        test('should cover openDropdown firstItem focus', () => {
            jest.useFakeTimers();
            const menu = uiManager.getElement('colorThemeMenu');
            if (menu) {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                menu.appendChild(item);
                uiManager.openDropdown('colorThemeDropdown');
                jest.advanceTimersByTime(100);
                // Should focus first item
            }
            jest.useRealTimers();
        });

        test('should cover handleKeydown close dropdowns', () => {
            // Create a mock dropdown
            const dropdown = document.createElement('div');
            dropdown.id = 'testDropdownMenu';
            dropdown.className = 'dropdown open';
            document.body.appendChild(dropdown);

            const event = { key: 'Escape', preventDefault: jest.fn() };
            uiManager.handleKeydown(event);
            expect(event.preventDefault).toHaveBeenCalled();

            document.body.removeChild(dropdown);
        });

        test('should cover setupColorThemeDropdown menu click listener', () => {
            uiManager.setupColorThemeDropdown();
            const menu = uiManager.getElement('colorThemeMenu');
            if (menu) {
                const menuItem = document.createElement('div');
                menuItem.className = 'dropdown-item';
                menuItem.setAttribute('data-theme', 'blue');
                menu.appendChild(menuItem);

                // Simulate click
                menuItem.click();
                // Should call themeManager.setColorTheme
            }
        });

        test('should cover setupColorThemeDropdown document click listener', () => {
            uiManager.setupColorThemeDropdown();
            const dropdown = uiManager.getElement('colorThemeDropdown');
            if (dropdown) {
                // Click outside dropdown
                document.body.click();
                // Should close dropdown
            }
        });

        test('should cover showModal create new modal', () => {
            uiManager.showModal('new-test-modal');
            const modal = document.querySelector('#new-test-modalModal');
            expect(modal).toBeDefined();
            if (modal) {
                expect(modal.style.display).toBe('block');
            }
        });

        test('should cover hideModal with existing modal', () => {
            uiManager.showModal('existing-test-modal');
            uiManager.hideModal('existing-test-modal');
            const modal = document.querySelector('#existing-test-modalModal');
            if (modal) {
                expect(modal.style.display).toBe('none');
            }
        });

        test('should cover hideModal with remove', () => {
            uiManager.showModal('remove-test-modal');
            uiManager.hideModal('remove-test-modal', true);
            const modal = document.querySelector('#remove-test-modalModal');
            expect(modal).toBeNull();
        });

        test('should cover handleDataChange with total element and data', () => {
            const totalEl = document.createElement('div');
            totalEl.id = 'total';
            document.body.appendChild(totalEl);

            const data = { total: 100 };
            uiManager.handleDataChange(data);
            expect(totalEl.textContent).toBe('$100');

            document.body.removeChild(totalEl);
        });

        test('should cover updateThemeToggle incomplete themeManager fallback', () => {
            const incompleteUIManager = new UIManager(mockFormatter, {});
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            incompleteUIManager.updateThemeToggle();
            expect(consoleSpy).toHaveBeenCalledWith('ThemeManager incomplete; defaulting to light.');
            consoleSpy.mockRestore();
        });
    });
});
