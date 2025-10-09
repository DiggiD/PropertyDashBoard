/**
 * Jest unit tests for ModuleLoader.js
 * Tests dynamic module loading, dependency resolution, and initialization
 */

import ModuleLoader from '../modules/ModuleLoader.js';

// Import real modules for isolated testing with spies
import DataManager from '../modules/core/DataManager.js';
import ChartRenderer from '../modules/core/ChartRenderer.js';
import UIManager from '../modules/core/UIManager.js';
import EventHandler from '../modules/core/EventHandler.js';
import HistoryManager from '../modules/core/HistoryManager.js';
import PropertiesManager from '../modules/PropertiesManager.js';

// Mock external dependencies (storage, validator, formatter) minimally
jest.mock('../modules/utils/Storage.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        load: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockResolvedValue(),
        clear: jest.fn().mockResolvedValue(),
    })),
}));

jest.mock('../modules/utils/Validator.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        validatePropertyName: jest.fn().mockReturnValue({ isValid: true }),
        validateCategoryName: jest.fn().mockReturnValue({ isValid: true }),
        validateAmount: jest.fn().mockReturnValue({ isValid: true }),
        validateDashboardData: jest.fn().mockReturnValue({ isValid: true }),
    })),
}));

jest.mock('../modules/utils/Formatter.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        formatCurrency: jest.fn().mockReturnValue('$0.00'),
    })),
}));

// Mock d3 for ChartRenderer
global.d3 = {
    easeCubicInOut: jest.fn(),
    easeBackOut: jest.fn(),
    zoomIdentity: jest.fn(),
    zoom: jest.fn().mockReturnValue({
        transform: jest.fn().mockReturnValue({
            translate: jest.fn().mockReturnValue({
                scale: jest.fn(),
            }),
        }),
    }),
    select: jest.fn().mockReturnValue({
        selectAll: jest.fn().mockReturnValue({
            data: jest.fn().mockReturnValue({
                enter: jest.fn().mockReturnValue({
                    append: jest.fn().mockReturnValue({
                        attr: jest.fn().mockReturnValue({
                            style: jest.fn().mockReturnValue({
                                text: jest.fn().mockReturnValue({
                                    on: jest.fn().mockReturnValue({
                                        transition: jest.fn().mockReturnValue({
                                            duration: jest.fn().mockReturnValue({
                                                ease: jest.fn().mockReturnValue({
                                                    attr: jest.fn().mockReturnValue({
                                                        style: jest.fn().mockReturnValue({
                                                            on: jest.fn(),
                                                        }),
                                                    }),
                                                }),
                                            }),
                                        }),
                                    }),
                                }),
                            }),
                        }),
                    }),
                }),
                exit: jest.fn().mockReturnValue({
                    remove: jest.fn(),
                }),
            }),
        }),
        append: jest.fn().mockReturnValue({
            attr: jest.fn().mockReturnValue({
                style: jest.fn().mockReturnValue({
                    on: jest.fn().mockReturnValue({
                        transition: jest.fn().mockReturnValue({
                            duration: jest.fn().mockReturnValue({
                                ease: jest.fn().mockReturnValue({
                                    style: jest.fn().mockReturnValue({
                                        attr: jest.fn().mockReturnValue({
                                            remove: jest.fn(),
                                        }),
                                    }),
                                }),
                            }),
                        }),
                    }),
                }),
            }),
        }),
        remove: jest.fn(),
        call: jest.fn(),
        transition: jest.fn().mockReturnValue({
            duration: jest.fn().mockReturnValue({
                ease: jest.fn().mockReturnValue({
                    style: jest.fn().mockReturnValue({
                        attr: jest.fn().mockReturnValue({
                            remove: jest.fn(),
                        }),
                    }),
                }),
            }),
        }),
    }),
    stratify: jest.fn().mockReturnValue({
        parentId: jest.fn().mockReturnValue({
            descendants: jest.fn().mockReturnValue([]),
            links: jest.fn().mockReturnValue([]),
        }),
    }),
    sankey: jest.fn().mockReturnValue(jest.fn().mockReturnValue({
        nodes: [],
        links: [],
    })),
    sankeyLinkHorizontal: jest.fn(),
    forceSimulation: jest.fn().mockReturnValue({
        force: jest.fn().mockReturnValue({
            strength: jest.fn().mockReturnValue({
                distance: jest.fn().mockReturnValue({
                    iterations: jest.fn().mockReturnValue({
                        extent: jest.fn().mockReturnValue({
                            stop: jest.fn(),
                        }),
                    }),
                }),
            }),
        }),
        nodes: jest.fn().mockReturnValue([]),
        stop: jest.fn(),
        alpha: jest.fn().mockReturnValue({
            alphaDecay: jest.fn().mockReturnValue({
                restart: jest.fn(),
            }),
        }),
    }),
    forceLink: jest.fn().mockReturnValue({
        id: jest.fn().mockReturnValue({
            distance: jest.fn(),
        }),
    }),
    forceManyBody: jest.fn().mockReturnValue({
        strength: jest.fn(),
    }),
    forceCenter: jest.fn(),
    forceRadial: jest.fn().mockReturnValue({
        strength: jest.fn(),
    }),
    min: jest.fn(),
    max: jest.fn(),
    pointer: jest.fn().mockReturnValue([0, 0]),
    interpolate: jest.fn(),
};

describe('ModuleLoader', () => {
    let moduleLoader;

    beforeEach(() => {
        jest.clearAllMocks();
        moduleLoader = new ModuleLoader();
    });

    describe('module registration', () => {
        test('should register a module without dependencies', () => {
            const MockModule = jest.fn();
            moduleLoader.registerModule('TestModule', MockModule);

            expect(moduleLoader.getRegisteredModules()).toContain('TestModule');
            expect(moduleLoader.getDependencies('TestModule')).toEqual([]);
        });

        test('should register a module with dependencies', () => {
            const MockModule = jest.fn();
            const MockDep = jest.fn();
            moduleLoader.registerModule('DepModule', MockDep);
            moduleLoader.registerModule('TestModule', MockModule, ['DepModule']);

            expect(moduleLoader.getDependencies('TestModule')).toEqual(['DepModule']);
        });

        test('should detect circular dependencies', () => {
            const MockModule = jest.fn();
            moduleLoader.registerModule('ModuleA', MockModule, ['ModuleB']);

            expect(() => {
                moduleLoader.registerModule('ModuleB', MockModule, ['ModuleA']);
            }).toThrow('Circular dependency detected for module: ModuleB');
        });

        test('should overwrite existing module registration', () => {
            const MockModule1 = jest.fn();
            const MockModule2 = jest.fn();
            moduleLoader.registerModule('TestModule', MockModule1);
            moduleLoader.registerModule('TestModule', MockModule2);

            expect(moduleLoader.getRegisteredModules()).toContain('TestModule');
        });
    });

    describe('module loading', () => {
        test('should load module without dependencies', async () => {
            const MockModule = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
            }));
            moduleLoader.registerModule('TestModule', MockModule);

            const instance = await moduleLoader.loadModule('TestModule');

            expect(MockModule).toHaveBeenCalledWith();
            expect(instance).toBeDefined();
            expect(moduleLoader.isModuleLoaded('TestModule')).toBe(true);
        });

        test('should load module with dependencies', async () => {
            const MockDep = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
            }));
            const MockModule = jest.fn().mockImplementation((dep) => ({
                dependency: dep,
                initialize: jest.fn().mockResolvedValue(),
            }));

            moduleLoader.registerModule('DepModule', MockDep);
            moduleLoader.registerModule('TestModule', MockModule, ['DepModule']);

            const instance = await moduleLoader.loadModule('TestModule');

            expect(MockDep).toHaveBeenCalledWith();
            expect(MockModule).toHaveBeenCalledWith(expect.any(Object));
            expect(instance.dependency).toBeDefined();
        });

        test('should return cached instance on subsequent loads', async () => {
            const MockModule = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
            }));
            moduleLoader.registerModule('TestModule', MockModule);

            const instance1 = await moduleLoader.loadModule('TestModule');
            const instance2 = await moduleLoader.loadModule('TestModule');

            expect(MockModule).toHaveBeenCalledTimes(1);
            expect(instance1).toBe(instance2);
        });

        test('should throw error for unregistered module', async () => {
            await expect(moduleLoader.loadModule('NonExistent')).rejects.toThrow('Module NonExistent not registered');
        });

        test('should throw error when dependency fails to load', async () => {
            const MockModule = jest.fn().mockImplementation(() => {
                throw new Error('Module creation failed');
            });
            moduleLoader.registerModule('TestModule', MockModule);

            await expect(moduleLoader.loadModule('TestModule')).rejects.toThrow('Module creation failed');
        });
    });

    describe('module initialization', () => {
        test('should initialize module successfully', async () => {
            const mockInstance = {
                initialize: jest.fn().mockResolvedValue(),
            };
            const MockModule = jest.fn().mockReturnValue(mockInstance);
            moduleLoader.registerModule('TestModule', MockModule);
            await moduleLoader.loadModule('TestModule');

            await moduleLoader.initializeModule('TestModule');

            expect(mockInstance.initialize).toHaveBeenCalled();
            expect(moduleLoader.isModuleInitialized('TestModule')).toBe(true);
        });

        test('should initialize dependencies first', async () => {
            const depInstance = { initialize: jest.fn().mockResolvedValue() };
            const mainInstance = { initialize: jest.fn().mockResolvedValue() };
            const MockDep = jest.fn().mockReturnValue(depInstance);
            const MockMain = jest.fn().mockReturnValue(mainInstance);

            moduleLoader.registerModule('DepModule', MockDep);
            moduleLoader.registerModule('MainModule', MockMain, ['DepModule']);

            await moduleLoader.loadModule('MainModule');
            await moduleLoader.initializeModule('MainModule');

            expect(depInstance.initialize).toHaveBeenCalled();
            expect(mainInstance.initialize).toHaveBeenCalled();
        });

        test('should skip initialization for already initialized module', async () => {
            const mockInstance = {
                initialize: jest.fn().mockResolvedValue(),
            };
            const MockModule = jest.fn().mockReturnValue(mockInstance);
            moduleLoader.registerModule('TestModule', MockModule);
            await moduleLoader.loadModule('TestModule');
            await moduleLoader.initializeModule('TestModule');

            mockInstance.initialize.mockClear();
            await moduleLoader.initializeModule('TestModule');

            expect(mockInstance.initialize).not.toHaveBeenCalled();
        });

        test('should throw error for uninitialized module', async () => {
            moduleLoader.registerModule('TestModule', jest.fn());

            await expect(moduleLoader.initializeModule('TestModule')).rejects.toThrow('Module TestModule not loaded');
        });
    });

    describe('loadAllModules', () => {
        test('should load and initialize all registered modules', async () => {
            // Spy on real module methods
            const initializeSpy = jest.spyOn(DataManager.prototype, 'initialize').mockResolvedValue();
            const cleanupSpy = jest.spyOn(DataManager.prototype, 'cleanup').mockResolvedValue();
            const chartInitSpy = jest.spyOn(ChartRenderer.prototype, 'initialize').mockResolvedValue();
            const chartCleanupSpy = jest.spyOn(ChartRenderer.prototype, 'cleanup').mockResolvedValue();

            moduleLoader.registerModule('DataManager', DataManager);
            moduleLoader.registerModule('ChartRenderer', ChartRenderer, ['DataManager']);

            await moduleLoader.loadAllModules();

            expect(moduleLoader.isModuleLoaded('DataManager')).toBe(true);
            expect(moduleLoader.isModuleLoaded('ChartRenderer')).toBe(true);
            expect(moduleLoader.isModuleInitialized('DataManager')).toBe(true);
            expect(moduleLoader.isModuleInitialized('ChartRenderer')).toBe(true);
            expect(initializeSpy).toHaveBeenCalled();
            expect(chartInitSpy).toHaveBeenCalled();

            // Cleanup spies
            initializeSpy.mockRestore();
            cleanupSpy.mockRestore();
            chartInitSpy.mockRestore();
            chartCleanupSpy.mockRestore();
        });

        test('should maintain correct loading order', async () => {
            const MockDep = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
            }));
            const MockMain = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
            }));

            moduleLoader.registerModule('DepModule', MockDep);
            moduleLoader.registerModule('MainModule', MockMain, ['DepModule']);

            await moduleLoader.loadAllModules();

            const order = moduleLoader.getLoadingOrder();
            expect(order.indexOf('DepModule')).toBeLessThan(order.indexOf('MainModule'));
        });
    });

    describe('module retrieval', () => {
        test('should get loaded module instance', async () => {
            const mockInstance = { test: 'value' };
            const MockModule = jest.fn().mockReturnValue(mockInstance);
            moduleLoader.registerModule('TestModule', MockModule);
            await moduleLoader.loadModule('TestModule');

            const instance = moduleLoader.getModule('TestModule');

            expect(instance).toBe(mockInstance);
        });

        test('should throw error for unloaded module', () => {
            moduleLoader.registerModule('TestModule', jest.fn());

            expect(() => moduleLoader.getModule('TestModule')).toThrow('Module TestModule not loaded');
        });

        test('should throw error for unregistered module', () => {
            expect(() => moduleLoader.getModule('Unregistered')).toThrow('Module Unregistered not registered');
        });
    });

    describe('loadModule functionality', () => {
        test('should load module with complex dependency chain', async () => {
            const MockA = jest.fn().mockImplementation(() => ({ initialize: jest.fn().mockResolvedValue() }));
            const MockB = jest.fn().mockImplementation(() => ({ initialize: jest.fn().mockResolvedValue() }));
            const MockC = jest.fn().mockImplementation(() => ({ initialize: jest.fn().mockResolvedValue() }));

            moduleLoader.registerModule('ModuleA', MockA);
            moduleLoader.registerModule('ModuleB', MockB, ['ModuleA']);
            moduleLoader.registerModule('ModuleC', MockC, ['ModuleB']);

            const instance = await moduleLoader.loadModule('ModuleC');

            expect(moduleLoader.isModuleLoaded('ModuleA')).toBe(true);
            expect(moduleLoader.isModuleLoaded('ModuleB')).toBe(true);
            expect(moduleLoader.isModuleLoaded('ModuleC')).toBe(true);
            expect(instance).toBeDefined();
        });

        test('should load module dynamically without pre-registration', async () => {
            const MockModule = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
            }));

            // Simulate dynamic module loading
            moduleLoader.registerModule('DynamicModule', MockModule);

            const instance = await moduleLoader.loadModule('DynamicModule');

            expect(instance).toBeDefined();
            expect(moduleLoader.isModuleLoaded('DynamicModule')).toBe(true);
        });

        test('should handle loadModule with missing dependency', async () => {
            const MockModule = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
            }));

            moduleLoader.registerModule('TestModule', MockModule, ['MissingDep']);

            await expect(moduleLoader.loadModule('TestModule')).rejects.toThrow('Module MissingDep not registered');
        });

        test('should load module with multiple dependencies', async () => {
            const MockDep1 = jest.fn().mockImplementation(() => ({ initialize: jest.fn().mockResolvedValue() }));
            const MockDep2 = jest.fn().mockImplementation(() => ({ initialize: jest.fn().mockResolvedValue() }));
            const MockMain = jest.fn().mockImplementation((dep1, dep2) => ({
                dep1, dep2,
                initialize: jest.fn().mockResolvedValue(),
            }));

            moduleLoader.registerModule('Dep1', MockDep1);
            moduleLoader.registerModule('Dep2', MockDep2);
            moduleLoader.registerModule('MainModule', MockMain, ['Dep1', 'Dep2']);

            const instance = await moduleLoader.loadModule('MainModule');

            expect(instance.dep1).toBeDefined();
            expect(instance.dep2).toBeDefined();
            expect(MockMain).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
        });
    });

    describe('initAllModules functionality', () => {
        test('should initialize all modules in correct dependency order', async () => {
            const initOrder = [];
            const MockA = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockImplementation(async () => {
                    initOrder.push('A');
                }),
            }));
            const MockB = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockImplementation(async () => {
                    initOrder.push('B');
                }),
            }));
            const MockC = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockImplementation(async () => {
                    initOrder.push('C');
                }),
            }));

            moduleLoader.registerModule('ModuleA', MockA);
            moduleLoader.registerModule('ModuleB', MockB, ['ModuleA']);
            moduleLoader.registerModule('ModuleC', MockC, ['ModuleB']);

            await moduleLoader.loadAllModules();

            expect(initOrder).toEqual(['A', 'B', 'C']);
            expect(moduleLoader.isModuleInitialized('ModuleA')).toBe(true);
            expect(moduleLoader.isModuleInitialized('ModuleB')).toBe(true);
            expect(moduleLoader.isModuleInitialized('ModuleC')).toBe(true);
        });

        test('should handle initAllModules with empty module list', async () => {
            await expect(moduleLoader.loadAllModules()).resolves.not.toThrow();
            expect(moduleLoader.getLoadedModules()).toHaveLength(0);
        });

        test('should initAllModules with mixed dependency patterns', async () => {
            const MockIndependent = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
            }));
            const MockDependent = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
            }));

            moduleLoader.registerModule('Independent', MockIndependent);
            moduleLoader.registerModule('Dependent', MockDependent, ['Independent']);

            await moduleLoader.loadAllModules();

            expect(moduleLoader.isModuleInitialized('Independent')).toBe(true);
            expect(moduleLoader.isModuleInitialized('Dependent')).toBe(true);
        });
    });

    describe('dynamic load functionality', () => {
        test('should dynamically load modules on demand', async () => {
            const MockModule = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
                dynamicMethod: jest.fn(),
            }));

            moduleLoader.registerModule('DynamicModule', MockModule);

            // First access should load the module
            const instance1 = await moduleLoader.loadModule('DynamicModule');
            expect(instance1).toBeDefined();

            // Second access should return cached instance
            const instance2 = await moduleLoader.loadModule('DynamicModule');
            expect(instance1).toBe(instance2);
        });

        test('should handle dynamic loading with runtime dependencies', async () => {
            const MockBase = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
                getData: () => 'base data',
            }));
            const MockExtension = jest.fn().mockImplementation((base) => ({
                base,
                initialize: jest.fn().mockResolvedValue(),
                extendedMethod: () => 'extended',
            }));

            moduleLoader.registerModule('BaseModule', MockBase);
            moduleLoader.registerModule('ExtensionModule', MockExtension, ['BaseModule']);

            const extensionInstance = await moduleLoader.loadModule('ExtensionModule');

            expect(extensionInstance.base).toBeDefined();
            expect(extensionInstance.base.getData()).toBe('base data');
            expect(extensionInstance.extendedMethod()).toBe('extended');
        });

        test('should dynamically reload module after changes', async () => {
            const MockModule = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
                cleanup: jest.fn().mockResolvedValue(),
                version: 1,
            }));

            moduleLoader.registerModule('ReloadModule', MockModule);
            await moduleLoader.loadModule('ReloadModule');
            await moduleLoader.initializeModule('ReloadModule');

            const originalInstance = moduleLoader.getModule('ReloadModule');

            // Simulate module reload
            await moduleLoader.reloadModule('ReloadModule');

            const newInstance = moduleLoader.getModule('ReloadModule');
            expect(originalInstance).not.toBe(newInstance);
            expect(originalInstance.cleanup).toHaveBeenCalled();
        });
    });

    describe('error handling functionality', () => {
        test('should handle module registration errors', () => {
            const MockModule = jest.fn().mockImplementation(() => {
                throw new Error('Registration failed');
            });

            expect(() => {
                moduleLoader.registerModule('FailingModule', MockModule);
            }).not.toThrow(); // Registration itself shouldn't fail
        });

        test('should handle loadModule errors with missing dependencies', async () => {
            const MockModule = jest.fn().mockImplementation(() => ({
                initialize: jest.fn().mockResolvedValue(),
            }));

            moduleLoader.registerModule('TestModule', MockModule, ['NonExistentDep']);

            await expect(moduleLoader.loadModule('TestModule')).rejects.toThrow('Module NonExistentDep not registered');
        });

        test('should handle initialization errors gracefully', async () => {
            const mockInstance = {
                initialize: jest.fn().mockRejectedValue(new Error('Init failed')),
            };
            const MockModule = jest.fn().mockReturnValue(mockInstance);

            moduleLoader.registerModule('FailingInit', MockModule);
            await moduleLoader.loadModule('FailingInit');

            await expect(moduleLoader.initializeModule('FailingInit')).rejects.toThrow('Init failed');
            expect(moduleLoader.isModuleInitialized('FailingInit')).toBe(false);
        });

        test('should handle circular dependency detection', () => {
            const MockModule = jest.fn();

            moduleLoader.registerModule('A', MockModule, ['B']);
            moduleLoader.registerModule('B', MockModule, ['C']);

            expect(() => {
                moduleLoader.registerModule('C', MockModule, ['A']);
            }).toThrow('Circular dependency detected for module: C');
        });

        test('should handle cleanup errors without failing entire cleanup', async () => {
            const goodInstance = { cleanup: jest.fn().mockResolvedValue() };
            const badInstance = { cleanup: jest.fn().mockRejectedValue(new Error('Cleanup error')) };

            const MockGood = jest.fn().mockReturnValue(goodInstance);
            const MockBad = jest.fn().mockReturnValue(badInstance);

            moduleLoader.registerModule('GoodModule', MockGood);
            moduleLoader.registerModule('BadModule', MockBad);

            await moduleLoader.loadModule('GoodModule');
            await moduleLoader.loadModule('BadModule');

            // Cleanup should not throw even if one module fails
            await expect(moduleLoader.cleanup()).resolves.not.toThrow();

            expect(goodInstance.cleanup).toHaveBeenCalled();
            expect(badInstance.cleanup).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        test('should cleanup all modules in reverse order', async () => {
            const depInstance = { cleanup: jest.fn().mockResolvedValue() };
            const mainInstance = { cleanup: jest.fn().mockResolvedValue() };
            const MockDep = jest.fn().mockReturnValue(depInstance);
            const MockMain = jest.fn().mockReturnValue(mainInstance);

            moduleLoader.registerModule('DepModule', MockDep);
            moduleLoader.registerModule('MainModule', MockMain, ['DepModule']);
            await moduleLoader.loadAllModules();

            await moduleLoader.cleanup();

            expect(mainInstance.cleanup).toHaveBeenCalled();
            expect(depInstance.cleanup).toHaveBeenCalled();
            expect(moduleLoader.getRegisteredModules()).toHaveLength(0);
        });

        test('should handle cleanup errors gracefully', async () => {
            const mockInstance = {
                cleanup: jest.fn().mockRejectedValue(new Error('Cleanup failed')),
            };
            const MockModule = jest.fn().mockReturnValue(mockInstance);
            moduleLoader.registerModule('TestModule', MockModule);
            await moduleLoader.loadModule('TestModule');

            await expect(moduleLoader.cleanup()).resolves.not.toThrow();
        });

        test('should get initialized modules', async () => {
            const mockInstance = { initialize: jest.fn().mockResolvedValue() };
            const MockModule = jest.fn().mockReturnValue(mockInstance);
            moduleLoader.registerModule('TestModule', MockModule);
            await moduleLoader.loadModule('TestModule');
            await moduleLoader.initializeModule('TestModule');

            const initialized = moduleLoader.getInitializedModules();
            expect(initialized).toContain('TestModule');
        });

        test('should get module status', () => {
            const MockModule = jest.fn();
            moduleLoader.registerModule('TestModule', MockModule);

            const status = moduleLoader.getModuleStatus();
            expect(status.TestModule).toBeDefined();
            expect(status.TestModule.registered).toBe(true);
            expect(status.TestModule.loaded).toBe(false);
        });

        test('should debug module loader state', () => {
            // Enable debug mode in logger to see debug messages
            logger.setDebugMode(true);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            moduleLoader.debug();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringMatching(/\[.*\] \[DEBUG\] \[MODULELOADER\] === MODULE LOADER STATUS ===/)
            );
            consoleSpy.mockRestore();

            // Reset debug mode
            logger.setDebugMode(false);
        });

        test('should reload module and call cleanup', async () => {
            const mockInstance = {
                initialize: jest.fn().mockResolvedValue(),
                cleanup: jest.fn().mockResolvedValue(),
            };
            const MockModule = jest.fn().mockReturnValue(mockInstance);
            moduleLoader.registerModule('TestModule', MockModule);
            await moduleLoader.loadModule('TestModule');
            await moduleLoader.initializeModule('TestModule');

            await moduleLoader.reloadModule('TestModule');

            expect(mockInstance.cleanup).toHaveBeenCalled();
            expect(moduleLoader.isModuleLoaded('TestModule')).toBe(true);
        });
    });
});
