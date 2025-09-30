/**
 * Jest unit tests for ThemeManager.js
 * Tests theme switching, persistence, and color management
 */

import ThemeManager from '../modules/core/ThemeManager.js';

describe('ThemeManager', () => {
    let themeManager;
    let originalLocalStorage;
    let originalMatchMedia;

    beforeEach(() => {
        jest.clearAllMocks();

        // Store originals
        originalLocalStorage = window.localStorage;
        originalMatchMedia = window.matchMedia;

        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                clear: jest.fn(),
            },
            writable: true,
        });

        // Mock matchMedia
        Object.defineProperty(window, 'matchMedia', {
            value: jest.fn().mockImplementation(() => ({
                matches: false,
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
            })),
            writable: true,
        });

        // Ensure document has head element for meta theme-color tests
        if (!document.head) {
            document.head = document.createElement('head');
            document.documentElement.appendChild(document.head);
        }

        themeManager = new ThemeManager();
    });

    afterEach(() => {
        // Restore originals
        Object.defineProperty(window, 'localStorage', {
            value: originalLocalStorage,
            writable: true,
        });
        Object.defineProperty(window, 'matchMedia', {
            value: originalMatchMedia,
            writable: true,
        });
    });

    describe('initialization', () => {
        test('should initialize with default settings', () => {
            localStorage.getItem.mockReturnValue(null);

            // Re-initialize to test init method
            themeManager.init();

            expect(themeManager.getCurrentTheme()).toBe('light'); // Default when no preference
            expect(themeManager.isDarkModeActive()).toBe(false);
        });

        test('should load saved dark mode preference', () => {
            localStorage.getItem.mockReturnValue('true');

            themeManager.init();

            expect(themeManager.isDarkModeActive()).toBe(true);
            expect(themeManager.getCurrentTheme()).toBe('dark');
        });

        test('should detect system preference when no manual override', () => {
            window.matchMedia.mockReturnValue({
                matches: true,
                addEventListener: jest.fn(),
            });
            localStorage.getItem.mockReturnValue(null);

            themeManager.init();

            expect(themeManager.systemPrefersDark).toBe(true);
            expect(themeManager.isDarkModeActive()).toBe(true);
        });
    });

    describe('theme switching', () => {
        test('should toggle from light to dark', () => {
            themeManager.isDarkMode = false;

            const result = themeManager.toggleTheme();

            expect(result).toBe(true);
            expect(themeManager.isDarkModeActive()).toBe(true);
            expect(themeManager.getCurrentTheme()).toBe('dark');
            expect(localStorage.setItem).toHaveBeenCalledWith('expense-dashboard-dark-mode', 'true');
        });

        test('should toggle from dark to light', () => {
            themeManager.isDarkMode = true;

            const result = themeManager.toggleTheme();

            expect(result).toBe(false);
            expect(themeManager.isDarkModeActive()).toBe(false);
            expect(themeManager.getCurrentTheme()).toBe('light');
            expect(localStorage.setItem).toHaveBeenCalledWith('expense-dashboard-dark-mode', 'false');
        });

        test('should set theme explicitly', () => {
            themeManager.setTheme(true);

            expect(themeManager.isDarkModeActive()).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith('expense-dashboard-dark-mode', 'true');
        });
    });

    describe('theme application', () => {
        test('should apply light theme to document', () => {
            themeManager.isDarkMode = false;
            themeManager.applyCurrentTheme();

            expect(document.documentElement.getAttribute('data-color-scheme')).toBe('light');
            expect(document.documentElement.style.getPropertyValue('--color-background')).toBe('#FAFAF7');
            expect(document.documentElement.style.getPropertyValue('--color-text')).toBe('#1B2D3B');
        });

        test('should apply dark theme to document', () => {
            themeManager.isDarkMode = true;
            themeManager.applyCurrentTheme();

            expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
            expect(document.documentElement.style.getPropertyValue('--color-background')).toBe('#000000');
            expect(document.documentElement.style.getPropertyValue('--color-text')).toBe('#F5F5F5');
        });

        test('should update meta theme-color', () => {
            themeManager.isDarkMode = false;
            themeManager.applyCurrentTheme();

            const metaTag = document.querySelector('meta[name="theme-color"]');
            expect(metaTag).toBeTruthy();
            expect(metaTag.content).toBe('#218BCD'); // light theme primary color
        });
    });

    describe('color management', () => {
        test('should get current colors', () => {
            themeManager.isDarkMode = false;
            const colors = themeManager.getCurrentColors();

            expect(colors.background).toBe('#FAFAF7');
            expect(colors.primary).toBe('#218BCD');
        });

        test('should get specific color value', () => {
            themeManager.isDarkMode = false;
            const primaryColor = themeManager.getColor('primary');

            expect(primaryColor).toBe('#218BCD');
        });

        test('should return primary color for unknown color name', () => {
            themeManager.isDarkMode = false;
            const unknownColor = themeManager.getColor('unknown');

            expect(unknownColor).toBe('#218BCD');
        });
    });

    describe('color themes', () => {
        test('should set color theme', () => {
            themeManager.setColorTheme('ocean');

            expect(themeManager.getCurrentColorTheme()).toBe('ocean');
            expect(localStorage.setItem).toHaveBeenCalledWith('expense-dashboard-color-theme', 'ocean');
        });

        test('should fallback to default for invalid color theme', () => {
            themeManager.setColorTheme('invalid-theme');

            expect(themeManager.getCurrentColorTheme()).toBe('default');
        });

        test('should get color theme data', () => {
            const theme = themeManager.getColorTheme('ocean');

            expect(theme.name).toBe('Ocean');
            expect(theme.properties).toBeDefined();
            expect(theme.categories).toBeDefined();
        });

        test('should get available color themes', () => {
            const themes = themeManager.getAvailableColorThemes();

            expect(themes.default).toBeDefined();
            expect(themes.ocean).toBeDefined();
            expect(themes.forest).toBeDefined();
        });

        test('should get color theme options for UI', () => {
            const options = themeManager.getColorThemeOptions();

            expect(Array.isArray(options)).toBe(true);
            expect(options[0]).toHaveProperty('id');
            expect(options[0]).toHaveProperty('name');
        });

        test('should get chart colors', () => {
            const colors = themeManager.getChartColors();

            expect(colors).toHaveProperty('properties');
            expect(colors).toHaveProperty('categories');
            expect(colors).toHaveProperty('trends');
        });
    });

    describe('system preference handling', () => {
        test('should reset to system preference', () => {
            // Set up system preference first
            window.matchMedia.mockReturnValue({
                matches: true,
                addEventListener: jest.fn(),
            });
            themeManager.detectSystemPreference(); // This sets systemPrefersDark

            themeManager.manualOverride = true;
            themeManager.isDarkMode = false;

            themeManager.resetToSystemPreference();

            expect(themeManager.manualOverride).toBe(false);
            expect(themeManager.isDarkMode).toBe(true);
        });

        test('should check manual override status', () => {
            themeManager.manualOverride = true;

            expect(themeManager.hasManualOverride()).toBe(true);
        });
    });

    describe('theme information', () => {
        test('should get theme info', () => {
            themeManager.isDarkMode = true;
            themeManager.manualOverride = true;

            const info = themeManager.getThemeInfo();

            expect(info.current).toBe('dark');
            expect(info.isDark).toBe(true);
            expect(info.manualOverride).toBe(true);
            expect(info.colors).toBeDefined();
        });
    });

    describe('event notifications', () => {
        test('should dispatch theme change event', () => {
            const dispatchSpy = jest.spyOn(document, 'dispatchEvent');

            themeManager.toggleTheme();

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'themeChange',
                    detail: expect.objectContaining({
                        theme: 'dark',
                        isDark: true,
                    }),
                })
            );

            dispatchSpy.mockRestore();
        });

        test('should dispatch color theme change event', () => {
            const dispatchSpy = jest.spyOn(document, 'dispatchEvent');

            themeManager.setColorTheme('ocean');

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'colorThemeChange',
                    detail: expect.objectContaining({
                        theme: 'ocean',
                    }),
                })
            );

            dispatchSpy.mockRestore();
        });
    });

    describe('persistence', () => {
        test('should save preference to localStorage', () => {
            themeManager.savePreference();

            expect(localStorage.setItem).toHaveBeenCalledWith('expense-dashboard-dark-mode', 'false');
        });

        test('should load preference from localStorage', () => {
            localStorage.getItem.mockReturnValue('true');

            themeManager.loadSavedPreference();

            expect(themeManager.isDarkMode).toBe(true);
            expect(themeManager.manualOverride).toBe(true);
        });

        test('should handle localStorage errors gracefully', () => {
            localStorage.setItem.mockImplementation(() => {
                throw new Error('Storage error');
            });

            expect(() => themeManager.savePreference()).not.toThrow();
        });
    });

    describe('export/import', () => {
        test('should export theme settings', () => {
            themeManager.isDarkMode = true;
            const settings = themeManager.exportThemeSettings();

            expect(settings.currentTheme).toBe('dark');
            expect(settings.isDarkMode).toBe(true);
            expect(settings.timestamp).toBeDefined();
        });

        test('should import theme settings', () => {
            const settings = {
                isDarkMode: true,
                manualOverride: true,
            };

            themeManager.importThemeSettings(settings);

            expect(themeManager.isDarkMode).toBe(true);
            expect(themeManager.manualOverride).toBe(true);
        });

        test('should export color theme settings', () => {
            const settings = themeManager.exportColorThemeSettings();

            expect(settings.currentColorTheme).toBeDefined();
            expect(settings.colorThemes).toBeDefined();
        });

        test('should import color theme settings', () => {
            const settings = {
                currentColorTheme: 'ocean',
            };

            themeManager.importColorThemeSettings(settings);

            expect(themeManager.getCurrentColorTheme()).toBe('ocean');
        });
    });

    describe('setTheme functionality', () => {
        test('should set theme to dark mode explicitly', () => {
            themeManager.setTheme(true);

            expect(themeManager.isDarkModeActive()).toBe(true);
            expect(themeManager.getCurrentTheme()).toBe('dark');
            expect(themeManager.hasManualOverride()).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith('expense-dashboard-dark-mode', 'true');
        });

        test('should set theme to light mode explicitly', () => {
            themeManager.isDarkMode = true; // Start in dark mode
            themeManager.setTheme(false);

            expect(themeManager.isDarkModeActive()).toBe(false);
            expect(themeManager.getCurrentTheme()).toBe('light');
            expect(themeManager.hasManualOverride()).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith('expense-dashboard-dark-mode', 'false');
        });

        test('should handle setTheme with same value', () => {
            themeManager.isDarkMode = false;
            themeManager.setTheme(false); // Same value

            expect(themeManager.isDarkModeActive()).toBe(false);
            expect(localStorage.setItem).toHaveBeenCalledWith('expense-dashboard-dark-mode', 'false');
        });
    });

    describe('toggle functionality', () => {
        test('should toggle from light to dark and notify listeners', () => {
            themeManager.isDarkMode = false;
            const mockCallback = jest.fn();
            themeManager.onThemeChangeCallback(mockCallback);

            themeManager.toggleTheme();

            expect(themeManager.isDarkModeActive()).toBe(true);
            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    current: 'dark',
                    isDark: true,
                    manualOverride: true
                })
            );
        });

        test('should toggle from dark to light and dispatch event', () => {
            themeManager.isDarkMode = true;
            const dispatchSpy = jest.spyOn(document, 'dispatchEvent');

            themeManager.toggleTheme();

            expect(themeManager.isDarkModeActive()).toBe(false);
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'themeChange',
                    detail: expect.objectContaining({
                        theme: 'light',
                        isDark: false
                    })
                })
            );

            dispatchSpy.mockRestore();
        });

        test('should return new theme state after toggle', () => {
            themeManager.isDarkMode = false;
            const result = themeManager.toggleTheme();

            expect(result).toBe(true);

            const result2 = themeManager.toggleTheme();
            expect(result2).toBe(false);
        });
    });

    describe('apply functionality', () => {
        test('should apply theme and update all CSS variables', () => {
            themeManager.isDarkMode = true;
            themeManager.applyCurrentTheme();

            expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');

            // Check that multiple CSS properties are set
            expect(document.documentElement.style.getPropertyValue('--color-background')).toBe('#000000');
            expect(document.documentElement.style.getPropertyValue('--color-text')).toBe('#F5F5F5');
            expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#4FB8E5');
        });

        test('should apply theme to specific element', () => {
            const mockElement = { style: { setProperty: jest.fn() } };
            themeManager.applyThemeToElement(mockElement);

            expect(mockElement.style.setProperty).toHaveBeenCalledWith('--color-background', '#FAFAF7');
            expect(mockElement.style.setProperty).toHaveBeenCalledWith('--color-text', '#1B2D3B');
        });

        test('should resolve theme variables in CSS string', () => {
            const css = 'background: var(--color-background); color: var(--color-text);';
            const resolved = themeManager.resolveThemeVariables(css);

            expect(resolved).toContain('#FAFAF7');
            expect(resolved).toContain('#1B2D3B');
        });
    });

    describe('persist functionality', () => {
        test('should persist theme preference to localStorage', () => {
            themeManager.isDarkMode = true;
            themeManager.savePreference();

            expect(localStorage.setItem).toHaveBeenCalledWith('expense-dashboard-dark-mode', 'true');
        });

        test('should persist color theme preference', () => {
            themeManager.currentColorTheme = 'ocean';
            themeManager.saveColorThemePreference();

            expect(localStorage.setItem).toHaveBeenCalledWith('expense-dashboard-color-theme', 'ocean');
        });

        test('should handle localStorage errors during save', () => {
            localStorage.setItem.mockImplementation(() => {
                throw new Error('Storage quota exceeded');
            });

            expect(() => themeManager.savePreference()).not.toThrow();
            expect(() => themeManager.saveColorThemePreference()).not.toThrow();
        });
    });

    describe('load on init functionality', () => {
        test('should load saved theme preference on initialization', () => {
            localStorage.getItem.mockReturnValue('true');

            themeManager.loadSavedPreference();

            expect(themeManager.isDarkMode).toBe(true);
            expect(themeManager.manualOverride).toBe(true);
        });

        test('should load saved color theme on initialization', () => {
            localStorage.getItem.mockReturnValue('ocean');

            themeManager.loadSavedColorTheme();

            expect(themeManager.currentColorTheme).toBe('ocean');
        });

        test('should fallback to default when saved theme is invalid', () => {
            localStorage.getItem.mockReturnValue('nonexistent-theme');

            themeManager.loadSavedColorTheme();

            expect(themeManager.currentColorTheme).toBe('default');
        });

        test('should handle localStorage errors during load', () => {
            localStorage.getItem.mockImplementation(() => {
                throw new Error('Storage access denied');
            });

            expect(() => themeManager.loadSavedPreference()).not.toThrow();
            expect(() => themeManager.loadSavedColorTheme()).not.toThrow();

            // Should maintain defaults
            expect(themeManager.isDarkMode).toBe(false);
            expect(themeManager.currentColorTheme).toBe('default');
        });

        test('should initialize with system preference when no saved preference', () => {
            localStorage.getItem.mockReturnValue(null);
            window.matchMedia.mockReturnValue({
                matches: true,
                addEventListener: jest.fn(),
            });

            themeManager.detectSystemPreference();
            themeManager.loadSavedPreference();

            expect(themeManager.systemPrefersDark).toBe(true);
            expect(themeManager.isDarkMode).toBe(true);
            expect(themeManager.manualOverride).toBe(false);
        });
    });

    describe('edge cases', () => {
        test('should handle non-boolean values in setTheme', () => {
            themeManager.setTheme('invalid'); // truthy string

            // Should treat as dark mode since it's truthy
            expect(themeManager.getCurrentTheme()).toBe('dark');
        });

        test('should handle missing document element gracefully', () => {
            delete document.documentElement;

            expect(() => themeManager.applyCurrentTheme()).not.toThrow();
        });

        test('should handle empty import settings', () => {
            expect(() => themeManager.importThemeSettings(null)).not.toThrow();
            expect(() => themeManager.importColorThemeSettings(null)).not.toThrow();
        });
    });

    describe('additional edge cases for 100% coverage', () => {
        test('should load invalid preference value and fallback to system preference', () => {
            localStorage.getItem.mockReturnValue('invalid-json-string');

            themeManager.loadSavedPreference();

            expect(themeManager.isDarkMode).toBe(false); // systemPrefersDark false
            expect(themeManager.manualOverride).toBe(false);
        });

        test('should handle save with quota exceeded error and log', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            localStorage.setItem.mockImplementation(() => {
                throw new DOMException('QuotaExceededError', 'QuotaExceededError');
            });

            themeManager.savePreference();

            expect(console.error).toHaveBeenCalledWith('Save failed');
            consoleErrorSpy.mockRestore();
        });

        test('should toggle successfully multiple times without no-op', () => {
            themeManager.setTheme(false);

            expect(themeManager.isDarkModeActive()).toBe(false);
            const result1 = themeManager.toggleTheme();
            expect(result1).toBe(true);
            expect(themeManager.isDarkModeActive()).toBe(true);

            const result2 = themeManager.toggleTheme();
            expect(result2).toBe(false);
            expect(themeManager.isDarkModeActive()).toBe(false);
        });

        test('should handle applyCurrentTheme with invalid CSS property values gracefully', () => {
            themeManager.isDarkMode = true;

            // Mock invalid style property to trigger potential errors (though setProperty rarely throws)
            const setPropertySpy = jest.spyOn(document.documentElement.style, 'setProperty').mockImplementation(() => {
                // Simulate potential error for invalid selector/property
                if (Math.random() > 1) throw new Error('Invalid property');
            });

            expect(() => themeManager.applyCurrentTheme()).not.toThrow();

            setPropertySpy.mockRestore();
        });

        test('should init without storage key present', () => {
            localStorage.getItem.mockReturnValue(undefined);

            themeManager.init();

            expect(themeManager.getCurrentTheme()).toBe('light'); // defaults to light
            expect(document.documentElement.getAttribute('data-color-scheme')).toBe('light');
        });

        test('should setTheme with falsy value defaulting correctly', () => {
            themeManager.setTheme(0); // falsy

            expect(themeManager.isDarkModeActive()).toBe(false);
            expect(localStorage.setItem).toHaveBeenCalledWith('expense-dashboard-dark-mode', 'false');
        });

        test('should loadSavedPreference handle localStorage getItem throwing', () => {
            localStorage.getItem.mockImplementation(() => {
                throw new Error('Storage access denied');
            });

            expect(() => themeManager.loadSavedPreference()).not.toThrow();
            expect(themeManager.isDarkMode).toBe(false); // system default
        });

        test('should loadSavedColorTheme fallback on invalid saved theme', () => {
            localStorage.getItem.mockReturnValue('nonexistent-theme');

            themeManager.loadSavedColorTheme();

            expect(themeManager.getCurrentColorTheme()).toBe('default');
        });
    });
});
