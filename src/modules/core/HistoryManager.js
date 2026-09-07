import logger from '../utils/Logger.js';
import { migrateToFlat } from '../utils/legacyMigrator.js';
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

        logger.info('HISTORY', 'HistoryManager initialized');
    }

    /**
     * Initialize history manager
     */
    async initialize() {
        logger.info('HISTORY', 'Initializing history manager...');

        // Ensure dataManager is available
        if (!this.dataManager) {
            logger.error('HISTORY', 'DataManager not available during initialization');
            return;
        }

        await this.loadHistoryFromStorage();
        logger.debug('HISTORY', `Loaded ${this.history.length} history entries`);

        // Create initial snapshot if no history exists and data is available
        const currentData = this.dataManager.getData();
        if (this.history.length === 0 && currentData.properties && currentData.properties.length > 0) {
            logger.info('HISTORY', 'No history found, creating initial snapshot...');
            await this.createSnapshot('Initial State', 'Initial State - Auto-created on app startup', true);
        } else {
            logger.info('HISTORY', 'History already exists or no data available, skipping initial snapshot creation');
        }

        // Update UI buttons state
        this.updateUndoRedoButtons();

        logger.info('HISTORY', 'History manager initialization complete');
    }

    /**
     * Save current state to history
     * @param {string} description - Description of the change
     * @param {Object} metadata - Additional metadata
     * @param {boolean} isSnapshot - Whether this is a snapshot operation
     * @returns {boolean} Success status
     */
    hasFlatSnapshot() {
        return Array.isArray(this.history)
            && this.history.some(entry => Array.isArray(entry?.data?.transactions));
    }

    async capture(description = 'Initial State') {
        if (this.hasFlatSnapshot()) {
            return false;
        }
        return this.saveState(description);
    }

    async saveState(description = 'State change', metadata = {}, isSnapshot = false) {
        if (this.isUndoRedoInProgress) {
            logger.info('HISTORY', 'Skipping save during undo/redo operation');
            return false;
        }

        try {
            const currentData = this._captureFlatData();

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

            logger.debug('HISTORY', `State saved: "${updatedDescription}" (${this.history.length} entries)`);

            // Update UI state
            this.updateUndoRedoButtons();

            return true;
        } catch (error) {
            logger.error('HISTORY', 'Failed to save state', error);
            return false;
        }
    }

    /**
     * Undo last operation
     * @returns {Object} Result with success status and restored data
     */
    async undo() {
        if (!this.canUndo()) {
            logger.info('HISTORY', 'Cannot undo - no previous state');
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
                    logger.debug('HISTORY', 'Undoing snapshot creation:', currentState.metadata.snapshotId);
                    const history = await this.storage.loadHistoryFromStorage();
                    const snapshotIndex = history.findIndex(s => s.id === currentState.metadata.snapshotId);
                    if (snapshotIndex !== -1) {
                        history.splice(snapshotIndex, 1);
                        localStorage.setItem(this.historyStorageKey, JSON.stringify(history));
                        await this.loadHistoryFromStorage();
                    }
                } else if (action === 'delete_snapshot') {
                    // Undo snapshot deletion - restore the snapshot
                    logger.debug('HISTORY', 'Undoing snapshot deletion:', currentState.metadata.snapshotId);
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
                logger.info('HISTORY', 'Undoing file import operation');
            }

            this.historyIndex--;

            // Restore the data to the previous state
            if (targetState) {
                const restoredData = JSON.parse(JSON.stringify(targetState.data));
                await this.dataManager.initialize(restoredData);
                if (typeof this.dataManager.save === 'function') {
                    await this.dataManager.save();
                }
                logger.debug('HISTORY', `Restored data to: "${targetState.description}"`);
            } else {
                await this.dataManager.initialize({
                    properties: [],
                    expenseCategories: [],
                    transactions: [],
                });
                if (typeof this.dataManager.save === 'function') {
                    await this.dataManager.save();
                }
                logger.info('HISTORY', 'Restored to empty state');
            }

            await this.saveHistoryToStorage();

            logger.debug('HISTORY', `Undid: "${currentState.description}"`);

            // Update UI
            this.updateUndoRedoButtons();

            // Refresh the history manager UI if it's open
            this.refreshHistoryManagerUI();

            this.isUndoRedoInProgress = false;

            return {
                success: true,
                message: `Undid: ${currentState.description}`,
                restoredState: targetState,
            };
        } catch (error) {
            logger.error('HISTORY', 'Undo failed', error);
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
            logger.info('HISTORY', 'Cannot redo - no next state');
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
                    logger.debug('HISTORY', 'Redoing snapshot creation:', targetState.metadata.snapshotId);
                    const snapshotData = targetState.metadata.snapshotData;
                    if (snapshotData) {
                        const success = await this.storage.saveHistorySnapshot(snapshotData);
                        if (success) {
                            await this.loadHistoryFromStorage();
                        }
                    }
                } else if (action === 'delete_snapshot') {
                    // Redo snapshot deletion - remove the snapshot again
                    logger.debug('HISTORY', 'Redoing snapshot deletion:', targetState.metadata.snapshotId);
                    const history = await this.storage.loadHistoryFromStorage();
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
            if (typeof this.dataManager.save === 'function') {
                await this.dataManager.save();
            }

            // Save current state as a snapshot
            await this.saveHistoryToStorage();

            logger.debug('HISTORY', `Redid: "${currentState.description}" -> "${targetState.description}"`);

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
            logger.error('HISTORY', 'Redo failed', error);
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
            const currentData = this._captureFlatData();
            logger.debug('HISTORY', 'Creating snapshot with data:', {
                properties: currentData.properties?.length || 0,
                categories: currentData.expenseCategories?.length || 0,
                transactions: currentData.transactions?.length || 0,
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

            // Save snapshot using storage module - database is authoritative
            logger.debug('HISTORY', 'Saving snapshot to storage:', {
                id: snapshot.id,
                name: snapshot.name,
                hasData: !!snapshot.data,
                dataProperties: snapshot.data?.properties?.length || 0,
                dataCategories: snapshot.data?.expenseCategories?.length || 0,
            });

            const success = await this.storage.saveHistorySnapshot(snapshot);
            logger.debug('HISTORY', 'Storage save result:', success);

            if (success) {
                logger.debug('HISTORY', `Snapshot created: "${snapshot.name}"`);

                // Reload history from database to ensure consistency
                logger.info('HISTORY', 'Reloading history from database for consistency...');
                await this.loadHistoryFromStorage();
                logger.debug('HISTORY', 'History reloaded from database, new length:', this.history.length);

                // Find the newly created snapshot in the fresh history
                const newSnapshot = this.history.find(s => s.name === snapshot.name && s.timestamp === snapshot.timestamp);
                if (newSnapshot) {
                    if (!Array.isArray(newSnapshot.data?.transactions)
                        && Array.isArray(snapshot.data?.transactions)) {
                        newSnapshot.data = snapshot.data;
                    }
                    this.historyIndex = this.history.findIndex(s => s.id === newSnapshot.id);
                    logger.debug('HISTORY', 'Set history index to newly created snapshot:', this.historyIndex);
                }

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
            logger.error('HISTORY', 'Failed to create snapshot', error);
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
    async loadSnapshot(snapshotId, options = {}) {
        try {
            logger.debug('HISTORY', 'Loading snapshot:', snapshotId);

            // Always load fresh from database as authoritative source
            logger.info('HISTORY', 'Loading fresh history from database...');
            await this.loadHistoryFromStorage();
            logger.debug('HISTORY', 'Fresh history loaded, length:', this.history.length);

            let snapshot = this.history.find(s => String(s.id) === String(snapshotId));

            if (!snapshot) {
                logger.error('HISTORY', 'Snapshot not found', snapshotId);
                logger.error('HISTORY', 'Available snapshot IDs', this.history.filter(h => h.name).map(h => h.id));

                // Show toast notification
                if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                    window.uiManager.showToast('Snapshot not found. It may have been deleted.', 'error', 3000);
                }
                return {
                    success: false,
                    message: 'Snapshot not found',
                };
            }

            const requireConfirm = options.confirm !== false;
            if (requireConfirm) {
                const confirmed = await this.showInlineConfirmation(
                    `Load Snapshot "${snapshot.name}"`,
                    `This will replace your current data with the snapshot.\n\nCreated: ${new Date(snapshot.timestamp).toLocaleString()}\nTotal Expenses: ₹${snapshot.totalExpenses.toLocaleString()}`,
                    'Load',
                    'Cancel',
                );
                if (!confirmed) {
                    return { success: false, message: 'Snapshot load cancelled' };
                }
            }

            // Save current state before loading snapshot
            await this.saveState(`Load snapshot: ${snapshot.name}`, {
                snapshotTotal: snapshot.totalExpenses
            });

            const snapshotData = this._normalizeSnapshotData(snapshot.data);
            logger.debug('HISTORY', 'Loading snapshot data:', {
                properties: snapshotData.properties?.length || 0,
                categories: snapshotData.expenseCategories?.length || 0,
                hasTransactions: !!snapshotData.transactions,
                transactionsCount: snapshotData.transactions?.length || 0,
            });

            // Calculate summary from snapshot data for accurate display
            const propertiesCount = snapshotData.properties?.length || 0;
            const categoriesCount = snapshotData.expenseCategories?.length || 0;
            const totalExpenses = snapshot.totalExpenses || this.dataManager.calculateTotalExpensesFromData(snapshotData);

            logger.debug('HISTORY', 'Snapshot summary calculated:', {
                propertiesCount,
                categoriesCount,
                totalExpenses,
                snapshotTotalExpenses: snapshot.totalExpenses,
            });

            await this.dataManager.initialize(snapshotData);
            if (typeof this.dataManager.save === 'function') {
                await this.dataManager.save();
            }
            logger.info('HISTORY', 'DataManager initialized with snapshot data');

            // Show toast notification with accurate statistics
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast(`Snapshot "${snapshot.name}" loaded: ${propertiesCount} properties, ${categoriesCount} categories, ₹${totalExpenses.toLocaleString()} total`, 'success', 5000);
            }

            // Refresh the history manager UI if it's open
            this.refreshHistoryManagerUI();

            // Refresh the main application UI
            if (window.uiManager && typeof window.uiManager.forceUIRefresh === 'function') {
                window.uiManager.forceUIRefresh();
            }

            // Also refresh data display with current statistics
            if (window.dataManager && typeof window.dataManager.getDataStatistics === 'function') {
                const stats = window.dataManager.getDataStatistics();
                logger.debug('HISTORY', 'Current data statistics after snapshot load:', stats);
                if (window.uiManager && typeof window.uiManager.updateDataDisplay === 'function') {
                    window.uiManager.updateDataDisplay(stats);
                }
            }

            return {
                success: true,
                message: `Snapshot "${snapshot.name}" loaded successfully`,
                snapshot,
            };
        } catch (error) {
            logger.error('HISTORY', 'Failed to load snapshot', error);
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
            logger.debug('HISTORY', 'Renaming snapshot:', snapshotId);

            // Find the snapshot in history
            const snapshotIndex = this.history.findIndex(s => s.id === snapshotId);

            if (snapshotIndex === -1) {
                logger.error('HISTORY', 'Snapshot not found for renaming', snapshotId);
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

            // Update in database
            await this.storage.updateHistorySnapshot(snapshotId, {
                name: newName.trim()
            });

            // Save updated history to localStorage for consistency
            await this.saveHistoryToStorage();

            logger.debug('HISTORY', `Snapshot renamed: "${currentName}" -> "${newName.trim()}"`);

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
            logger.error('HISTORY', 'Failed to rename snapshot', error);
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
            logger.debug('HISTORY', 'Deleting snapshot:', snapshotId);

            const history = await this.storage.loadHistoryFromStorage();
            const snapshotIndex = history.findIndex(s => s.id === snapshotId);

            if (snapshotIndex === -1) {
                logger.error('HISTORY', 'Snapshot not found for deletion', snapshotId);
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

            logger.debug('HISTORY', `Snapshot deleted: "${snapshot.name}"`);

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
            logger.error('HISTORY', 'Failed to delete snapshot', error);
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

        logger.debug('HISTORY', 'Loaded snapshots from memory:', snapshots.length);
        logger.debug('HISTORY', 'Snapshot details:', snapshots.map(s => ({
            name: s.name || s.description || 'Unnamed',
            timestamp: s.timestamp,
            totalExpenses: s.totalExpenses || 0,
            propertyCount: s.propertyCount || 0
        })));

        return snapshots;
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

            logger.info('HISTORY', 'History cleared');
            return true;
        } catch (error) {
            logger.error('HISTORY', 'Failed to clear history', error);
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
            logger.error('HISTORY', 'Failed to save history to storage', error);
            return false;
        }
    }

    /**
     * Load history from storage
     * @returns {boolean} Success status
     */
    async loadHistoryFromStorage() {
        try {
            // Load snapshots from database as the authoritative source
            const snapshots = await this.storage.loadHistoryFromStorage();
            logger.debug('HISTORY', 'Loaded snapshots from database:', snapshots.length);

            // For now, set history to snapshots only since database is authoritative
            // Regular undo/redo history will be handled separately if needed
            this.history = snapshots.map(snapshot => ({
                ...snapshot,
                // Database now includes calculated fields, but ensure fallbacks for compatibility
                propertyCount: snapshot.propertyCount ?? (snapshot.data?.properties?.length || 0),
                categoryCount: snapshot.categoryCount ?? (snapshot.data?.expenseCategories?.length || 0),
                totalExpenses: snapshot.totalExpenses ?? this.calculateTotalExpensesFromData(snapshot.data),
            }));

            // Set current index to latest entry
            if (this.history.length > 0) {
                this.historyIndex = this.history.length - 1;
            } else {
                this.historyIndex = -1;
            }

            logger.debug('HISTORY', 'History loaded from database, total entries:', this.history.length);
            return true;
        } catch (error) {
            logger.error('HISTORY', 'Failed to load history from storage', error);
            this.history = [];
            this.historyIndex = -1;
            return false;
        }
    }

    _normalizeSnapshotData(data) {
        const copy = JSON.parse(JSON.stringify(data || {}));
        return migrateToFlat(copy);
    }

    _captureFlatData() {
        const currentData = typeof this.dataManager.getData === 'function'
            ? this.dataManager.getData() || {}
            : {};
        const exported = this.dataManager.store
            && typeof this.dataManager.store.exportData === 'function'
            ? this.dataManager.store.exportData()
            : null;
        if (exported && Array.isArray(exported.transactions)) {
            return JSON.parse(JSON.stringify({ ...currentData, ...exported }));
        }
        return JSON.parse(JSON.stringify(currentData));
    }

    /**
     * Calculate total expenses from data
     * @param {Object} data - Data object
     * @returns {number} Total expenses
     */
    calculateTotalExpensesFromData(data) {
        if (!data || !Array.isArray(data.transactions)) {
            return 0;
        }

        return data.transactions.reduce((total, txn) => {
            if (!txn || txn.type !== 'expense') {
                return total;
            }
            return total + Math.abs(txn.amount || 0);
        }, 0);
    }

    /**
     * Update undo/redo button states
     */
    updateUndoRedoButtons() {
        const state = this.getHistoryState();
        logger.debug('HISTORY', `Button states - Undo: ${state.canUndo}, Redo: ${state.canRedo}`);

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
            logger.warn('HISTORY', 'Could not update button states', error.message);
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

                logger.debug('HISTORY', `Imported ${this.history.length} history entries`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error('HISTORY', 'Failed to import history', error);
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
                logger.debug('HISTORY', `Snapshot imported: "${snapshot.name}"`);
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
            logger.error('HISTORY', 'Failed to import snapshot', error);
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
            logger.info('HISTORY', 'Opening history manager...');

            // Check if modal already exists
            const existingModal = document.getElementById('historyManagerModal');
            if (existingModal) {
                logger.info('HISTORY', 'History manager modal already exists, refreshing content...');
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
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .history-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border-radius: 8px;
                    margin-bottom: 20px;
                    border: 1px solid #dee2e6;
                }

                .history-actions-left {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .history-actions-right {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .toolbar-separator {
                    width: 1px;
                    height: 24px;
                    background: #dee2e6;
                    margin: 0 8px;
                }

                .history-btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .history-btn.primary {
                    background: #007bff;
                    color: white;
                }

                .history-btn.primary:hover:not(:disabled) {
                    background: #0056b3;
                    transform: translateY(-1px);
                }

                .history-btn.secondary {
                    background: #6c757d;
                    color: white;
                }

                .history-btn.secondary:hover:not(:disabled) {
                    background: #545b62;
                    transform: translateY(-1px);
                }

                .history-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .history-btn.danger {
                    background: #dc3545;
                    color: white;
                }

                .history-btn.danger:hover:not(:disabled) {
                    background: #c82333;
                    transform: translateY(-1px);
                }

                .history-stats {
                    display: flex;
                    gap: 16px;
                }

                .stat-item {
                    font-size: 13px;
                    color: #6c757d;
                    background: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    border: 1px solid #dee2e6;
                }

                .history-content {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                }

                .history-panel, .snapshots-panel {
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 20px;
                    border: 1px solid #dee2e6;
                }

                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    border-bottom: 2px solid #007bff;
                    padding-bottom: 8px;
                }

                .panel-title {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #495057;
                }

                .panel-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .history-list, .snapshots-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    max-height: 300px;
                    overflow-y: auto;
                    padding-right: 8px;
                }

                .history-list::-webkit-scrollbar,
                .snapshots-list::-webkit-scrollbar {
                    width: 6px;
                }

                .history-list::-webkit-scrollbar-track,
                .snapshots-list::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 3px;
                }

                .history-list::-webkit-scrollbar-thumb,
                .snapshots-list::-webkit-scrollbar-thumb {
                    background: #c1c1c1;
                    border-radius: 3px;
                }

                .history-list::-webkit-scrollbar-thumb:hover,
                .snapshots-list::-webkit-scrollbar-thumb:hover {
                    background: #a8a8a8;
                }

                .history-entry {
                    background: white;
                    border-radius: 6px;
                    padding: 12px 16px;
                    border: 1px solid #e9ecef;
                    transition: all 0.2s ease;
                    position: relative;
                }

                .history-entry:hover {
                    border-color: #007bff;
                    box-shadow: 0 2px 4px rgba(0,123,255,0.1);
                }

                .history-entry.current {
                    border-color: #007bff;
                    background: linear-gradient(135deg, #e7f3ff 0%, #f8f9fa 100%);
                    box-shadow: 0 2px 8px rgba(0,123,255,0.15);
                }

                .entry-content {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .entry-title {
                    font-weight: 500;
                    color: #495057;
                    font-size: 14px;
                }

                .entry-meta {
                    font-size: 12px;
                    color: #6c757d;
                }

                .current-indicator {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #007bff;
                    font-size: 12px;
                    font-weight: bold;
                }

                .snapshot-entry {
                    background: white;
                    border-radius: 6px;
                    padding: 16px;
                    border: 1px solid #e9ecef;
                    transition: all 0.2s ease;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .snapshot-entry:hover {
                    border-color: #28a745;
                    box-shadow: 0 2px 4px rgba(40,167,69,0.1);
                }

                .snapshot-info {
                    flex: 1;
                    min-width: 0; /* Allow text to wrap properly */
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    text-align: left;
                }

                .snapshot-date {
                    font-size: 12px;
                    color: #868e96;
                    font-weight: 500;
                    text-align: left;
                }

                .snapshot-title {
                    font-weight: 600;
                    color: #495057;
                    font-size: 14px;
                    line-height: 1.3;
                    cursor: pointer;
                    padding: 2px 4px;
                    border-radius: 3px;
                    transition: background-color 0.2s ease;
                    text-align: left;
                }

                .snapshot-title:hover {
                    background-color: #f8f9fa;
                }

                .snapshot-title.editing {
                    background-color: #fff;
                    border: 1px solid #007bff;
                    outline: none;
                }

                .snapshot-summary {
                    font-size: 12px;
                    color: #6c757d;
                    font-weight: 500;
                    text-align: left;
                }

                .snapshot-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    align-items: flex-end;
                    justify-content: flex-start;
                    min-width: 80px;
                }

                .action-btn {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    min-width: 70px;
                    text-align: center;
                }

                .load-btn {
                    background: #28a745;
                    color: white;
                }

                .load-btn:hover {
                    background: #218838;
                    transform: translateY(-1px);
                }

                .rename-btn {
                    background: #ffc107;
                    color: #212529;
                }

                .rename-btn:hover {
                    background: #e0a800;
                    transform: translateY(-1px);
                }

                .delete-btn {
                    background: #dc3545;
                    color: white;
                }

                .delete-btn:hover {
                    background: #c82333;
                    transform: translateY(-1px);
                }

                .empty-state {
                    text-align: center;
                    color: #6c757d;
                    font-style: italic;
                    padding: 40px 20px;
                    background: white;
                    border-radius: 6px;
                    border: 1px solid #e9ecef;
                }

                .close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #6c757d;
                    transition: color 0.2s ease;
                }

                .close-btn:hover {
                    color: #495057;
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
            }, 10);

            logger.info('HISTORY', 'History manager opened');

            return {
                success: true,
                message: 'History manager opened successfully',
            };
        } catch (error) {
            logger.error('HISTORY', 'Failed to open history manager', error);
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
                        🗑️ Delete All
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
                // Calculate accurate summary from snapshot data
                const propertiesCount = snapshot.data?.properties?.length || snapshot.propertyCount || 0;
                const categoriesCount = snapshot.data?.expenseCategories?.length || snapshot.categoryCount || 0;
                const totalExpenses = snapshot.totalExpenses || 0;

                logger.debug('HISTORY', 'Displaying snapshot in UI:', {
                    id: snapshot.id,
                    name: snapshot.name,
                    propertiesCount,
                    categoriesCount,
                    totalExpenses,
                    hasData: !!snapshot.data,
                });

                content += `
                    <div class="snapshot-entry">
                        <div class="snapshot-info">
                            <div class="snapshot-date">${new Date(snapshot.timestamp).toLocaleDateString()}</div>
                            <div class="snapshot-title" onclick="window.historyManager.renameSnapshot('${snapshot.id}')" title="Click to rename">${snapshot.name}</div>
                            <div class="snapshot-summary">${propertiesCount} properties • ${categoriesCount} categories • ₹${totalExpenses.toLocaleString()}</div>
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

            logger.info('HISTORY', 'History exported successfully');
            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast('History exported successfully', 'success', 3000);
            }
        } catch (error) {
            logger.error('HISTORY', 'Failed to export history', error);
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

            logger.info('HISTORY', 'Import history modal opened');
        } catch (error) {
            logger.error('HISTORY', 'Failed to open import modal', error);
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
            logger.info('HISTORY', '===== STARTING HISTORY IMPORT PROCESS =====');
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

            logger.debug('HISTORY', 'Selected file for import:', {
                name: file.name,
                size: file.size,
                type: file.type,
            });

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
                logger.info('HISTORY', 'Import cancelled by user');
                return;
            }

            logger.info('HISTORY', 'User confirmed import, reading file...');

            // Read file content
            const fileContent = await this.readFileAsText(file);
            logger.debug('HISTORY', 'File content length:', fileContent.length);
            const importData = JSON.parse(fileContent);

            logger.debug('HISTORY', 'Parsed import data:', {
                keys: Object.keys(importData),
                hasCurrentData: !!importData.currentData,
                hasHistory: !!importData.history,
                hasProperties: !!importData.properties,
                hasTransactions: !!importData.transactions,
            });

            // Import both current data and history if present
            let dataImportSuccess = false;
            let historyImportSuccess = false;
            let importedDataSummary = null;

            // Import current data if present
            if (importData.currentData || importData.properties) {
                const dataToImport = importData.currentData || importData;
                logger.debug('HISTORY', 'Importing main application data...', {
                    hasProperties: !!dataToImport.properties,
                    propertiesCount: dataToImport.properties?.length || 0,
                    hasCategories: !!dataToImport.expenseCategories,
                    categoriesCount: dataToImport.expenseCategories?.length || 0,
                    hasTransactions: !!dataToImport.transactions,
                    transactionsCount: dataToImport.transactions?.length || 0,
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

                logger.debug('HISTORY', 'About to call dataManager.importData with dataToImport:', {
                    hasData: !!dataToImport,
                    dataType: typeof dataToImport,
                    dataKeys: dataToImport ? Object.keys(dataToImport) : 'N/A',
                    hasTransactions: !!(dataToImport && dataToImport.transactions),
                    transactionsLength: dataToImport && dataToImport.transactions ? dataToImport.transactions.length : 'N/A',
                    hasProperties: !!(dataToImport && dataToImport.properties),
                    propertiesLength: dataToImport && dataToImport.properties ? dataToImport.properties.length : 'N/A'
                });

                logger.debug('HISTORY', 'Current dataManager state before import:', {
                    properties: window.dataManager?.getProperties()?.length || 0,
                    categories: window.dataManager?.getExpenseCategories()?.length || 0,
                });

                dataImportSuccess = await window.dataManager.importData(dataToImport);
                logger.debug('HISTORY', 'Data import result:', dataImportSuccess);

                if (dataImportSuccess) {
                    logger.info('HISTORY', 'Data imported successfully');
                    logger.debug('HISTORY', 'DataManager state after import:', {
                        properties: window.dataManager?.getProperties()?.length || 0,
                        categories: window.dataManager?.getExpenseCategories()?.length || 0,
                    });
                } else {
                    console.error('[HISTORY] Data import failed');
                }
            }

            // Import history if present
            if (importData.history && Array.isArray(importData.history)) {
                logger.debug('HISTORY', 'Importing history data...', {
                    historyLength: importData.history.length
                });

                historyImportSuccess = this.importHistoryData(importData);
                if (historyImportSuccess) {
                    logger.info('HISTORY', 'History imported successfully');
                } else {
                    console.error('[HISTORY] History import failed');
                }
            }

            // Determine overall success
            const success = dataImportSuccess || historyImportSuccess;

            logger.debug('HISTORY', 'Import results:', {
                dataImportSuccess,
                historyImportSuccess,
                overallSuccess: success,
            });

            if (success) {
                logger.info('HISTORY', 'Import successful, performing post-import operations...');
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
                logger.info('HISTORY', 'Waiting for DataManager operations to complete...');
                await new Promise(resolve => setTimeout(resolve, 500));

                // Reload history from storage after importing data
                if (dataImportSuccess) {
                    logger.info('HISTORY', 'Reloading history from storage...');
                    await this.loadHistoryFromStorage();
                    logger.info('HISTORY', 'History reloaded after data import');
                }

                // Force refresh of main application UI
                if (window.uiManager && typeof window.uiManager.forceUIRefresh === 'function') {
                    logger.info('HISTORY', 'Forcing UI refresh...');
                    window.uiManager.forceUIRefresh();
                    logger.info('HISTORY', 'Main app UI refreshed');
                }

                // Update data display with statistics
                if (window.dataManager && typeof window.dataManager.getDataStatistics === 'function') {
                    const stats = window.dataManager.getDataStatistics();
                    logger.debug('HISTORY', 'Data statistics after import:', stats);
                    if (window.uiManager && typeof window.uiManager.updateDataDisplay === 'function') {
                        await window.uiManager.updateDataDisplay(stats);
                        logger.info('HISTORY', 'UI updated with imported data statistics');
                    }
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

                    logger.info('HISTORY', 'Creating snapshot for imported data...');
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
                if (window.uiManager && typeof window.uiManager.forceUIRefresh === 'function') {
                    window.uiManager.forceUIRefresh();
                }
    
                // Update data display with current statistics
                if (window.dataManager && typeof window.dataManager.getDataStatistics === 'function') {
                    const stats = window.dataManager.getDataStatistics();
                    logger.debug('HISTORY', 'Current data statistics after snapshot load:', stats);
                    if (window.uiManager && typeof window.uiManager.updateDataDisplay === 'function') {
                        window.uiManager.updateDataDisplay(stats);
                    }
                }
    
                // Also refresh PropertiesManager if available
                if (window.propertiesManager && typeof window.propertiesManager.renderPropertiesDashboard === 'function') {
                    logger.info('HISTORY', 'Refreshing PropertiesManager after snapshot load...');
                    window.propertiesManager.renderPropertiesDashboard();
                }

                // Also refresh ChartRenderer if available
                if (window.chartRenderer && typeof window.chartRenderer.renderOverviewSankey === 'function') {
                    logger.info('HISTORY', 'Refreshing ChartRenderer after snapshot load...');
                    window.chartRenderer.renderOverviewSankey();
                }

                logger.info('HISTORY', '===== HISTORY IMPORT PROCESS COMPLETE =====');
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
            logger.error('HISTORY', 'Failed to import data', error);
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
            logger.info('HISTORY', 'Refreshing history manager UI...');

            // Check for modal with more robust detection
            const modal = document.getElementById('historyManagerModal');

            if (modal && modal.parentNode) {
                logger.info('HISTORY', 'Found modal, updating content...');

                // Update the modal content
                const modalBody = modal.querySelector('.modal-body');
                if (modalBody) {
                    const newContent = this.generateHistoryManagerContent();
                    logger.info('HISTORY', 'Generated new content, updating modal...');
                    modalBody.innerHTML = newContent;

                    // Re-bind event handlers for the new buttons
                    this.bindModalEvents();
                    logger.info('HISTORY', 'UI refreshed successfully');
                } else {
                    console.error('[HISTORY] Modal body not found');
                }
            } else {
                logger.info('HISTORY', 'History manager modal not found or not in DOM - skipping refresh (modal not open)');
                // Do not open a new modal - only refresh if already open
            }
        } catch (error) {
            logger.error('HISTORY', 'Failed to refresh UI', error);
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
                        logger.info('HISTORY', 'History manager modal closed');
                    }
                });
                logger.info('HISTORY', 'Close button bound');
            } else {
                logger.error('HISTORY', 'Close button not found');
            }
        } catch (error) {
            logger.error('HISTORY', 'Failed to bind close button', error);
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

            logger.info('HISTORY', 'Modal events re-bound');
        } catch (error) {
            logger.error('HISTORY', 'Failed to bind modal events', error);
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

            logger.debug('HISTORY', 'Started inline editing for snapshot:', snapshotId);
        } catch (error) {
            logger.error('HISTORY', 'Failed to start inline editing', error);
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
                logger.info('HISTORY', 'Input element no longer in DOM, skipping finishInlineEditing');
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

            logger.info('HISTORY', 'Finished inline editing');
        } catch (error) {
            logger.error('HISTORY', 'Failed to finish inline editing', error);
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
            logger.error('HISTORY', 'Failed to extract snapshot ID', error);
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
            logger.debug('HISTORY', 'Saving snapshot name:', snapshotId, '->', newName);

            // Find and update the snapshot in history
            const snapshotIndex = this.history.findIndex(entry => entry.id === snapshotId);
            if (snapshotIndex === -1) {
                logger.error('HISTORY', 'Snapshot not found for renaming', snapshotId);
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
                        logger.info('HISTORY', 'Updated create snapshot history entry');
                    }

                    // Update "Delete snapshot" entries
                    if (action === 'delete_snapshot' && entry.metadata.snapshotId === snapshotId) {
                        entry.description = `Delete snapshot: ${newName.trim()}`;
                        logger.info('HISTORY', 'Updated delete snapshot history entry');
                    }
                }

                // Also update any other history entries that might reference the old snapshot name
                if (entry.description && entry.description.includes(oldName)) {
                    entry.description = entry.description.replace(oldName, newName.trim());
                    logger.info('HISTORY', 'Updated history entry description containing snapshot name');
                }
            });

            // Save to storage
            await this.saveHistoryToStorage();

            // Refresh the history manager UI to show updated names immediately
            this.refreshHistoryManagerUI();

            logger.info('HISTORY', 'Snapshot name saved successfully');

            // Show toast notification
            if (window.uiManager && typeof window.uiManager.showToast === 'function') {
                window.uiManager.showToast(`Snapshot renamed to "${newName.trim()}"`, 'success', 2000);
            }
        } catch (error) {
            logger.error('HISTORY', 'Failed to save snapshot name', error);
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
        logger.debug('HISTORY', 'Delete All Data button clicked');

        // Show inline confirmation instead of browser popup
        const confirmed = await this.showInlineConfirmation(
            '⚠️ Delete All Data',
            'This will delete ALL data including:\n' +
            '• All properties and their expenses\n' +
            '• All expense categories\n' +
            '• All history and snapshots\n' +
            '• All stored data in browser\n' +
            '• All cached data\n\n' +
            'This action CANNOT be undone!',
            'Delete Everything',
            'Cancel'
        );

        if (!confirmed) {
            logger.debug('HISTORY', 'Delete operation cancelled by user');
            return { success: false, message: 'Delete operation cancelled' };
        }

        logger.debug('HISTORY', 'Starting comprehensive data deletion...');

        // Clear all data from storage using the Storage module
        if (window.storage && typeof window.storage.clearAllData === 'function') {
            logger.debug('HISTORY', 'Clearing all data via Storage module...');
            const clearResult = await window.storage.clearAllData(true);
            logger.debug('HISTORY', 'Storage clear result:', clearResult);

            if (!clearResult) {
                logger.warn('HISTORY', 'Storage clear returned false, attempting manual clear...');
                // Fallback: clear localStorage manually
                localStorage.clear();
                logger.debug('HISTORY', 'localStorage cleared manually as fallback');
            }
        } else {
            logger.warn('HISTORY', 'Storage module not available, clearing manually...');
            // Fallback manual clearing
            localStorage.clear();
            logger.debug('HISTORY', 'localStorage cleared manually');

            // Try to clear IndexedDB manually
            if (window.indexedDB) {
                try {
                    const deleteRequest = window.indexedDB.deleteDatabase('ExpenseDashboardDB');
                    await new Promise((resolve, reject) => {
                        deleteRequest.onsuccess = () => resolve();
                        deleteRequest.onerror = () => reject(deleteRequest.error);
                        deleteRequest.onblocked = () => reject(new Error('Database deletion blocked'));
                    });
                    logger.debug('HISTORY', 'IndexedDB cleared manually');
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
                incomeCategories: [],
                currentTimePeriod: 'all',
                currentView: 'overview',
            };
            logger.debug('HISTORY', 'DataManager memory cleared');
        }

        if (window.historyManager && window.historyManager.history) {
            window.historyManager.history = [];
            window.historyManager.historyIndex = -1;
            logger.debug('HISTORY', 'HistoryManager memory cleared');
        }

        // Clear any cached data in other modules
        if (window.transactionStore) {
            // Clear any cached transactions
            if (window.transactionStore.transactions) {
                window.transactionStore.transactions = [];
            }
            logger.debug('HISTORY', 'TransactionStore cache cleared');
        }

        // Clear browser cache and storage
        try {
            // Clear session storage
            sessionStorage.clear();
            logger.debug('HISTORY', 'Session storage cleared');

            // Clear any service worker caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
                logger.debug('HISTORY', 'Browser caches cleared');
            }
        } catch (cacheError) {
            logger.warn('HISTORY', 'Error clearing browser cache:', cacheError);
        }

        logger.debug('HISTORY', 'All data deletion completed successfully');

        // Show toast notification
        if (window.uiManager && typeof window.uiManager.showToast === 'function') {
            window.uiManager.showToast('All data deleted successfully', 'success', 3000);
        }

        // Add a small delay to ensure all async operations complete
        setTimeout(() => {
            // Show inline success message instead of browser popup
            this.showInlineConfirmation(
                '✅ Data Deleted Successfully',
                'All data has been deleted successfully!\n\n' +
                '• Database cleared\n' +
                '• Local storage cleared\n' +
                '• Session storage cleared\n' +
                '• Browser cache cleared\n\n' +
                'The page will now reload to ensure a clean state.',
                'Reload Page',
                'Cancel'
            ).then((confirmed) => {
                if (confirmed) {
                    // Force a hard reload to clear all cached resources
                    window.location.href = window.location.href;
                }
            });
        }, 1000);

        return { success: true, message: 'All data deleted successfully' };
    } catch (error) {
        logger.error('HISTORY', 'Error during data deletion:', error);

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
            logger.error('HISTORY', 'Failed to show import status', error);
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
     * Cleanup resources
     */
    cleanup() {
        logger.info('HISTORY', 'Cleaning up history manager resources');

        // Clear history data
        this.history = [];
        this.historyIndex = -1;

        // Clear any pending operations
        this.isUndoRedoInProgress = false;
        this.pendingChanges = [];

        // Clear timers if any
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }

        logger.info('HISTORY', 'History manager cleanup complete');
    }

    /**
     * Debug history information
     */
    debug() {
        logger.debug('HISTORY', '=== HISTORY INFORMATION ===');
        logger.debug('HISTORY', 'Total entries:', this.history.length);
        logger.debug('HISTORY', 'Current index:', this.historyIndex);
        logger.debug('HISTORY', 'Can undo:', this.canUndo());
        logger.debug('HISTORY', 'Can redo:', this.canRedo());
        logger.debug('HISTORY', 'Statistics:', this.getHistoryStatistics());

        if (this.history.length > 0) {
            logger.debug('HISTORY', 'Current entry:', this.history[this.historyIndex]);
            logger.debug('HISTORY', 'Recent entries:');
            this.history.slice(-5).forEach((entry, index) => {
                const marker = index === this.history.length - 1 - this.historyIndex ? ' <-- CURRENT' : '';
                logger.debug('HISTORY', `[${this.history.length - 5 + index}] ${entry.description} (${entry.timestamp})${marker}`);
            });
        }

        logger.debug('HISTORY', '=== END DEBUG ===');
    }
}

// Export for use in other modules
export default HistoryManager;

// Expose globally for Babel standalone transpilation (only in browser)
if (typeof window !== 'undefined') {
    window.HistoryManager = HistoryManager;
}
