/**
 * Application Entry Point
 * Initializes the modular Property Expense Dashboard
 * - Loads all modules using ModuleLoader
 * - Initializes the main App orchestrator
 * - Handles application startup and error recovery
 */

// Global error handler for unhandled errors
window.addEventListener('error', (event) => {
    console.error('🔧 [GLOBAL ERROR]', event.error);
    showGlobalError('An unexpected error occurred. Please refresh the page.');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('🔧 [UNHANDLED PROMISE REJECTION]', event.reason);
    showGlobalError('An unexpected error occurred. Please refresh the page.');
});

/**
 * Show global error message
 */
function showGlobalError(message) {
    // Remove any existing error overlay
    const existingError = document.getElementById('global-error-overlay');
    if (existingError) {
        existingError.remove();
    }

    // Create error overlay
    const errorOverlay = document.createElement('div');
    errorOverlay.id = 'global-error-overlay';
    errorOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    errorOverlay.innerHTML = `
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
                color: var(--color-error, #ef4444);
            ">⚠️ Error</div>
            <div style="
                margin-bottom: var(--space-20, 20px);
                color: var(--color-text, #333);
                line-height: 1.5;
            ">${message}</div>
            <button onclick="location.reload()" style="
                background: var(--color-primary, #1f77b4);
                color: white;
                border: none;
                padding: var(--space-12, 12px) var(--space-20, 20px);
                border-radius: var(--radius-base, 8px);
                cursor: pointer;
                font-size: var(--font-size-base, 14px);
                font-weight: 500;
            ">Refresh Page</button>
        </div>
    `;

    document.body.appendChild(errorOverlay);
}

/**
 * Check if all required dependencies are loaded
 */
function checkDependencies() {
    const requiredDeps = ['d3', 'Dexie'];
    const missingDeps = [];

    if (typeof d3 === 'undefined') {
        missingDeps.push('D3.js');
    }

    if (typeof Dexie === 'undefined') {
        missingDeps.push('Dexie.js');
    }

    if (missingDeps.length > 0) {
        showGlobalError(`Missing required dependencies: ${missingDeps.join(', ')}. Please check your internet connection and refresh the page.`);
        return false;
    }

    console.log('🔧 [DEPENDENCIES] All required dependencies loaded');
    return true;
}

/**
 * Initialize the modular application
 */
async function initializeApplication() {
    try {
        console.log('🔧 [INIT] Starting modular application initialization...');

        // Check dependencies first
        if (!checkDependencies()) {
            return;
        }

        // Create module loader
        const moduleLoader = new ModuleLoader();

        // Register all modules with their dependencies
        console.log('🔧 [INIT] Registering modules...');

        // Utility modules (no dependencies)
        moduleLoader.registerModule('formatter', Formatter, []);
        moduleLoader.registerModule('storage', Storage, []);
        moduleLoader.registerModule('validator', Validator, []);
        moduleLoader.registerModule('themeManager', ThemeManager, []);

        // Core modules with dependencies
        moduleLoader.registerModule('dataManager', DataManager, ['storage', 'validator']);
        moduleLoader.registerModule('uiManager', UIManager, ['formatter', 'themeManager']);
        moduleLoader.registerModule('historyManager', HistoryManager, ['storage', 'dataManager']);
        moduleLoader.registerModule('eventHandler', EventHandler, ['dataManager', 'uiManager', 'historyManager']);
        moduleLoader.registerModule('chartRenderer', ChartRenderer, ['dataManager', 'uiManager', 'formatter']);

        // Main application orchestrator
        moduleLoader.registerModule('app', App, [
            'dataManager',
            'uiManager',
            'eventHandler',
            'chartRenderer',
            'historyManager',
            'formatter',
            'storage',
            'validator',
            'themeManager',
        ]);

        console.log('🔧 [INIT] All modules registered, loading...');

        // Load and initialize all modules
        await moduleLoader.loadAllModules();

        console.log('🔧 [INIT] All modules loaded, initializing main application...');

        // Get the main application instance
        const app = moduleLoader.getModule('app');

        // Initialize the application
        await app.initialize();

        // Make modules globally available for debugging
        window.moduleLoader = moduleLoader;
        window.app = app;

        // Make key modules globally available for UI interactions
        window.historyManager = moduleLoader.getModule('historyManager');
        window.dataManager = moduleLoader.getModule('dataManager');
        window.uiManager = moduleLoader.getModule('uiManager');

        // Add debug functions to window
        window.debugModules = () => moduleLoader.debug();
        window.debugApp = () => app.debug();

        console.log('🔧 [INIT] Modular application initialization complete!');
        console.log('🔧 [INIT] Available debug commands:');
        console.log('🔧 [INIT] - debugModules() - Debug module loader status');
        console.log('🔧 [INIT] - debugApp() - Debug application state');
        console.log('🔧 [INIT] - window.app - Main application instance');
        console.log('🔧 [INIT] - window.moduleLoader - Module loader instance');

    } catch (error) {
        console.error('🔧 [INIT] Application initialization failed:', error);
        showGlobalError('Failed to initialize application. Please refresh the page.');
    }
}

/**
 * Handle page visibility changes for performance optimization
 */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('🔧 [VISIBILITY] Page hidden, pausing non-essential operations');
        // Could pause auto-save, animations, etc.
    } else {
        console.log('🔧 [VISIBILITY] Page visible, resuming operations');
        // Could resume operations
    }
});

/**
 * Handle beforeunload for cleanup
 */
window.addEventListener('beforeunload', () => {
    console.log('🔧 [UNLOAD] Cleaning up application...');

    if (window.app && typeof window.app.cleanup === 'function') {
        window.app.cleanup();
    }

    if (window.moduleLoader && typeof window.moduleLoader.cleanup === 'function') {
        window.moduleLoader.cleanup();
    }
});

/**
 * Performance monitoring
 */
if ('performance' in window && 'mark' in window.performance) {
    try {
        performance.mark('app-init-start');

        // Mark initialization complete when done
        window.addEventListener('load', () => {
            setTimeout(() => {
                performance.mark('app-init-end');
                performance.measure('app-initialization', 'app-init-start', 'app-init-end');

                const measure = performance.getEntriesByName('app-initialization')[0];
                console.log(`🔧 [PERFORMANCE] Application initialization took ${measure.duration.toFixed(2)}ms`);
            }, 100);
        });
    } catch (error) {
        console.warn('🔧 [PERFORMANCE] Performance monitoring not available:', error);
    }
}

/**
 * Start application when DOM is ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
    // DOM already loaded
    initializeApplication();
}

// Export for potential use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initializeApplication };
}
