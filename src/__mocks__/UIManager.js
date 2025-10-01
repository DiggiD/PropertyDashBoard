// filepath: src/__mocks__/UIManager.js

export default class MockUIManager {
    constructor(formatter, themeManager) {
        this.formatter = formatter;
        this.themeManager = themeManager;
        console.log('[UI] UIManager initialized');
    }

    async initialize() {
        console.log('[UI] UI manager initialized');
        console.log('[UI] Event listeners setup complete');
    }

    getElement(id) {
        return { id, style: {} };
    }

    showLoadingState(message) {
        // no-op
    }

    hideLoadingState() {
        // no-op
    }

    updateDataDisplay(stats) {
        // no-op
    }
}
