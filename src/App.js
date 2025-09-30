/**
 * Main Application Orchestrator
 * Integrates all modules and manages application lifecycle
 * - Coordinates module interactions
 * - Manages application state
 * - Handles initialization and cleanup
 * - Provides unified API for UI interactions
 */

class App {
    constructor(dataManager, uiManager, eventHandler, chartRenderer, historyManager, formatter, storage, validator, themeManager, propertiesManager) {
        // Core modules
        this.dataManager = dataManager;
        this.uiManager = uiManager;
        this.eventHandler = eventHandler;
        this.chartRenderer = chartRenderer;
        this.historyManager = historyManager;
        this.propertiesManager = propertiesManager;

        // Pass themeManager to chartRenderer
        if (this.chartRenderer && typeof this.chartRenderer.setThemeManager === 'function') {
            this.chartRenderer.setThemeManager(themeManager);
        }

        // Utility modules
        this.formatter = formatter;
        this.storage = storage;
        this.validator = validator;
        this.themeManager = themeManager;

        // Application state
        this.isInitialized = false;
        this.currentView = 'overview';
        this.currentTimePeriod = 'all';

        console.log('[APP] Application orchestrator initialized');
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            console.log('[APP] Starting application initialization...');

            // Initialize utility modules first
            await this.initializeUtilityModules();

            // Initialize core modules
            await this.initializeCoreModules();

            // Setup module dependencies
            this.setupModuleDependencies();

            // Initialize application state
            await this.initializeApplicationState();

            // Setup event handlers
            this.setupEventHandlers();

            // Mark as initialized
            this.isInitialized = true;

            console.log('[APP] Application initialization complete');

            // Show initial view
            this.showOverviewView();

        } catch (error) {
            console.error('[APP] Initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize utility modules
     */
    async initializeUtilityModules() {
        console.log('[APP] Initializing utility modules...');

        // Utility modules are already initialized by ModuleLoader
        // Just ensure they have initialize methods if needed
        if (typeof this.formatter.initialize === 'function') {
            await this.formatter.initialize();
        }
        if (typeof this.storage.initialize === 'function') {
            await this.storage.initialize();
        }
        if (typeof this.validator.initialize === 'function') {
            await this.validator.initialize();
        }
        if (typeof this.themeManager.initialize === 'function') {
            await this.themeManager.initialize();
        }

        console.log('[APP] Utility modules initialized');
    }

    /**
     * Initialize core modules
     */
    async initializeCoreModules() {
        console.log('[APP] Initializing core modules...');

        // Core modules are already initialized by ModuleLoader
        // Just ensure they have initialize methods if needed
        if (typeof this.dataManager.initialize === 'function') {
            await this.dataManager.initialize();
        }
        if (typeof this.uiManager.initialize === 'function') {
            await this.uiManager.initialize();
        }
        if (typeof this.historyManager.initialize === 'function') {
            await this.historyManager.initialize();
        }
        if (typeof this.eventHandler.initialize === 'function') {
            await this.eventHandler.initialize();
        }
        if (typeof this.chartRenderer.initialize === 'function') {
            await this.chartRenderer.initialize();
        }

        console.log('[APP] Core modules initialized');
    }

    /**
     * Setup module dependencies
     */
    setupModuleDependencies() {
        console.log('[APP] Setting up module dependencies...');

        // DataManager dependencies are already set in constructor
        // UIManager dependencies
        if (typeof this.uiManager.setDataManager === 'function') {
            this.uiManager.setDataManager(this.dataManager);
        }
        if (typeof this.uiManager.setEventHandler === 'function') {
            this.uiManager.setEventHandler(this.eventHandler);
        }

        // EventHandler dependencies
        if (typeof this.eventHandler.setChartRenderer === 'function') {
            this.eventHandler.setChartRenderer(this.chartRenderer);
        }

        // ChartRenderer dependencies
        if (typeof this.chartRenderer.setDataManager === 'function') {
            this.chartRenderer.setDataManager(this.dataManager);
        }
        if (typeof this.chartRenderer.setUIManager === 'function') {
            this.chartRenderer.setUIManager(this.uiManager);
        }

        console.log('[APP] Module dependencies configured');
    }

    /**
     * Initialize application state
     */
    async initializeApplicationState() {
        console.log('[APP] Initializing application state...');

        // Load data from storage
        await this.dataManager.loadData();

        // Load theme preferences
        await this.themeManager.loadPreferences();

        // Setup initial UI state
        this.uiManager.setupInitialState();

        // Force UI refresh to ensure loaded data is displayed
        console.log('[APP] Forcing UI refresh after data load...');
        await this.forceUIRefresh();

        console.log('[APP] Application state initialized');
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        console.log('[APP] Setting up event handlers...');

        // View navigation events
        this.setupViewNavigation();

        // Data management events
        this.setupDataManagement();

        // UI interaction events
        this.setupUIInteractions();

        console.log('[APP] Event handlers configured');
    }

    /**
     * Setup view navigation
     */
    setupViewNavigation() {
        if (!this.uiManager) return;

        // Overview view
        const overviewBtn = this.uiManager.getElement('overviewBtn');
        if (overviewBtn) {
            overviewBtn.addEventListener('click', () => this.showOverviewView());
        }

        // Properties view
        const propertiesBtn = this.uiManager.getElement('propertiesBtn');
        if (propertiesBtn) {
            propertiesBtn.addEventListener('click', () => this.showPropertiesView());
        }
    }

    /**
     * Setup data management events
     */
    setupDataManagement() {
        if (!this.uiManager) return;

        // History button
        const historyBtn = this.uiManager.getElement('historyBtn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => this.openHistoryManager());
        }

        // Undo/Redo buttons
        const undoBtn = this.uiManager.getElement('undoBtn');
        const redoBtn = this.uiManager.getElement('redoBtn');

        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undo());
        }

        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redo());
        }
    }

    /**
     * Setup UI interaction events
     */
    setupUIInteractions() {
        if (!this.uiManager) return;

        // Dark mode toggle
        const darkModeToggle = this.uiManager.getElement('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => this.toggleDarkMode());
        }

        // Year and month selectors handled via custom events (no direct select element)
        document.addEventListener('yearChange', (e) => {
            const selectedYear = e.detail.selectedYear;
            this.dataManager.setSelectedYear(selectedYear);

            if (this.currentView === 'properties') {
                // Properties dashboard always filters by month
                // Ensure a month is selected when year changes
                let selectedMonth = this.dataManager.getSelectedMonth();
                if (!selectedMonth || selectedMonth === 'all') {
                    // Auto-select current month or latest month with data
                    const now = new Date();
                    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

                    // Check if current month has data, otherwise find latest month with data
                    if (this.hasDataForMonthYear(selectedYear, currentMonth)) {
                        selectedMonth = currentMonth;
                      } else {
                        selectedMonth = this.getLastAvailableMonthForYear(selectedYear);
                      }

                    if (selectedMonth) {
                        this.dataManager.setSelectedMonth(selectedMonth);
                    }
                }

                // Always set to month filtering for properties dashboard
                this.dataManager.setCurrentTimePeriod('month');
            } else if (this.currentView === 'overview') {
                // For overview (sankey), set time period based on selection
                if (selectedYear !== 'all') {
                    this.dataManager.setCurrentTimePeriod('year');
                    // Show toast indicating whole year aggregation for Sankey chart
                    this.uiManager.showToast(`Showing whole year ${selectedYear} aggregated for Sankey chart`, 'info');
                } else {
                    this.dataManager.setCurrentTimePeriod('all');
                    // Show toast indicating all years for Sankey chart
                    this.uiManager.showToast('Showing all years aggregated for Sankey chart', 'info');
                }
            }

            // Update all views that depend on time period
            this.updateTimePeriodDependentViews();
        });

        document.addEventListener('monthChange', (e) => {
            const selectedMonth = e.detail.selectedMonth;
            this.dataManager.setSelectedMonth(selectedMonth);

            // Properties dashboard always filters by month
            this.dataManager.setCurrentTimePeriod('month');

            // Update all views that depend on time period
            this.updateTimePeriodDependentViews();
        });
    }

    /**
     * Setup overview navigation
     */
    setupOverviewNavigation() {
        if (!this.uiManager) return;
        const overviewBtn = this.uiManager.getElement('overviewBtn');
        if (overviewBtn) {
            overviewBtn.addEventListener('click', () => this.showOverviewView());
        }
    }

    /**
     * Setup properties navigation
     */
    setupPropertiesNavigation() {
        if (!this.uiManager) return;
        const propertiesBtn = this.uiManager.getElement('propertiesBtn');
        if (propertiesBtn) {
            propertiesBtn.addEventListener('click', () => this.showPropertiesView());
        }
    }

    /**
     * Setup undo/redo operations
     */
    setupUndoRedo() {
        if (!this.uiManager) return;
        const undoBtn = this.uiManager.getElement('undoBtn');
        const redoBtn = this.uiManager.getElement('redoBtn');

        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undo());
        }

        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redo());
        }
    }

    /**
     * Setup theme operations
     */
    setupThemeOperations() {
        // Theme operations are handled in setupUIInteractions
        // This method exists for test compatibility
    }

    /**
     * Setup history operations
     */
    setupHistoryOperations() {
        if (!this.uiManager) return;
        const historyBtn = this.uiManager.getElement('historyBtn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => this.openHistoryManager());
        }
    }

    /**
     * Setup import/export operations
     */
    setupImportExport() {
        // Import/export operations not implemented yet
        // This method exists for test compatibility
    }

    /**
     * Setup year picker operations
     */
    setupYearPickerOperations() {
        // Year picker operations are handled via custom events in setupUIInteractions
        // This method exists for test compatibility
    }

    /**
     * Setup month picker operations
     */
    setupMonthPickerOperations() {
        // Month picker operations are handled via custom events in setupUIInteractions
        // This method exists for test compatibility
    }

    /**
     * Setup color theme operations
     */
    setupColorThemeOperations() {
        if (!this.uiManager) return;
        const darkModeToggle = this.uiManager.getElement('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => this.toggleDarkMode());
        }
    }

    /**
     * Show overview view
     */
    async showOverviewView() {
        console.log('[APP] Showing overview view');

        this.currentView = 'overview';  // Add this line

        this.uiManager.hideAllDashboards();
        this.uiManager.showDashboard('overview');
        this.uiManager.updateNavigationState('overview');
        this.uiManager.updateYearPickerVisibility('overview');

        // Populate time period header with available years from loaded data
        const availableYears = this.dataManager.getAvailableYears();
        if (availableYears.length > 0) {
            this.populateTimePeriodHeader(availableYears);

            // Automatically select the most recent year
            const mostRecentYear = availableYears[availableYears.length - 1];
            this.dataManager.setSelectedYear(mostRecentYear);

            // Set time period to 'year' for filtering since we're selecting a specific year
            this.dataManager.setCurrentTimePeriod('year');

            // Show toast indicating whole year aggregation for Sankey chart
            this.uiManager.showToast(`Showing whole year ${mostRecentYear} aggregated for Sankey chart`, 'info');

            console.log('[APP] Auto-selected most recent year:', mostRecentYear);
        }

    // Render overview sankey diagram
    if (this.chartRenderer) {
        this.chartRenderer.renderOverviewSankey();
    }
    }

    /**
     * Show properties view
     */
    showPropertiesView() {
        console.log('[APP] Showing properties view');

        this.currentView = 'properties';  // Add this line

        this.uiManager.hideAllDashboards();
        this.uiManager.showDashboard('properties');
        this.uiManager.updateNavigationState('properties');
        this.uiManager.updateYearPickerVisibility('properties');

        // Initialize properties manager if not already done
        if (this.propertiesManager && typeof this.propertiesManager.initialize === 'function') {
            this.propertiesManager.initialize();
        }
    }

    /**
     * Update time period
     */
    updateTimePeriod() {
        this.dataManager.setCurrentTimePeriod(this.currentTimePeriod);

        // Update overview sankey diagram
        if (this.chartRenderer) {
            this.chartRenderer.renderOverviewSankey();
        }

        // Update properties dashboard if it's currently active
        if (this.currentView === 'properties' && this.propertiesManager) {
            this.propertiesManager.renderPropertiesDashboard();
        }

        this.updateChartCalculations();
    }

    /**
     * Update time period dependent views
     */
    updateTimePeriodDependentViews() {
        console.log('[APP] Updating time period dependent views...');

        // Update overview sankey diagram if it's active
        if (this.currentView === 'overview' && this.chartRenderer) {
            this.chartRenderer.renderOverviewSankey();
        }

        // Update properties dashboard if it's active
        if (this.currentView === 'properties' && this.propertiesManager) {
            this.propertiesManager.renderPropertiesDashboard();
        }

        // Update chart calculations
        this.updateChartCalculations();

        console.log('[APP] Time period dependent views updated');
    }

    /**
     * Populate year picker with available years
     * @param {Array} availableYears - Array of available years
     */
    populateTimePeriodHeader(availableYears) {
        // Use UIManager to populate the year picker in the header
        this.uiManager.populateYearPicker(availableYears);

        // Update selection state
        this.updateTimePeriodSelection();

        console.log(`[APP] Populated year picker with ${availableYears.length + 1} options`);
    }



    /**
     * Update time period selection UI
     */
    updateTimePeriodSelection() {
        const yearPickerHeader = this.uiManager.getElement('yearPickerHeader');
        const selectedYear = this.dataManager.getSelectedYear();

        if (yearPickerHeader) {
            // Remove selected class from all items
            const allItems = yearPickerHeader.querySelectorAll('.year-picker-item');
            allItems.forEach(item => {
                item.classList.remove('selected');
            });

            // Add selected class to the current selection
            const selectedItem = yearPickerHeader.querySelector(`[data-year="${selectedYear}"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }
        }
    }

    /**
     * Check if there's data for a specific month and year
     * @param {string} year - Year to check
     * @param {string} month - Month to check (MM format)
     * @returns {boolean} True if data exists for the month/year
     */
    hasDataForMonthYear(year, month) {
        const properties = this.dataManager.getProperties();

        // Check if any property has data for this month/year
        for (const property of properties) {
            if (property.monthlyData) {
                // Look for month key in format "MMM YYYY"
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthIndex = parseInt(month) - 1;
                const monthName = monthNames[monthIndex];

                if (monthName) {
                    const monthKey = `${monthName} ${year}`;
                    if (property.monthlyData[monthKey]) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Get the last available month for a specific year
     * @param {string} year - Year to check
     * @returns {string|null} Last month with data (MM format) or null if no data
     */
    getLastAvailableMonthForYear(year) {
        const properties = this.dataManager.getProperties();
        let latestMonth = null;

        // Find the most recent month with data for this year
        for (const property of properties) {
            if (property.monthlyData) {
                const monthKeys = Object.keys(property.monthlyData);
                for (const monthKey of monthKeys) {
                    if (monthKey.endsWith(` ${year}`)) {
                        // Extract month from "MMM YYYY" format
                        const parts = monthKey.split(' ');
                        if (parts.length === 2) {
                            const monthName = parts[0];
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const monthIndex = monthNames.indexOf(monthName);
                            if (monthIndex !== -1) {
                                const monthNum = String(monthIndex + 1).padStart(2, '0');
                                if (!latestMonth || monthNum > latestMonth) {
                                    latestMonth = monthNum;
                                }
                            }
                        }
                    }
                }
            }
        }

        return latestMonth;
    }

    /**
     * Update chart calculations
     * Currently no metrics to update after analytics removal
     */
    updateChartCalculations() {
        // No chart metrics to update for current views (overview and properties)
        console.log('[APP] Chart calculations updated (no metrics display)');
    }



    /**
     * Open history manager
     */
    openHistoryManager() {
        this.historyManager.openHistoryManager();
    }

    /**
     * Undo last action
     */
    undo() {
        this.historyManager.undo();
        this.refreshUI();
    }

    /**
     * Redo last undone action
     */
    redo() {
        this.historyManager.redo();
        this.refreshUI();
    }

    /**
     * Toggle dark mode
     */
    toggleDarkMode() {
        this.themeManager.toggleTheme();
    }

    /**
     * Force UI refresh after data loading
     */
    async forceUIRefresh() {
        console.log('[APP] Forcing UI refresh...');

        // Wait a bit for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update chart calculations with loaded data
        this.updateChartCalculations();

        // Force re-render of current view
        /*
        switch (this.currentView) {
            case 'overview':
                this.showOverviewView();
                break;
            case 'properties':
                this.showPropertiesView();
                break;
        }
        */

        // Update UI with data statistics
        try {
            const stats = this.dataManager.getDataStatistics();
            console.log('[APP] Data statistics after load:', stats);

            // Force update of any UI elements that display data
            if (this.uiManager && typeof this.uiManager.updateDataDisplay === 'function') {
                this.uiManager.updateDataDisplay(stats);
            }
        } catch (error) {
            console.warn('[APP] Failed to get data statistics:', error);
            // Continue without updating statistics
        }

        // Populate year picker with available years from loaded data
        const availableYears2 = this.dataManager.getAvailableYears();
        if (availableYears2.length > 0 && this.uiManager && typeof this.uiManager.populateYearPicker === 'function') {
            // Only populate if not already populated or if years changed
            // For simplicity, call it, but with UIManager guards, it won't loop
            this.uiManager.populateYearPicker(availableYears2);

            // If no year is currently selected, auto-select the most recent year
            const currentSelectedYear = this.dataManager.getSelectedYear();
            if (!currentSelectedYear || currentSelectedYear === 'all') {
                const mostRecentYear = availableYears2[availableYears2.length - 1];
                this.dataManager.setSelectedYear(mostRecentYear);

                // Update the year picker UI to reflect the selected year
                this.uiManager.updateYearPickerSelection(mostRecentYear);

                console.log('[APP] Auto-selected most recent year in forceUIRefresh:', mostRecentYear);
            }
        }

        console.log('[APP] UI refresh forced complete');
    }

    /**
     * Refresh UI after state changes
     */
    refreshUI() {
        console.log('[APP] Refreshing UI...');

        // Update year picker visibility
        this.uiManager.updateYearPickerVisibility(this.currentView);

        // Re-render current view
        switch (this.currentView) {
            case 'overview':
                this.showOverviewView();
                break;
            case 'properties':
                this.showPropertiesView();
                break;
        }

        // Update chart calculations
        this.updateChartCalculations();

        console.log('[APP] UI refresh complete');
    }

    /**
     * Handle initialization error
     */
    handleInitializationError(error) {
        console.error('[APP] Initialization error:', error);

        if (this.uiManager && typeof this.uiManager.showError === 'function') {
            this.uiManager.showError(
                'Failed to initialize application',
                'Please refresh the page and try again',
            );
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        console.log('[APP] Cleaning up application...');

        // Cleanup modules
        if (this.chartRenderer) {
            this.chartRenderer.cleanup();
        }

        if (this.eventHandler) {
            this.eventHandler.cleanup();
        }

        if (this.historyManager) {
            this.historyManager.cleanup();
        }

        if (this.dataManager) {
            this.dataManager.cleanup();
        }

        if (this.storage) {
            this.storage.cleanup();
        }

        console.log('[APP] Application cleanup complete');
    }

    /**
     * Debug application state
     */
    debug() {
        console.log('[APP DEBUG] === APPLICATION STATE ===');
        console.log('[APP DEBUG] Initialized:', this.isInitialized);
        console.log('[APP DEBUG] Current View:', this.currentView);
        console.log('[APP DEBUG] Current Time Period:', this.currentTimePeriod);

        console.log('[APP DEBUG] === MODULE STATUS ===');
        console.log('[APP DEBUG] DataManager:', !!this.dataManager);
        console.log('[APP DEBUG] UIManager:', !!this.uiManager);
        console.log('[APP DEBUG] EventHandler:', !!this.eventHandler);
        console.log('[APP DEBUG] ChartRenderer:', !!this.chartRenderer);
        console.log('[APP DEBUG] HistoryManager:', !!this.historyManager);

        console.log('[APP DEBUG] === UTILITY STATUS ===');
        console.log('[APP DEBUG] Formatter:', !!this.formatter);
        console.log('[APP DEBUG] Storage:', !!this.storage);
        console.log('[APP DEBUG] Validator:', !!this.validator);
        console.log('[APP DEBUG] ThemeManager:', !!this.themeManager);

        // Debug individual modules
        if (this.dataManager) {this.dataManager.debug();}
        if (this.uiManager) {this.uiManager.debug();}
        if (this.chartRenderer) {this.chartRenderer.debug();}

        console.log('[APP DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
} else {
    window.App = App;
}
