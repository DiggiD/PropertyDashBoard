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

        console.log('[EVENT] EventHandler initialized');
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

        console.log('[EVENT] Event handlers initialized');
    }

    /**
     * Bind summary button events
     */
    bindSummaryButtons() {
        const buttonMappings = {
            'overviewBtn': () => this.handleViewChange('overview'),
            'propertiesBtn': () => this.handleViewChange('properties'),
        };

        Object.entries(buttonMappings).forEach(([buttonKey, handler]) => {
            this.bindClickEvent(buttonKey, handler);
        });

        console.log('[EVENT] Summary buttons bound');
    }

    /**
     * Bind modal events
     */
    bindModalEvents() {
        // Import Modal
        this.bindClickEvent('confirmImport', () => this.handleImportData());
        this.bindClickEvent('cancelImport', () => this.handleCancelImport());
        this.bindClickEvent('closeImportModal', () => this.handleCancelImport());

        // History
        this.bindClickEvent('historyBtn', () => this.handleHistoryOpen());

        // Theme toggle
        this.bindClickEvent('darkModeToggle', () => this.handleThemeToggle());

        console.log('[EVENT] Modal events bound');
    }

    /**
     * Bind form events
     */
    bindFormEvents() {
        console.log('[EVENT] Form events bound');
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

        console.log('[EVENT] Keyboard shortcuts bound');
    }

    /**
     * Bind chart interaction events
     * Currently empty as analytics features removed
     */
    bindChartInteractions() {
        console.log('[EVENT] Chart interactions bound (no analytics)');
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
            if (view === 'overview') {
                await this.handleOverviewView();
            } else if (view === 'properties') {
                await this.handlePropertiesView();
            }

            console.log(`[EVENT] View changed to: ${view}`);
        } catch (error) {
            console.error('[EVENT] Error changing view:', error);
            this.uiManager.showError('Failed to change view', 'View Change Error');
        }
    }

    /**
     * Handle overview view
     */
    async handleOverviewView() {
        try {
            this.uiManager.showLoadingState('Loading overview...');

            // Trigger overview render using chart renderer
            if (window.chartRenderer && typeof window.chartRenderer.renderOverviewSankey === 'function') {
                await window.chartRenderer.renderOverviewSankey();
            }

            this.uiManager.hideLoadingState();
        } catch (error) {
            console.error('[EVENT] Error handling overview view:', error);
            this.uiManager.showError('Failed to load overview', 'Overview Error');
        }
    }

    /**
     * Handle properties view
     */
    async handlePropertiesView() {
        try {
            this.uiManager.showLoadingState('Loading properties...');

            // Trigger properties render using chart renderer if available
            if (window.chartRenderer && typeof window.chartRenderer.renderPropertiesChart === 'function') {
                await window.chartRenderer.renderPropertiesChart();
            }

            this.uiManager.hideLoadingState();
        } catch (error) {
            console.error('[EVENT] Error handling properties view:', error);
            this.uiManager.showError('Failed to load properties', 'Properties Error');
        }
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

            // Save current state for undo BEFORE import
            await this.historyManager.saveState('Before import');

            // Import data
            const result = await this.dataManager.importData(JSON.parse(jsonData));

            if (result) {
                // Close modal
                this.uiManager.closeModal('importModal');

                // Show success message
                this.uiManager.showToast('Data imported successfully', 'success');

                // IMPORTANT: Re-initialize HistoryManager to load updated history
                if (this.historyManager && typeof this.historyManager.initialize === 'function') {
                    await this.historyManager.initialize();
                    console.log('[EVENT] HistoryManager re-initialized after import');
                }

                // Update undo/redo buttons after history reload
                if (this.historyManager && typeof this.historyManager.updateUndoRedoButtons === 'function') {
                    this.historyManager.updateUndoRedoButtons();
                }

                // Small delay to ensure all async operations complete
                await new Promise(resolve => setTimeout(resolve, 100));

                // Refresh current view with updated data
                await this.handleViewChange(this.uiManager.currentView);

                console.log('[EVENT] Data imported successfully');
            } else {
                this.uiManager.showToast('Failed to import data', 'error');
            }
        } catch (error) {
            console.error('[EVENT] Error importing data:', error);
            this.uiManager.showError('Failed to import data. Please check the format.', 'Import Error');
        }
    }

    /**
     * Handle cancel import
     */
    handleCancelImport() {
        this.uiManager.closeModal('importModal');
        console.log('[EVENT] Import cancelled');
    }



    /**
     * Handle history open
     */
    handleHistoryOpen() {
        console.log('[EVENT] History button clicked');
        this.historyManager.openHistoryManager();
    }

    /**
     * Handle theme toggle
     */
    handleThemeToggle() {
        try {
            const isDark = this.themeManager.toggleTheme();
            this.uiManager.updateThemeToggle();

            this.uiManager.showToast(`Switched to ${isDark ? 'dark' : 'light'} mode`, 'info', 1500);

            console.log(`[EVENT] Theme toggled to: ${isDark ? 'dark' : 'light'}`);
        } catch (error) {
            console.error('[EVENT] Error toggling theme:', error);
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

                console.log('[EVENT] Undo executed');
            } else {
                this.uiManager.showToast(result.message, 'info');
            }
        } catch (error) {
            console.error('[EVENT] Error executing undo:', error);
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

                console.log('[EVENT] Redo executed');
            } else {
                this.uiManager.showToast(result.message, 'info');
            }
        } catch (error) {
            console.error('[EVENT] Error executing redo:', error);
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
                console.log('[EVENT] Data saved');
            } else {
                this.uiManager.showToast('Failed to save data', 'error');
            }
        } catch (error) {
            console.error('[EVENT] Error saving data:', error);
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
            const wrappedHandler = async (e) => {
                e.preventDefault();
                try {
                    await handler(e);
                } catch (error) {
                    console.error('[EVENT] Error in click event handler:', error);
                }
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
        console.log('[EVENT] Event handler cleaned up');
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
        console.log('[EVENT DEBUG] === EVENT HANDLER INFO ===');
        console.log('[EVENT DEBUG] Event statistics:', this.getEventStatistics());
        console.log('[EVENT DEBUG] Bound events:');

        this.boundEvents.forEach((elementBindings, elementKey) => {
            console.log(`[EVENT DEBUG] ${elementKey}:`);
            elementBindings.forEach((binding, event) => {
                const meta = binding.metadata ? ` (${binding.metadata})` : '';
                console.log(`[EVENT DEBUG]   - ${event}${meta}`);
            });
        });

        console.log('[EVENT DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
export default EventHandler;

// Expose globally for Babel standalone transpilation
window.EventHandler = EventHandler;
