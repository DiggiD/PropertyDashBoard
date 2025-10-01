// filepath: src/__mocks__/ThemeManager.js

class MockThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.themes = {
            light: {
                primary: '#059669',
                secondary: '#DC2626',
                accent: '#F59E0B',
                background: '#FFFFFF',
                text: '#111827',
                darkBg: '#111827',
                darkText: '#F9FAFB',
            },
            dark: {
                primary: '#059669',
                secondary: '#DC2626',
                accent: '#F59E0B',
                background: '#111827',
                text: '#F9FAFB',
                darkBg: '#FFFFFF',
                darkText: '#111827',
            },
        };
    }

    getColorTheme() {
        return this.themes[this.currentTheme];
    }

    applyTheme(container) {
        console.log('Theme applied to', container);
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    }

    toggleDarkMode() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    getCurrentColorTheme() {
        return this.currentTheme;
    }

    setTheme(themeName) {
        if (themeName === 'light' || themeName === 'dark') {
            this.currentTheme = themeName;
        }
    }

    async initialize() {
        console.log('[THEME] ThemeManager initialized');
    }

    loadPreferences() {
    // no-op
    }

    cleanup() {
    // no-op
    }
}

export default MockThemeManager;
