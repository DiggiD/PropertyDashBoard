/**
 * ThemeManager Module
 * Handles dark/light mode functionality for the expense dashboard
 * - Theme switching
 * - Preference persistence
 * - System preference detection
 * - CSS variable management
 */

class ThemeManager {
    constructor() {
        this.storageKey = 'expense-dashboard-dark-mode';
        this.isDarkMode = false;
        this.systemPrefersDark = false;
        this.manualOverride = false;

        // Theme color schemes
        this.themes = {
            light: {
                background: '#FAFAF7',
                surface: '#FFFFFF',
                text: '#1B2D3B',
                'text-secondary': '#62707B',
                primary: '#218BCD',
                'primary-hover': '#1B7AB8',
                'primary-active': '#1669A3',
                border: '#D4D4D4',
                'card-border': '#E8E8E8',
                success: '#218BCD',
                error: '#C02147',
                warning: '#B87547',
                info: '#62707B',
            },
            dark: {
                background: '#000000',
                surface: '#0a0a0a',
                text: '#F5F5F5',
                'text-secondary': '#B0B7BC',
                primary: '#4FB8E5',
                'primary-hover': '#3DA8D1',
                'primary-active': '#2E8FB8',
                border: '#3D5566',
                'card-border': '#3D5566',
                success: '#4FB8E5',
                error: '#E55B73',
                warning: '#E5A569',
                info: '#B0B7BC',
            },
        };

        // Color themes for charts
        this.colorThemes = {
            default: {
                name: 'Default',
                properties: ['#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B', '#ECEBD5', '#33808D', '#C0152F', '#A84B2F'],
                categories: ['#5D878F', '#DB4545', '#964325', '#13343B', '#33808D', '#A84B2F'],
                trends: {
                    increasing: '#10B981',
                    decreasing: '#EF4444',
                    stable: '#6B7280',
                },
            },
            ocean: {
                name: 'Ocean',
                properties: ['#00A6FB', '#0582CA', '#006994', '#00D4FF', '#90E0EF', '#CAF0F8', '#0077BE', '#023E8A', '#03045E', '#001845'],
                categories: ['#00A6FB', '#0582CA', '#00D4FF', '#CAF0F8', '#023E8A', '#001845'],
                trends: {
                    increasing: '#00A6FB',
                    decreasing: '#EF4444',
                    stable: '#6B7280',
                },
            },
            forest: {
                name: 'Forest',
                properties: ['#2D5016', '#4A7C59', '#6B8F47', '#8FB339', '#A8C66C', '#C4D7A0', '#1B4332', '#2D6A4F', '#40916C', '#52B788'],
                categories: ['#2D5016', '#4A7C59', '#8FB339', '#C4D7A0', '#2D6A4F', '#52B788'],
                trends: {
                    increasing: '#52B788',
                    decreasing: '#EF4444',
                    stable: '#6B7280',
                },
            },
            sunset: {
                name: 'Sunset',
                properties: ['#FF6B35', '#F7931E', '#FFD23F', '#FF8C42', '#FFA366', '#FFB380', '#E85D04', '#DC2F02', '#D00000', '#9D0208'],
                categories: ['#FF6B35', '#F7931E', '#FF8C42', '#FFB380', '#DC2F02', '#9D0208'],
                trends: {
                    increasing: '#FFD23F',
                    decreasing: '#D00000',
                    stable: '#6B7280',
                },
            },
            monochrome: {
                name: 'Monochrome',
                properties: ['#2C2C2C', '#404040', '#5A5A5A', '#737373', '#8F8F8F', '#A6A6A6', '#BEBEBE', '#D4D4D4', '#E8E8E8', '#F5F5F5'],
                categories: ['#2C2C2C', '#404040', '#737373', '#A6A6A6', '#D4D4D4', '#F5F5F5'],
                trends: {
                    increasing: '#8F8F8F',
                    decreasing: '#404040',
                    stable: '#A6A6A6',
                },
            },
            vibrant: {
                name: 'Vibrant',
                properties: ['#FF0080', '#00FF80', '#8000FF', '#FF8000', '#00FF00', '#0080FF', '#FF00FF', '#FFFF00', '#00FFFF', '#FF4040'],
                categories: ['#FF0080', '#00FF80', '#FF8000', '#0080FF', '#FFFF00', '#FF4040'],
                trends: {
                    increasing: '#00FF80',
                    decreasing: '#FF4040',
                    stable: '#FFFF00',
                },
            },
            neon: {
                name: 'Neon',
                properties: ['#FF073A', '#39FF14', '#FF6600', '#00FFFF', '#FF00FF', '#FFFF00', '#FF6B35', '#4DEEEA', '#74EE15', '#F000FF'],
                categories: ['#FF073A', '#39FF14', '#00FFFF', '#FFFF00', '#4DEEEA', '#F000FF'],
                trends: {
                    increasing: '#39FF14',
                    decreasing: '#FF073A',
                    stable: '#FFFF00',
                },
            },
            viridis: {
                name: 'Viridis',
                properties: ['#440154', '#481567', '#482677', '#453781', '#404788', '#39568c', '#33638d', '#2d708e', '#25848e', '#21918c', '#1e9b8a', '#22a884', '#2fb47c', '#35b779', '#3cbc75', '#42be71', '#4ec36b', '#5cc863', '#67cc5c', '#73d055', '#7fd34e', '#8bd646', '#95d840', '#a0da39', '#acdc30', '#b5de2b', '#bfdf26', '#c8e020', '#d2e21b', '#dde318', '#e6e419', '#efe51c', '#f5e61a', '#fde725'],
                categories: ['#440154', '#481567', '#453781', '#39568c', '#2d708e', '#21918c'],
                trends: {
                    increasing: '#fde725',
                    decreasing: '#440154',
                    stable: '#21918c',
                },
            },
            inferno: {
                name: 'Inferno',
                properties: ['#000004', '#0c0927', '#1d1147', '#320a5e', '#460b5e', '#58146d', '#6b186e', '#7e1e6c', '#921569', '#a52c60', '#b73757', '#ca4240', '#dd513a', '#ed6b3d', '#f5844c', '#f69c73', '#f7b799', '#f8d1a4', '#f9e6b7', '#f9f9c7', '#fcffa4'],
                categories: ['#000004', '#0c0927', '#320a5e', '#58146d', '#7e1e6c', '#a52c60'],
                trends: {
                    increasing: '#fcffa4',
                    decreasing: '#000004',
                    stable: '#781c6d',
                },
            },
            magma: {
                name: 'Magma',
                properties: ['#000004', '#0c0927', '#1f0c47', '#3b0f70', '#56106e', '#71136d', '#8c1a64', '#a61e4d', '#bf3633', '#d6522b', '#e76f24', '#f58c46', '#f7a873', '#f9c5a6', '#fae1c3', '#fbf6d9', '#fcfdbf'],
                categories: ['#000004', '#0c0927', '#3b0f70', '#71136d', '#a61e4d', '#d6522b'],
                trends: {
                    increasing: '#fcfdbf',
                    decreasing: '#000004',
                    stable: '#b0367a',
                },
            },
            plasma: {
                name: 'Plasma',
                properties: ['#0d0887', '#2a0593', '#41049d', '#5601a4', '#6a00a8', '#7e03a8', '#8f0da4', '#a11a9b', '#b12a90', '#bf3984', '#cc4778', '#d6556d', '#e16462', '#ea7457', '#f2844b', '#f69c3e', '#f7b432', '#f9cc26', '#f0f921'],
                categories: ['#0d0887', '#2a0593', '#5601a4', '#7e03a8', '#a11a9b', '#cc4778'],
                trends: {
                    increasing: '#f0f921',
                    decreasing: '#0d0887',
                    stable: '#cc4778',
                },
            },
            cividis: {
                name: 'Cividis',
                properties: ['#002051', '#003f5c', '#1d5b6a', '#3a7575', '#58907d', '#76ab82', '#95c684', '#b5e08a', '#d6fa91', '#f6f6f6'],
                categories: ['#002051', '#003f5c', '#3a7575', '#76ab82', '#b5e08a', '#f6f6f6'],
                trends: {
                    increasing: '#f6f6f6',
                    decreasing: '#002051',
                    stable: '#7e7e7e',
                },
            },
            turbo: {
                name: 'Turbo',
                properties: ['#23171b', '#2c1b1d', '#351f1f', '#3f2321', '#482723', '#512b25', '#5b2f27', '#643329', '#6d372b', '#763b2d', '#7f3f2f', '#884331', '#914733', '#9a4b35', '#a34f37', '#ac5339', '#b5573b', '#be5b3d', '#c75f3f', '#d06341', '#d96743', '#e26b45', '#eb6f47', '#f47349', '#fd774b', '#ff7b4d', '#ff7f4f', '#ff8351', '#ff8753', '#ff8b55', '#ff8f57', '#ff9359', '#ff975b', '#ff9b5d', '#ff9f5f', '#ffa361', '#ffa763', '#ffab65', '#ffaf67', '#ffb369', '#ffb76b', '#ffbb6d', '#ffbf6f', '#ffc371', '#ffc773', '#ffcb75', '#ffcf77', '#ffd379', '#ffd77b', '#ffdb7d', '#ffdf7f', '#ffe381', '#ffe783', '#ffeb85', '#ffef87', '#fff389', '#fff78b', '#fffb8d', '#ffff8f', '#ffff91', '#ffff93', '#ffff95', '#ffff97', '#ffff99'],
                categories: ['#23171b', '#2c1b1d', '#3f2321', '#512b25', '#643329', '#763b2d'],
                trends: {
                    increasing: '#ffff99',
                    decreasing: '#23171b',
                    stable: '#ff6b35',
                },
            },
            blues: {
                name: 'Blues',
                properties: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
                categories: ['#f7fbff', '#deebf7', '#c6dbef', '#6baed6', '#2171b5', '#08306b'],
                trends: {
                    increasing: '#f7fbff',
                    decreasing: '#08306b',
                    stable: '#6baed6',
                },
            },
            greens: {
                name: 'Greens',
                properties: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
                categories: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#74c476', '#238b45', '#00441b'],
                trends: {
                    increasing: '#f7fcf5',
                    decreasing: '#00441b',
                    stable: '#74c476',
                },
            },
            oranges: {
                name: 'Oranges',
                properties: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
                categories: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fd8d3c', '#d94801', '#7f2704'],
                trends: {
                    increasing: '#fff5eb',
                    decreasing: '#7f2704',
                    stable: '#fd8d3c',
                },
            },
            purples: {
                name: 'Purples',
                properties: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
                categories: ['#fcfbfd', '#efedf5', '#dadaeb', '#9e9ac8', '#6a51a3', '#3f007d'],
                trends: {
                    increasing: '#fcfbfd',
                    decreasing: '#3f007d',
                    stable: '#9e9ac8',
                },
            },
            reds: {
                name: 'Reds',
                properties: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
                categories: ['#fff5f0', '#fee0d2', '#fcbba1', '#fb6a4a', '#cb181d', '#67000d'],
                trends: {
                    increasing: '#fff5f0',
                    decreasing: '#67000d',
                    stable: '#fb6a4a',
                },
            },
        };

        // Current color theme
        this.currentColorTheme = 'default';
        this.colorThemeStorageKey = 'expense-dashboard-color-theme';

        this.init();
    }

    /**
     * Initialize theme manager
     */
    init() {
        this.detectSystemPreference();
        this.loadSavedPreference();
        this.loadSavedColorTheme();
        this.applyCurrentTheme();
        this.setupSystemPreferenceListener();
    }

    /**
     * Detect system color scheme preference
     */
    detectSystemPreference() {
        if (window.matchMedia) {
            this.systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
    }

    /**
     * Set up listener for system preference changes
     */
    setupSystemPreferenceListener() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                this.systemPrefersDark = e.matches;

                // Only auto-switch if user hasn't manually set a preference
                if (!this.manualOverride) {
                    this.isDarkMode = this.systemPrefersDark;
                    this.applyCurrentTheme();
                    this.notifyThemeChange();
                }
            });
        }
    }

    /**
     * Load saved theme preference from localStorage
     */
    loadSavedPreference() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved === 'true') {
                this.isDarkMode = true;
                this.manualOverride = true;
            } else if (saved === 'false') {
                this.isDarkMode = false;
                this.manualOverride = true;
            } else {
                // No saved preference, use system preference
                this.isDarkMode = this.systemPrefersDark;
                this.manualOverride = false;
            }
        } catch (error) {
            console.warn('Failed to load theme preference:', error);
            this.isDarkMode = this.systemPrefersDark;
        }
    }

    /**
     * Save current theme preference to localStorage
     */
    savePreference() {
        try {
            localStorage.setItem(this.storageKey, this.isDarkMode.toString());
        } catch (error) {
            console.error('Save failed');
        }
    }

    /**
     * Toggle between dark and light mode
     */
    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        this.manualOverride = true;
        this.applyCurrentTheme();
        this.savePreference();
        this.notifyThemeChange();

        return this.isDarkMode;
    }

    /**
     * Set theme explicitly
     * @param {boolean} isDark - Whether to set dark mode
     */
    setTheme(isDark) {
        this.isDarkMode = !!isDark;
        this.manualOverride = true;
        this.applyCurrentTheme();
        this.savePreference();
        this.notifyThemeChange();
    }

    /**
     * Apply current theme to the document
     */
    applyCurrentTheme() {
        const theme = this.isDarkMode ? 'dark' : 'light';
        const colors = this.themes[theme];

        // Set data attribute for CSS
        document.documentElement.setAttribute('data-color-scheme', theme);

        // Update CSS custom properties
        Object.entries(colors).forEach(([property, value]) => {
            const cssProperty = `--color-${property}`;
            document.documentElement.style.setProperty(cssProperty, value);
        });

        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(colors.primary);

        console.log(`[THEME] Applied ${theme} theme`);
    }

    /**
     * Update meta theme-color for mobile browsers
     * @param {string} color - Theme color
     */
    updateMetaThemeColor(color) {
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.content = color;
    }

    /**
     * Get current theme name
     * @returns {string} 'light' or 'dark'
     */
    getCurrentTheme() {
        return this.isDarkMode ? 'dark' : 'light';
    }

    /**
     * Check if dark mode is currently active
     * @returns {boolean} Whether dark mode is active
     */
    isDarkModeActive() {
        return this.isDarkMode;
    }

    /**
     * Get theme colors for current theme
     * @returns {Object} Color scheme object
     */
    getCurrentColors() {
        return this.themes[this.getCurrentTheme()];
    }

    /**
     * Get specific color value
     * @param {string} colorName - Color name (e.g., 'primary', 'background')
     * @returns {string} Color value
     */
    getColor(colorName) {
        const colors = this.getCurrentColors();
        return colors[colorName] || colors.primary;
    }

    /**
     * Reset to system preference
     */
    resetToSystemPreference() {
        this.manualOverride = false;
        this.isDarkMode = this.systemPrefersDark;
        this.applyCurrentTheme();
        this.savePreference();
        this.notifyThemeChange();
    }

    /**
     * Check if manual override is active
     * @returns {boolean} Whether manual override is active
     */
    hasManualOverride() {
        return this.manualOverride;
    }

    /**
     * Get theme information for UI display
     * @returns {Object} Theme info for UI
     */
    getThemeInfo() {
        return {
            current: this.getCurrentTheme(),
            isDark: this.isDarkMode,
            manualOverride: this.manualOverride,
            systemPrefersDark: this.systemPrefersDark,
            colors: this.getCurrentColors(),
        };
    }

    /**
     * Notify listeners of theme change
     */
    notifyThemeChange() {
        // Dispatch custom event for other modules to listen to
        try {
            const event = new CustomEvent('themeChange', {
                detail: {
                    theme: this.getCurrentTheme(),
                    isDark: this.isDarkMode,
                    colors: this.getCurrentColors(),
                },
                bubbles: true,
                cancelable: true,
            });
            document.dispatchEvent(event);
        } catch (error) {
            // Fallback for environments that don't support CustomEvent
            console.warn('[THEME] CustomEvent not supported, using fallback notification');
        }

        // Call any registered callbacks
        if (this.onThemeChange) {
            this.onThemeChange(this.getThemeInfo());
        }
    }

    /**
     * Register theme change callback
     * @param {Function} callback - Callback function
     */
    onThemeChangeCallback(callback) {
        this.onThemeChange = callback;
    }

    /**
     * Get CSS class for theme-aware elements
     * @param {string} baseClass - Base CSS class
     * @returns {string} Theme-aware CSS class
     */
    getThemeClass(baseClass) {
        const theme = this.getCurrentTheme();
        return `${baseClass} ${baseClass}--${theme}`;
    }

    /**
     * Apply theme to specific element
     * @param {HTMLElement} element - Element to apply theme to
     * @param {Object} customColors - Custom colors to apply
     */
    applyThemeToElement(element, customColors = null) {
        if (!element) {return;}

        const colors = customColors || this.getCurrentColors();

        Object.entries(colors).forEach(([property, value]) => {
            element.style.setProperty(`--color-${property}`, value);
        });
    }

    /**
     * Create theme-aware CSS for dynamic content
     * @param {string} css - CSS string with theme variables
     * @returns {string} CSS with resolved theme values
     */
    resolveThemeVariables(css) {
        const colors = this.getCurrentColors();
        let resolvedCss = css;

        Object.entries(colors).forEach(([property, value]) => {
            const regex = new RegExp(`var\\(--color-${property}\\)`, 'g');
            resolvedCss = resolvedCss.replace(regex, value);
        });

        return resolvedCss;
    }

    /**
     * Export current theme settings
     * @returns {Object} Theme export data
     */
    exportThemeSettings() {
        return {
            currentTheme: this.getCurrentTheme(),
            isDarkMode: this.isDarkMode,
            manualOverride: this.manualOverride,
            systemPrefersDark: this.systemPrefersDark,
            colors: this.getCurrentColors(),
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Import theme settings
     * @param {Object} settings - Theme settings to import
     */
    importThemeSettings(settings) {
        if (!settings) {return;}

        if (settings.manualOverride !== undefined) {
            this.manualOverride = settings.manualOverride;
        }

        if (settings.isDarkMode !== undefined) {
            this.isDarkMode = settings.isDarkMode;
            this.applyCurrentTheme();
            this.savePreference();
            this.notifyThemeChange();
        }
    }

    /**
     * Get theme transition duration for smooth transitions
     * @returns {string} CSS transition duration
     */
    getTransitionDuration() {
        return '250ms';
    }

    /**
     * Check if theme transition is supported
     * @returns {boolean} Whether transitions are supported
     */
    supportsTransitions() {
        return window.getComputedStyle &&
               'transition' in document.documentElement.style;
    }

    /**
     * Get theme-aware icon name
     * @param {string} iconName - Base icon name
     * @returns {string} Theme-aware icon name
     */
    getThemeIcon(iconName) {
        const theme = this.getCurrentTheme();
        return `${iconName}-${theme}`;
    }

    /**
     * Load theme preferences (alias for loadSavedPreference)
     * @returns {Promise<void>}
     */
    async loadPreferences() {
        // Preferences are already loaded in constructor via loadSavedPreference
        console.log('[THEME] Theme preferences loaded');
    }

    /**
     * Initialize the theme manager
     * @returns {Promise<void>}
     */
    async initialize() {
        // Theme manager initialization is already done in constructor
        console.log('[THEME] Theme manager initialized');
    }

    /**
     * Load saved color theme preference from localStorage
     */
    loadSavedColorTheme() {
        try {
            const saved = localStorage.getItem(this.colorThemeStorageKey);
            if (saved && this.colorThemes[saved]) {
                this.currentColorTheme = saved;
            } else {
                this.currentColorTheme = 'default';
            }
        } catch (error) {
            console.warn('Failed to load color theme preference:', error);
            this.currentColorTheme = 'default';
        }
    }

    /**
     * Save current color theme preference to localStorage
     */
    saveColorThemePreference() {
        try {
            localStorage.setItem(this.colorThemeStorageKey, this.currentColorTheme);
        } catch (error) {
            console.warn('Failed to save color theme preference:', error);
        }
    }

    /**
     * Set color theme
     * @param {string} themeName - Name of the color theme
     */
    setColorTheme(themeName) {
        if (!this.colorThemes[themeName]) {
            console.warn(`[THEME] Color theme '${themeName}' not found, using default`);
            themeName = 'default';
        }

        this.currentColorTheme = themeName;
        this.saveColorThemePreference();
        this.notifyColorThemeChange();

        console.log(`[THEME] Color theme changed to: ${themeName}`);
    }

    /**
     * Get current color theme
     * @returns {string} Current color theme name
     */
    getCurrentColorTheme() {
        return this.currentColorTheme;
    }

    /**
     * Get color theme data
     * @param {string} themeName - Optional theme name, uses current if not provided
     * @returns {Object} Color theme data
     */
    getColorTheme(themeName = null) {
        const theme = themeName || this.currentColorTheme;
        return this.colorThemes[theme] || this.colorThemes.default;
    }

    /**
     * Get available color themes
     * @returns {Object} All available color themes
     */
    getAvailableColorThemes() {
        return this.colorThemes;
    }

    /**
     * Get color theme names for UI
     * @returns {Array} Array of theme objects with id and name
     */
    getColorThemeOptions() {
        return Object.entries(this.colorThemes).map(([id, theme]) => ({
            id,
            name: theme.name,
        }));
    }

    /**
     * Notify listeners of color theme change
     */
    notifyColorThemeChange() {
        // Dispatch custom event for other modules to listen to
        try {
            const event = new CustomEvent('colorThemeChange', {
                detail: {
                    theme: this.currentColorTheme,
                    colors: this.getColorTheme(),
                },
                bubbles: true,
                cancelable: true,
            });
            document.dispatchEvent(event);
        } catch (error) {
            // Fallback for environments that don't support CustomEvent
            console.warn('[THEME] CustomEvent not supported, using fallback notification');
        }

        // Call any registered callbacks
        if (this.onColorThemeChange) {
            this.onColorThemeChange({
                theme: this.currentColorTheme,
                colors: this.getColorTheme(),
            });
        }
    }

    /**
     * Register color theme change callback
     * @param {Function} callback - Callback function
     */
    onColorThemeChangeCallback(callback) {
        this.onColorThemeChange = callback;
    }

    /**
     * Get chart colors for current color theme
     * @returns {Object} Chart color configuration
     */
    getChartColors() {
        return this.getColorTheme();
    }

    /**
     * Export color theme settings
     * @returns {Object} Color theme export data
     */
    exportColorThemeSettings() {
        return {
            currentColorTheme: this.currentColorTheme,
            colorThemes: this.colorThemes,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Import color theme settings
     * @param {Object} settings - Color theme settings to import
     */
    importColorThemeSettings(settings) {
        if (!settings) {return;}

        if (settings.currentColorTheme && this.colorThemes[settings.currentColorTheme]) {
            this.currentColorTheme = settings.currentColorTheme;
            this.saveColorThemePreference();
            this.notifyColorThemeChange();
        }
    }

    /**
     * Debug theme information
     */
    debug() {
        console.log('[THEME DEBUG] === THEME INFORMATION ===');
        console.log('[THEME DEBUG] Current theme:', this.getCurrentTheme());
        console.log('[THEME DEBUG] Is dark mode:', this.isDarkMode);
        console.log('[THEME DEBUG] Manual override:', this.manualOverride);
        console.log('[THEME DEBUG] System prefers dark:', this.systemPrefersDark);
        console.log('[THEME DEBUG] Current colors:', this.getCurrentColors());
        console.log('[THEME DEBUG] Current color theme:', this.currentColorTheme);
        console.log('[THEME DEBUG] Color theme data:', this.getColorTheme());
        console.log('[THEME DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
export default ThemeManager;

// Expose globally for Babel standalone transpilation
window.ThemeManager = ThemeManager;
