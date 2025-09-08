import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                localStorage: 'readonly',
                URL: 'readonly',
                Blob: 'readonly',
                FileReader: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                Promise: 'readonly',
                JSON: 'readonly',
                Date: 'readonly',
                Error: 'readonly',
                Array: 'readonly',
                Object: 'readonly',
                String: 'readonly',
                Number: 'readonly',
                Boolean: 'readonly',
                RegExp: 'readonly',
                Map: 'readonly',
                Set: 'readonly',
                // D3.js library
                d3: 'readonly',
                // Dexie library
                Dexie: 'readonly',
                // Browser APIs
                confirm: 'readonly',
                prompt: 'readonly',
                performance: 'readonly',
                PerformanceObserver: 'readonly',
                requestAnimationFrame: 'readonly',
                CustomEvent: 'readonly',
                KeyboardEvent: 'readonly',
                // Module system
                module: 'readonly',
                require: 'readonly',
                // Module classes (will be defined when loaded)
                ModuleLoader: 'readonly',
                Formatter: 'readonly',
                Storage: 'readonly',
                Validator: 'readonly',
                ThemeManager: 'readonly',
                DataManager: 'readonly',
                UIManager: 'readonly',
                HistoryManager: 'readonly',
                EventHandler: 'readonly',
                ChartRenderer: 'readonly',
                App: 'readonly',
                PerformanceOptimizer: 'readonly',
            },
        },
        rules: {
            // Code quality rules
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-console': 'off', // Allow console statements for debugging
            'no-debugger': 'warn',
            'prefer-const': 'error',
            'no-var': 'error',
            'object-shorthand': 'error',
            'prefer-arrow-callback': 'error',

            // Style rules
            'semi': ['error', 'always'],
            'quotes': ['error', 'single'],
            'indent': ['error', 4, { 'SwitchCase': 1 }],
            'comma-dangle': ['error', 'always-multiline'],
            'eol-last': 'error',
            'no-trailing-spaces': 'error',
            'max-len': ['error', { code: 120 }],

            // Best practices
            'eqeqeq': 'error',
            'curly': 'error',
            'default-case': 'error',
            'no-duplicate-imports': 'error',
            'no-template-curly-in-string': 'error',
        },
        ignores: [
            'node_modules/',
            'dist/',
            'build/',
            '*.min.js',
        ],
    },
];
