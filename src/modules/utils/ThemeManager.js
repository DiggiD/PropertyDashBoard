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

        this.init();
    }

    /**
     * Initialize theme manager
     */
    init() {
        this.detectSystemPreference();
        this.loadSavedPreference();
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
            console.warn('Failed to save theme preference:', error);
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
        this.isDarkMode = isDark;
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
        const event = new CustomEvent('themeChange', {
            detail: {
                theme: this.getCurrentTheme(),
                isDark: this.isDarkMode,
                colors: this.getCurrentColors(),
            },
        });
        document.dispatchEvent(event);

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
     * Debug theme information
     */
    debug() {
        console.log('[THEME DEBUG] === THEME INFORMATION ===');
        console.log('[THEME DEBUG] Current theme:', this.getCurrentTheme());
        console.log('[THEME DEBUG] Is dark mode:', this.isDarkMode);
        console.log('[THEME DEBUG] Manual override:', this.manualOverride);
        console.log('[THEME DEBUG] System prefers dark:', this.systemPrefersDark);
        console.log('[THEME DEBUG] Current colors:', this.getCurrentColors());
        console.log('[THEME DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
} else {
    window.ThemeManager = ThemeManager;
}
