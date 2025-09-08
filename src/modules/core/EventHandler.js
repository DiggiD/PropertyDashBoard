/**
 * EventHandler Module
 * Handles all event binding and user interactions
 * - Button click handlers
 * - Form submissions
 * - Keyboard shortcuts
 * - Touch/mouse events
 * - Modal interactions
 */

class EventHandler {
    constructor(dataManager, uiManager, historyManager, themeManager) {
        this.dataManager = dataManager;
        this.uiManager = uiManager;
        this.historyManager = historyManager;
        this.themeManager = themeManager;

        // Event binding state
        this.boundEvents = new Map();
        this.eventListeners = new Map();

        console.log('🔧 [EVENT] EventHandler initialized');
    }

    /**
     * Initialize event handlers
     */
    async initialize() {
        this.bindSummaryButtons();
        this.bindModalEvents();
        this.bindFormEvents();
        this.bindKeyboardShortcuts();
        this.bindChartInteractions();

        console.log('🔧 [EVENT] Event handlers initialized');
    }

    /**
     * Bind summary button events
     */
    bindSummaryButtons() {
        const buttonMappings = {
            'overviewBtn': () => this.handleViewChange('overview'),
            'expensesBtn': () => this.handleViewChange('expenses'),
            'incomeBtn': () => this.handleViewChange('income'),
            'propertiesBtn': () => this.handleViewChange('properties'),
        };

        Object.entries(buttonMappings).forEach(([buttonKey, handler]) => {
            this.bindClickEvent(buttonKey, handler);
        });

        console.log('🔧 [EVENT] Summary buttons bound');
    }

    /**
     * Bind modal events
     */
    bindModalEvents() {
        // Add Property Modal
        this.bindClickEvent('addPropertyBtn', () => this.handleAddProperty());
        this.bindClickEvent('saveProperty', () => this.handleSaveProperty());
        this.bindClickEvent('cancelProperty', () => this.handleCancelProperty());
        this.bindClickEvent('closePropertyModal', () => this.handleCancelProperty());

        // Add Category Modal
        this.bindClickEvent('addCategoryBtn', () => this.handleAddCategory());
        this.bindClickEvent('saveCategory', () => this.handleSaveCategory());
        this.bindClickEvent('cancelCategory', () => this.handleCancelCategory());
        this.bindClickEvent('closeCategoryModal', () => this.handleCancelCategory());

        // Import Modal
        this.bindClickEvent('confirmImport', () => this.handleImportData());
        this.bindClickEvent('cancelImport', () => this.handleCancelImport());
        this.bindClickEvent('closeImportModal', () => this.handleCancelImport());

        // Dropdown
        this.bindClickEvent('addDropdownBtn', () => this.handleDropdownToggle());

        // History
        this.bindClickEvent('historyBtn', () => this.handleHistoryOpen());

        // Theme toggle
        this.bindClickEvent('darkModeToggle', () => this.handleThemeToggle());

        console.log('🔧 [EVENT] Modal events bound');
    }

    /**
     * Bind form events
     */
    bindFormEvents() {
        // Property name input
        this.bindEnterKeyEvent('propertyName', () => this.handleSaveProperty());

        // Category name input
        this.bindEnterKeyEvent('categoryName', () => this.handleSaveCategory());

        console.log('🔧 [EVENT] Form events bound');
    }

    /**
     * Bind keyboard shortcuts
     */
    bindKeyboardShortcuts() {
        // Undo/Redo shortcuts
        this.bindKeyboardShortcut(['ctrl+z', 'cmd+z'], () => this.handleUndo());
        this.bindKeyboardShortcut(['ctrl+y', 'cmd+y', 'ctrl+shift+z', 'cmd+shift+z'], () => this.handleRedo());

        // Save shortcut
        this.bindKeyboardShortcut(['ctrl+s', 'cmd+s'], (e) => {
            e.preventDefault();
            this.handleSaveData();
        });

        // New property shortcut
        this.bindKeyboardShortcut(['ctrl+n', 'cmd+n'], (e) => {
            e.preventDefault();
            this.handleAddProperty();
        });

        console.log('🔧 [EVENT] Keyboard shortcuts bound');
    }

    /**
     * Bind chart interaction events
     */
    bindChartInteractions() {
        // Chart controls
        this.bindChangeEvent('expensesViewSelect', (e) => this.handleChartViewChange(e.target.value));
        this.bindChangeEvent('expensesTimePeriodSelect', (e) => this.handleTimePeriodChange(e.target.value));

        console.log('🔧 [EVENT] Chart interactions bound');
    }

    /**
     * Handle view change
     * @param {string} view - View name
     */
    async handleViewChange(view) {
        try {
            this.uiManager.setCurrentView(view);

            // Update data manager
            this.dataManager.setCurrentView(view);

            // Render appropriate content
            if (view === 'expenses') {
                await this.handleExpensesView();
            } else if (view === 'overview') {
                await this.handleOverviewView();
            }

            console.log(`🔧 [EVENT] View changed to: ${view}`);
        } catch (error) {
            console.error('🔧 [EVENT] Error changing view:', error);
            this.uiManager.showError('Failed to change view', 'View Change Error');
        }
    }

    /**
     * Handle expenses view
     */
    async handleExpensesView() {
        try {
            this.uiManager.showLoadingState('Loading expenses...');

            // Update chart controls
            const currentView = this.dataManager.getCurrentView();
            const currentTimePeriod = this.dataManager.getCurrentTimePeriod();

            this.uiManager.updateChartControls({
                view: currentView,
                timePeriod: currentTimePeriod,
            });

            // Update chart metrics
            const metrics = {
                totalExpenses: this.dataManager.calculateTotalExpenses(),
                averageExpensePerProperty: this.dataManager.calculateAverageExpensePerProperty(),
                topCategory: this.dataManager.getTopExpenseCategory(),
            };

            this.uiManager.updateChartMetrics(metrics);

            // Trigger chart render (this will be handled by ChartRenderer when implemented)
            if (window.expenseDashboard && window.expenseDashboard.renderExpenseChart) {
                window.expenseDashboard.renderExpenseChart();
            }

            this.uiManager.hideLoadingState();
        } catch (error) {
            console.error('🔧 [EVENT] Error handling expenses view:', error);
            this.uiManager.showError('Failed to load expenses view', 'Expenses View Error');
        }
    }

    /**
     * Handle overview view
     */
    async handleOverviewView() {
        try {
            this.uiManager.showLoadingState('Loading overview...');

            // Trigger overview render (this will be handled by ChartRenderer when implemented)
            if (window.expenseDashboard && window.expenseDashboard.renderOverviewSankey) {
                window.expenseDashboard.renderOverviewSankey();
            }

            this.uiManager.hideLoadingState();
        } catch (error) {
            console.error('🔧 [EVENT] Error handling overview view:', error);
            this.uiManager.showError('Failed to load overview', 'Overview Error');
        }
    }

    /**
     * Handle chart view change
     * @param {string} view - Chart view
     */
    async handleChartViewChange(view) {
        try {
            this.dataManager.setCurrentView(view);
            await this.handleExpensesView();

            console.log(`🔧 [EVENT] Chart view changed to: ${view}`);
        } catch (error) {
            console.error('🔧 [EVENT] Error changing chart view:', error);
            this.uiManager.showError('Failed to change chart view', 'Chart View Error');
        }
    }

    /**
     * Handle time period change
     * @param {string} timePeriod - Time period
     */
    async handleTimePeriodChange(timePeriod) {
        try {
            this.dataManager.setCurrentTimePeriod(timePeriod);
            await this.handleExpensesView();

            console.log(`🔧 [EVENT] Time period changed to: ${timePeriod}`);
        } catch (error) {
            console.error('🔧 [EVENT] Error changing time period:', error);
            this.uiManager.showError('Failed to change time period', 'Time Period Error');
        }
    }

    /**
     * Handle add property
     */
    handleAddProperty() {
        try {
            // Clear form
            this.uiManager.clearModalForm('addPropertyModal');

            // Open modal
            this.uiManager.openModal('addPropertyModal');

            console.log('🔧 [EVENT] Add property modal opened');
        } catch (error) {
            console.error('🔧 [EVENT] Error opening add property modal:', error);
            this.uiManager.showError('Failed to open add property form', 'Modal Error');
        }
    }

    /**
     * Handle save property
     */
    async handleSaveProperty() {
        try {
            const formData = this.uiManager.getModalFormData('addPropertyModal');
            const propertyName = formData.propertyName?.trim();

            if (!propertyName) {
                this.uiManager.showToast('Please enter a property name', 'warning');
                return;
            }

            // Save state for undo
            await this.historyManager.saveState('Add property');

            // Add property
            const result = this.dataManager.addProperty(propertyName);

            if (result.success) {
                // Close modal
                this.uiManager.closeModal('addPropertyModal');

                // Show success message
                this.uiManager.showToast(result.message, 'success');

                // Refresh view if on expenses page
                if (this.uiManager.currentView === 'expenses') {
                    await this.handleExpensesView();
                }

                console.log('🔧 [EVENT] Property added:', result.property.name);
            } else {
                this.uiManager.showToast(result.message, 'error');
            }
        } catch (error) {
            console.error('🔧 [EVENT] Error saving property:', error);
            this.uiManager.showError('Failed to save property', 'Save Error');
        }
    }

    /**
     * Handle cancel property
     */
    handleCancelProperty() {
        this.uiManager.closeModal('addPropertyModal');
        console.log('🔧 [EVENT] Add property cancelled');
    }

    /**
     * Handle add category
     */
    handleAddCategory() {
        try {
            // Clear form
            this.uiManager.clearModalForm('addCategoryModal');

            // Open modal
            this.uiManager.openModal('addCategoryModal');

            console.log('🔧 [EVENT] Add category modal opened');
        } catch (error) {
            console.error('🔧 [EVENT] Error opening add category modal:', error);
            this.uiManager.showError('Failed to open add category form', 'Modal Error');
        }
    }

    /**
     * Handle save category
     */
    async handleSaveCategory() {
        try {
            const formData = this.uiManager.getModalFormData('addCategoryModal');
            const categoryName = formData.categoryName?.trim();

            if (!categoryName) {
                this.uiManager.showToast('Please enter a category name', 'warning');
                return;
            }

            // Save state for undo
            await this.historyManager.saveState('Add category');

            // Add category
            const result = this.dataManager.addExpenseCategory(categoryName);

            if (result.success) {
                // Close modal
                this.uiManager.closeModal('addCategoryModal');

                // Show success message
                this.uiManager.showToast(result.message, 'success');

                // Refresh view if on expenses page
                if (this.uiManager.currentView === 'expenses') {
                    await this.handleExpensesView();
                }

                console.log('🔧 [EVENT] Category added:', categoryName);
            } else {
                this.uiManager.showToast(result.message, 'error');
            }
        } catch (error) {
            console.error('🔧 [EVENT] Error saving category:', error);
            this.uiManager.showError('Failed to save category', 'Save Error');
        }
    }

    /**
     * Handle cancel category
     */
    handleCancelCategory() {
        this.uiManager.closeModal('addCategoryModal');
        console.log('🔧 [EVENT] Add category cancelled');
    }

    /**
     * Handle import data
     */
    async handleImportData() {
        try {
            const formData = this.uiManager.getModalFormData('importModal');
            const jsonData = formData.importData?.trim();

            if (!jsonData) {
                this.uiManager.showToast('Please paste data to import', 'warning');
                return;
            }

            // Save current state for undo
            await this.historyManager.saveState('Import data');

            // Import data
            const result = await this.dataManager.importData(JSON.parse(jsonData));

            if (result) {
                // Close modal
                this.uiManager.closeModal('importModal');

                // Show success message
                this.uiManager.showToast('Data imported successfully', 'success');

                // Refresh current view
                await this.handleViewChange(this.uiManager.currentView);

                console.log('🔧 [EVENT] Data imported successfully');
            } else {
                this.uiManager.showToast('Failed to import data', 'error');
            }
        } catch (error) {
            console.error('🔧 [EVENT] Error importing data:', error);
            this.uiManager.showError('Failed to import data. Please check the format.', 'Import Error');
        }
    }

    /**
     * Handle cancel import
     */
    handleCancelImport() {
        this.uiManager.closeModal('importModal');
        console.log('🔧 [EVENT] Import cancelled');
    }

    /**
     * Handle dropdown toggle
     */
    handleDropdownToggle() {
        this.uiManager.toggleDropdown('addDropdownBtn');
    }

    /**
     * Handle history open
     */
    handleHistoryOpen() {
        // This will be implemented when we have a history UI component
        console.log('🔧 [EVENT] History button clicked');
        this.uiManager.showToast('History feature coming soon', 'info');
    }

    /**
     * Handle theme toggle
     */
    handleThemeToggle() {
        try {
            const isDark = this.themeManager.toggleTheme();
            this.uiManager.updateThemeToggle();

            this.uiManager.showToast(`Switched to ${isDark ? 'dark' : 'light'} mode`, 'info', 1500);

            console.log(`🔧 [EVENT] Theme toggled to: ${isDark ? 'dark' : 'light'}`);
        } catch (error) {
            console.error('🔧 [EVENT] Error toggling theme:', error);
            this.uiManager.showError('Failed to toggle theme', 'Theme Error');
        }
    }

    /**
     * Handle undo
     */
    async handleUndo() {
        try {
            const result = await this.historyManager.undo();

            if (result.success) {
                this.uiManager.showToast(result.message, 'info');

                // Update UI state
                this.uiManager.updateUndoRedoButtons(
                    this.historyManager.canUndo(),
                    this.historyManager.canRedo(),
                );

                // Refresh current view
                await this.handleViewChange(this.uiManager.currentView);

                console.log('🔧 [EVENT] Undo executed');
            } else {
                this.uiManager.showToast(result.message, 'info');
            }
        } catch (error) {
            console.error('🔧 [EVENT] Error executing undo:', error);
            this.uiManager.showError('Failed to undo action', 'Undo Error');
        }
    }

    /**
     * Handle redo
     */
    async handleRedo() {
        try {
            const result = await this.historyManager.redo();

            if (result.success) {
                this.uiManager.showToast(result.message, 'info');

                // Update UI state
                this.uiManager.updateUndoRedoButtons(
                    this.historyManager.canUndo(),
                    this.historyManager.canRedo(),
                );

                // Refresh current view
                await this.handleViewChange(this.uiManager.currentView);

                console.log('🔧 [EVENT] Redo executed');
            } else {
                this.uiManager.showToast(result.message, 'info');
            }
        } catch (error) {
            console.error('🔧 [EVENT] Error executing redo:', error);
            this.uiManager.showError('Failed to redo action', 'Redo Error');
        }
    }

    /**
     * Handle save data
     */
    async handleSaveData() {
        try {
            const success = await this.dataManager.save();

            if (success) {
                this.uiManager.showToast('Data saved successfully', 'success');
                console.log('🔧 [EVENT] Data saved');
            } else {
                this.uiManager.showToast('Failed to save data', 'error');
            }
        } catch (error) {
            console.error('🔧 [EVENT] Error saving data:', error);
            this.uiManager.showError('Failed to save data', 'Save Error');
        }
    }

    /**
     * Bind click event to element
     * @param {string} elementKey - Element key
     * @param {Function} handler - Event handler
     */
    bindClickEvent(elementKey, handler) {
        const element = this.uiManager.getElement(elementKey);
        if (element) {
            const wrappedHandler = (e) => {
                e.preventDefault();
                handler(e);
            };

            this.uiManager.addEventListener(element, 'click', wrappedHandler);
            this.storeEventBinding(elementKey, 'click', wrappedHandler);
        }
    }

    /**
     * Bind change event to element
     * @param {string} elementKey - Element key
     * @param {Function} handler - Event handler
     */
    bindChangeEvent(elementKey, handler) {
        const element = this.uiManager.getElement(elementKey);
        if (element) {
            this.uiManager.addEventListener(element, 'change', handler);
            this.storeEventBinding(elementKey, 'change', handler);
        }
    }

    /**
     * Bind enter key event to input element
     * @param {string} elementKey - Element key
     * @param {Function} handler - Event handler
     */
    bindEnterKeyEvent(elementKey, handler) {
        const element = this.uiManager.getElement(elementKey);
        if (element) {
            const wrappedHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handler(e);
                }
            };

            this.uiManager.addEventListener(element, 'keypress', wrappedHandler);
            this.storeEventBinding(elementKey, 'keypress', wrappedHandler);
        }
    }

    /**
     * Bind keyboard shortcut
     * @param {string|Array} keys - Key combination(s)
     * @param {Function} handler - Event handler
     */
    bindKeyboardShortcut(keys, handler) {
        const keyArray = Array.isArray(keys) ? keys : [keys];

        const wrappedHandler = (e) => {
            const pressedKeys = [];

            if (e.ctrlKey || e.metaKey) {pressedKeys.push(e.ctrlKey ? 'ctrl' : 'cmd');}
            if (e.shiftKey) {pressedKeys.push('shift');}
            if (e.altKey) {pressedKeys.push('alt');}
            pressedKeys.push(e.key.toLowerCase());

            const keyCombo = pressedKeys.join('+');

            if (keyArray.includes(keyCombo)) {
                handler(e);
            }
        };

        this.uiManager.addEventListener(document, 'keydown', wrappedHandler);
        this.storeEventBinding('document', 'keydown', wrappedHandler, keys);
    }

    /**
     * Store event binding for cleanup
     * @param {string} elementKey - Element key
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {any} metadata - Additional metadata
     */
    storeEventBinding(elementKey, event, handler, metadata = null) {
        if (!this.boundEvents.has(elementKey)) {
            this.boundEvents.set(elementKey, new Map());
        }

        this.boundEvents.get(elementKey).set(event, {
            handler,
            metadata,
        });
    }

    /**
     * Remove event binding
     * @param {string} elementKey - Element key
     * @param {string} event - Event type
     */
    removeEventBinding(elementKey, event) {
        const elementBindings = this.boundEvents.get(elementKey);
        if (elementBindings && elementBindings.has(event)) {
            const binding = elementBindings.get(event);
            this.uiManager.removeEventListener(
                this.uiManager.getElement(elementKey) || document,
                event,
            );
            elementBindings.delete(event);
        }
    }

    /**
     * Cleanup all event bindings
     */
    cleanup() {
        this.boundEvents.forEach((elementBindings, elementKey) => {
            elementBindings.forEach((binding, event) => {
                this.removeEventBinding(elementKey, event);
            });
        });

        this.boundEvents.clear();
        console.log('🔧 [EVENT] Event handler cleaned up');
    }

    /**
     * Get event binding statistics
     * @returns {Object} Event binding statistics
     */
    getEventStatistics() {
        let totalBindings = 0;
        this.boundEvents.forEach(elementBindings => {
            totalBindings += elementBindings.size;
        });

        return {
            totalElements: this.boundEvents.size,
            totalBindings,
            elements: Array.from(this.boundEvents.keys()),
        };
    }

    /**
     * Debug event information
     */
    debug() {
        console.log('🔧 [EVENT DEBUG] === EVENT HANDLER INFO ===');
        console.log('🔧 [EVENT DEBUG] Event statistics:', this.getEventStatistics());
        console.log('🔧 [EVENT DEBUG] Bound events:');

        this.boundEvents.forEach((elementBindings, elementKey) => {
            console.log(`🔧 [EVENT DEBUG] ${elementKey}:`);
            elementBindings.forEach((binding, event) => {
                const meta = binding.metadata ? ` (${binding.metadata})` : '';
                console.log(`🔧 [EVENT DEBUG]   - ${event}${meta}`);
            });
        });

        console.log('🔧 [EVENT DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventHandler;
} else {
    window.EventHandler = EventHandler;
}
