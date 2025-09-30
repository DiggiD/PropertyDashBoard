/**
 * Jest unit tests for EventHandler.js
 * Tests event binding, emission, and cleanup functionality
 */

import EventHandler from 'src/modules/core/EventHandler.js';

// Mock dependencies
const mockDataManager = {
    setCurrentView: jest.fn(),
    setCurrentTimePeriod: jest.fn(),
    importData: jest.fn(),
    save: jest.fn(),
};

let mockUIManager;

const mockHistoryManager = {
    undo: jest.fn(),
    redo: jest.fn(),
    openHistoryManager: jest.fn(),
    saveState: jest.fn(),
    updateUndoRedoButtons: jest.fn(),
    initialize: jest.fn(),
};

const mockThemeManager = {
    toggleTheme: jest.fn(),
};

describe('EventHandler', () => {
    let eventHandler;

    beforeEach(() => {
        jest.clearAllMocks();
    
        mockUIManager = {
            setCurrentView: jest.fn(),
            showLoadingState: jest.fn(),
            hideLoadingState: jest.fn(),
            showToast: jest.fn(),
            showError: jest.fn(),
            closeModal: jest.fn(),
            getElement: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            updateThemeToggle: jest.fn(),
            getModalFormData: jest.fn(),
            currentView: 'overview',
        };
    
        // Mock DOM elements
        mockUIManager.getElement.mockImplementation((key) => {
            if (key === 'overviewBtn') {
                return { addEventListener: jest.fn() };
            }
            if (key === 'propertiesBtn') {
                return { addEventListener: jest.fn() };
            }
            if (key === 'confirmImport') {
                return { addEventListener: jest.fn() };
            }
            if (key === 'cancelImport') {
                return { addEventListener: jest.fn() };
            }
            if (key === 'closeImportModal') {
                return { addEventListener: jest.fn() };
            }
            if (key === 'historyBtn') {
                return { addEventListener: jest.fn() };
            }
            if (key === 'darkModeToggle') {
                return { addEventListener: jest.fn() };
            }
            return null;
        });
    
        eventHandler = new EventHandler(
            mockDataManager,
            mockUIManager,
            mockHistoryManager,
            mockThemeManager
        );
    });

    describe('initialization', () => {
        test('should initialize event handlers', async () => {
            await eventHandler.initialize();

            expect(mockUIManager.getElement).toHaveBeenCalledWith('overviewBtn');
            expect(mockUIManager.getElement).toHaveBeenCalledWith('propertiesBtn');
            expect(mockUIManager.getElement).toHaveBeenCalledWith('confirmImport');
        });
    });

    describe('view change handling', () => {
        test('should handle overview view change', async () => {
            // Mock window.chartRenderer
            const mockRender = jest.fn();
            window.chartRenderer = { renderOverviewSankey: mockRender };

            await eventHandler.handleViewChange('overview');

            expect(mockUIManager.setCurrentView).toHaveBeenCalledWith('overview');
            expect(mockDataManager.setCurrentView).toHaveBeenCalledWith('overview');
            expect(mockRender).toHaveBeenCalled();

            // Cleanup
            delete window.chartRenderer;
        });

        test('should handle properties view change', async () => {
            await eventHandler.handleViewChange('properties');

            expect(mockUIManager.setCurrentView).toHaveBeenCalledWith('properties');
            expect(mockDataManager.setCurrentView).toHaveBeenCalledWith('properties');
        });

        test('should handle overview view change without chart renderer', async () => {
            await eventHandler.handleViewChange('overview');

            expect(mockUIManager.showLoadingState).toHaveBeenCalledWith('Loading overview...');
            expect(mockUIManager.hideLoadingState).toHaveBeenCalled();
        });

        test('should handle properties view change without chart renderer', async () => {
            await eventHandler.handleViewChange('properties');

            expect(mockUIManager.showLoadingState).toHaveBeenCalledWith('Loading properties...');
            expect(mockUIManager.hideLoadingState).toHaveBeenCalled();
        });

        test('should handle view change errors', async () => {
            mockUIManager.setCurrentView.mockImplementation(() => {
                throw new Error('View change error');
            });

            await eventHandler.handleViewChange('overview');

            expect(mockUIManager.showError).toHaveBeenCalledWith(
                'Failed to change view',
                'View Change Error'
            );
        });
    });

    describe('import handling', () => {
        test('should handle successful data import', async () => {
            const mockFormData = { importData: '{"properties": []}' };
            mockUIManager.getModalFormData.mockReturnValue(mockFormData);
            mockDataManager.importData.mockResolvedValue(true);
            mockHistoryManager.saveState.mockResolvedValue(true);
            mockHistoryManager.initialize.mockResolvedValue(true);

            await eventHandler.handleImportData();

            expect(mockHistoryManager.saveState).toHaveBeenCalledWith('Before import');
            expect(mockDataManager.importData).toHaveBeenCalledWith({ properties: [] });
            expect(mockUIManager.closeModal).toHaveBeenCalledWith('importModal');
            expect(mockUIManager.showToast).toHaveBeenCalledWith('Data imported successfully', 'success');
            expect(mockHistoryManager.initialize).toHaveBeenCalled();
            expect(mockHistoryManager.updateUndoRedoButtons).toHaveBeenCalled();
        });

        test('should handle import with empty data', async () => {
            const mockFormData = { importData: '' };
            mockUIManager.getModalFormData.mockReturnValue(mockFormData);

            await eventHandler.handleImportData();

            expect(mockUIManager.showToast).toHaveBeenCalledWith('Please paste data to import', 'warning');
            expect(mockDataManager.importData).not.toHaveBeenCalled();
        });

        test('should handle import errors', async () => {
            const mockFormData = { importData: 'invalid json' };
            mockUIManager.getModalFormData.mockReturnValue(mockFormData);

            await eventHandler.handleImportData();

            expect(mockUIManager.showError).toHaveBeenCalledWith(
                'Failed to import data. Please check the format.',
                'Import Error'
            );
        });
    });

    describe('history operations', () => {
        test('should handle undo with success', async () => {
            mockHistoryManager.undo.mockResolvedValue({ success: true, message: 'Undid action' });

            await eventHandler.handleUndo();

            expect(mockHistoryManager.undo).toHaveBeenCalled();
            expect(mockUIManager.showToast).toHaveBeenCalledWith('Undid action', 'info');
        });

        test('should handle undo with failure', async () => {
            mockHistoryManager.undo.mockResolvedValue({ success: false, message: 'Nothing to undo' });

            await eventHandler.handleUndo();

            expect(mockUIManager.showToast).toHaveBeenCalledWith('Nothing to undo', 'info');
        });

        test('should handle redo with success', async () => {
            mockHistoryManager.redo.mockResolvedValue({ success: true, message: 'Redid action' });

            await eventHandler.handleRedo();

            expect(mockHistoryManager.redo).toHaveBeenCalled();
            expect(mockUIManager.showToast).toHaveBeenCalledWith('Redid action', 'info');
        });

        test('should handle redo errors', async () => {
            mockHistoryManager.redo.mockRejectedValue(new Error('Redo failed'));

            await eventHandler.handleRedo();

            expect(mockUIManager.showError).toHaveBeenCalledWith('Failed to redo action', 'Redo Error');
        });
    });

    describe('theme operations', () => {
        test('should handle theme toggle', () => {
            mockThemeManager.toggleTheme.mockReturnValue(true);

            eventHandler.handleThemeToggle();

            expect(mockThemeManager.toggleTheme).toHaveBeenCalled();
            expect(mockUIManager.updateThemeToggle).toHaveBeenCalled();
            expect(mockUIManager.showToast).toHaveBeenCalledWith('Switched to dark mode', 'info', 1500);
        });

        test('should handle theme toggle errors', () => {
            mockThemeManager.toggleTheme.mockImplementation(() => {
                throw new Error('Theme toggle error');
            });

            eventHandler.handleThemeToggle();

            expect(mockUIManager.showError).toHaveBeenCalledWith('Failed to toggle theme', 'Theme Error');
        });
    });

    describe('save operations', () => {
        test('should handle successful save', async () => {
            mockDataManager.save.mockResolvedValue(true);

            await eventHandler.handleSaveData();

            expect(mockDataManager.save).toHaveBeenCalled();
            expect(mockUIManager.showToast).toHaveBeenCalledWith('Data saved successfully', 'success');
        });

        test('should handle save failure', async () => {
            mockDataManager.save.mockResolvedValue(false);

            await eventHandler.handleSaveData();

            expect(mockUIManager.showToast).toHaveBeenCalledWith('Failed to save data', 'error');
        });

        test('should handle save errors', async () => {
            mockDataManager.save.mockRejectedValue(new Error('Save failed'));

            await eventHandler.handleSaveData();

            expect(mockUIManager.showError).toHaveBeenCalledWith('Failed to save data', 'Save Error');
        });
    });

    describe('event binding', () => {
        test('should bind click event to element', () => {
            const mockElement = {};
            mockUIManager.getElement.mockReturnValue(mockElement);

            eventHandler.bindClickEvent('testBtn', jest.fn());

            expect(mockUIManager.getElement).toHaveBeenCalledWith('testBtn');
            expect(mockUIManager.addEventListener).toHaveBeenCalledWith(mockElement, 'click', expect.any(Function));
        });

        test('should bind keyboard shortcut', () => {
            const mockHandler = jest.fn();

            eventHandler.bindKeyboardShortcut(['ctrl+z'], mockHandler);

            expect(mockUIManager.addEventListener).toHaveBeenCalledWith(document, 'keydown', expect.any(Function));
        });

        test('should bind enter key event to input element', () => {
            const mockElement = {};
            const mockHandler = jest.fn();
            mockUIManager.getElement.mockReturnValue(mockElement);

            eventHandler.bindEnterKeyEvent('testInput', mockHandler);

            expect(mockUIManager.addEventListener).toHaveBeenCalledWith(mockElement, 'keypress', expect.any(Function));
        });

        test('should store event bindings', () => {
            const mockElement = { addEventListener: jest.fn() };
            mockUIManager.getElement.mockReturnValue(mockElement);

            eventHandler.bindClickEvent('testBtn', jest.fn());

            const stats = eventHandler.getEventStatistics();
            expect(stats.totalBindings).toBeGreaterThan(0);
        });

        test('should get event statistics', () => {
            const stats = eventHandler.getEventStatistics();
            expect(stats).toHaveProperty('totalElements');
            expect(stats).toHaveProperty('totalBindings');
            expect(stats).toHaveProperty('elements');
            expect(typeof stats.totalElements).toBe('number');
            expect(typeof stats.totalBindings).toBe('number');
            expect(Array.isArray(stats.elements)).toBe(true);
        });
    });

    describe('emit/subscribe functionality', () => {
        test('should bind and trigger click event subscription', () => {
            const mockElement = {};
            const mockHandler = jest.fn();
            mockUIManager.getElement.mockReturnValue(mockElement);

            eventHandler.bindClickEvent('testBtn', mockHandler);

            // Simulate event trigger
            const call = mockUIManager.addEventListener.mock.calls.find(([el, event]) => el === mockElement && event === 'click');
            const boundHandler = call[2];
            const mockEvent = { preventDefault: jest.fn() };
            boundHandler(mockEvent);

            expect(mockHandler).toHaveBeenCalledWith(mockEvent);
            expect(mockEvent.preventDefault).toHaveBeenCalled();
        });

        test('should handle multiple subscribers to same event', () => {
            const mockElement = {};
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            mockUIManager.getElement.mockReturnValue(mockElement);

            eventHandler.bindClickEvent('testBtn', handler1);
            eventHandler.bindClickEvent('testBtn', handler2);

            // Both handlers should be bound
            expect(mockUIManager.addEventListener).toHaveBeenCalledTimes(2);
        });

        test('should subscribe to change events', () => {
            const mockElement = {};
            const mockHandler = jest.fn();
            mockUIManager.getElement.mockReturnValue(mockElement);

            eventHandler.bindChangeEvent('testSelect', mockHandler);

            expect(mockUIManager.addEventListener).toHaveBeenCalledWith(mockElement, 'change', mockHandler);
        });
    });

    describe('once/off functionality', () => {
        test('should bind one-time keyboard shortcut', () => {
            const mockHandler = jest.fn();

            eventHandler.bindKeyboardShortcut('ctrl+z', mockHandler);

            const call = mockUIManager.addEventListener.mock.calls.find(([el, event]) => el === document && event === 'keydown');
            const boundHandler = call[2];
            const mockEvent = {
                ctrlKey: true,
                key: 'z',
                preventDefault: jest.fn()
            };

            // First trigger should work
            boundHandler(mockEvent);
            expect(mockHandler).toHaveBeenCalledTimes(1);

            // Second trigger should also work (keyboard shortcuts are not one-time)
            boundHandler(mockEvent);
            expect(mockHandler).toHaveBeenCalledTimes(2);
        });

        test('should remove event binding with off functionality', () => {
            const mockElement = {};
            mockUIManager.getElement.mockReturnValue(mockElement);
            mockUIManager.removeEventListener.mockImplementation(() => {});

            eventHandler.bindClickEvent('testBtn', jest.fn());
            eventHandler.removeEventBinding('testBtn', 'click');

            expect(mockUIManager.removeEventListener).toHaveBeenCalledWith(mockElement, 'click');
        });

        test('should handle removing non-existent event binding', () => {
            expect(() => {
                eventHandler.removeEventBinding('nonExistent', 'click');
            }).not.toThrow();
        });
    });

    describe('invalid events functionality', () => {
        test('should handle binding to non-existent element', () => {
            mockUIManager.getElement.mockReturnValue(null);

            expect(() => {
                eventHandler.bindClickEvent('nonExistentBtn', jest.fn());
            }).not.toThrow();

            // Should not create binding
            const stats = eventHandler.getEventStatistics();
            expect(stats.totalBindings).toBe(0);
        });

        test('should handle invalid keyboard shortcut format', () => {
            const mockDocument = { addEventListener: jest.fn() };
            global.document = mockDocument;

            expect(() => {
                eventHandler.bindKeyboardShortcut('', jest.fn());
            }).not.toThrow();

            expect(() => {
                eventHandler.bindKeyboardShortcut([], jest.fn());
            }).not.toThrow();

            delete global.document;
        });

        test('should handle null or undefined handlers', () => {
            const mockElement = { addEventListener: jest.fn() };
            mockUIManager.getElement.mockReturnValue(mockElement);

            expect(() => {
                eventHandler.bindClickEvent('testBtn', null);
            }).not.toThrow();

            expect(() => {
                eventHandler.bindClickEvent('testBtn', undefined);
            }).not.toThrow();
        });
    });

    describe('async emit functionality', () => {
        test('should handle async event handlers', async () => {
            const mockElement = {};
            const asyncHandler = jest.fn().mockResolvedValue('async result');
            mockUIManager.getElement.mockReturnValue(mockElement);

            eventHandler.bindClickEvent('asyncBtn', asyncHandler);

            const call = mockUIManager.addEventListener.mock.calls.find(([el, event]) => el === mockElement && event === 'click');
            const boundHandler = call[2];
            const mockEvent = { preventDefault: jest.fn() };

            await boundHandler(mockEvent);

            expect(asyncHandler).toHaveBeenCalledWith(mockEvent);
            expect(asyncHandler).toHaveBeenCalledTimes(1);
        });

        test('should handle async view change operations', async () => {
            const mockRender = jest.fn(() => Promise.resolve());
            window.chartRenderer = { renderOverviewSankey: mockRender };

            await eventHandler.handleViewChange('overview');

            expect(mockUIManager.showLoadingState).toHaveBeenCalledWith('Loading overview...');
            expect(mockRender).toHaveBeenCalled();
            expect(mockUIManager.hideLoadingState).toHaveBeenCalled();

            delete window.chartRenderer;
        });

        test('should handle async import operations', async () => {
            const mockFormData = { importData: '{"properties": []}' };
            mockUIManager.getModalFormData.mockReturnValue(mockFormData);
            mockDataManager.importData.mockResolvedValue(true);
            mockHistoryManager.saveState.mockResolvedValue(true);

            await eventHandler.handleImportData();

            expect(mockDataManager.importData).toHaveBeenCalled();
            expect(mockHistoryManager.saveState).toHaveBeenCalledWith('Before import');
        });

        test('should handle async errors in event handlers', async () => {
            const mockElement = {};
            const failingHandler = jest.fn().mockRejectedValue(new Error('Handler failed'));
            mockUIManager.getElement.mockReturnValue(mockElement);

            eventHandler.bindClickEvent('failingBtn', failingHandler);

            const call = mockUIManager.addEventListener.mock.calls.find(([el, event]) => el === mockElement && event === 'click');
            const boundHandler = call[2];
            const mockEvent = { preventDefault: jest.fn() };

            // Should not throw when handler fails
            await expect(boundHandler(mockEvent)).resolves.not.toThrow();
            expect(failingHandler).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        test('should cleanup all event bindings', () => {
            const mockElement = {};
            mockUIManager.getElement.mockReturnValue(mockElement);
            mockUIManager.removeEventListener.mockImplementation(() => {});

            eventHandler.bindClickEvent('testBtn', jest.fn());
            eventHandler.cleanup();

            expect(mockUIManager.removeEventListener).toHaveBeenCalledWith(mockElement, 'click');
            const stats = eventHandler.getEventStatistics();
            expect(stats.totalBindings).toBe(0);
        });
    });
});
