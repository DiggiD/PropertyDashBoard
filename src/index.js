import DataManager from './modules/core/DataManager.js';
import ChartRenderer from './modules/core/ChartRenderer.js';
import Storage from './modules/utils/Storage.js';
import Validator from './modules/utils/Validator.js';
import Formatter from './modules/utils/Formatter.js';
import UIManager from './modules/core/UIManager.js';
import ThemeManager from './modules/core/ThemeManager.js';

async function initializeApplication() {
    console.log('[INDEX] Starting application initialization...');
    try {
        console.log('[INDEX] Initializing utility modules...');
        // Initialize dependencies
        const storage = new Storage();
        console.log('[INDEX] Storage initialized');
        const validator = new Validator();
        console.log('[INDEX] Validator initialized');
        const formatter = new Formatter();
        console.log('[INDEX] Formatter initialized');

        console.log('[INDEX] Initializing ThemeManager...');
        // Initialize ThemeManager first
        const themeManager = new ThemeManager();
        await themeManager.initialize();
        console.log('[INDEX] ThemeManager initialized');

        console.log('[INDEX] Initializing UIManager...');
        // Initialize UIManager (depends on themeManager)
        const uiManager = new UIManager(formatter, themeManager);
        await uiManager.initialize(); // Now DOM/elements ready
        console.log('[INDEX] UIManager initialized');

        console.log('[INDEX] Initializing DataManager...');
        // Initialize DataManager
        const dataManager = new DataManager(storage, validator, formatter);
        await dataManager.initialize();
        console.log('[INDEX] DataManager initialized');

        // Add sample property if no properties exist after initialization
        if (dataManager.getProperties().length === 0) {
            console.log('[INDEX] No properties found, adding sample property...');
            const result = await dataManager.addProperty('Sample Property');
            if (result.success) {
                console.log('[INDEX] Sample property added successfully');
            } else {
                console.error('[INDEX] Failed to add sample property:', result.message);
            }
        } else {
            console.log('[INDEX] Properties already exist, skipping sample property');
        }

        console.log('[INDEX] Initializing ChartRenderer...');
        // Initialize ChartRenderer
        const chartRenderer = new ChartRenderer(dataManager, uiManager, formatter, themeManager);
        await chartRenderer.initialize();
        console.log('[INDEX] ChartRenderer initialized');

        console.log('[INDEX] Rendering initial chart...');
        // Render initial chart
        await chartRenderer.renderOverviewSankey();
        console.log('[INDEX] Initial chart rendered');

        // Expose globally for debugging (optional)
        window.DataManager = DataManager;
        window.dataManager = dataManager;
        window.chartRenderer = chartRenderer;
        window.uiManager = uiManager;
        window.themeManager = themeManager;
        console.log('[INDEX] Global objects exposed for debugging');

        console.log('[INDEX] Application initialization complete');
    } catch (e) {
        console.error('[INDEX] Initialization failed:', e);
        console.error('[INDEX] Error stack:', e.stack);
    }
}

document.addEventListener('DOMContentLoaded', initializeApplication);

// Add window load event listener for early theme application
window.addEventListener('load', () => window.themeManager?.applyTheme());

// Add global unhandledrejection
window.addEventListener('unhandledrejection', e => console.error('Promise rejected:', e.reason));

// Export for use in other modules
export default { initializeApplication };
