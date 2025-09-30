import DataManager from './modules/core/DataManager.js';
import ChartRenderer from './modules/core/ChartRenderer.js';
import Storage from './modules/utils/Storage.js';
import Validator from './modules/utils/Validator.js';
import Formatter from './modules/utils/Formatter.js';
import UIManager from './modules/core/UIManager.js';
import ThemeManager from './modules/core/ThemeManager.js';

async function initializeApplication() {
    try {
        // Initialize dependencies
        const storage = new Storage();
        const validator = new Validator();
        const formatter = new Formatter();

        // Initialize ThemeManager first
        const themeManager = new ThemeManager();
        await themeManager.initialize();

        // Initialize UIManager (depends on themeManager)
        const uiManager = new UIManager(formatter, themeManager);
        await uiManager.initialize(); // Now DOM/elements ready

        // Initialize DataManager
        const dataManager = new DataManager(storage, validator, formatter);
        await dataManager.initialize();

        // Add sample property if no properties exist after initialization
        if (dataManager.getProperties().length === 0) {
            console.log('[INDEX] No properties found, adding sample property...');
            const result = await dataManager.addProperty('Sample Property');
            if (result.success) {
                console.log('[INDEX] Sample property added successfully');
            } else {
                console.error('[INDEX] Failed to add sample property:', result.message);
            }
        }

        // Initialize ChartRenderer
        const chartRenderer = new ChartRenderer(dataManager, uiManager, formatter, themeManager);
        await chartRenderer.initialize();

        // Render initial chart
        await chartRenderer.renderOverviewSankey();

        // Expose globally for debugging (optional)
        window.DataManager = DataManager;
        window.dataManager = dataManager;
        window.chartRenderer = chartRenderer;
        window.uiManager = uiManager;
        window.themeManager = themeManager;
    } catch (e) {
        console.error('Init failed:', e);
    }
}

document.addEventListener('DOMContentLoaded', initializeApplication);

// Add window load event listener for early theme application
window.addEventListener('load', () => window.themeManager?.applyTheme());

// Add global unhandledrejection
window.addEventListener('unhandledrejection', e => console.error('Promise rejected:', e.reason));

// Export for use in other modules
export default { initializeApplication };
