/**
 * HistoryManager Module
 * Handles undo/redo functionality with diff-based state management
 * - Linear history array with current index pointer
 * - Diff-based snapshots for memory efficiency
 * - Debounced state pushes to batch rapid UI events
 * - Immutable operations with shallow/deep clones
 * - Optional persistence via Storage.js
 */

class HistoryManager {
    /**
     * @param {Object} storage - Storage module for persistence
     * @param {Object} dataManager - DataManager for state operations
     */
    constructor(storage, dataManager) {
        this.storage = storage;
        this.dataManager = dataManager;

        // History state - linear array with current index
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = 50;
        this.fullState = null; // Current reconstructed full state

        // Throttling for rapid UI events
        this.debouncedPushTimer = null;
        this.pendingState = null;

        // Persistence
        this.historyStorageKey = 'sankey-property-dashboard-history';
        this.stateStorageKey = 'sankey-property-dashboard-current-state';

        this.isUndoRedoInProgress = false;

        console.log('[HISTORY] HistoryManager initialized with diff-based storage');
    }

    /**
     * Initialize the history manager (alias for init)
     */
    async initialize() {
        return this.init();
    }

    /**
     * Initialize the history manager
     * Loads persisted history and sets up initial state
     */
    async init() {
        console.log('[HISTORY] Initializing history manager...');

        if (!this.dataManager) {
            console.error('[HISTORY] DataManager not available during initialization');
            return;
        }

        this._loadHistoryFromStorage();

        // Create initial full state entry if history is empty
        const currentData = this.dataManager.getData();
        if (this.history.length === 0 && currentData && currentData.properties && currentData.properties.length > 0) {
            console.log('[HISTORY] No history found, creating initial full state entry');
            this._addFullStateEntry(currentData);
        } else {
            console.log(`[HISTORY] Loaded ${this.history.length} history entries`);
            // Reconstruct current full state from loaded history
            this._reconstructState();
        }

        this._updateUndoRedoButtons();
        console.log('[HISTORY] History manager initialization complete');
    }

    /**
     * Add a full state entry (used for initial state)
     * @param {Object} state - Full state object
     * @private
     */
    _addFullStateEntry(state) {
        const shallowClone = this._shallowClone(state);
        this.history.push({ changes: null, fullState: shallowClone });
        this.currentIndex = 0;
        this.fullState = shallowClone;
    }

    /**
     * Add a delta entry
     * @param {Object} delta - Change delta from previous state
     * @private
     */
    _addDeltaEntry(delta) {
        this.history.push({ changes: delta });
        this.currentIndex++;
    }

    /**
     * Push new state to history (debounced by 100ms)
     * @param {Object} state - New state object
     */
    pushState(state) {
        // Return existing pending state if one is already queued
        if (this.pendingState) {
            this.pendingState = state;
            return;
        }

        this.pendingState = state;

        // If there's already a timer running, replace the pending state
        if (this.debouncedPushTimer) {
            clearTimeout(this.debouncedPushTimer);
        }

        this.debouncedPushTimer = setTimeout(() => {
            if (this.pendingState && this._hasStateChanged(this.pendingState)) {
                this._doPushState(this.pendingState);
            }
            this.pendingState = null;
            this.debouncedPushTimer = null;
        }, 100);
    }

    /**
     * Execute the actual push state operation
     * @param {Object} state - New state object
     * @private
     */
    _doPushState(state) {
        if (this.isUndoRedoInProgress) {
            console.log('[HISTORY] Skipping push during undo/redo operation');
            return false;
        }

        try {
            const shallowClone = this._shallowClone(state);

            // First entry is always full state
            if (this.history.length === 0) {
                this._addFullStateEntry(shallowClone);
            } else {
                // Subsequent entries are deltas
                const delta = this._computeDiff(this.fullState, shallowClone);
                if (delta) {
                    // Remove any future history entries after current index
                    this.history = this.history.slice(0, this.currentIndex + 1);

                    this._addDeltaEntry(delta);
                    this.fullState = shallowClone;

                    // Prune history if exceeds max size
                    this._pruneHistoryIfNeeded();
                }
            }

            this._saveToStorage();
            this._updateUndoRedoButtons();

            console.log(`[HISTORY] State pushed (entries: ${this.history.length}, index: ${this.currentIndex})`);
            return true;
        } catch (error) {
            console.error('[HISTORY] Failed to push state:', error);
            return false;
        }
    }

    /**
     * Undo last operation
     * @returns {Promise<boolean>} Success status
     */
    async undo() {
        if (!this.canUndo()) {
            console.log('[HISTORY] Cannot undo - no previous state');
            return false;
        }

        try {
            this.isUndoRedoInProgress = true;

            // Apply inverse of current delta to get previous state
            const currentEntry = this.history[this.currentIndex];
            if (currentEntry.changes) {
                const inverseDelta = this._inverseDelta(currentEntry.changes);
                this.fullState = this._applyDiff(this.fullState, inverseDelta);
            }

            this.currentIndex--;
            await this.dataManager.initialize(this._shallowClone(this.fullState));

            this._updateUndoRedoButtons();
            console.log('[HISTORY] Undid operation');
            this.isUndoRedoInProgress = false;
            return true;
        } catch (error) {
            console.error('[HISTORY] Undo failed:', error);
            this.isUndoRedoInProgress = false;
            return false;
        }
    }

    /**
     * Redo last undone operation
     * @returns {Promise<boolean>} Success status
     */
    async redo() {
        if (!this.canRedo()) {
            console.log('[HISTORY] Cannot redo - no next state');
            return false;
        }

        try {
            this.isUndoRedoInProgress = true;

            this.currentIndex++;
            const nextEntry = this.history[this.currentIndex];

            if (nextEntry.changes) {
                this.fullState = this._applyDiff(this.fullState, nextEntry.changes);
            } else if (nextEntry.fullState) {
                this.fullState = this._shallowClone(nextEntry.fullState);
            }

            await this.dataManager.initialize(this._shallowClone(this.fullState));

            this._updateUndoRedoButtons();
            console.log('[HISTORY] Redid operation');
            this.isUndoRedoInProgress = false;
            return true;
        } catch (error) {
            console.error('[HISTORY] Redo failed:', error);
            this.isUndoRedoInProgress = false;
            return false;
        }
    }

    /**
     * Check if undo is available
     * @returns {boolean} Whether undo is available
     */
    canUndo() {
        return this.currentIndex > 0;
    }

    /**
     * Check if redo is available
     * @returns {boolean} Whether redo is available
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Clear all history
     */
    async clear() {
        this.history = [];
        this.currentIndex = -1;
        this.fullState = null;
        this._saveToStorage();
        this._updateUndoRedoButtons();
        console.log('[HISTORY] History cleared');
    }

    /**
     * Open history manager (placeholder for UI integration)
     */
    openHistoryManager() {
        console.log('[HISTORY] Open history manager called');
        // This would typically open a UI dialog
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.debouncedPushTimer) {
            clearTimeout(this.debouncedPushTimer);
            this.debouncedPushTimer = null;
        }
        this.pendingState = null;
        console.log('[HISTORY] HistoryManager cleaned up');
    }

    /**
     * Create a snapshot (legacy method - kept for compatibility)
     * Note: This now uses the new storage format internally
     */
    async createSnapshot(name = null, description = '', silent = false) {
        try {
            const currentData = this.dataManager.getData();
            console.log('[HISTORY] Creating snapshot with data:', {
                properties: currentData.properties?.length || 0,
                categories: currentData.expenseCategories?.length || 0,
            });

            const snapshot = {
                id: Date.now().toString(),
                name: name || `Snapshot ${new Date().toLocaleDateString()}`,
                description: description || `Auto-saved on ${new Date().toLocaleString()}`,
                timestamp: new Date().toISOString(),
                data: JSON.parse(JSON.stringify(currentData)),
                totalExpenses: this.dataManager.calculateTotalExpenses(),
                propertyCount: currentData.properties.length,
                categoryCount: currentData.expenseCategories.length,
            };

            const success = await this.storage.saveHistorySnapshot(snapshot);
            if (success) {
                console.log(`[HISTORY] Snapshot created: "${snapshot.name}"`);
                if (!silent && window.uiManager?.showToast) {
                    window.uiManager.showToast(`Snapshot "${snapshot.name}" created successfully`, 'success', 3000);
                }
                return { success: true, message: `Snapshot "${snapshot.name}" created successfully`, snapshot };
            } else {
                if (!silent && window.uiManager?.showToast) {
                    window.uiManager.showToast('Failed to save snapshot', 'error', 3000);
                }
                return { success: false, message: 'Failed to save snapshot' };
            }
        } catch (error) {
            console.error('[HISTORY] Failed to create snapshot:', error);
            if (!silent && window.uiManager?.showToast) {
                window.uiManager.showToast('Failed to create snapshot', 'error', 3000);
            }
            return { success: false, message: 'Snapshot creation failed' };
        }
    }

    /**
     * Get snapshots (legacy compatibility)
     */
    getSnapshots() {
        return this.storage.loadHistoryFromStorage().filter(entry => entry.name);
    }

    /**
     * Shallow clone an object for immutability
     * @param {Object} obj - Object to clone
     * @returns {Object} Shallow clone
     * @private
     */
    _shallowClone(obj) {
        if (!obj || typeof obj !== 'object') {return obj;}
        if (Array.isArray(obj)) {return [...obj];}
        return { ...obj };
    }

    /**
     * Check if state has changed from current full state
     * @param {Object} newState - New state to compare
     * @returns {boolean} Whether state has changed
     * @private
     */
    _hasStateChanged(newState) {
        if (!this.fullState) {return true;}
        const delta = this._computeDiff(this.fullState, newState);
        return delta !== null;
    }

    /**
     * Compute diff between two objects
     * @param {Object} oldObj - Old object
     * @param {Object} newObj - New object
     * @returns {Object|null} Diff object or null if no changes
     * @private
     */
    _computeDiff(oldObj, newObj) {
        const changes = {};
        const keys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

        for (const key of keys) {
            const oldVal = oldObj ? oldObj[key] : undefined;
            const newVal = newObj ? newObj[key] : undefined;

            if (newVal === undefined && oldVal !== undefined) {
                changes[key] = { type: 'delete', oldValue: oldVal };
            } else if (oldVal === undefined && newVal !== undefined) {
                changes[key] = { type: 'add', newValue: newVal };
            } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                // For objects/arrays, use deep comparison via JSON
                changes[key] = { type: 'update', oldValue: oldVal, newValue: newVal };
            }
        }

        return Object.keys(changes).length > 0 ? changes : null;
    }

    /**
     * Apply diff to an object
     * @param {Object} obj - Base object
     * @param {Object} changes - Changes to apply
     * @returns {Object} Modified object
     * @private
     */
    _applyDiff(obj, changes) {
        const result = this._shallowClone(obj);

        for (const key in changes) {
            const change = changes[key];
            switch (change.type) {
                case 'delete':
                    delete result[key];
                    break;
                case 'add':
                case 'update':
                    result[key] = this._shallowClone(change.newValue);
                    break;
            }
        }

        return result;
    }

    /**
     * Create inverse of a delta for undo operations
     * @param {Object} delta - Original delta
     * @returns {Object} Inverse delta
     * @private
     */
    _inverseDelta(delta) {
        const inverse = {};

        for (const key in delta) {
            const change = delta[key];
            switch (change.type) {
                case 'delete':
                    inverse[key] = { type: 'add', newValue: change.oldValue };
                    break;
                case 'add':
                    inverse[key] = { type: 'delete', oldValue: change.newValue };
                    break;
                case 'update':
                    inverse[key] = { type: 'update', oldValue: change.newValue, newValue: change.oldValue };
                    break;
            }
        }

        return inverse;
    }

    /**
     * Prune history if it exceeds max size
     * @private
     */
    _pruneHistoryIfNeeded() {
        if (this.history.length > this.maxHistorySize) {
            const entriesToRemove = this.history.length - this.maxHistorySize;
            this.history = this.history.slice(entriesToRemove);
            this.currentIndex -= entriesToRemove;
            console.log(`[HISTORY] Pruned ${entriesToRemove} entries, new index: ${this.currentIndex}`);
        }
    }

    /**
     * Reconstruct current full state from history
     * @private
     */
    _reconstructState() {
        if (this.history.length === 0) {
            this.currentIndex = -1;
            this.fullState = null;
            return;
        }

        // Start from the full state entry (should be at index 0)
        if (this.history[0].fullState) {
            this.fullState = this._shallowClone(this.history[0].fullState);
        } else {
            console.error('[HISTORY] No full state found at history[0]');
            return;
        }

        // Apply deltas up to current index
        for (let i = 1; i <= this.currentIndex; i++) {
            const entry = this.history[i];
            if (entry.changes) {
                this.fullState = this._applyDiff(this.fullState, entry.changes);
            }
        }
    }

    /**
     * Reconstruct current full state from loaded history without modifying currentIndex
     * Used during storage loading to preserve the loaded currentIndex value
     * @private
     */
    _reconstructStateFromLoadedHistory() {
        if (this.history.length === 0) {
            this.fullState = null;
            return;
        }

        // Start from the full state entry (should be at index 0)
        if (this.history[0].fullState) {
            this.fullState = this._shallowClone(this.history[0].fullState);
        } else {
            console.error('[HISTORY] No full state found at history[0]');
            return;
        }

        // Apply deltas up to current index
        for (let i = 1; i <= this.currentIndex; i++) {
            const entry = this.history[i];
            if (entry && entry.changes) {
                this.fullState = this._applyDiff(this.fullState, entry.changes);
            }
        }
    }

    /**
     * Update undo/redo button states
     * @private
     */
    _updateUndoRedoButtons() {
        try {
            const undoBtn = document.getElementById('undoBtn');
            const redoBtn = document.getElementById('redoBtn');

            if (undoBtn) {
                undoBtn.disabled = !this.canUndo();
                undoBtn.style.opacity = this.canUndo() ? '1' : '0.5';
                undoBtn.title = this.canUndo() ? 'Undo last action' : 'Nothing to undo';
            }

            if (redoBtn) {
                redoBtn.disabled = !this.canRedo();
                redoBtn.style.opacity = this.canRedo() ? '1' : '0.5';
                redoBtn.title = this.canRedo() ? 'Redo last undone action' : 'Nothing to redo';
            }
        } catch (error) {
            console.warn('[HISTORY] Could not update button states:', error.message);
        }
    }

    /**
     * Save history to storage
      * @private
     */
    _saveToStorage() {
        try {
            // Also save current reconstructed state for reconstruction on reload
            if (this.fullState) {
                window.localStorage.setItem(this.stateStorageKey, JSON.stringify(this.fullState));
            }

            window.localStorage.setItem(this.historyStorageKey, JSON.stringify({
                history: this.history,
                currentIndex: this.currentIndex,
                lastSaved: new Date().toISOString(),
            }));
        } catch (error) {
            console.error('[HISTORY] Failed to save to storage:', error);
        }
    }

    /**
     * Load history from storage
      * @private
     */
    _loadHistoryFromStorage() {
        try {
            const savedHistory = window.localStorage.getItem(this.historyStorageKey);
            if (savedHistory) {
                const parsed = JSON.parse(savedHistory);
                this.history = parsed.history || [];
                this.currentIndex = parsed.currentIndex ?? -1;

                // Initialize currentIndex to 0 when history is loaded successfully
                if (this.history.length > 0) {
                    // Ensure loaded currentIndex is within valid bounds
                    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
                        this.currentIndex = 0;
                    }

                    // Reconstruct state from history
                    this._reconstructStateFromLoadedHistory();
                    console.log(`[HISTORY] Loaded history: ${this.history.length} entries, currentIndex: ${this.currentIndex}`);
                } else {
                    console.log('[HISTORY] No history entries found in storage');
                }
            } else {
                console.log('[HISTORY] No saved history found in storage');
            }
        } catch (error) {
            console.error('[HISTORY] Failed to load from storage:', error);
            this.history = [];
            this.currentIndex = -1;
        }
    }
}

// Export for use in other modules
export default HistoryManager;

// Expose globally for Babel standalone transpilation
window.HistoryManager = HistoryManager;
