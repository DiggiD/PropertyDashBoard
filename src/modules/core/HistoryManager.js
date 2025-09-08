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

        console.log('🔧 [HISTORY] HistoryManager initialized');
    }

    /**
     * Initialize history manager
     */
    async initialize() {
        await this.loadHistoryFromStorage();
        console.log(`🔧 [HISTORY] Loaded ${this.history.length} history entries`);
    }

    /**
     * Save current state to history
     * @param {string} description - Description of the change
     * @param {Object} metadata - Additional metadata
     * @returns {boolean} Success status
     */
    async saveState(description = 'State change', metadata = {}) {
        if (this.isUndoRedoInProgress) {
            console.log('🔧 [HISTORY] Skipping save during undo/redo operation');
            return false;
        }

        try {
            // Get current data state
            const currentData = this.dataManager.getData();

            // Create history entry
            const historyEntry = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                description,
                data: JSON.parse(JSON.stringify(currentData)),
                metadata: { ...metadata },
            };

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

            console.log(`🔧 [HISTORY] State saved: "${description}" (${this.history.length} entries)`);

            // Update UI state
            this.updateUndoRedoButtons();

            return true;
        } catch (error) {
            console.error('🔧 [HISTORY] Failed to save state:', error);
            return false;
        }
    }

    /**
     * Undo last operation
     * @returns {Object} Result with success status and restored data
     */
    async undo() {
        if (!this.canUndo()) {
            console.log('🔧 [HISTORY] Cannot undo - no previous state');
            return { success: false, message: 'Nothing to undo' };
        }

        try {
            this.isUndoRedoInProgress = true;

            // Get the state to restore
            const targetState = this.history[this.historyIndex - 1];
            const currentState = this.history[this.historyIndex];

            // Move history index back
            this.historyIndex--;

            // Restore the data
            const restoredData = JSON.parse(JSON.stringify(targetState.data));
            await this.dataManager.initialize(restoredData);

            // Save current state as a snapshot before undo
            await this.saveHistoryToStorage();

            console.log(`🔧 [HISTORY] Undid: "${currentState.description}" -> "${targetState.description}"`);

            // Update UI
            this.updateUndoRedoButtons();

            this.isUndoRedoInProgress = false;

            return {
                success: true,
                message: `Undid: ${currentState.description}`,
                restoredState: targetState,
            };
        } catch (error) {
            console.error('🔧 [HISTORY] Undo failed:', error);
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
            console.log('🔧 [HISTORY] Cannot redo - no next state');
            return { success: false, message: 'Nothing to redo' };
        }

        try {
            this.isUndoRedoInProgress = true;

            // Get the state to restore
            const targetState = this.history[this.historyIndex + 1];
            const currentState = this.history[this.historyIndex];

            // Move history index forward
            this.historyIndex++;

            // Restore the data
            const restoredData = JSON.parse(JSON.stringify(targetState.data));
            await this.dataManager.initialize(restoredData);

            // Save current state as a snapshot
            await this.saveHistoryToStorage();

            console.log(`🔧 [HISTORY] Redid: "${currentState.description}" -> "${targetState.description}"`);

            // Update UI
            this.updateUndoRedoButtons();

            this.isUndoRedoInProgress = false;

            return {
                success: true,
                message: `Redid: ${targetState.description}`,
                restoredState: targetState,
            };
        } catch (error) {
            console.error('🔧 [HISTORY] Redo failed:', error);
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
     * @returns {Object} Result with success status and snapshot data
     */
    async createSnapshot(name = null, description = '') {
        try {
            const currentData = this.dataManager.getData();

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
                console.log(`🔧 [HISTORY] Snapshot created: "${snapshot.name}"`);
                return {
                    success: true,
                    message: `Snapshot "${snapshot.name}" created successfully`,
                    snapshot,
                };
            } else {
                return {
                    success: false,
                    message: 'Failed to save snapshot',
                };
            }
        } catch (error) {
            console.error('🔧 [HISTORY] Failed to create snapshot:', error);
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
            // Get snapshot from storage
            const history = this.storage.loadHistoryFromStorage();
            const snapshot = history.find(s => s.id === snapshotId);

            if (!snapshot) {
                return {
                    success: false,
                    message: 'Snapshot not found',
                };
            }

            // Confirm with user (this would be handled by UI)
            const confirmed = confirm(
                `Load snapshot "${snapshot.name}"?\n\nThis will replace your current data.\n\nCreated: ${new Date(snapshot.timestamp).toLocaleString()}\nTotal Expenses: ₹${snapshot.totalExpenses.toLocaleString()}`,
            );

            if (!confirmed) {
                return { success: false, message: 'Snapshot load cancelled' };
            }

            // Save current state before loading snapshot
            await this.saveState(`Load snapshot: ${snapshot.name}`);

            // Load snapshot data
            const snapshotData = JSON.parse(JSON.stringify(snapshot.data));
            await this.dataManager.initialize(snapshotData);

            console.log(`🔧 [HISTORY] Snapshot loaded: "${snapshot.name}"`);

            return {
                success: true,
                message: `Snapshot "${snapshot.name}" loaded successfully`,
                snapshot,
            };
        } catch (error) {
            console.error('🔧 [HISTORY] Failed to load snapshot:', error);
            return {
                success: false,
                message: 'Snapshot load failed',
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
            const history = this.storage.loadHistoryFromStorage();
            const snapshotIndex = history.findIndex(s => s.id === snapshotId);

            if (snapshotIndex === -1) {
                return {
                    success: false,
                    message: 'Snapshot not found',
                };
            }

            const snapshot = history[snapshotIndex];

            // Confirm deletion
            const confirmed = confirm(
                `Delete snapshot "${snapshot.name}"?\n\nThis action cannot be undone.`,
            );

            if (!confirmed) {
                return { success: false, message: 'Snapshot deletion cancelled' };
            }

            // Remove from history
            history.splice(snapshotIndex, 1);

            // Save updated history
            localStorage.setItem(this.historyStorageKey, JSON.stringify(history));

            console.log(`🔧 [HISTORY] Snapshot deleted: "${snapshot.name}"`);

            return {
                success: true,
                message: `Snapshot "${snapshot.name}" deleted successfully`,
            };
        } catch (error) {
            console.error('🔧 [HISTORY] Failed to delete snapshot:', error);
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
        return this.storage.loadHistoryFromStorage();
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
                const snapshots = this.history.filter(entry =>
                    entry.description.includes('Snapshot') ||
                    entry.description.includes('snapshot'),
                );
                this.history = snapshots;
                this.historyIndex = snapshots.length - 1;
            } else {
                // Clear everything
                this.history = [];
                this.historyIndex = -1;
            }

            this.saveHistoryToStorage();
            this.updateUndoRedoButtons();

            console.log('🔧 [HISTORY] History cleared');
            return true;
        } catch (error) {
            console.error('🔧 [HISTORY] Failed to clear history:', error);
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
            const historyData = this.history.map(entry => ({
                ...entry,
                // Calculate totals for snapshots
                totalExpenses: entry.data ?
                    this.calculateTotalExpensesFromData(entry.data) :
                    entry.totalExpenses || 0,
                propertyCount: entry.data ? entry.data.properties.length : entry.propertyCount || 0,
                categoryCount: entry.data ? entry.data.expenseCategories.length : entry.categoryCount || 0,
            }));

            localStorage.setItem(this.historyStorageKey, JSON.stringify(historyData));
            return true;
        } catch (error) {
            console.error('🔧 [HISTORY] Failed to save history to storage:', error);
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
            console.error('🔧 [HISTORY] Failed to load history from storage:', error);
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
        console.log(`🔧 [HISTORY] Button states - Undo: ${state.canUndo}, Redo: ${state.canRedo}`);

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
            console.warn('🔧 [HISTORY] Could not update button states:', error.message);
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

                console.log(`🔧 [HISTORY] Imported ${this.history.length} history entries`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('🔧 [HISTORY] Failed to import history:', error);
            return false;
        }
    }

    /**
     * Get history statistics
     * @returns {Object} History statistics
     */
    getHistoryStatistics() {
        const snapshots = this.history.filter(entry =>
            entry.description.includes('Snapshot') ||
            entry.description.includes('snapshot'),
        );

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
                console.log(`🔧 [HISTORY] Snapshot imported: "${snapshot.name}"`);
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
            console.error('🔧 [HISTORY] Failed to import snapshot:', error);
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
            console.log('🔧 [HISTORY] Opening history manager...');

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
                        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        ${historyContent}
                    </div>
                </div>
            `;

            // Add modal styles
            const style = document.createElement('style');
            style.textContent = `
                .history-modal { max-width: 800px; }
                .history-entry { padding: 10px; border-bottom: 1px solid #ddd; }
                .history-entry.current { background-color: #e8f4fd; }
                .history-actions { margin-top: 20px; }
                .history-btn { margin: 0 5px; padding: 5px 10px; }
            `;
            document.head.appendChild(style);

            document.body.appendChild(modal);

            // Show modal
            setTimeout(() => modal.classList.add('open'), 10);

            console.log('🔧 [HISTORY] History manager opened');

            return {
                success: true,
                message: 'History manager opened successfully',
            };
        } catch (error) {
            console.error('🔧 [HISTORY] Failed to open history manager:', error);
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

        let content = `
            <div class="history-stats">
                <p>Total entries: ${historyState.totalEntries}</p>
                <p>Current position: ${historyState.currentIndex + 1}</p>
            </div>

            <div class="history-actions">
                <button class="history-btn" onclick="window.historyManager.undo()" ${!historyState.canUndo ? 'disabled' : ''}>
                    Undo
                </button>
                <button class="history-btn" onclick="window.historyManager.redo()" ${!historyState.canRedo ? 'disabled' : ''}>
                    Redo
                </button>
                <button class="history-btn" onclick="window.historyManager.createSnapshot()">
                    Create Snapshot
                </button>
            </div>

            <div class="history-entries">
                <h3>Recent History</h3>
        `;

        // Show recent history entries
        const recentEntries = this.history.slice(-10).reverse();
        recentEntries.forEach((entry, index) => {
            const isCurrent = this.history.length - 1 - index === this.historyIndex;
            const entryClass = isCurrent ? 'history-entry current' : 'history-entry';

            content += `
                <div class="${entryClass}">
                    <strong>${entry.description}</strong><br>
                    <small>${new Date(entry.timestamp).toLocaleString()}</small>
                    ${isCurrent ? ' <em>(Current)</em>' : ''}
                </div>
            `;
        });

        content += `
            </div>

            <div class="snapshots-section">
                <h3>Snapshots (${snapshots.length})</h3>
        `;

        if (snapshots.length === 0) {
            content += '<p>No snapshots available</p>';
        } else {
            snapshots.forEach(snapshot => {
                content += `
                    <div class="snapshot-entry">
                        <strong>${snapshot.name}</strong><br>
                        <small>${new Date(snapshot.timestamp).toLocaleString()}</small>
                        <button class="history-btn" onclick="window.historyManager.loadSnapshot('${snapshot.id}')">
                            Load
                        </button>
                        <button class="history-btn" onclick="window.historyManager.deleteSnapshot('${snapshot.id}')">
                            Delete
                        </button>
                    </div>
                `;
            });
        }

        content += `
            </div>
        `;

        return content;
    }

    /**
     * Debug history information
     */
    debug() {
        console.log('🔧 [HISTORY DEBUG] === HISTORY INFORMATION ===');
        console.log('🔧 [HISTORY DEBUG] Total entries:', this.history.length);
        console.log('🔧 [HISTORY DEBUG] Current index:', this.historyIndex);
        console.log('🔧 [HISTORY DEBUG] Can undo:', this.canUndo());
        console.log('🔧 [HISTORY DEBUG] Can redo:', this.canRedo());
        console.log('🔧 [HISTORY DEBUG] Statistics:', this.getHistoryStatistics());

        if (this.history.length > 0) {
            console.log('🔧 [HISTORY DEBUG] Current entry:', this.history[this.historyIndex]);
            console.log('🔧 [HISTORY DEBUG] Recent entries:');
            this.history.slice(-5).forEach((entry, index) => {
                const marker = index === this.history.length - 1 - this.historyIndex ? ' <-- CURRENT' : '';
                console.log(`🔧 [HISTORY DEBUG] [${this.history.length - 5 + index}] ${entry.description} (${entry.timestamp})${marker}`);
            });
        }

        console.log('🔧 [HISTORY DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistoryManager;
} else {
    window.HistoryManager = HistoryManager;
}
