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

        // Utility modules
        this.formatter = formatter;
        this.storage = storage;
        this.validator = validator;
        this.themeManager = themeManager;

        // Application state
        this.isInitialized = false;
        this.currentView = 'overview';
        this.currentTimePeriod = 'all';

        console.log('🔧 [APP] Application orchestrator initialized');
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            console.log('🔧 [APP] Starting application initialization...');

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

            console.log('🔧 [APP] Application initialization complete');

            // Show initial view
            this.showOverviewView();

        } catch (error) {
            console.error('🔧 [APP] Initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize utility modules
     */
    async initializeUtilityModules() {
        console.log('🔧 [APP] Initializing utility modules...');

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

        console.log('🔧 [APP] Utility modules initialized');
    }

    /**
     * Initialize core modules
     */
    async initializeCoreModules() {
        console.log('🔧 [APP] Initializing core modules...');

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

        console.log('🔧 [APP] Core modules initialized');
    }

    /**
     * Setup module dependencies
     */
    setupModuleDependencies() {
        console.log('🔧 [APP] Setting up module dependencies...');

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

        console.log('🔧 [APP] Module dependencies configured');
    }

    /**
     * Initialize application state
     */
    async initializeApplicationState() {
        console.log('🔧 [APP] Initializing application state...');

        // Load data from storage
        await this.dataManager.loadData();

        // Load theme preferences
        await this.themeManager.loadPreferences();

        // Setup initial UI state
        this.uiManager.setupInitialState();

        // Force UI refresh to ensure loaded data is displayed
        console.log('🔧 [APP] Forcing UI refresh after data load...');
        await this.forceUIRefresh();

        console.log('🔧 [APP] Application state initialized');
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        console.log('🔧 [APP] Setting up event handlers...');

        // View navigation events
        this.setupViewNavigation();

        // Data management events
        this.setupDataManagement();

        // UI interaction events
        this.setupUIInteractions();

        console.log('🔧 [APP] Event handlers configured');
    }

    /**
     * Setup view navigation
     */
    setupViewNavigation() {
        // Overview view
        const overviewBtn = this.uiManager.getElement('overviewBtn');
        if (overviewBtn) {
            overviewBtn.addEventListener('click', () => this.showOverviewView());
        }

        // Expenses view
        const expensesBtn = this.uiManager.getElement('expensesBtn');
        if (expensesBtn) {
            expensesBtn.addEventListener('click', () => this.showExpensesView());
        }

        // Income view
        const incomeBtn = this.uiManager.getElement('incomeBtn');
        if (incomeBtn) {
            incomeBtn.addEventListener('click', () => this.showIncomeView());
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
        // Add property button
        const addPropertyBtn = this.uiManager.getElement('addPropertyBtn');
        if (addPropertyBtn) {
            addPropertyBtn.addEventListener('click', () => this.openAddPropertyModal());
        }

        // Add category button
        const addCategoryBtn = this.uiManager.getElement('addCategoryBtn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => this.openAddCategoryModal());
        }

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
        // Dark mode toggle
        const darkModeToggle = this.uiManager.getElement('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => this.toggleDarkMode());
        }

        // Time period selector
        const timePeriodSelect = this.uiManager.getElement('expensesTimePeriodSelect');
        if (timePeriodSelect) {
            timePeriodSelect.addEventListener('change', (e) => {
                this.currentTimePeriod = e.target.value;
                this.updateTimePeriod();
            });
        }

        // View selector
        const viewSelect = this.uiManager.getElement('expensesViewSelect');
        if (viewSelect) {
            viewSelect.addEventListener('change', (e) => {
                this.currentView = e.target.value;
                this.updateView();
            });
        }
    }

    /**
     * Show overview view
     */
    showOverviewView() {
        console.log('🔧 [APP] Showing overview view');

        this.uiManager.hideAllDashboards();
        this.uiManager.showDashboard('overview');
        this.uiManager.updateNavigationState('overview');

        // Render overview sankey diagram
        this.chartRenderer.renderOverviewSankey();
    }

    /**
     * Show expenses view
     */
    showExpensesView() {
        console.log('🔧 [APP] Showing expenses view');

        this.uiManager.hideAllDashboards();
        this.uiManager.showDashboard('expenses');
        this.uiManager.updateNavigationState('expenses');

        // Update controls
        this.updateExpensesControls();

        // Render expense chart
        this.chartRenderer.renderExpenseChart();
    }

    /**
     * Show income view
     */
    showIncomeView() {
        console.log('🔧 [APP] Showing income view');

        this.uiManager.hideAllDashboards();
        this.uiManager.showDashboard('income');
        this.uiManager.updateNavigationState('income');
    }

    /**
     * Show properties view
     */
    showPropertiesView() {
        console.log('🔧 [APP] Showing properties view');

        this.uiManager.hideAllDashboards();
        this.uiManager.showDashboard('properties');
        this.uiManager.updateNavigationState('properties');

        // Initialize properties manager if not already done
        if (this.propertiesManager && typeof this.propertiesManager.initialize === 'function') {
            this.propertiesManager.initialize();
        }
    }

    /**
     * Update expenses controls
     */
    updateExpensesControls() {
        const timePeriodSelect = this.uiManager.getElement('expensesTimePeriodSelect');
        const viewSelect = this.uiManager.getElement('expensesViewSelect');

        if (timePeriodSelect) {
            timePeriodSelect.value = this.currentTimePeriod;
        }

        if (viewSelect) {
            viewSelect.value = this.currentView;
        }
    }

    /**
     * Update time period
     */
    updateTimePeriod() {
        this.dataManager.setCurrentTimePeriod(this.currentTimePeriod);
        this.chartRenderer.renderExpenseChart();
        this.updateChartCalculations();
    }

    /**
     * Update view
     */
    updateView() {
        this.dataManager.setCurrentView(this.currentView);
        this.chartRenderer.renderExpenseChart();
        this.updateChartCalculations();
    }

    /**
     * Update chart calculations
     */
    updateChartCalculations() {
        const properties = this.dataManager.getProperties();
        const categories = this.dataManager.getExpenseCategories();

        let totalExpenses = 0;
        const propertyCount = properties.length;

        properties.forEach(property => {
            const data = this.dataManager.getCurrentPeriodData(property);
            totalExpenses += data.total;
        });

        const avgPerProperty = propertyCount > 0 ? totalExpenses / propertyCount : 0;

        // Update UI elements
        this.uiManager.updateChartMetrics({
            totalExpenses,
            avgPerProperty,
            propertyCount,
        });
    }

    /**
     * Open add property modal
     */
    openAddPropertyModal() {
        this.uiManager.openModal('addPropertyModal');
    }

    /**
     * Open add category modal
     */
    openAddCategoryModal() {
        this.uiManager.openModal('addCategoryModal');
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
        console.log('🔧 [APP] Forcing UI refresh...');

        // Wait a bit for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update chart calculations with loaded data
        this.updateChartCalculations();

        // Force re-render of current view
        switch (this.currentView) {
            case 'overview':
                this.uiManager.hideAllDashboards();
                this.uiManager.showDashboard('overview');
                this.chartRenderer.renderOverviewSankey();
                break;
            case 'expenses':
                this.uiManager.hideAllDashboards();
                this.uiManager.showDashboard('expenses');
                this.updateExpensesControls();
                this.chartRenderer.renderExpenseChart();
                break;
            case 'income':
                this.uiManager.hideAllDashboards();
                this.uiManager.showDashboard('income');
                break;
            case 'properties':
                this.uiManager.hideAllDashboards();
                this.uiManager.showDashboard('properties');
                if (this.propertiesManager && typeof this.propertiesManager.initialize === 'function') {
                    this.propertiesManager.initialize();
                }
                break;
        }

        // Update UI with data statistics
        const stats = this.dataManager.getDataStatistics();
        console.log('🔧 [APP] Data statistics after load:', stats);

        // Force update of any UI elements that display data
        if (this.uiManager && typeof this.uiManager.updateDataDisplay === 'function') {
            this.uiManager.updateDataDisplay(stats);
        }

        console.log('🔧 [APP] UI refresh forced complete');
    }

    /**
     * Refresh UI after state changes
     */
    refreshUI() {
        console.log('🔧 [APP] Refreshing UI...');

        // Re-render current view
        switch (this.currentView) {
            case 'overview':
                this.uiManager.hideAllDashboards();
                this.uiManager.showDashboard('overview');
                this.chartRenderer.renderOverviewSankey();
                break;
            case 'expenses':
                this.uiManager.hideAllDashboards();
                this.uiManager.showDashboard('expenses');
                this.updateExpensesControls();
                this.chartRenderer.renderExpenseChart();
                break;
            case 'income':
                this.uiManager.hideAllDashboards();
                this.uiManager.showDashboard('income');
                break;
            case 'properties':
                this.uiManager.hideAllDashboards();
                this.uiManager.showDashboard('properties');
                if (this.propertiesManager && typeof this.propertiesManager.initialize === 'function') {
                    this.propertiesManager.initialize();
                }
                break;
        }

        // Update chart calculations
        this.updateChartCalculations();

        console.log('🔧 [APP] UI refresh complete');
    }

    /**
     * Handle initialization error
     */
    handleInitializationError(error) {
        console.error('🔧 [APP] Initialization error:', error);

        this.uiManager.showError(
            'Failed to initialize application',
            'Please refresh the page and try again',
        );
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        console.log('🔧 [APP] Cleaning up application...');

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

        console.log('🔧 [APP] Application cleanup complete');
    }

    /**
     * Debug application state
     */
    debug() {
        console.log('🔧 [APP DEBUG] === APPLICATION STATE ===');
        console.log('🔧 [APP DEBUG] Initialized:', this.isInitialized);
        console.log('🔧 [APP DEBUG] Current View:', this.currentView);
        console.log('🔧 [APP DEBUG] Current Time Period:', this.currentTimePeriod);

        console.log('🔧 [APP DEBUG] === MODULE STATUS ===');
        console.log('🔧 [APP DEBUG] DataManager:', !!this.dataManager);
        console.log('🔧 [APP DEBUG] UIManager:', !!this.uiManager);
        console.log('🔧 [APP DEBUG] EventHandler:', !!this.eventHandler);
        console.log('🔧 [APP DEBUG] ChartRenderer:', !!this.chartRenderer);
        console.log('🔧 [APP DEBUG] HistoryManager:', !!this.historyManager);

        console.log('🔧 [APP DEBUG] === UTILITY STATUS ===');
        console.log('🔧 [APP DEBUG] Formatter:', !!this.formatter);
        console.log('🔧 [APP DEBUG] Storage:', !!this.storage);
        console.log('🔧 [APP DEBUG] Validator:', !!this.validator);
        console.log('🔧 [APP DEBUG] ThemeManager:', !!this.themeManager);

        // Debug individual modules
        if (this.dataManager) {this.dataManager.debug();}
        if (this.uiManager) {this.uiManager.debug();}
        if (this.chartRenderer) {this.chartRenderer.debug();}

        console.log('🔧 [APP DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
} else {
    window.App = App;
}
