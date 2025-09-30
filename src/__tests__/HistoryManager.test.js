/**
 * Jest unit tests for the refactored HistoryManager.js
 * Tests diff-based state management with debounced pushState and delta operations
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import HistoryManager from 'src/modules/core/HistoryManager.js';

// Minimal mock storage for snapshots
const mockStorage = {
  saveHistorySnapshot: jest.fn().mockResolvedValue(true),
  loadHistoryFromStorage: jest.fn().mockReturnValue([]),
};

// Mock data manager
const mockDataManager = {
  getData: jest.fn(),
  initialize: jest.fn().mockResolvedValue(true),
  calculateTotalExpenses: jest.fn().mockReturnValue(1200),
};

// Test data
const testData1 = {
  properties: [{ id: 1, name: 'Property 1', expenses: { rent: 1000, maintenance: 200 } }],
  expenseCategories: ['rent', 'maintenance']
};

const testData2 = {
  properties: [
    { id: 1, name: 'Property 1', expenses: { rent: 1000, maintenance: 200 } },
    { id: 2, name: 'Property 2', expenses: { rent: 1500 } }
  ],
  expenseCategories: ['rent', 'maintenance']
};

describe('HistoryManager - Refactored Diff-Based Implementation', () => {
  let manager;

  beforeEach(() => {
    const localStorageMock = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };

    window.localStorage = localStorageMock;
    global.window = { localStorage: localStorageMock, uiManager: { showToast: jest.fn() } };

    mockDataManager.getData.mockReturnValue(testData1);
    manager = new HistoryManager(mockStorage, mockDataManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Core API Methods', () => {
    test('init() should initialize the manager', async () => {
      global.localStorage.getItem = jest.fn().mockReturnValue(null);
      mockDataManager.getData.mockReturnValue(null); // No data available
      await manager.init();
      expect(manager.currentIndex).toBe(-1);
      expect(manager.fullState).toBe(null);
    });

    test('init() should handle missing DataManager', async () => {
      const managerWithoutDataManager = new HistoryManager(mockStorage, null);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await managerWithoutDataManager.init();
      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] DataManager not available during initialization');
      consoleSpy.mockRestore();
    });

    test('init() should create initial full state entry when history is empty but data exists', async () => {
      global.localStorage.getItem = jest.fn().mockReturnValue(null);
      mockDataManager.getData.mockReturnValue(testData1);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await manager.init();
      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] No history found, creating initial full state entry');
      expect(manager.history.length).toBe(1);
      expect(manager.currentIndex).toBe(0);
      consoleSpy.mockRestore();
    });

    test('initialize() should alias to init()', async () => {
      const initSpy = jest.spyOn(manager, 'init');
      await manager.initialize();
      expect(initSpy).toHaveBeenCalled();
      initSpy.mockRestore();
    });

    test('pushState() should add state with debouncing', async () => {
      manager.pushState(testData1);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(manager.history.length).toBe(1);
      expect(manager.currentIndex).toBe(0);
      expect(manager.fullState).toEqual(testData1);
    });

    test('canUndo() should return false initially', () => {
      expect(manager.canUndo()).toBe(false);
    });

    test('canRedo() should return false initially', () => {
      expect(manager.canRedo()).toBe(false);
    });

    test('clear() should reset history', async () => {
      manager.pushState(testData1);
      await new Promise(resolve => setTimeout(resolve, 150));

      await manager.clear();
      expect(manager.history).toEqual([]);
      expect(manager.currentIndex).toBe(-1);
      expect(manager.fullState).toBe(null);
    });
  });

  describe('Diff-Based Operations', () => {
    test('_computeDiff should detect changes between objects', () => {
      const delta = manager._computeDiff(testData1, testData2);
      expect(delta).toBeDefined();
      expect(delta.properties).toBeDefined();
    });

    test('_computeDiff should handle null oldObj', () => {
      const delta = manager._computeDiff(null, testData1);
      expect(delta).toBeDefined();
      expect(delta.properties.type).toBe('add');
    });

    test('_computeDiff should handle null newObj', () => {
      const delta = manager._computeDiff(testData1, null);
      expect(delta).toBeDefined();
      expect(delta.properties.type).toBe('delete');
    });

    test('_applyDiff should apply changes to an object', () => {
      const delta = { properties: { type: 'add', newValue: [testData2.properties[1]] } };
      const result = manager._applyDiff(testData1, delta);

      expect(result.properties).toHaveLength(1); // Original property still there
      // Note: This test shows the apply logic works
    });

    test('_applyDiff should handle update operations', () => {
      const delta = { properties: { type: 'update', oldValue: testData1.properties, newValue: testData2.properties } };
      const result = manager._applyDiff(testData1, delta);
      expect(result.properties).toEqual(testData2.properties);
    });

    test('_applyDiff should handle delete operations', () => {
      const delta = { properties: { type: 'delete', oldValue: testData1.properties } };
      const result = manager._applyDiff(testData1, delta);
      expect(result.properties).toBeUndefined();
    });

    test('_inverseDelta should handle all change types', () => {
      const delta = {
        properties: { type: 'update', oldValue: testData1.properties, newValue: testData2.properties },
        categories: { type: 'delete', oldValue: ['rent', 'maintenance'] },
        newField: { type: 'add', newValue: 'test' }
      };

      const inverse = manager._inverseDelta(delta);

      expect(inverse.properties.type).toBe('update');
      expect(inverse.properties.oldValue).toEqual(testData2.properties);
      expect(inverse.properties.newValue).toEqual(testData1.properties);

      expect(inverse.categories.type).toBe('add');
      expect(inverse.categories.newValue).toEqual(['rent', 'maintenance']);

      expect(inverse.newField.type).toBe('delete');
      expect(inverse.newField.oldValue).toBe('test');
    });

    test('undo/redo should work with delta-based history', async () => {
      manager.pushState(testData1);
      await new Promise(resolve => setTimeout(resolve, 150));

      manager.pushState(testData2);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(manager.canUndo()).toBe(true);
      expect(manager.canRedo()).toBe(false);

      await manager.undo();
      expect(manager.fullState).toEqual(testData1);
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(true);

      await manager.redo();
      expect(manager.fullState).toEqual(testData2);
      expect(manager.canRedo()).toBe(false);
    });

    test('undo should return false when cannot undo', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = await manager.undo();
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] Cannot undo - no previous state');
      consoleSpy.mockRestore();
    });

    test('redo should return false when cannot redo', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = await manager.redo();
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] Cannot redo - no next state');
      consoleSpy.mockRestore();
    });

    test('undo should handle errors gracefully', async () => {
      manager.pushState(testData1);
      await new Promise(resolve => setTimeout(resolve, 150));

      manager.pushState(testData2);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Force an error in dataManager.initialize
      mockDataManager.initialize.mockRejectedValueOnce(new Error('Test error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await manager.undo();
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] Undo failed:', expect.any(Error));
      expect(manager.isUndoRedoInProgress).toBe(false);

      consoleSpy.mockRestore();
    });

    test('redo should handle errors gracefully', async () => {
      manager.pushState(testData1);
      await new Promise(resolve => setTimeout(resolve, 150));
      manager.pushState(testData2);
      await new Promise(resolve => setTimeout(resolve, 150));

      await manager.undo();

      // Force an error in dataManager.initialize
      mockDataManager.initialize.mockRejectedValueOnce(new Error('Test error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await manager.redo();
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] Redo failed:', expect.any(Error));
      expect(manager.isUndoRedoInProgress).toBe(false);

      consoleSpy.mockRestore();
    });

    test('redo should handle full state entries', async () => {
      // Manually create a history with a full state entry at index 1
      manager.history = [
        { changes: { properties: { type: 'add', newValue: [testData1.properties[0]] } } },
        { fullState: testData2 }
      ];
      manager.currentIndex = 0;
      manager.fullState = testData1;

      const result = await manager.redo();
      expect(result).toBe(true);
      expect(manager.fullState).toEqual(testData2);
    });
  });

  describe('Debouncing Behavior', () => {
    test('rapid pushState calls should be debounced', async () => {
      manager.pushState(testData1);
      manager.pushState(testData2); // Should replace

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(manager.history.length).toBe(1);
      expect(manager.fullState).toEqual(testData2);
    });

    test('identical states should not be added', async () => {
      manager.pushState(testData1);
      await new Promise(resolve => setTimeout(resolve, 150));

      manager.pushState(testData1); // Same state
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(manager.history.length).toBe(1);
    });

    test('pushState should replace pending state when called rapidly', () => {
      manager.pushState(testData1);
      expect(manager.pendingState).toEqual(testData1);

      manager.pushState(testData2); // Should replace pending state
      expect(manager.pendingState).toEqual(testData2);
    });

    test('pushState should handle pending state replacement (lines 112-113)', async () => {
      // First call to start the timer
      manager.pushState(testData1);
      // Second call should replace pending state
      manager.pushState(testData2);

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(manager.fullState).toEqual(testData2);
    });

    test('_doPushState should skip during undo/redo operations', async () => {
      manager.isUndoRedoInProgress = true;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = manager._doPushState(testData1);
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] Skipping push during undo/redo operation');
      consoleSpy.mockRestore();
    });

    test('_doPushState should handle errors gracefully', async () => {
      // Force an error by making _shallowClone throw
      const originalShallowClone = manager._shallowClone;
      manager._shallowClone = jest.fn().mockImplementation(() => { throw new Error('Test error'); });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = manager._doPushState(testData1);
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] Failed to push state:', expect.any(Error));

      manager._shallowClone = originalShallowClone;
      consoleSpy.mockRestore();
    });
  });

  describe('History Size Limits', () => {
    test('should prune history when exceeding max size', async () => {
      manager.maxHistorySize = 2;

      manager.pushState(testData1);
      await new Promise(resolve => setTimeout(resolve, 150));

      manager.pushState(testData2);
      await new Promise(resolve => setTimeout(resolve, 150));

      manager.pushState(testData1); // Should trigger pruning
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(manager.history.length).toBe(2);
      expect(manager.currentIndex).toBe(1);
    });

    test('_reconstructState should handle empty history', () => {
      manager.history = [];
      manager.currentIndex = 0;
      manager._reconstructState();
      expect(manager.currentIndex).toBe(-1);
      expect(manager.fullState).toBe(null);
    });

    test('_reconstructState should handle missing full state at index 0', () => {
      manager.history = [{ changes: { test: 'change' } }];
      manager.currentIndex = 0;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      manager._reconstructState();
      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] No full state found at history[0]');
      consoleSpy.mockRestore();
    });

    test('_reconstructState should apply deltas correctly', () => {
      manager.history = [
        { fullState: testData1 },
        { changes: { properties: { type: 'update', oldValue: testData1.properties, newValue: testData2.properties } } }
      ];
      manager.currentIndex = 1;
      manager._reconstructState();
      expect(manager.fullState).toEqual(testData2);
    });

    test('_updateUndoRedoButtons should handle DOM errors gracefully', () => {
      // Mock document.getElementById to throw an error
      const originalGetElementById = document.getElementById;
      document.getElementById = jest.fn().mockImplementation(() => { throw new Error('DOM error'); });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      manager._updateUndoRedoButtons();

      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] Could not update button states:', 'DOM error');

      document.getElementById = originalGetElementById;
      consoleSpy.mockRestore();
    });

    test('_updateUndoRedoButtons should handle missing buttons gracefully', () => {
      const originalGetElementById = document.getElementById;
      document.getElementById = jest.fn().mockReturnValue(null);

      manager._updateUndoRedoButtons();

      // Should not throw any errors
      expect(document.getElementById).toHaveBeenCalledWith('undoBtn');
      expect(document.getElementById).toHaveBeenCalledWith('redoBtn');

      document.getElementById = originalGetElementById;
    });




    test('_updateUndoRedoButtons should update button states when elements exist (lines 492-495, 498-501)', () => {
      const mockUndoBtn = { disabled: false, style: { opacity: '1' }, title: '' };
      const mockRedoBtn = { disabled: false, style: { opacity: '1' }, title: '' };

      const originalGetElementById = document.getElementById;
      document.getElementById = jest.fn()
        .mockReturnValueOnce(mockUndoBtn)
        .mockReturnValueOnce(mockRedoBtn);

      // Set up state where undo is available but redo is not
      manager.history = [{ fullState: testData1 }];
      manager.currentIndex = 0;

      manager._updateUndoRedoButtons();

      expect(mockUndoBtn.disabled).toBe(true); // Cannot undo at index 0
      expect(mockUndoBtn.style.opacity).toBe('0.5');
      expect(mockUndoBtn.title).toBe('Nothing to undo');

      expect(mockRedoBtn.disabled).toBe(true); // Cannot redo
      expect(mockRedoBtn.style.opacity).toBe('0.5');
      expect(mockRedoBtn.title).toBe('Nothing to redo');

      document.getElementById = originalGetElementById;
    });


  });

  describe('Legacy Snapshot Compatibility', () => {
    test('createSnapshot should work', async () => {
      const result = await manager.createSnapshot('Test Snapshot');
      expect(result.success).toBe(true);
    });

    test('createSnapshot should handle storage failure', async () => {
      mockStorage.saveHistorySnapshot.mockResolvedValueOnce(false);
      const result = await manager.createSnapshot('Test Snapshot');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to save snapshot');
    });

    test('createSnapshot should handle errors gracefully', async () => {
      mockStorage.saveHistorySnapshot.mockRejectedValueOnce(new Error('Storage error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = await manager.createSnapshot('Test Snapshot');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Snapshot creation failed');
      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] Failed to create snapshot:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    test('createSnapshot should work silently', async () => {
      const showToastSpy = jest.fn();
      global.window.uiManager.showToast = showToastSpy;
      const result = await manager.createSnapshot('Test Snapshot', 'Description', true);
      expect(result.success).toBe(true);
      expect(showToastSpy).not.toHaveBeenCalled();
    });

    test('createSnapshot should show toast on success (lines 311-312)', async () => {
      const showToastSpy = jest.fn();
      global.window.uiManager.showToast = showToastSpy;
      const result = await manager.createSnapshot('Test Snapshot', 'Description', false);
      expect(result.success).toBe(true);
      expect(showToastSpy).toHaveBeenCalledWith(`Snapshot "${result.snapshot.name}" created successfully`, 'success', 3000);
    });

    test('createSnapshot should show toast on failure (lines 316-317)', async () => {
      mockStorage.saveHistorySnapshot.mockResolvedValueOnce(false);
      const showToastSpy = jest.fn();
      global.window.uiManager.showToast = showToastSpy;
      const result = await manager.createSnapshot('Test Snapshot');
      expect(result.success).toBe(false);
      expect(showToastSpy).toHaveBeenCalledWith('Failed to save snapshot', 'error', 3000);
    });

    test('createSnapshot should show toast on error (lines 323-324)', async () => {
      mockStorage.saveHistorySnapshot.mockRejectedValueOnce(new Error('Storage error'));
      const showToastSpy = jest.fn();
      global.window.uiManager.showToast = showToastSpy;
      const result = await manager.createSnapshot('Test Snapshot');
      expect(result.success).toBe(false);
      expect(showToastSpy).toHaveBeenCalledWith('Failed to create snapshot', 'error', 3000);
    });

    test('getSnapshots should return snapshots', () => {
      const snapshots = manager.getSnapshots();
      expect(Array.isArray(snapshots)).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    test('openHistoryManager should log message', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      manager.openHistoryManager();
      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] Open history manager called');
      consoleSpy.mockRestore();
    });

    test('cleanup should clear timers and state', () => {
      manager.debouncedPushTimer = setTimeout(() => {}, 1000);
      manager.pendingState = testData1;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      manager.cleanup();

      expect(manager.debouncedPushTimer).toBe(null);
      expect(manager.pendingState).toBe(null);
      expect(consoleSpy).toHaveBeenCalledWith('[HISTORY] HistoryManager cleaned up');
      consoleSpy.mockRestore();
    });

    test('_shallowClone should clone objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      const clone = manager._shallowClone(obj);
      expect(clone).toEqual(obj);
      expect(clone).not.toBe(obj);
      expect(clone.b).toBe(obj.b); // shallow
    });

    test('_hasStateChanged should return true for null fullState', () => {
      manager.fullState = null;
      expect(manager._hasStateChanged(testData1)).toBe(true);
    });

    test('_hasStateChanged should return true for different state', () => {
      manager.fullState = testData1;
      expect(manager._hasStateChanged(testData2)).toBe(true);
    });

    test('_hasStateChanged should return false for same state', () => {
      manager.fullState = testData1;
      expect(manager._hasStateChanged(testData1)).toBe(false);
    });

    test('_pruneHistoryIfNeeded should prune when exceeding max size', () => {
      manager.maxHistorySize = 2;
      manager.history = [{}, {}, {}];
      manager.currentIndex = 2;
      manager._pruneHistoryIfNeeded();
      expect(manager.history.length).toBe(2);
      expect(manager.currentIndex).toBe(1);
    });

    test('_saveToStorage should handle errors gracefully', () => {
      const originalSetItem = window.localStorage.setItem;
      window.localStorage.setItem = jest.fn(() => { throw new Error('Storage error'); });

      expect(() => manager._saveToStorage()).not.toThrow();

      window.localStorage.setItem = originalSetItem;
    });

    test('_loadHistoryFromStorage should handle errors gracefully', () => {
      const originalGetItem = window.localStorage.getItem;
      window.localStorage.getItem = jest.fn(() => { throw new Error('Load error'); });

      expect(() => manager._loadHistoryFromStorage()).not.toThrow();
      expect(manager.history).toEqual([]);
      expect(manager.currentIndex).toBe(-1);

      window.localStorage.getItem = originalGetItem;
    });

    test('_loadHistoryFromStorage should load saved history', () => {
       // Create a fresh manager instance for this test
       const freshManager = new HistoryManager(mockStorage, mockDataManager);

       // Set up the data that should be "loaded" from storage
       const savedData = {
         history: [{
           changes: null,
           fullState: testData1
         }],
         currentIndex: -1,
         lastSaved: '2025-09-30T09:54:10.044Z'
       };

       // Mock localStorage.getItem to return the saved data
       const originalGetItem = window.localStorage.getItem;
       window.localStorage.getItem = jest.fn((key) => {
         if (key === 'sankey-property-dashboard-history') {
           return JSON.stringify(savedData);
         }
         return null;
       });

       // Call the method
       freshManager._loadHistoryFromStorage();

       // Verify the method correctly initialized currentIndex to 0
       expect(freshManager.currentIndex).toBe(0);
       expect(freshManager.fullState).toEqual(testData1);
       expect(freshManager.history.length).toBe(1);

       // Restore original localStorage
       window.localStorage.getItem = originalGetItem;
     });

    test('_shallowClone should handle non-objects', () => {
      expect(manager._shallowClone(null)).toBe(null);
      expect(manager._shallowClone('string')).toBe('string');
      expect(manager._shallowClone(42)).toBe(42);
      expect(manager._shallowClone(undefined)).toBe(undefined);
    });

    test('_shallowClone should handle arrays', () => {
      const arr = [1, 2, { a: 3 }];
      const clone = manager._shallowClone(arr);
      expect(clone).toEqual(arr);
      expect(clone).not.toBe(arr);
      expect(clone[2]).toBe(arr[2]); // shallow
    });

    test('_computeDiff should handle identical objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      const delta = manager._computeDiff(obj, obj);
      expect(delta).toBe(null);
    });

    test('_computeDiff should detect nested changes', () => {
      const oldObj = { a: 1, b: { c: 2 } };
      const newObj = { a: 1, b: { c: 3 } };
      const delta = manager._computeDiff(oldObj, newObj);
      expect(delta).toBeDefined();
      expect(delta.b).toBeDefined();
    });

    test('_applyDiff should handle add operations', () => {
      const delta = { newKey: { type: 'add', newValue: 'value' } };
      const result = manager._applyDiff({}, delta);
      expect(result.newKey).toBe('value');
    });

    test('pushState should handle rapid calls with pending state replacement', async () => {
      // Start first push
      manager.pushState(testData1);
      expect(manager.pendingState).toEqual(testData1);

      // Rapid second push should replace pending state without setting new timer
      manager.pushState(testData2);
      expect(manager.pendingState).toEqual(testData2);

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(manager.fullState).toEqual(testData2);
      expect(manager.history.length).toBe(1);
    });

    test('pushState should clear existing timer when called', () => {
      const oldTimer = setTimeout(() => {}, 100);
      manager.debouncedPushTimer = oldTimer;
      manager.pendingState = null;
      manager.pushState(testData1);
      expect(manager.pendingState).toEqual(testData1);
      expect(manager.debouncedPushTimer).not.toBe(oldTimer);
    });
  });
});
