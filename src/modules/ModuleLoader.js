/**
 * ModuleLoader Module
 * Handles module loading, dependencies, and initialization
 * - Manages module registration and loading order
 * - Handles circular dependency detection
 * - Provides module resolution and caching
 * - Manages module lifecycle (init/cleanup)
 */

import logger from './utils/Logger.js';

class ModuleLoader {
    constructor() {
        this.modules = new Map();
        this.loadedModules = new Set();
        this.loadingOrder = [];
        this.dependencies = new Map();
        this.initializationQueue = [];

        // Performance tracking
        this.performanceMetrics = new Map();

        logger.info('MODULELOADER', 'Module loader initialized');
    }

    /**
     * Register a module with its dependencies
     */
    registerModule(name, moduleClass, dependencies = []) {
        logger.info('MODULELOADER', `Registering module: ${name}`);

        if (this.modules.has(name)) {
            console.warn(`[MODULELOADER] Module ${name} already registered, overwriting`);
        }

        this.modules.set(name, {
            name,
            moduleClass,
            dependencies,
            instance: null,
            initialized: false,
        });

        this.dependencies.set(name, dependencies);

        // Check for circular dependencies
        if (this.hasCircularDependency(name)) {
            console.error(`[MODULELOADER] Circular dependency detected for module: ${name}`);
            throw new Error(`Circular dependency detected for module: ${name}`);
        }

        logger.info('MODULELOADER', `Module ${name} registered successfully`);
    }

    /**
     * Check for circular dependencies
     */
    hasCircularDependency(moduleName, visited = new Set()) {
        if (visited.has(moduleName)) {
            return true;
        }

        visited.add(moduleName);

        const dependencies = this.dependencies.get(moduleName) || [];
        for (const dep of dependencies) {
            if (this.hasCircularDependency(dep, new Set(visited))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Load a module and its dependencies
     */
    async loadModule(name) {
        logger.info('MODULELOADER', `Loading module: ${name}`);
        const loadStart = performance.now();

        if (this.loadedModules.has(name)) {
            logger.info('MODULELOADER', `Module ${name} already loaded`);
            return this.modules.get(name).instance;
        }

        const moduleInfo = this.modules.get(name);
        if (!moduleInfo) {
            throw new Error(`Module ${name} not registered`);
        }

        // Load dependencies first
        const dependencies = moduleInfo.dependencies;
        for (const dep of dependencies) {
            if (!this.loadedModules.has(dep)) {
                await this.loadModule(dep);
            }
        }

        // Create module instance with dependencies
        try {
            let instance;

            if (dependencies.length > 0) {
                // Resolve dependency instances
                const dependencyInstances = dependencies.map(depName => {
                    const depModule = this.modules.get(depName);
                    if (!depModule || !depModule.instance) {
                        throw new Error(`Dependency ${depName} not loaded for module ${name}`);
                    }
                    return depModule.instance;
                });

                // Create instance with dependencies as constructor arguments
                instance = new moduleInfo.moduleClass(...dependencyInstances);
            } else {
                // Create instance without dependencies
                instance = new moduleInfo.moduleClass();
            }

            moduleInfo.instance = instance;
            this.loadedModules.add(name);
            this.loadingOrder.push(name);

            // Track load time
            const loadTime = performance.now() - loadStart;
            this.performanceMetrics.set(`${name}_load`, loadTime);
            logger.info('MODULELOADER', `Module ${name} loaded successfully in ${loadTime.toFixed(2)}ms`);
            return instance;

        } catch (error) {
            console.error(`[MODULELOADER] Failed to load module ${name}:`, error);
            throw error;
        }
    }

    /**
     * Initialize a module
     */
    async initializeModule(name) {
        logger.info('MODULELOADER', `Initializing module: ${name}`);
        const initStart = performance.now();

        const moduleInfo = this.modules.get(name);
        if (!moduleInfo) {
            throw new Error(`Module ${name} not registered`);
        }

        if (!moduleInfo.instance) {
            throw new Error(`Module ${name} not loaded`);
        }

        if (moduleInfo.initialized) {
            logger.info('MODULELOADER', `Module ${name} already initialized`);
            return;
        }

        try {
            // Initialize dependencies first
            const dependencies = moduleInfo.dependencies;
            for (const dep of dependencies) {
                if (!this.modules.get(dep).initialized) {
                    await this.initializeModule(dep);
                }
            }

            // Initialize the module
            if (typeof moduleInfo.instance.initialize === 'function') {
                await moduleInfo.instance.initialize();
            }

            moduleInfo.initialized = true;

            // Track initialization time
            const initTime = performance.now() - initStart;
            this.performanceMetrics.set(`${name}_init`, initTime);
            logger.info('MODULELOADER', `Module ${name} initialized successfully in ${initTime.toFixed(2)}ms`);

        } catch (error) {
            console.error(`[MODULELOADER] Failed to initialize module ${name}:`, error);
            throw error;
        }
    }

    /**
     * Load and initialize all registered modules
     */
    async loadAllModules() {
        logger.info('MODULELOADER', 'Loading all modules...');
        const totalStart = performance.now();

        const moduleNames = Array.from(this.modules.keys());

        // Load modules in dependency order
        for (const name of moduleNames) {
            await this.loadModule(name);
        }

        logger.info('MODULELOADER', 'All modules loaded, starting initialization...');

        // Initialize modules in dependency order
        for (const name of this.loadingOrder) {
            await this.initializeModule(name);
        }

        const totalTime = performance.now() - totalStart;
        logger.info('MODULELOADER', `All modules initialized successfully in ${totalTime.toFixed(2)}ms`);

        // Log performance summary
        this.logPerformanceSummary();
    }

    /**
     * Get a loaded module instance
     */
    getModule(name) {
        const moduleInfo = this.modules.get(name);
        if (!moduleInfo) {
            throw new Error(`Module ${name} not registered`);
        }

        if (!moduleInfo.instance) {
            throw new Error(`Module ${name} not loaded`);
        }

        return moduleInfo.instance;
    }

    /**
     * Check if a module is loaded
     */
    isModuleLoaded(name) {
        return this.loadedModules.has(name);
    }

    /**
     * Check if a module is initialized
     */
    isModuleInitialized(name) {
        const moduleInfo = this.modules.get(name);
        return moduleInfo ? moduleInfo.initialized : false;
    }

    /**
     * Get module loading order
     */
    getLoadingOrder() {
        return [...this.loadingOrder];
    }

    /**
     * Get module dependencies
     */
    getDependencies(name) {
        return this.dependencies.get(name) || [];
    }

    /**
     * Get all registered modules
     */
    getRegisteredModules() {
        return Array.from(this.modules.keys());
    }

    /**
     * Get all loaded modules
     */
    getLoadedModules() {
        return Array.from(this.loadedModules);
    }

    /**
     * Get all initialized modules
     */
    getInitializedModules() {
        return Array.from(this.modules.entries())
            .filter(([, info]) => info.initialized)
            .map(([name]) => name);
    }

    /**
     * Cleanup all modules
     */
    async cleanup() {
        logger.info('MODULELOADER', 'Cleaning up all modules...');

        // Cleanup in reverse loading order
        const reverseOrder = [...this.loadingOrder].reverse();

        for (const name of reverseOrder) {
            const moduleInfo = this.modules.get(name);
            if (moduleInfo && moduleInfo.instance && typeof moduleInfo.instance.cleanup === 'function') {
                try {
                    await moduleInfo.instance.cleanup();
                    logger.info('MODULELOADER', `Module ${name} cleaned up`);
                } catch (error) {
                    logger.error('MODULELOADER', `Failed to cleanup module ${name}:`, error);
                }
            }
        }

        // Clear all references
        this.modules.clear();
        this.loadedModules.clear();
        this.loadingOrder = [];
        this.dependencies.clear();
        this.initializationQueue = [];

        logger.info('MODULELOADER', 'All modules cleaned up');
    }

    /**
     * Reload a specific module
     */
    async reloadModule(name) {
        logger.info('MODULELOADER', `Reloading module: ${name}`);

        const moduleInfo = this.modules.get(name);
        if (!moduleInfo) {
            throw new Error(`Module ${name} not registered`);
        }

        // Cleanup if initialized
        if (moduleInfo.initialized && moduleInfo.instance && typeof moduleInfo.instance.cleanup === 'function') {
            await moduleInfo.instance.cleanup();
        }

        // Reset module state
        moduleInfo.instance = null;
        moduleInfo.initialized = false;
        this.loadedModules.delete(name);

        // Remove from loading order
        const index = this.loadingOrder.indexOf(name);
        if (index > -1) {
            this.loadingOrder.splice(index, 1);
        }

        // Reload and reinitialize
        await this.loadModule(name);
        await this.initializeModule(name);

        logger.info('MODULELOADER', `Module ${name} reloaded successfully`);
    }

    /**
     * Get module status information
     */
    getModuleStatus() {
        const status = {};

        for (const [name, info] of this.modules.entries()) {
            status[name] = {
                registered: true,
                loaded: this.loadedModules.has(name),
                initialized: info.initialized,
                dependencies: info.dependencies,
                hasInstance: !!info.instance,
            };
        }

        return status;
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return Object.fromEntries(this.performanceMetrics);
    }

    /**
     * Log performance summary
     */
    logPerformanceSummary() {
        logger.info('MODULELOADER', '=== MODULE PERFORMANCE SUMMARY ===');

        const metrics = this.getPerformanceMetrics();
        let totalLoadTime = 0;
        let totalInitTime = 0;

        for (const [key, time] of Object.entries(metrics)) {
            if (key.endsWith('_load')) {
                const moduleName = key.replace('_load', '');
                logger.info('MODULELOADER', `${moduleName} load: ${time.toFixed(2)}ms`);
                totalLoadTime += time;
            } else if (key.endsWith('_init')) {
                const moduleName = key.replace('_init', '');
                logger.info('MODULELOADER', `${moduleName} init: ${time.toFixed(2)}ms`);
                totalInitTime += time;
            }
        }

        logger.info('MODULELOADER', `Total load time: ${totalLoadTime.toFixed(2)}ms`);
        logger.info('MODULELOADER', `Total init time: ${totalInitTime.toFixed(2)}ms`);
        logger.info('MODULELOADER', `Grand total: ${(totalLoadTime + totalInitTime).toFixed(2)}ms`);
        logger.info('MODULELOADER', '=== END PERFORMANCE SUMMARY ===');
    }

    /**
     * Debug module loader state
     */
    debug() {
        logger.debug('MODULELOADER', '=== MODULE LOADER STATUS ===');
        logger.debug('MODULELOADER', 'Registered modules:', this.getRegisteredModules());
        logger.debug('MODULELOADER', 'Loaded modules:', this.getLoadedModules());
        logger.debug('MODULELOADER', 'Initialized modules:', this.getInitializedModules());
        logger.debug('MODULELOADER', 'Loading order:', this.getLoadingOrder());

        logger.debug('MODULELOADER', '=== MODULE DETAILS ===');
        const status = this.getModuleStatus();
        for (const [name, info] of Object.entries(status)) {
            logger.debug('MODULELOADER', `${name}:`, info);
        }

        logger.debug('MODULELOADER', '=== DEPENDENCY GRAPH ===');
        for (const [name, deps] of this.dependencies.entries()) {
            logger.debug('MODULELOADER', `${name} -> [${deps.join(', ')}]`);
        }

        logger.debug('MODULELOADER', '=== END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModuleLoader;
} else {
    window.ModuleLoader = ModuleLoader;
}
