/**
 * HistoryManager Module
 * Handles undo/redo functionality and data snapshots
 * - State management for undo/redo operations
 * - Snapshot creation and restoration
 * - History persistence and limits
 * - Change tracking and diffing
 */

class HistoryManager {
    constructor(storage, dataManager) {
        this.storage = storage;
        this.dataManager = dataManager;

        // History state
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 20;

        // History storage
        this.historyStorageKey = 'sankey-property-dashboard-history';

        // Change tracking
        this.isUndoRedoInProgress = false;
        this.pendingChanges = [];

        console.log('[HISTORY] HistoryManager initialized');
    }

    /**
     * Initialize history manager
     */
    async initialize() {
        console.log('[HISTORY] Initializing history manager...');

        // Ensure dataManager is available
        if (!this.dataManager) {
            console.error('[HISTORY] DataManager not available during initialization');
            return;
        }

        await this.loadHistoryFromStorage();
        console.log(`[HISTORY] Loaded ${this.history.length} history entries`);

        // Create initial snapshot if no history exists and data is available
        const currentData = this.dataManager.getData();
        if (this.history.length === 0 && currentData.properties && currentData.properties.length > 0) {
            console.log('[HISTORY] No history found, creating initial snapshot...');
            await this.createSnapshot('Initial State', 'Initial State - Auto-created on app startup', true);
        } else {
            console.log('[HISTORY] History already exists or no data available, skipping initial snapshot creation');
        }

        // Update UI buttons state
        this.updateUndoRedoButtons();

        console.log('[HISTORY] History manager initialization complete');
    }

    /**
     * Save current state to history
     * @param {string} description - Description of the change
     * @param {Object} metadata - Additional metadata
     * @param {boolean} isSnapshot - Whether this is a snapshot operation
     * @returns {boolean} Success status
     */
    async saveState(description = 'State change', metadata = {}, isSnapshot = false) {
        if (this.isUndoRedoInProgress) {
            console.log('[HISTORY] Skipping save during undo/redo operation');
            return false;
        }

        try {
            // Get current data state
            const currentData = this.dataManager.getData();

            // Calculate total expenses for accurate description
            // Use snapshot total from metadata if provided (for snapshot creation)
            const totalExpenses = metadata.snapshotTotal || this.calculateTotalExpensesFromData(currentData);

            // Update description if it contains a placeholder total
            let updatedDescription = description;
            if (description.includes('₹0 total') || description.includes('total: ₹0')) {
                updatedDescription = description.replace(/₹0/g, `₹${totalExpenses.toLocaleString()}`);
            }

            // Create history entry - ensure it's not treated as a snapshot
            const historyEntry = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                description: updatedDescription,
                data: JSON.parse(JSON.stringify(currentData)),
                metadata: { ...metadata },
                totalExpenses, // Store calculated total
            };

            // If this is NOT a snapshot operation, ensure it doesn't have snapshot properties
            if (!isSnapshot) {
                // Remove any properties that would make this look like a snapshot
                delete historyEntry.name;
                delete historyEntry.propertyCount;
                delete historyEntry.categoryCount;
                // Ensure description doesn't contain "Auto-saved" which would be treated as a snapshot
                if (historyEntry.description.includes('Auto-saved')) {
                    historyEntry.description = historyEntry.description.replace('Auto-saved', 'State saved');
                }
            }

            // Remove any history entries after current index (when user made new changes after undo)
            this.history = this.history.slice(0, this.historyIndex + 1);

            // Add new entry
            this.history.push(historyEntry);
            this.historyIndex++;

            // Maintain history size limit
            if (this.history.length > this.maxHistorySize) {
                this.history.shift();
                this.historyIndex--;
            }

            // Save to storage
            await this.saveHistoryToStorage();

            console.log(`[HISTORY] State saved: "${updatedDescription}" (${this.history.length} entries)`);

            // Update UI state
            this.updateUndoRedoButtons();

            return true;
        } catch (error) {
            console.error('[HISTORY] Failed to save state:', error);
            return false;
        }
    }

    /**
     * Undo last operation
     * @returns {Object} Result with success status and restored data
     */
    async undo() {
        if (!this.canUndo()) {
            console.log('[HISTORY] Cannot undo - no previous state');
            return { success: false, message: 'Nothing to undo' };
        }

        try {
            this.isUndoRedoInProgress = true;

            // Get the state to restore
            const targetState = this.history[this.historyIndex - 1];
            const currentState = this.history[this.historyIndex];

            // Check if current state is a snapshot operation that needs special handling
            if (currentState && currentState.metadata && currentState.metadata.action) {
                const action = currentState.metadata.action;

                if (action === 'create_snapshot') {
                    // Undo snapshot creation - remove the snapshot from storage
                    console.log('[HISTORY] Undoing snapshot creation:', currentState.metadata.snapshotId);
                    const history = this.storage.loadHistoryFromStorage();
                    const snapshotIndex = history.findIndex(s => s.id === currentState.metadata.snapshotId);
                    if (snapshotIndex !== -1) {
                        history.splice(snapshotIndex, 1);
                        localStorage.setItem(this.historyStorageKey, JSON.stringify(history));
                        await this.loadHistoryFromStorage();
                    }
                } else if (action === 'delete_snapshot') {
                    // Undo snapshot deletion - restore the snapshot
                    console.log('[HISTORY] Undoing snapshot deletion:', currentState.metadata.snapshotId);
                    const snapshotData = currentState.metadata.snapshotData;
                    if (snapshotData) {
                        const success = await this.storage.saveHistorySnapshot(snapshotData);
                        if (success) {
                            await this.loadHistoryFromStorage();
                        }
                    }
                }
            }

            // Check if current state is a file import operation that needs special handling
            if (currentState && currentState.description && currentState.description.includes('Import')) {
                // Undo file import - this will be handled by removing the history entry
                console.log('[HISTORY] Undoing file import operation');
            }

            // Remove the current history entry being undone
            const removedEntry = this.history.splice(this.historyIndex, 1)[0];
            console.log('[HISTORY] Removed history entry:', removedEntry.description);

            // Adjust history index since we removed an entry
            this.historyIndex--;

            // If we removed the last entry and there are no more entries, reset index
            if (this.history.length === 0) {
                this.historyIndex = -1;
            }

            // Restore the data to the previous state
            if (targetState) {
                const restoredData = JSON.parse(JSON.stringify(targetState.data));
                await this.dataManager.initialize(restoredData);
                console.log(`[HISTORY] Restored data to: "${targetState.description}"`);
            } else {
                // If no target state, initialize with empty data
                await this.dataManager.initialize({
                    properties: [],
                    expenseCategories: []
                });
                console.log('[HISTORY] Restored to empty state');
            }

            // Save the updated history to storage
            await this.saveHistoryToStorage();

            console.log(`[HISTORY] Undid and removed: "${removedEntry.description}"`);

            // Update UI
            this.updateUndoRedoButtons();

            // Refresh the history manager UI if it's open
            this.refreshHistoryManagerUI();

            this.isUndoRedoInProgress = false;

            return {
                success: true,
                message: `Undid and removed: ${removedEntry.description}`,
                restoredState: targetState,
                removedEntry: removedEntry,
            };
        } catch (error) {
            console.error('[HISTORY] Undo failed:', error);
            this.isUndoRedoInProgress = false;
            return { success: false, message: 'Undo operation failed' };
        }
    }

    /**
     * Redo last undone operation
     * @returns {Object} Result with success status and restored data
     */
    async redo() {
        if (!this.canRedo()) {
            console.log('[HISTORY] Cannot redo - no next state');
            return { success: false, message: 'Nothing to redo' };
        }

        try {
            this.isUndoRedoInProgress = true;

            // Get the state to restore
            const targetState = this.history[this.historyIndex + 1];
            const currentState = this.history[this.historyIndex];

            // Check if target state is a snapshot operation that needs special handling
            if (targetState.metadata && targetState.metadata.action) {
                const action = targetState.metadata.action;

                if (action === 'create_snapshot') {
                    // Redo snapshot creation - restore the snapshot
                    console.log('[HISTORY] Redoing snapshot creation:', targetState.metadata.snapshotId);
                    const snapshotData = targetState.metadata.snapshotData;
                    if (snapshotData) {
                        const success = await this.storage.saveHistorySnapshot(snapshotData);
                        if (success) {
                            await this.loadHistoryFromStorage();
                        }
                    }
                } else if (action === 'delete_snapshot') {
                    // Redo snapshot deletion - remove the snapshot again
                    console.log('[HISTORY] Redoing snapshot deletion:', targetState.metadata.snapshotId);
                    const history = this.storage.loadHistoryFromStorage();
                    const snapshotIndex = history.findIndex(s => s.id === targetState.metadata.snapshotId);
                    if (snapshotIndex !== -1) {
                        history.splice(snapshotIndex, 1);
                        localStorage.setItem(this.historyStorageKey, JSON.stringify(history));
                        await this.loadHistoryFromStorage();
                    }
                }
            }

            // Move history index forward
            this.historyIndex++;

            // Restore the data
            const restoredData = JSON.parse(JSON.stringify(targetState.data));
            await this.dataManager.initialize(restoredData);

            // Save current state as a snapshot
            await this.saveHistoryToStorage();

            console.log(`[HISTORY] Redid: "${currentState.description}" -> "${targetState.description}"`);

            // Update UI
            this.updateUndoRedoButtons();

            // Refresh the history manager UI if it's open
            this.refreshHistoryManagerUI();

            this.isUndoRedoInProgress = false;

            return {
                success: true,
                message: `Redid: ${targetState.description}`,
                restoredState: targetState,
            };
        } catch (error) {
            console.error('[HISTORY] Redo failed:', error);
            this.isUndoRedoInProgress = false;
            return { success: false, message: 'Redo operation failed' };
        }
    }

    /**
     * Check if undo is available
     * @returns {boolean} Whether undo is available
     */
    canUndo() {
        return this.historyIndex > 0;
    }

    /**
     * Check if redo is available
     * @returns {boolean} Whether redo is available
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * Get current history state information
     * @returns {Object} History state info
     */
    getHistoryState() {
        return {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            currentIndex: this.historyIndex,
            totalEntries: this.history.length,
            currentEntry: this.history[this.historyIndex],
            nextEntry: this.history[this.historyIndex + 1],
            previousEntry: this.history[this.historyIndex - 1],
        };
    }

    /**
     * Create a snapshot of current state
     * @param {string} name - Snapshot name
     * @param {string} description - Snapshot description
     * @param {boolean} silent - Whether to show alerts (for auto-snapshots)
     * @returns {Object} Result with success status and snapshot data
     */
    async createSnapshot(name = null, description = '', silent = false) {
        try {
            const currentData = this.dataManager.getData();
            console.log('[HISTORY] Creating snapshot with data:', {
                properties: currentData.properties?.length || 0,
                categories: currentData.expenseCategories?.length || 0
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

            // Save snapshot using storage module
            const success = await this.storage.saveHistorySnapshot(snapshot);

            if (success) {
                console.log(`[HISTORY] Snapshot created: "${snapshot.name}"`);

                // Add the snapshot to the in-memory history array so getSnapshots() can find it
                this.history.push(snapshot);
                this.historyIndex = this.history.length - 1;

                // Save to localStorage
                await this.saveHistoryToStorage();

                // Save current state before creating snapshot for undo capability
                if (!silent) {
                    // Use the same total as the snapshot to avoid miscalculation
                    const snapshotTotal = snapshot.totalExpenses;
                    await this.saveState(`Create snapshot: ${snapshot.name}`, {
                        action: 'create_snapshot',
                        snapshotId: snapshot.id,
                        snapshotTotal: snapshotTotal // Pass the correct total
                    });
                }

                if (!silent) {
                    // Show toast notification
                    if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                        window.uiManager.showToast(`Snapshot "${snapshot.name}" created successfully`, 'success', 3000);
                    }
                }

                // Refresh the history manager UI if it's open
                this.refreshHistoryManagerUI();

                return {
                    success: true,
                    message: `Snapshot "${snapshot.name}" created successfully`,
                    snapshot,
                };
            } else {
                console.error('[HISTORY] Failed to save snapshot to storage');
                if (!silent) {
                    // Show toast notification
                    if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                        window.uiManager.showToast('Failed to save snapshot', 'error', 3000);
                    }
                }
                return {
                    success: false,
                    message: 'Failed to save snapshot',
                };
            }
        } catch (error) {
            console.error('[HISTORY] Failed to create snapshot:', error);
            if (!silent) {
                // Show toast notification
                if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                    window.uiManager.showToast('Failed to create snapshot', 'error', 3000);
                }
            }
            return {
                success: false,
                message: 'Snapshot creation failed',
            };
        }
    }

    /**
     * Load a snapshot
     * @param {string} snapshotId - Snapshot ID to load
     * @returns {Object} Result with success status
     */
    async loadSnapshot(snapshotId) {
        try {
            console.log('[HISTORY] Loading snapshot:', snapshotId);

            // Get snapshot from storage
            const history = this.storage.loadHistoryFromStorage();
            const snapshot = history.find(s => s.id === snapshotId);

            if (!snapshot) {
                console.error('[HISTORY] Snapshot not found:', snapshotId);
                // Show toast notification
                if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                    window.uiManager.showToast('Snapshot not found. It may have been deleted.', 'error', 3000);
                }
                return {
                    success: false,
                    message: 'Snapshot not found',
                };
            }

            // Show inline confirmation instead of browser popup
            const confirmed = await this.showInlineConfirmation(
                `Load Snapshot "${snapshot.name}"`,
                `This will replace your current data with the snapshot.\n\nCreated: ${new Date(snapshot.timestamp).toLocaleString()}\nTotal Expenses: ₹${snapshot.totalExpenses.toLocaleString()}`,
                'Load',
                'Cancel'
            );

            if (!confirmed) {
                return { success: false, message: 'Snapshot load cancelled' };
            }

            // Save current state before loading snapshot
            await this.saveState(`Load snapshot: ${snapshot.name}`, {
                snapshotTotal: snapshot.totalExpenses
            });

            // Load snapshot data
            const snapshotData = JSON.parse(JSON.stringify(snapshot.data));
            await this.dataManager.initialize(snapshotData);

            console.log(`[HISTORY] Snapshot loaded: "${snapshot.name}"`);

            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast(`Snapshot "${snapshot.name}" loaded successfully`, 'success', 3000);
            }

            // Refresh the history manager UI if it's open
            this.refreshHistoryManagerUI();

            // Refresh the main application UI
            if (window.app && typeof window.app.refreshUI === 'function') {
                window.app.refreshUI();
            }

            return {
                success: true,
                message: `Snapshot "${snapshot.name}" loaded successfully`,
                snapshot,
            };
        } catch (error) {
            console.error('[HISTORY] Failed to load snapshot:', error);
            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('Failed to load snapshot', 'error', 3000);
            }
            return {
                success: false,
                message: 'Snapshot load failed',
            };
        }
    }

    /**
     * Rename a snapshot
     * @param {string} snapshotId - Snapshot ID to rename
     * @returns {Object} Result with success status
     */
    async renameSnapshot(snapshotId) {
        try {
            console.log('[HISTORY] Renaming snapshot:', snapshotId);

            // Find the snapshot in history
            const snapshotIndex = this.history.findIndex(s => s.id === snapshotId);

            if (snapshotIndex === -1) {
                console.error('[HISTORY] Snapshot not found for renaming:', snapshotId);
                // Show toast notification
                if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                    window.uiManager.showToast('Snapshot not found. It may have been deleted.', 'error', 3000);
                }
                return {
                    success: false,
                    message: 'Snapshot not found',
                };
            }

            const snapshot = this.history[snapshotIndex];
            const currentName = snapshot.name || 'Unnamed';

            // Show inline input dialog instead of browser popup
            const newName = await this.showInlineInputDialog(
                `Rename Snapshot "${currentName}"`,
                'Enter a new name for this snapshot:',
                currentName,
                'Rename',
                'Cancel'
            );

            if (!newName || newName.trim() === '') {
                return { success: false, message: 'Rename cancelled' };
            }

            if (newName.trim() === currentName) {
                return { success: false, message: 'Name unchanged' };
            }

            // Update the snapshot name
            this.history[snapshotIndex].name = newName.trim();

            // Save updated history
            await this.saveHistoryToStorage();

            console.log(`[HISTORY] Snapshot renamed: "${currentName}" -> "${newName.trim()}"`);

            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast(`Snapshot renamed to "${newName.trim()}"`, 'success', 3000);
            }

            // Refresh the history manager UI if it's open
            this.refreshHistoryManagerUI();

            return {
                success: true,
                message: `Snapshot renamed to "${newName.trim()}"`,
            };
        } catch (error) {
            console.error('[HISTORY] Failed to rename snapshot:', error);
            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('Failed to rename snapshot', 'error', 3000);
            }
            return {
                success: false,
                message: 'Snapshot rename failed',
            };
        }
    }

    /**
     * Delete a snapshot
     * @param {string} snapshotId - Snapshot ID to delete
     * @returns {Object} Result with success status
     */
    async deleteSnapshot(snapshotId) {
        try {
            console.log('[HISTORY] Deleting snapshot:', snapshotId);

            const history = this.storage.loadHistoryFromStorage();
            const snapshotIndex = history.findIndex(s => s.id === snapshotId);

            if (snapshotIndex === -1) {
                console.error('[HISTORY] Snapshot not found for deletion:', snapshotId);
                // Show toast notification
                if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                    window.uiManager.showToast('Snapshot not found. It may have been deleted.', 'error', 3000);
                }
                return {
                    success: false,
                    message: 'Snapshot not found',
                };
            }

            const snapshot = history[snapshotIndex];

            // Show inline confirmation instead of browser popup
            const confirmed = await this.showInlineConfirmation(
                `Delete Snapshot "${snapshot.name}"`,
                `This will permanently delete the snapshot "${snapshot.name}".\n\nThis action cannot be undone.`,
                'Delete',
                'Cancel'
            );

            if (!confirmed) {
                return { success: false, message: 'Snapshot deletion cancelled' };
            }

            // Save current state before deletion for undo capability
            await this.saveState(`Delete snapshot: ${snapshot.name}`, {
                action: 'delete_snapshot',
                snapshotId: snapshotId,
                snapshotData: JSON.parse(JSON.stringify(snapshot))
            });

            // Remove from history
            history.splice(snapshotIndex, 1);

            // Save updated history
            localStorage.setItem(this.historyStorageKey, JSON.stringify(history));

            // Update the in-memory history array
            await this.loadHistoryFromStorage();

            console.log(`[HISTORY] Snapshot deleted: "${snapshot.name}"`);

            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast(`Snapshot "${snapshot.name}" deleted successfully`, 'success', 3000);
            }

            // Refresh the history manager UI if it's open
            this.refreshHistoryManagerUI();

            return {
                success: true,
                message: `Snapshot "${snapshot.name}" deleted successfully`,
            };
        } catch (error) {
            console.error('[HISTORY] Failed to delete snapshot:', error);
            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('Failed to delete snapshot', 'error', 3000);
            }
            return {
                success: false,
                message: 'Snapshot deletion failed',
            };
        }
    }

    /**
     * Get all snapshots
     * @returns {Array} Array of snapshots
     */
    getSnapshots() {
        // Use in-memory history data where snapshots are now stored
        const allEntries = this.history;
        const snapshots = allEntries.filter(entry => {
            // Real snapshots have a name property (created by createSnapshot method)
            if (entry.name) {
                return true;
            }

            // Import operations that create snapshots
            if (entry.description && entry.description.includes('Import') && entry.data) {
                return true;
            }

            // Auto-created snapshots (have description but no name, but contain snapshot data)
            // Only treat as snapshot if it has snapshot-specific properties AND is not a history entry
            if (entry.description &&
                (entry.description.includes('Auto-saved') ||
                 entry.description.includes('Initial State')) &&
                entry.data &&
                (entry.propertyCount !== undefined || entry.categoryCount !== undefined) &&
                !entry.metadata) { // History entries have metadata, snapshots don't
                return true;
            }

            return false;
        });

        console.log('[HISTORY] Loaded snapshots from memory:', snapshots.length);
        console.log('[HISTORY] Snapshot details:', snapshots.map(s => ({
            name: s.name || s.description || 'Unnamed',
            timestamp: s.timestamp,
            totalExpenses: s.totalExpenses || 0,
            propertyCount: s.propertyCount || 0
        })));

        return snapshots;
    }

    /**
     * Compare two snapshots
     * @param {string} snapshotId1 - First snapshot ID
     * @param {string} snapshotId2 - Second snapshot ID
     * @returns {Object} Comparison result
     */
    compareSnapshots(snapshotId1, snapshotId2) {
        const history = this.storage.loadHistoryFromStorage();
        const snap1 = history.find(s => s.id === snapshotId1);
        const snap2 = history.find(s => s.id === snapshotId2);

        if (!snap1 || !snap2) {
            return {
                success: false,
                message: 'One or both snapshots not found',
            };
        }

        const comparison = {
            snapshot1: snap1,
            snapshot2: snap2,
            expenseDifference: snap2.totalExpenses - snap1.totalExpenses,
            propertyDifference: snap2.propertyCount - snap1.propertyCount,
            categoryDifference: snap2.categoryCount - snap1.categoryCount,
            timeDifference: new Date(snap2.timestamp) - new Date(snap1.timestamp),
            propertyChanges: this.compareProperties(snap1.data.properties, snap2.data.properties),
        };

        return {
            success: true,
            comparison,
        };
    }

    /**
     * Compare properties between two data sets
     * @param {Array} oldProps - Old properties
     * @param {Array} newProps - New properties
     * @returns {Array} Array of changes
     */
    compareProperties(oldProps, newProps) {
        const changes = [];

        // Check for added/removed properties
        const oldIds = oldProps.map(p => p.id);
        const newIds = newProps.map(p => p.id);

        const added = newIds.filter(id => !oldIds.includes(id));
        const removed = oldIds.filter(id => !newIds.includes(id));

        added.forEach(id => {
            const prop = newProps.find(p => p.id === id);
            changes.push({ type: 'added', property: prop.name, id });
        });

        removed.forEach(id => {
            const prop = oldProps.find(p => p.id === id);
            changes.push({ type: 'removed', property: prop.name, id });
        });

        // Check for expense changes in existing properties
        oldProps.forEach(oldProp => {
            const newProp = newProps.find(p => p.id === oldProp.id);
            if (newProp) {
                const oldTotal = Object.values(oldProp.expenses).reduce((sum, val) => sum + val, 0);
                const newTotal = Object.values(newProp.expenses).reduce((sum, val) => sum + val, 0);

                if (Math.abs(newTotal - oldTotal) > 0.01) {
                    changes.push({
                        type: 'expense_change',
                        property: oldProp.name,
                        id: oldProp.id,
                        oldTotal,
                        newTotal,
                        difference: newTotal - oldTotal,
                    });
                }
            }
        });

        return changes;
    }

    /**
     * Clear history
     * @param {boolean} keepSnapshots - Whether to keep snapshots
     * @returns {boolean} Success status
     */
    clearHistory(keepSnapshots = true) {
        try {
            if (keepSnapshots) {
                // Keep only snapshots, remove undo/redo history
                const snapshots = this.history.filter(entry => {
                    // Real snapshots have a name property (created by createSnapshot method)
                    if (entry.name) {
                        return true;
                    }

                    // Import operations that create snapshots
                    if (entry.description && entry.description.includes('Import') && entry.data) {
                        return true;
                    }

                    // Auto-created snapshots (have description but no name, but contain snapshot data)
                    if (entry.description &&
                        (entry.description.includes('Auto-saved') ||
                         entry.description.includes('Initial State')) &&
                        entry.data) {
                        return true;
                    }

                    return false;
                });
                this.history = snapshots;
                this.historyIndex = snapshots.length - 1;
            } else {
                // Clear everything
                this.history = [];
                this.historyIndex = -1;
            }

            this.saveHistoryToStorage();
            this.updateUndoRedoButtons();

            console.log('[HISTORY] History cleared');
            return true;
        } catch (error) {
            console.error('[HISTORY] Failed to clear history:', error);
            return false;
        }
    }

    /**
     * Get recent changes for display
     * @param {number} limit - Maximum number of changes to return
     * @returns {Array} Array of recent changes
     */
    getRecentChanges(limit = 10) {
        const changes = [];

        // Get changes from recent history entries
        for (let i = 0; i < Math.min(limit, this.history.length - 1); i++) {
            const current = this.history[i];
            const previous = this.history[i + 1];

            if (current && previous) {
                const expenseDiff = current.totalExpenses - previous.totalExpenses;
                if (Math.abs(expenseDiff) > 0) {
                    changes.push({
                        timestamp: current.timestamp,
                        description: `Change from ${previous.description}`,
                        amount: expenseDiff,
                    });
                }
            }
        }

        return changes;
    }

    /**
     * Save history to storage
     * @returns {boolean} Success status
     */
    async saveHistoryToStorage() {
        try {
            // Preserve totals for snapshots and snapshot-related operations
            const historyData = this.history.map(entry => {
                if (entry.name) {
                    // This is a snapshot - preserve original totals
                    return entry;
                } else if (entry.metadata && entry.metadata.action === 'create_snapshot' && entry.metadata.snapshotTotal) {
                    // This is a "Create snapshot" history entry - preserve the snapshot total
                    // Don't add propertyCount/categoryCount to history entries as it makes them look like snapshots
                    return {
                        ...entry,
                        totalExpenses: entry.metadata.snapshotTotal,
                    };
                } else {
                    // This is a regular history entry - calculate totals from data
                    // Don't add propertyCount/categoryCount to history entries as it makes them look like snapshots
                    return {
                        ...entry,
                        totalExpenses: entry.data ?
                            this.calculateTotalExpensesFromData(entry.data) :
                            entry.totalExpenses || 0,
                    };
                }
            });

            localStorage.setItem(this.historyStorageKey, JSON.stringify(historyData));
            return true;
        } catch (error) {
            console.error('[HISTORY] Failed to save history to storage:', error);
            return false;
        }
    }

    /**
     * Load history from storage
     * @returns {boolean} Success status
     */
    async loadHistoryFromStorage() {
        try {
            const saved = localStorage.getItem(this.historyStorageKey);
            if (saved) {
                this.history = JSON.parse(saved);

                // Clean up any spurious snapshot properties from history entries
                this.history = this.history.map(entry => {
                    // If this entry has metadata (it's a history entry) but also has snapshot properties,
                    // remove the snapshot properties to prevent it from being treated as a snapshot
                    if (entry.metadata && (entry.propertyCount !== undefined || entry.categoryCount !== undefined)) {
                        const cleanedEntry = { ...entry };
                        delete cleanedEntry.propertyCount;
                        delete cleanedEntry.categoryCount;
                        console.log('[HISTORY] Cleaned spurious snapshot properties from history entry:', entry.description);
                        return cleanedEntry;
                    }
                    return entry;
                });

                // Set current index to latest entry
                if (this.history.length > 0) {
                    this.historyIndex = this.history.length - 1;
                }
            } else {
                this.history = [];
                this.historyIndex = -1;
            }

            return true;
        } catch (error) {
            console.error('[HISTORY] Failed to load history from storage:', error);
            this.history = [];
            this.historyIndex = -1;
            return false;
        }
    }

    /**
     * Calculate total expenses from data
     * @param {Object} data - Data object
     * @returns {number} Total expenses
     */
    calculateTotalExpensesFromData(data) {
        if (!data || !data.properties || !Array.isArray(data.properties)) {return 0;}

        return data.properties.reduce((total, property) => {
            if (!property || !property.expenses) {return total;}

            // Calculate total expenses for this property
            const propertyTotal = Object.values(property.expenses).reduce((sum, expense) => {
                return sum + (typeof expense === 'number' ? expense : 0);
            }, 0);

            return total + propertyTotal;
        }, 0);
    }

    /**
     * Update undo/redo button states
     */
    updateUndoRedoButtons() {
        const state = this.getHistoryState();
        console.log(`[HISTORY] Button states - Undo: ${state.canUndo}, Redo: ${state.canRedo}`);

        // Try to update UI buttons if they exist
        try {
            const undoBtn = document.getElementById('undoBtn');
            const redoBtn = document.getElementById('redoBtn');

            if (undoBtn) {
                undoBtn.disabled = !state.canUndo;
                undoBtn.style.opacity = state.canUndo ? '1' : '0.5';
                undoBtn.title = state.canUndo ? 'Undo last action' : 'Nothing to undo';
            }

            if (redoBtn) {
                redoBtn.disabled = !state.canRedo;
                redoBtn.style.opacity = state.canRedo ? '1' : '0.5';
                redoBtn.title = state.canRedo ? 'Redo last undone action' : 'Nothing to redo';
            }
        } catch (error) {
            // Silently fail if DOM elements don't exist
            console.warn('[HISTORY] Could not update button states:', error.message);
        }
    }

    /**
     * Export history data
     * @returns {Object} Export data
     */
    exportHistoryData() {
        return {
            history: this.history,
            currentIndex: this.historyIndex,
            exportDate: new Date().toISOString(),
            version: '1.0',
        };
    }

    /**
     * Import history data
     * @param {Object} importData - History data to import
     * @returns {boolean} Success status
     */
    importHistoryData(importData) {
        try {
            if (importData.history && Array.isArray(importData.history)) {
                this.history = importData.history;
                this.historyIndex = importData.currentIndex || this.history.length - 1;

                this.saveHistoryToStorage();
                this.updateUndoRedoButtons();

                console.log(`[HISTORY] Imported ${this.history.length} history entries`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[HISTORY] Failed to import history:', error);
            return false;
        }
    }

    /**
     * Get history statistics
     * @returns {Object} History statistics
     */
    getHistoryStatistics() {
        const snapshots = this.history.filter(entry => {
            // Real snapshots have a name property (created by createSnapshot method)
            if (entry.name) {
                return true;
            }

            // Import operations that create snapshots
            if (entry.description && entry.description.includes('Import') && entry.data) {
                return true;
            }

            // Auto-created snapshots (have description but no name, but contain snapshot data)
            if (entry.description &&
                (entry.description.includes('Auto-saved') ||
                 entry.description.includes('Initial State')) &&
                entry.data) {
                return true;
            }

            return false;
        });

        return {
            totalEntries: this.history.length,
            snapshots: snapshots.length,
            undoOperations: this.history.length - snapshots.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            currentIndex: this.historyIndex,
            oldestEntry: this.history.length > 0 ? this.history[0].timestamp : null,
            newestEntry: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null,
        };
    }

    /**
     * Import a snapshot from external data
     * @param {Object} snapshotData - Snapshot data to import
     * @returns {Object} Result with success status
     */
    async importSnapshot(snapshotData) {
        try {
            if (!snapshotData || !snapshotData.data) {
                return {
                    success: false,
                    message: 'Invalid snapshot data',
                };
            }

            // Validate snapshot structure
            const requiredFields = ['name', 'data', 'timestamp'];
            const missingFields = requiredFields.filter(field => !snapshotData[field]);

            if (missingFields.length > 0) {
                return {
                    success: false,
                    message: `Missing required fields: ${missingFields.join(', ')}`,
                };
            }

            // Create snapshot object
            const snapshot = {
                id: snapshotData.id || Date.now().toString(),
                name: snapshotData.name,
                description: snapshotData.description || `Imported on ${new Date().toLocaleString()}`,
                timestamp: snapshotData.timestamp,
                data: snapshotData.data,
                totalExpenses: snapshotData.totalExpenses || this.calculateTotalExpensesFromData(snapshotData.data),
                propertyCount: snapshotData.data.properties ? snapshotData.data.properties.length : 0,
                categoryCount: snapshotData.data.expenseCategories ? snapshotData.data.expenseCategories.length : 0,
            };

            // Save snapshot using storage module
            const success = await this.storage.saveHistorySnapshot(snapshot);

            if (success) {
                console.log(`[HISTORY] Snapshot imported: "${snapshot.name}"`);
                return {
                    success: true,
                    message: `Snapshot "${snapshot.name}" imported successfully`,
                    snapshot,
                };
            } else {
                return {
                    success: false,
                    message: 'Failed to save imported snapshot',
                };
            }
        } catch (error) {
            console.error('[HISTORY] Failed to import snapshot:', error);
            return {
                success: false,
                message: 'Snapshot import failed',
            };
        }
    }

    /**
     * Open history manager UI
     * @returns {Object} Result with success status
     */
    async openHistoryManager() {
        try {
            console.log('[HISTORY] Opening history manager...');

            // Check if modal already exists
            const existingModal = document.getElementById('historyManagerModal');
            if (existingModal) {
                console.log('[HISTORY] History manager modal already exists, refreshing content...');
                // Refresh the existing modal instead of creating a new one
                this.refreshHistoryManagerUI();
                return {
                    success: true,
                    message: 'History manager refreshed successfully',
                };
            }

            // Create history manager modal content
            const historyContent = this.generateHistoryManagerContent();

            // This would typically be handled by the UI manager
            // For now, we'll create a simple modal
            const modal = document.createElement('div');
            modal.id = 'historyManagerModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content history-modal">
                    <div class="modal-header">
                        <h2>History Manager</h2>
                        <button class="close-btn" id="historyCloseBtn">×</button>
                    </div>
                    <div class="modal-body">
                        ${historyContent}
                    </div>
                </div>
            `;

            // Add modal styles
            const style = document.createElement('style');
            style.textContent = `
                .history-modal {
                    max-width: 900px;
                    font-family: var(--font-family-base);
                    background: var(--color-background);
                }

                .history-modal .modal-header {
                    padding: var(--space-8) var(--space-20);
                }

                .history-modal h2,
                .history-modal h3,
                .history-modal .panel-title {
                    font-family: var(--font-family-base);
                    font-size: var(--font-size-sm);
                    font-weight: var(--font-weight-semibold);
                    color: var(--color-text);
                    margin: 0;
                    line-height: var(--line-height-tight);
                    letter-spacing: var(--letter-spacing-tight);
                    text-transform: uppercase;
                }

                .history-modal .panel-header {
                    margin-bottom: 0;
                }

                .history-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--space-8) var(--space-20);
                    background: var(--color-background);
                    border-radius: var(--radius-base);
                    margin-bottom: var(--space-20);
                    border: 1px solid var(--color-border);
                    font-family: var(--font-family-base);
                    font-size: var(--font-size-base);
                }

                .history-actions-left {
                    display: flex;
                    align-items: center;
                    gap: var(--space-8);
                }

                .history-actions-right {
                    display: flex;
                    align-items: center;
                    gap: var(--space-8);
                }

                .toolbar-separator {
                    width: 1px;
                    height: 24px;
                    background: var(--color-border);
                    margin: 0 var(--space-8);
                }

                .history-btn {
                    font-size: var(--font-size-sm);
                    padding: var(--space-4) var(--space-8);
                    min-width: 32px;
                    height: 32px;
                    background: var(--color-background);
                    color: var(--color-text);
                    border: 1px solid var(--color-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: var(--font-weight-bold);
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    gap: var(--space-6);
                }

                .history-btn:hover:not(:disabled) {
                    background: var(--color-text);
                    color: var(--color-background);
                    border-color: var(--color-text);
                    transform: translateY(-1px);
                }

                .history-btn:focus {
                    background: var(--color-text);
                    color: var(--color-background);
                    border-color: var(--color-text);
                    box-shadow: 0 0 0 2px var(--color-focus-ring);
                }

                .history-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .history-btn.danger {
                    color: var(--color-error);
                }

                .history-stats {
                    display: flex;
                    gap: var(--space-16);
                }

                .stat-item {
                    font-size: var(--font-size-sm);
                    color: var(--color-text-secondary);
                    background: var(--color-surface);
                    padding: var(--space-4) var(--space-12);
                    border-radius: var(--radius-full);
                    border: 1px solid var(--color-border);
                }

                .history-content {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-24);
                }

                .history-panel, .snapshots-panel {
                    background: var(--color-background);
                    border-radius: var(--radius-base);
                    padding: 0;
                    border: 1px solid var(--color-border);
                    font-family: var(--font-family-base);
                    font-size: var(--font-size-base);
                }

                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-16);
                    padding-bottom: var(--space-8);
                    width: 100%;
                }

                .panel-title {
                    margin: 0;
                    font-size: var(--font-size-lg);
                    font-weight: var(--font-weight-semibold);
                    color: var(--color-text);
                    flex: 1;
                }

                .panel-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    justify-content: flex-end;
                }

                .history-list, .snapshots-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    max-height: 300px;
                    overflow-y: auto;
                    scrollbar-width: none; /* Firefox */
                    -ms-overflow-style: none; /* IE and Edge */
                }

                .history-list::-webkit-scrollbar,
                .snapshots-list::-webkit-scrollbar {
                    display: none; /* Chrome, Safari, and Opera */
                }

                .history-entry {
                    background: var(--color-background);
                    border-radius: var(--radius-sm);
                    padding: var(--space-12) var(--space-16);
                    border: 1px solid var(--color-card-border-inner);
                    transition: all 0.2s ease;
                    position: relative;
                }

                .history-entry:hover {
                    border-color: var(--color-primary);
                    box-shadow: 0 2px 4px rgba(var(--color-teal-500-rgb), 0.1);
                }

                .history-entry.current {
                    border-color: var(--color-primary);
                    background: linear-gradient(135deg, rgba(var(--color-teal-500-rgb), 0.06) 0%, var(--color-surface) 100%);
                    box-shadow: 0 2px 8px rgba(var(--color-teal-500-rgb), 0.15);
                }

                .entry-content {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }

                .entry-title {
                    font-weight: var(--font-weight-medium);
                    color: var(--color-text);
                    font-size: var(--font-size-base);
                }

                .entry-meta {
                    font-size: var(--font-size-sm);
                    color: var(--color-text-secondary);
                }

                .current-indicator {
                    position: absolute;
                    right: var(--space-12);
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--color-primary);
                    font-size: var(--font-size-sm);
                    font-weight: var(--font-weight-bold);
                }

                .snapshot-entry {
                    background: var(--color-background);
                    border-radius: var(--radius-sm);
                    padding: var(--space-16);
                    border: 1px solid var(--color-card-border-inner);
                    transition: all 0.2s ease;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .snapshot-entry:hover {
                    border-color: var(--color-success);
                    box-shadow: 0 2px 4px rgba(var(--color-success-rgb), 0.1);
                }

                .snapshot-info {
                    flex: 1;
                    min-width: 0; /* Allow text to wrap properly */
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                    text-align: left;
                }

                .snapshot-date {
                    font-size: var(--font-size-sm);
                    color: var(--color-text-secondary);
                    font-weight: var(--font-weight-medium);
                    text-align: left;
                }

                .snapshot-title {
                    font-weight: var(--font-weight-semibold);
                    color: var(--color-text);
                    font-size: var(--font-size-base);
                    line-height: 1.3;
                    cursor: pointer;
                    padding: var(--space-2) var(--space-4);
                    border-radius: var(--radius-sm);
                    transition: background-color 0.2s ease;
                    text-align: left;
                }

                .snapshot-title:hover {
                    background-color: var(--color-secondary);
                }

                .snapshot-title.editing {
                    background-color: var(--color-surface);
                    border: 1px solid var(--color-primary);
                    outline: none;
                }

                .snapshot-summary {
                    font-size: var(--font-size-sm);
                    color: var(--color-text-secondary);
                    font-weight: var(--font-weight-medium);
                    text-align: left;
                }

                .snapshot-actions {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                    align-items: flex-end;
                    justify-content: flex-start;
                    min-width: 80px;
                }

                .action-btn {
                    font-size: var(--font-size-sm);
                    padding: var(--space-4) var(--space-8);
                    min-width: 60px;
                    height: 32px;
                    background: var(--color-background);
                    color: var(--color-text);
                    border: 1px solid var(--color-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: var(--font-weight-bold);
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    gap: var(--space-6);
                }

                .action-btn:hover:not(:disabled) {
                    background: var(--color-text);
                    color: var(--color-background);
                    border-color: var(--color-text);
                    transform: translateY(-1px);
                }

                .action-btn:focus {
                    background: var(--color-text);
                    color: var(--color-background);
                    border-color: var(--color-text);
                    box-shadow: 0 0 0 2px var(--color-focus-ring);
                }

                .delete-btn {
                    color: var(--color-error);
                }

                .empty-state {
                    text-align: center;
                    color: var(--color-text-secondary);
                    font-style: italic;
                    padding: var(--space-40) var(--space-20);
                    background: var(--color-surface);
                    border-radius: var(--radius-sm);
                    border: 1px solid var(--color-card-border-inner);
                }

                .close-btn {
                    background: none;
                    border: none;
                    font-size: var(--font-size-2xl);
                    cursor: pointer;
                    color: var(--color-text-secondary);
                    transition: color 0.2s ease;
                }

                .close-btn:hover {
                    color: var(--color-text);
                }

                @media (max-width: 768px) {
                    .history-content {
                        grid-template-columns: 1fr;
                    }

                    .history-toolbar {
                        flex-direction: column;
                        gap: 16px;
                        align-items: stretch;
                    }

                    .history-stats {
                        justify-content: center;
                    }
                }
            `;
            document.head.appendChild(style);

            document.body.appendChild(modal);

            // Show modal
            setTimeout(() => {
                modal.classList.add('open');
                // Bind close button after modal is shown
                this.bindCloseButton();
                // Bind outside click to close modal
                this.bindOutsideClickToClose();
            }, 10);

            console.log('[HISTORY] History manager opened');

            return {
                success: true,
                message: 'History manager opened successfully',
            };
        } catch (error) {
            console.error('[HISTORY] Failed to open history manager:', error);
            return {
                success: false,
                message: 'Failed to open history manager',
            };
        }
    }

    /**
     * Generate history manager content
     * @returns {string} HTML content for history manager
     */
    generateHistoryManagerContent() {
        const historyState = this.getHistoryState();
        const snapshots = this.getSnapshots();
        const stats = this.getHistoryStatistics();

        let content = `
            <div class="history-toolbar">
                <div class="history-actions-left">
                    <button class="history-btn danger" onclick="window.historyManager.deleteAllData()" title="Delete all data (irreversible)">
                        Delete All
                    </button>
                </div>
                <div class="history-actions-right">
                    <button class="history-btn secondary" onclick="window.historyManager.exportHistory()" title="Export history to file">
                        Export
                    </button>
                </div>
            </div>

            <div class="import-status" id="importStatus" style="display: none; background-color: #d4edda; border: 1px solid #c3e6cb; padding: 10px; border-radius: 4px; margin-bottom: 15px; color: #155724;">
                <strong>Import Status:</strong> <span id="importStatusText"></span>
            </div>

            <div class="history-content">
                <div class="history-panel">
                    <div class="panel-header">
                        <h3 class="panel-title">Recent History</h3>
                        <div class="panel-actions">
                            <button class="history-btn primary" onclick="window.historyManager.undo()" ${!historyState.canUndo ? 'disabled' : ''} title="Undo last action">
                                Undo
                            </button>
                            <button class="history-btn primary" onclick="window.historyManager.redo()" ${!historyState.canRedo ? 'disabled' : ''} title="Redo last undone action">
                                Redo
                            </button>
                        </div>
                    </div>
        `;

        // Show recent history entries (newest first) - exclude snapshots and auto-saved entries
        const recentEntries = this.history
            .filter(entry => {
                // Exclude real snapshots created by the user (have name + no Import in description)
                if (entry.name && entry.description && !entry.description.includes('Import') && !entry.description.includes('Auto-saved') && !entry.description.includes('Initial State')) {
                    return false; // Exclude real user-created snapshots
                }
                // Exclude "Auto-saved" entries from recent history
                if (entry.description && entry.description.includes('Auto-saved')) {
                    return false; // Exclude auto-saved entries
                }
                return true; // Include imports, snapshot creation entries, and regular history entries
            })
            .slice(-8)
            .reverse();

        if (recentEntries.length === 0) {
            content += '<div class="empty-state">No history entries available</div>';
        } else {
            content += '<div class="history-list">';
            recentEntries.forEach((entry, index) => {
                // Find the original index in the full history array for current position detection
                const originalIndex = this.history.findIndex(h => h.id === entry.id);
                const isCurrent = originalIndex === this.historyIndex;
                const entryClass = isCurrent ? 'history-entry current' : 'history-entry';

                // Calculate total expenses for this entry
                // Use stored total if available, otherwise calculate from entry data
                const totalExpenses = entry.totalExpenses ||
                    (entry.data ? this.calculateTotalExpensesFromData(entry.data) : 0);

                // Clean up description by removing incorrect totals
                let cleanDescription = entry.description;
                if (cleanDescription.includes('₹0 total') || cleanDescription.includes('total: ₹0')) {
                    cleanDescription = cleanDescription.replace(/, ₹0 total/g, '').replace(/total: ₹0/g, '').trim();
                }

                content += `
                    <div class="${entryClass}">
                        <div class="entry-content">
                            <div class="entry-title">${cleanDescription}</div>
                            <div class="entry-meta">
                                ${new Date(entry.timestamp).toLocaleString()} •
                                ₹${totalExpenses.toLocaleString()}
                            </div>
                        </div>
                        ${isCurrent ? '<div class="current-indicator">●</div>' : ''}
                    </div>
                `;
            });
            content += '</div>';
        }

        content += `
                </div>

                <div class="snapshots-panel">
                    <div class="panel-header">
                        <h3 class="panel-title">Snapshots (${stats.snapshots})</h3>
                        <div class="panel-actions">
                            <button class="history-btn secondary" onclick="window.historyManager.createSnapshot()" title="Create a snapshot">
                                Snapshot
                            </button>
                            <button class="history-btn secondary" onclick="window.historyManager.importHistory()" title="Import history from file">
                                Import
                            </button>
                        </div>
                    </div>
        `;

        if (snapshots.length === 0) {
            content += '<div class="empty-state">No snapshots available</div>';
        } else {
            content += '<div class="snapshots-list">';
            // Show most recent snapshots first
            snapshots.slice().reverse().forEach(snapshot => {
                content += `
                    <div class="snapshot-entry">
                        <div class="snapshot-info">
                            <div class="snapshot-date">${new Date(snapshot.timestamp).toLocaleDateString()}</div>
                            <div class="snapshot-title">${snapshot.name}</div>
                            <div class="snapshot-summary">${snapshot.propertyCount} properties • ₹${snapshot.totalExpenses.toLocaleString()}</div>
                        </div>
                        <div class="snapshot-actions">
                            <button class="action-btn load-btn" onclick="window.historyManager.loadSnapshot('${snapshot.id}')" title="Load this snapshot">
                                Load
                            </button>
                            <button class="action-btn delete-btn" onclick="window.historyManager.deleteSnapshot('${snapshot.id}')" title="Delete this snapshot">
                                Delete
                            </button>
                        </div>
                    </div>
                `;
            });
            content += '</div>';
        }

        content += `
                </div>
            </div>
        `;

        return content;
    }

    /**
     * Export history data to file
     */
    exportHistory() {
        try {
            const exportData = this.exportHistoryData();
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            // Create download link
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `history-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('[HISTORY] History exported successfully');
            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('History exported successfully', 'success', 3000);
            }
        } catch (error) {
            console.error('[HISTORY] Failed to export history:', error);
            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('Failed to export history', 'error', 3000);
            }
        }
    }

    /**
     * Import history data from file
     */
    importHistory() {
        try {
            // Create import modal
            const importModal = document.createElement('div');
            importModal.id = 'historyImportModal';
            importModal.className = 'modal';
            importModal.innerHTML = `
                <div class="modal-content import-modal">
                    <div class="modal-header">
                        <h3>Import History Data</h3>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label" for="historyImportFile">Select history JSON file</label>
                            <input type="file" id="historyImportFile" class="form-control" accept=".json" />
                            <div class="file-info" id="fileInfo" style="margin-top: 10px; font-size: 14px; color: #666;">
                                No file selected
                            </div>
                        </div>
                        <div class="import-warning">
                            <strong>⚠️ Warning:</strong> Importing history will replace your current history. Make sure to export your current history first if you want to keep it.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn--outline" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button class="btn btn--primary" id="confirmHistoryImport" disabled>Import History</button>
                    </div>
                </div>
            `;

            // Add modal styles
            const style = document.createElement('style');
            style.textContent = `
                .import-modal { max-width: 600px; }
                .import-warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin-top: 10px; color: #856404; }
                .form-control[type="file"] { padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: white; }
            `;
            document.head.appendChild(style);

            document.body.appendChild(importModal);

            // Show modal
            setTimeout(() => importModal.classList.add('open'), 10);

            // Add file input handler
            setTimeout(() => {
                const fileInput = document.getElementById('historyImportFile');
                const fileInfo = document.getElementById('fileInfo');
                const confirmBtn = document.getElementById('confirmHistoryImport');

                if (fileInput && fileInfo && confirmBtn) {
                    fileInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                            confirmBtn.disabled = false;
                        } else {
                            fileInfo.textContent = 'No file selected';
                            confirmBtn.disabled = true;
                        }
                    });

                    confirmBtn.addEventListener('click', () => {
                        this.confirmImportHistory();
                    });
                }
            }, 100);

            console.log('[HISTORY] Import history modal opened');
        } catch (error) {
            console.error('[HISTORY] Failed to open import modal:', error);
            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('Failed to open import dialog', 'error', 3000);
            }
        }
    }

    /**
     * Confirm and execute history import
     */
    async confirmImportHistory() {
        try {
            const fileInput = document.getElementById('historyImportFile');
            if (!fileInput) {
                // Show toast notification
                if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                    window.uiManager.showToast('File input not found', 'error', 3000);
                }
                return;
            }

            const file = fileInput.files[0];
            if (!file) {
                // Show toast notification
                if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                    window.uiManager.showToast('Please select a file to import', 'error', 3000);
                }
                return;
            }

            // Get filename without extension for snapshot naming
            const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension

            // Show inline confirmation instead of browser popup
            const confirmed = await this.showInlineConfirmation(
                'Confirm Import',
                'Are you sure you want to import this data?\n\nThis will replace your current data and cannot be undone.',
                'Import',
                'Cancel'
            );

            if (!confirmed) {
                return;
            }

            // Read file content
            const fileContent = await this.readFileAsText(file);
            const importData = JSON.parse(fileContent);

            // Import both current data and history if present
            let dataImportSuccess = false;
            let historyImportSuccess = false;
            let importedDataSummary = null;

            // Import current data if present
            if (importData.currentData || importData.properties) {
                const dataToImport = importData.currentData || importData;
                console.log('[HISTORY] Importing main application data...', {
                    hasProperties: !!dataToImport.properties,
                    propertiesCount: dataToImport.properties?.length || 0,
                    hasCategories: !!dataToImport.expenseCategories,
                    categoriesCount: dataToImport.expenseCategories?.length || 0
                });

                // Calculate summary before import
                const propertiesCount = dataToImport.properties?.length || 0;
                const categoriesCount = dataToImport.expenseCategories?.length || 0;
                const totalExpenses = this.calculateTotalExpensesFromData(dataToImport);

                importedDataSummary = {
                    propertiesCount,
                    categoriesCount,
                    totalExpenses,
                    fileName
                };

                dataImportSuccess = await window.dataManager.importData(dataToImport);
                if (dataImportSuccess) {
                    console.log('[HISTORY] Data imported successfully');
                } else {
                    console.error('[HISTORY] Data import failed');
                }
            }

            // Import history if present
            if (importData.history && Array.isArray(importData.history)) {
                console.log('[HISTORY] Importing history data...', {
                    historyLength: importData.history.length
                });

                historyImportSuccess = this.importHistoryData(importData);
                if (historyImportSuccess) {
                    console.log('[HISTORY] History imported successfully');
                } else {
                    console.error('[HISTORY] History import failed');
                }
            }

            // Determine overall success
            const success = dataImportSuccess || historyImportSuccess;

            if (success) {
                // Show appropriate success message
                if (dataImportSuccess && historyImportSuccess) {
                    // Show toast notification
                    if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                        window.uiManager.showToast('Data and history imported successfully', 'success', 3000);
                    }
                } else if (dataImportSuccess) {
                    // Show toast notification
                    if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                        window.uiManager.showToast('Data imported successfully', 'success', 3000);
                    }
                } else if (historyImportSuccess) {
                    // Show toast notification
                    if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                        window.uiManager.showToast('History imported successfully', 'success', 3000);
                    }
                }

                // Wait a bit for DataManager to complete all operations
                await new Promise(resolve => setTimeout(resolve, 500));

                // Reload history from storage after importing data
                if (dataImportSuccess) {
                    await this.loadHistoryFromStorage();
                    console.log('[HISTORY] History reloaded after data import');
                }

                // Force refresh of main application UI
                if (window.app && typeof window.app.forceUIRefresh === 'function') {
                    await window.app.forceUIRefresh();
                    console.log('[HISTORY] Main app UI refreshed');
                } else if (window.app && typeof window.app.refreshUI === 'function') {
                    await window.app.refreshUI();
                    console.log('[HISTORY] Main app UI refreshed (using refreshUI)');
                } else {
                    console.warn('[HISTORY] No refresh function available on window.app');
                }

                // Close import modal
                const importModal = document.getElementById('historyImportModal');
                if (importModal) {
                    importModal.remove();
                }

                // Create a snapshot of the imported data with summary
                if (dataImportSuccess && importedDataSummary) {
                    const snapshotName = importedDataSummary.fileName;
                    const snapshotDescription = `Imported: ${importedDataSummary.propertiesCount} properties, ${importedDataSummary.categoriesCount} categories, ₹${importedDataSummary.totalExpenses.toLocaleString()} total`;

                    console.log('[HISTORY] Creating snapshot for imported data...');
                    await this.createSnapshot(snapshotName, snapshotDescription, true); // Silent mode
                }

                // Refresh the history manager UI
                this.refreshHistoryManagerUI();

                // Show import status
                if (dataImportSuccess && historyImportSuccess) {
                    // Show toast notification
                    if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                        window.uiManager.showToast('Successfully imported data and history - snapshot created', 'success', 3000);
                    }
                } else if (dataImportSuccess) {
                    // Show toast notification
                    if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                        window.uiManager.showToast('Successfully imported application data - snapshot created', 'success', 3000);
                    }
                } else if (historyImportSuccess) {
                    // Show toast notification
                    if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                        window.uiManager.showToast('Successfully imported history data', 'success', 3000);
                    }
                }

                // Refresh the main application UI
                if (window.app && typeof window.app.refreshUI === 'function') {
                    window.app.refreshUI();
                }
            } else {
                console.error('[HISTORY] Import failed');

                // Close import modal
                const importModal = document.getElementById('historyImportModal');
                if (importModal) {
                    importModal.remove();
                }

                // Try to show error status in history manager if it's still open
                // Show toast notification
                if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                    window.uiManager.showToast('Import failed - please check data format', 'error', 3000);
                }
            }
        } catch (error) {
            console.error('[HISTORY] Failed to import data:', error);
            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('Failed to import data - please check JSON format', 'error', 3000);
            }
        }
    }

    /**
     * Read file content as text
     * @param {File} file - File to read
     * @returns {Promise<string>} File content as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Refresh the history manager UI after import/export
     * Only refreshes if the modal is currently open - does not create new modals
     */
    refreshHistoryManagerUI() {
        try {
            console.log('[HISTORY] Refreshing history manager UI...');

            // Check for modal with more robust detection
            const modal = document.getElementById('historyManagerModal');

            if (modal && modal.parentNode) {
                console.log('[HISTORY] Found modal, updating content...');

                // Update the modal content
                const modalBody = modal.querySelector('.modal-body');
                if (modalBody) {
                    const newContent = this.generateHistoryManagerContent();
                    console.log('[HISTORY] Generated new content, updating modal...');
                    modalBody.innerHTML = newContent;

                    // Re-bind event handlers for the new buttons
                    this.bindModalEvents();
                    console.log('[HISTORY] UI refreshed successfully');
                } else {
                    console.error('[HISTORY] Modal body not found');
                }
            } else {
                console.log('[HISTORY] History manager modal not found or not in DOM - skipping refresh (modal not open)');
                // Do not open a new modal - only refresh if already open
            }
        } catch (error) {
            console.error('[HISTORY] Failed to refresh UI:', error);
        }
    }

    /**
     * Bind close button for the history manager modal
     */
    bindCloseButton() {
        try {
            const closeBtn = document.getElementById('historyCloseBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    const modal = document.getElementById('historyManagerModal');
                    if (modal) {
                        modal.remove();
                        console.log('[HISTORY] History manager modal closed');
                    }
                });
                console.log('[HISTORY] Close button bound');
            } else {
                console.error('[HISTORY] Close button not found');
            }
        } catch (error) {
            console.error('[HISTORY] Failed to bind close button:', error);
        }
    }

    /**
     * Bind outside click to close modal
     */
    bindOutsideClickToClose() {
        try {
            const modal = document.getElementById('historyManagerModal');
            if (modal) {
                modal.addEventListener('click', (e) => {
                    // Only close if the click target is the modal itself (not its children)
                    if (e.target === modal) {
                        modal.remove();
                        console.log('[HISTORY] History manager modal closed by outside click');
                    }
                });
                console.log('[HISTORY] Outside click to close bound');
            } else {
                console.error('[HISTORY] Modal not found for outside click binding');
            }
        } catch (error) {
            console.error('[HISTORY] Failed to bind outside click to close:', error);
        }
    }

    /**
     * Bind modal events for dynamically generated content
     */
    bindModalEvents() {
        try {
            // Re-bind all modal buttons with robust modal detection
            const modal = document.getElementById('historyManagerModal') ||
                         document.querySelector('.modal:has(.history-modal)') ||
                         document.querySelector('.modal .history-modal')?.closest('.modal');
            if (!modal) return;

            // Clear any existing event listeners by cloning and replacing buttons
            const buttons = modal.querySelectorAll('button[onclick]');
            buttons.forEach(button => {
                const clone = button.cloneNode(true);
                button.parentNode.replaceChild(clone, button);
            });

            // Bind undo button
            const undoBtn = modal.querySelector('button[onclick*="undo"]');
            if (undoBtn) {
                undoBtn.onclick = () => this.undo();
            }

            // Bind redo button
            const redoBtn = modal.querySelector('button[onclick*="redo"]');
            if (redoBtn) {
                redoBtn.onclick = () => this.redo();
            }

            // Bind create snapshot button
            const createBtn = modal.querySelector('button[onclick*="createSnapshot"]');
            if (createBtn) {
                createBtn.onclick = () => this.createSnapshot();
            }

            // Bind export history button
            const exportBtn = modal.querySelector('button[onclick*="exportHistory"]');
            if (exportBtn) {
                exportBtn.onclick = () => this.exportHistory();
            }

            // Bind import history button
            const importBtn = modal.querySelector('button[onclick*="importHistory"]');
            if (importBtn) {
                importBtn.onclick = () => this.importHistory();
            }

            // Update button states based on current history state
            const historyState = this.getHistoryState();
            if (undoBtn) {
                undoBtn.disabled = !historyState.canUndo;
            }
            if (redoBtn) {
                redoBtn.disabled = !historyState.canRedo;
            }

            // Bind load snapshot buttons
            const loadButtons = modal.querySelectorAll('button[onclick*="loadSnapshot"]');
            loadButtons.forEach(button => {
                const onclickAttr = button.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/loadSnapshot\('([^']+)'\)/);
                    if (match) {
                        const snapshotId = match[1];
                        button.onclick = () => this.loadSnapshot(snapshotId);
                    }
                }
            });

            // Bind delete snapshot buttons
            const deleteButtons = modal.querySelectorAll('button[onclick*="deleteSnapshot"]');
            deleteButtons.forEach(button => {
                const onclickAttr = button.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/deleteSnapshot\('([^']+)'\)/);
                    if (match) {
                        const snapshotId = match[1];
                        button.onclick = () => this.deleteSnapshot(snapshotId);
                    }
                }
            });

            // Bind inline editing for snapshot titles
            const snapshotTitles = modal.querySelectorAll('.snapshot-title');
            snapshotTitles.forEach(title => {
                title.addEventListener('click', (e) => {
                    this.startInlineEditing(e.target);
                });
            });

            console.log('[HISTORY] Modal events re-bound');
        } catch (error) {
            console.error('[HISTORY] Failed to bind modal events:', error);
        }
    }

    /**
     * Start inline editing for snapshot title
     * @param {HTMLElement} titleElement - The title element to edit
     */
    startInlineEditing(titleElement) {
        try {
            // Prevent multiple editing sessions
            if (document.querySelector('.snapshot-title.editing')) {
                return;
            }

            const originalText = titleElement.textContent.trim();
            const snapshotEntry = titleElement.closest('.snapshot-entry');
            const snapshotId = this.extractSnapshotIdFromEntry(snapshotEntry);

            if (!snapshotId) {
                console.error('[HISTORY] Could not find snapshot ID for editing');
                return;
            }

            // Create input element
            const input = document.createElement('input');
            input.type = 'text';
            input.value = originalText;
            input.className = 'snapshot-title editing';
            input.style.width = '100%';
            input.style.fontSize = '14px';
            input.style.fontWeight = '600';
            input.style.border = '1px solid #007bff';
            input.style.borderRadius = '3px';
            input.style.padding = '2px 4px';
            input.style.outline = 'none';

            // Replace title with input
            titleElement.parentNode.replaceChild(input, titleElement);
            input.focus();
            input.select();

            // Handle save on Enter key
            const saveEdit = async () => {
                const newName = input.value.trim();
                if (newName && newName !== originalText) {
                    await this.saveSnapshotName(snapshotId, newName);
                }
                this.finishInlineEditing(input, newName || originalText);
            };

            // Handle cancel on Escape key
            const cancelEdit = () => {
                this.finishInlineEditing(input, originalText);
            };

            // Event listeners
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveEdit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEdit();
                }
            });

            input.addEventListener('blur', () => {
                saveEdit();
            });

            console.log('[HISTORY] Started inline editing for snapshot:', snapshotId);
        } catch (error) {
            console.error('[HISTORY] Failed to start inline editing:', error);
        }
    }

    /**
     * Finish inline editing and restore title element
     * @param {HTMLInputElement} input - The input element
     * @param {string} finalText - The final text to display
     */
    finishInlineEditing(input, finalText) {
        try {
            // Check if input is still in the DOM (it might have been removed during modal refresh)
            if (!input.parentNode || !document.contains(input)) {
                console.log('[HISTORY] Input element no longer in DOM, skipping finishInlineEditing');
                return;
            }

            // Create new title element
            const titleElement = document.createElement('div');
            titleElement.className = 'snapshot-title';
            titleElement.textContent = finalText;
            titleElement.style.cursor = 'pointer';
            titleElement.style.padding = '2px 4px';
            titleElement.style.borderRadius = '3px';
            titleElement.style.transition = 'background-color 0.2s ease';

            // Add hover effect
            titleElement.addEventListener('mouseenter', () => {
                titleElement.style.backgroundColor = '#f8f9fa';
            });
            titleElement.addEventListener('mouseleave', () => {
                titleElement.style.backgroundColor = '';
            });

            // Replace input with title
            input.parentNode.replaceChild(titleElement, input);

            // Re-bind click event
            titleElement.addEventListener('click', (e) => {
                this.startInlineEditing(e.target);
            });

            console.log('[HISTORY] Finished inline editing');
        } catch (error) {
            console.error('[HISTORY] Failed to finish inline editing:', error);
        }
    }

    /**
     * Extract snapshot ID from snapshot entry element
     * @param {HTMLElement} snapshotEntry - The snapshot entry element
     * @returns {string|null} The snapshot ID or null if not found
     */
    extractSnapshotIdFromEntry(snapshotEntry) {
        try {
            // Look for load button and extract ID from onclick attribute
            const loadBtn = snapshotEntry.querySelector('.load-btn');
            if (loadBtn) {
                const onclickAttr = loadBtn.getAttribute('onclick');
                const match = onclickAttr.match(/loadSnapshot\('([^']+)'\)/);
                if (match) {
                    return match[1];
                }
            }

            // Alternative: look for delete button
            const deleteBtn = snapshotEntry.querySelector('.delete-btn');
            if (deleteBtn) {
                const onclickAttr = deleteBtn.getAttribute('onclick');
                const match = onclickAttr.match(/deleteSnapshot\('([^']+)'\)/);
                if (match) {
                    return match[1];
                }
            }

            return null;
        } catch (error) {
            console.error('[HISTORY] Failed to extract snapshot ID:', error);
            return null;
        }
    }

    /**
     * Save new snapshot name
     * @param {string} snapshotId - The snapshot ID
     * @param {string} newName - The new name
     */
    async saveSnapshotName(snapshotId, newName) {
        try {
            console.log('[HISTORY] Saving snapshot name:', snapshotId, '->', newName);

            // Find and update the snapshot in history
            const snapshotIndex = this.history.findIndex(entry => entry.id === snapshotId);
            if (snapshotIndex === -1) {
                console.error('[HISTORY] Snapshot not found for renaming:', snapshotId);
                return;
            }

            const oldName = this.history[snapshotIndex].name;

            // Update the snapshot name
            this.history[snapshotIndex].name = newName.trim();

            // Also update any related history entries that reference this snapshot
            this.history.forEach(entry => {
                if (entry.metadata && entry.metadata.action) {
                    const action = entry.metadata.action;

                    // Update "Create snapshot" entries
                    if (action === 'create_snapshot' && entry.metadata.snapshotId === snapshotId) {
                        entry.description = `Create snapshot: ${newName.trim()}`;
                        console.log('[HISTORY] Updated create snapshot history entry');
                    }

                    // Update "Delete snapshot" entries
                    if (action === 'delete_snapshot' && entry.metadata.snapshotId === snapshotId) {
                        entry.description = `Delete snapshot: ${newName.trim()}`;
                        console.log('[HISTORY] Updated delete snapshot history entry');
                    }
                }

                // Also update any other history entries that might reference the old snapshot name
                if (entry.description && entry.description.includes(oldName)) {
                    entry.description = entry.description.replace(oldName, newName.trim());
                    console.log('[HISTORY] Updated history entry description containing snapshot name');
                }
            });

            // Save to storage
            await this.saveHistoryToStorage();

            // Refresh the history manager UI to show updated names immediately
            this.refreshHistoryManagerUI();

            console.log('[HISTORY] Snapshot name saved successfully');

            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast(`Snapshot renamed to "${newName.trim()}"`, 'success', 2000);
            }
        } catch (error) {
            console.error('[HISTORY] Failed to save snapshot name:', error);
            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('Failed to rename snapshot', 'error', 3000);
            }
        }
    }

    /**
     * Delete all data (irreversible operation)
     * @returns {Object} Result with success status
     */
    async deleteAllData() {
        try {
            console.log('[DELETE] Delete All Data button clicked');

            // Show inline confirmation instead of browser popup
            const confirmed = await this.showInlineConfirmation(
                '⚠️ Delete All Data',
                'This will delete ALL data including:\n' +
                '• All properties and their expenses\n' +
                '• All expense categories\n' +
                '• All history and snapshots\n' +
                '• All stored data in browser\n\n' +
                'This action CANNOT be undone!',
                'Delete Everything',
                'Cancel'
            );

            if (!confirmed) {
                console.log('[DELETE] Delete operation cancelled by user');
                return { success: false, message: 'Delete operation cancelled' };
            }

            console.log('[DELETE] Starting comprehensive data deletion...');

            // Clear all data from storage (this now handles everything including DB)
            if (window.storage && typeof window.storage.clearAllData === 'function') {
                const clearResult = await window.storage.clearAllData(true);
                console.log('[DELETE] Storage clear result:', clearResult);
            } else {
                console.log('[DELETE] Storage module not available, clearing manually...');
                // Fallback manual clearing
                localStorage.clear();
                console.log('[DELETE] localStorage cleared manually');

                // Try to clear IndexedDB manually
                if (window.indexedDB) {
                    try {
                        const deleteRequest = window.indexedDB.deleteDatabase('ExpenseDashboardDB');
                        await new Promise((resolve, reject) => {
                            deleteRequest.onsuccess = () => resolve();
                            deleteRequest.onerror = () => reject(deleteRequest.error);
                            deleteRequest.onblocked = () => reject(new Error('Database deletion blocked'));
                        });
                        console.log('[DELETE] IndexedDB cleared manually');
                    } catch (dbError) {
                        console.error('[DELETE] Error clearing IndexedDB manually:', dbError);
                    }
                }
            }

            // Clear any remaining data that might be cached in memory
            if (window.dataManager) {
                window.dataManager.data = {
                    properties: [],
                    expenseCategories: [],
                    currentTimePeriod: 'all',
                    currentView: 'overview',
                };
                console.log('[DELETE] DataManager memory cleared');
            }

            if (window.historyManager && window.historyManager.history) {
                window.historyManager.history = [];
                window.historyManager.historyIndex = -1;
                console.log('[DELETE] HistoryManager memory cleared');
            }

            console.log('[DELETE] All data deletion completed successfully');

            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('All data deleted successfully', 'success', 3000);
            }

            // Add a small delay to ensure all async operations complete
            setTimeout(() => {
                // Show inline success message instead of browser popup
                this.showInlineConfirmation(
                    '✅ Data Deleted Successfully',
                    'All data has been deleted successfully!\n\nThe page will now reload to ensure a clean state.',
                    'Reload Page',
                    'Cancel'
                ).then((confirmed) => {
                    if (confirmed) {
                        window.location.reload();
                    }
                });
            }, 500);

            return { success: true, message: 'All data deleted successfully' };
        } catch (error) {
            console.error('[DELETE] Error during data deletion:', error);
            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('Failed to delete data', 'error', 3000);
            }
            return { success: false, message: 'Delete operation failed' };
        }
    }

    /**
     * Show import status in the history manager UI
     * @param {string} message - Status message to display
     * @param {boolean} isError - Whether this is an error message
     */
    showImportStatus(message, isError = false) {
        try {
            const modal = document.getElementById('historyManagerModal') ||
                         document.querySelector('.modal:has(.history-modal)') ||
                         document.querySelector('.modal .history-modal')?.closest('.modal');

            if (modal) {
                const statusDiv = modal.querySelector('#importStatus');
                const statusText = modal.querySelector('#importStatusText');

                if (statusDiv && statusText) {
                    statusText.textContent = message;

                    if (isError) {
                        statusDiv.style.backgroundColor = '#f8d7da';
                        statusDiv.style.borderColor = '#f5c6cb';
                        statusDiv.style.color = '#721c24';
                    } else {
                        statusDiv.style.backgroundColor = '#d4edda';
                        statusDiv.style.borderColor = '#c3e6cb';
                        statusDiv.style.color = '#155724';
                    }

                    statusDiv.style.display = 'block';

                    // Auto-hide after 5 seconds
                    setTimeout(() => {
                        if (statusDiv) {
                            statusDiv.style.display = 'none';
                        }
                    }, 5000);
                }
            }
        } catch (error) {
            console.error('[HISTORY] Failed to show import status:', error);
        }
    }

    /**
     * Show inline input dialog
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @param {string} defaultValue - Default input value
     * @param {string} confirmText - Text for confirm button
     * @param {string} cancelText - Text for cancel button
     * @returns {Promise<string|null>} Promise that resolves to input value or null if cancelled
     */
    showInlineInputDialog(title, message, defaultValue = '', confirmText = 'OK', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            // Create input dialog overlay
            const overlay = document.createElement('div');
            overlay.id = 'inline-input-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;

            overlay.innerHTML = `
                <div style="
                    background: var(--color-surface, white);
                    border: 1px solid var(--color-border, #ddd);
                    border-radius: var(--radius-base, 8px);
                    padding: var(--space-24, 24px);
                    max-width: 400px;
                    text-align: center;
                    box-shadow: var(--shadow-lg, 0 10px 25px rgba(0, 0, 0, 0.2));
                ">
                    <div style="
                        font-size: var(--font-size-xl, 24px);
                        margin-bottom: var(--space-16, 16px);
                        color: var(--color-text, #333);
                        font-weight: 600;
                    ">${title}</div>
                    <div style="
                        margin-bottom: var(--space-16, 16px);
                        color: var(--color-text-secondary, #666);
                        line-height: 1.5;
                        text-align: left;
                    ">${message}</div>
                    <input type="text" id="inline-input-field" value="${defaultValue}" style="
                        width: 100%;
                        padding: var(--space-12, 12px);
                        border: 1px solid var(--color-border, #ddd);
                        border-radius: var(--radius-base, 8px);
                        font-size: var(--font-size-base, 14px);
                        margin-bottom: var(--space-20, 20px);
                        box-sizing: border-box;
                        outline: none;
                    " />
                    <div style="
                        display: flex;
                        gap: var(--space-12, 12px);
                        justify-content: center;
                    ">
                        <button id="inline-input-cancel-btn" style="
                            background: var(--color-surface-secondary, #f8f9fa);
                            color: var(--color-text, #333);
                            border: 1px solid var(--color-border, #ddd);
                            padding: var(--space-12, 12px) var(--space-20, 20px);
                            border-radius: var(--radius-base, 8px);
                            cursor: pointer;
                            font-size: var(--font-size-base, 14px);
                            font-weight: 500;
                            transition: all 0.2s ease;
                        ">${cancelText}</button>
                        <button id="inline-input-confirm-btn" style="
                            background: var(--color-primary, #007bff);
                            color: white;
                            border: none;
                            padding: var(--space-12, 12px) var(--space-20, 20px);
                            border-radius: var(--radius-base, 8px);
                            cursor: pointer;
                            font-size: var(--font-size-base, 14px);
                            font-weight: 500;
                            transition: all 0.2s ease;
                        ">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Setup event listeners
            const inputField = document.getElementById('inline-input-field');
            const cancelBtn = document.getElementById('inline-input-cancel-btn');
            const confirmBtn = document.getElementById('inline-input-confirm-btn');

            const closeDialog = (result) => {
                if (overlay.parentNode) {
                    overlay.remove();
                }
                resolve(result);
            };

            cancelBtn.addEventListener('click', () => closeDialog(null));
            confirmBtn.addEventListener('click', () => {
                const value = inputField.value.trim();
                closeDialog(value || null);
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeDialog(null);
                }
            });

            // Handle Enter key
            inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const value = inputField.value.trim();
                    closeDialog(value || null);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeDialog(null);
                }
            });

            // Focus the input field for accessibility
            setTimeout(() => {
                if (inputField) {
                    inputField.focus();
                    inputField.select();
                }
            }, 100);
        });
    }

    /**
     * Show inline confirmation dialog
     * @param {string} title - Confirmation title
     * @param {string} message - Confirmation message
     * @param {string} confirmText - Text for confirm button
     * @param {string} cancelText - Text for cancel button
     * @returns {Promise<boolean>} Promise that resolves to true if confirmed, false if cancelled
     */
    showInlineConfirmation(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            // Create confirmation overlay
            const overlay = document.createElement('div');
            overlay.id = 'inline-confirmation-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;

            overlay.innerHTML = `
                <div style="
                    background: var(--color-surface, white);
                    border: 1px solid var(--color-border, #ddd);
                    border-radius: var(--radius-base, 8px);
                    padding: var(--space-24, 24px);
                    max-width: 400px;
                    text-align: center;
                    box-shadow: var(--shadow-lg, 0 10px 25px rgba(0, 0, 0, 0.2));
                ">
                    <div style="
                        font-size: var(--font-size-xl, 24px);
                        margin-bottom: var(--space-16, 16px);
                        color: var(--color-text, #333);
                        font-weight: 600;
                    ">${title}</div>
                    <div style="
                        margin-bottom: var(--space-20, 20px);
                        color: var(--color-text-secondary, #666);
                        line-height: 1.5;
                        white-space: pre-line;
                    ">${message}</div>
                    <div style="
                        display: flex;
                        gap: var(--space-12, 12px);
                        justify-content: center;
                    ">
                        <button id="inline-cancel-btn" style="
                            background: var(--color-surface-secondary, #f8f9fa);
                            color: var(--color-text, #333);
                            border: 1px solid var(--color-border, #ddd);
                            padding: var(--space-12, 12px) var(--space-20, 20px);
                            border-radius: var(--radius-base, 8px);
                            cursor: pointer;
                            font-size: var(--font-size-base, 14px);
                            font-weight: 500;
                            transition: all 0.2s ease;
                        ">${cancelText}</button>
                        <button id="inline-confirm-btn" style="
                            background: var(--color-primary, #007bff);
                            color: white;
                            border: none;
                            padding: var(--space-12, 12px) var(--space-20, 20px);
                            border-radius: var(--radius-base, 8px);
                            cursor: pointer;
                            font-size: var(--font-size-base, 14px);
                            font-weight: 500;
                            transition: all 0.2s ease;
                        ">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Setup event listeners
            const cancelBtn = document.getElementById('inline-cancel-btn');
            const confirmBtn = document.getElementById('inline-confirm-btn');

            const closeConfirmation = (result) => {
                if (overlay.parentNode) {
                    overlay.remove();
                }
                resolve(result);
            };

            cancelBtn.addEventListener('click', () => closeConfirmation(false));
            confirmBtn.addEventListener('click', () => closeConfirmation(true));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeConfirmation(false);
                }
            });

            // Focus the cancel button for accessibility
            setTimeout(() => {
                if (cancelBtn) cancelBtn.focus();
            }, 100);
        });
    }

    /**
     * Debug history information
     */
    debug() {
        console.log('[HISTORY DEBUG] === HISTORY INFORMATION ===');
        console.log('[HISTORY DEBUG] Total entries:', this.history.length);
        console.log('[HISTORY DEBUG] Current index:', this.historyIndex);
        console.log('[HISTORY DEBUG] Can undo:', this.canUndo());
        console.log('[HISTORY DEBUG] Can redo:', this.canRedo());
        console.log('[HISTORY DEBUG] Statistics:', this.getHistoryStatistics());

        if (this.history.length > 0) {
            console.log('[HISTORY DEBUG] Current entry:', this.history[this.historyIndex]);
            console.log('[HISTORY DEBUG] Recent entries:');
            this.history.slice(-5).forEach((entry, index) => {
                const marker = index === this.history.length - 1 - this.historyIndex ? ' <-- CURRENT' : '';
                console.log(`[HISTORY DEBUG] [${this.history.length - 5 + index}] ${entry.description} (${entry.timestamp})${marker}`);
            });
        }

        console.log('[HISTORY DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistoryManager;
} else {
    window.HistoryManager = HistoryManager;
}
