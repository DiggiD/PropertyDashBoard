/**
 * UIManager Module
 * Handles all DOM manipulation and UI state management
 * - Element selection and manipulation
 * - UI state updates and synchronization
 * - Modal management
 * - Loading states and error displays
 * - Responsive UI updates
 */

class UIManager {
    constructor(formatter, themeManager) {
        // Dependency injection with fallbacks
        this.formatter = formatter || {
            formatCurrency: (value) => `$${value}`,
            formatDate: (date) => date.toISOString().split('T')[0],
            formatNumber: (num) => num.toString()
        };

        // Singleton fallback for ThemeManager
        if (themeManager) {
            this.themeManager = themeManager;
        } else {
            // Create fallback ThemeManager if not provided
            this.themeManager = this.createFallbackThemeManager();
        }

        this.elements = new Map();
        this.initialized = false;

        // UI state
        this.currentView = 'overview';
        this.isLoading = false;
        this.activeModals = new Set();

        // Year picker state persistence
        this.selectedYear = null;
        this.selectedMonth = null;

        // Event listeners cache for cleanup
        this.eventListeners = new Map();

        this._initialized = false;  // Prevent multiple initializations

        console.log('[UI] UIManager initialized');
    }

    /**
     * Create fallback ThemeManager when none is provided
     * @returns {Object} Fallback theme manager with minimal interface
     */
    createFallbackThemeManager() {
        return {
            isDarkModeActive: () => false,
            getColorTheme: (name) => ({ name: name || 'Default' }),
            getColorThemeOptions: () => [{ id: 'default', name: 'Default' }],
            getCurrentColorTheme: () => 'default',
            setColorTheme: (theme) => console.log(`[FALLBACK THEME] Setting color theme to: ${theme}`),
            toggleDarkMode: () => console.log('[FALLBACK THEME] Toggling dark mode'),
        };
    }

    /**
     * Initialize UI manager (idempotent)
     */
    async initialize() {
        if (this.initialized) {
            console.log('[UI] UI manager already initialized, skipping');
            return;
        }

        this.initialized = true; // Mark as initialized early to prevent re-entry

        await new Promise(r => setTimeout(r, 0)); // DOM ready
        const commonIds = ['chart-container', 'tooltip', 'app'];
        for (const id of commonIds) {
            this.elements.set(id, document.getElementById(id) || document.createElement('div'));
        }

        this.cacheElements();
        this.setupEventListeners();
        this.initializeUIState();

        console.log('[UI] UI manager initialized with', this.elements.size, 'cached elements');
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        const elementSelectors = {
            // Main containers
            'appContainer': '.app-container',
            'mainContent': '.main-content',
            'dashboardContainers': '.dashboard-containers',

            // Dashboard views
            'overviewDashboard': '#overviewDashboard',
            'propertiesDashboard': '#propertiesDashboard',

            // Chart containers
            'overviewChart': '#overviewChart',
            'overviewChartContent': '#overviewChartContent',

            // Buttons
            'undoBtn': '#undoBtn',
            'redoBtn': '#redoBtn',
            'darkModeToggle': '#darkModeToggle',
            'historyBtn': '#historyBtn',

            // Color theme dropdown
            'colorThemeDropdown': '#colorThemeDropdown',
            'colorThemeBtn': '#colorThemeBtn',
            'colorThemeMenu': '#colorThemeMenu',

            // Year picker
            'yearPicker': '#yearPicker',
            'yearPickerHeader': '#yearPickerHeader',
            'monthPicker': '#monthPicker',
            'monthPickerHeader': '#monthPickerHeader',

            // Summary buttons
            'overviewBtn': '#overviewBtn',
            'propertiesBtn': '#propertiesBtn',

            // Modals
            'importModal': '#importModal',

            // Modal elements
            'importData': '#importData',

            // Detail panel
            'detailPanel': '#detailPanel',
            'detailTitle': '#detailTitle',
            'detailContent': '#detailContent',
            'closeDetailPanel': '#closeDetailPanel',

            // Toast
            'toast': '#toast',
            'toastMessage': '#toastMessage',

            // Loading states
            'overviewLoadingState': '#overviewLoadingState',
        };

        // Store selectors for fallback
        this.elementSelectors = new Map();
        Object.entries(elementSelectors).forEach(([key, selector]) => {
            this.elementSelectors.set(key, selector);
        });

        // Cache elements
        Object.entries(elementSelectors).forEach(([key, selector]) => {
            const element = document.querySelector(selector);
            if (element) {
                this.elements.set(key, element);
            }
            // Removed console.warn to eliminate element not found warnings
        });
    }

    /**
     * Get cached element with resilience
     * @param {string} id - Element id
     * @param {boolean} createIfMissing - Whether to create element if missing
     * @returns {HTMLElement} DOM element
     */
    getElement(id, createIfMissing = false) {
        if (!this.elements) { this.elements = new Map(); }
        let el = this.elements.get(id);
        if (!el) {
            el = document.getElementById(id) || document.querySelector(`#${id}`);
            if (!el && createIfMissing) { el = document.createElement('div'); el.id = id; el.style.display = 'none'; document.body.appendChild(el); }
            if (el) this.elements.set(id, el); else { console.warn(`UI Element '${id}' missing; creating fallback.`); el = this.createFallbackElement(id); this.elements.set(id, el); }
        }
        return el;
    }

    /**
     * Create fallback element for missing DOM elements
     * @param {string} id - Element id
     * @returns {HTMLElement} Fallback element
     */
    createFallbackElement(id) {
        switch(id) {
            case 'chart-container':
                return document.createElement('div', {id, style: 'width:100%; height:600px; border:1px solid #ccc;'});
            case 'tooltip':
                return document.createElement('div', {id, style: 'position:fixed; opacity:0; background:white; border:1px solid #000; padding:8px; pointer-events:none; z-index:1000;'});
            default:
                return document.createElement('div');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.eventListeners.size > 0) {
            console.log('[UI] Event listeners already set up, skipping');
            return;
        }

        // Keyboard navigation
        this.addEventListener(document, 'keydown', this.handleKeydown.bind(this));

        // Window resize
        this.addEventListener(window, 'resize', this.handleResize.bind(this));

        // Theme change listener
        this.addEventListener(document, 'themeChange', this.handleThemeChange.bind(this));

        // Color theme change listener
        this.addEventListener(document, 'colorThemeChange', this.handleColorThemeChange.bind(this));

        console.log('[UI] Event listeners setup complete');
    }

    /**
     * Add event listener with cleanup tracking
     * @param {HTMLElement} element - Target element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    addEventListener(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);

        // Track for cleanup
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, new Map());
        }
        this.eventListeners.get(element).set(event, handler);
    }

    /**
     * Remove event listener
     * @param {HTMLElement} element - Target element
     * @param {string} event - Event type
     */
    removeEventListener(element, event) {
        const elementListeners = this.eventListeners.get(element);
        if (elementListeners && elementListeners.has(event)) {
            const handler = elementListeners.get(event);
            element.removeEventListener(event, handler);
            elementListeners.delete(event);
        }
    }

    /**
     * Initialize UI state
     */
    initializeUIState() {
        // Set initial view
        this.setCurrentView('overview');

        // Update button states
        this.updateUndoRedoButtons(false, false);
        try { this.updateThemeToggle(); } catch(e) { console.error('Theme init failed:', e); this.setDefaultTheme(); } // Fallback: document.documentElement.setAttribute('data-theme', 'light');

        // Setup color theme dropdown
        this.setupColorThemeDropdown();

        // Hide loading states
        this.hideLoadingState();
    }

    /**
     * Setup initial state (alias for initializeUIState)
     * @returns {Promise<void>}
     */
    async setupInitialState() {
        if (this.initialized) {
            console.log('[UI] Initial state already set up, skipping');
            return;
        }
        this.initializeUIState();
        console.log('[UI] Initial state setup complete');
    }

    /**
     * Set current view
     * @param {string} view - View name
     */
    setCurrentView(view) {
        this.currentView = view;

        // Update sidebar selection state
        this.updateSidebarSelection(view);

        // Hide all dashboards
        this.hideAllDashboards();

        // Show selected dashboard
        this.showDashboard(view);

        console.log(`[UI] Switched to view: ${view}`);
    }



    /**
     * Hide all dashboards
     */
    hideAllDashboards() {
        const dashboards = ['overviewDashboard', 'propertiesDashboard'];

        dashboards.forEach(dashboardKey => {
            const dashboard = this.getElement(dashboardKey);
            if (dashboard) {
                // Remove focus from any focused elements inside the dashboard before hiding
                const focusedElement = dashboard.querySelector(':focus');
                if (focusedElement) {
                    // Move focus to a safe element before hiding
                    const mainContent = this.getElement('mainContent');
                    if (mainContent) {
                        mainContent.focus();
                    } else {
                        // Fallback: blur the focused element
                        focusedElement.blur();
                    }
                }

                dashboard.classList.add('hidden');
                dashboard.setAttribute('aria-hidden', 'true');
            }
        });
    }

    /**
     * Show specific dashboard
     * @param {string} view - View name
     */
    showDashboard(view) {
        const dashboardMap = {
            'overview': 'overviewDashboard',
            'properties': 'propertiesDashboard',
        };

        const dashboardKey = dashboardMap[view];
        if (dashboardKey) {
            const dashboard = this.getElement(dashboardKey);
            if (dashboard) {
                dashboard.classList.remove('hidden');
                dashboard.setAttribute('aria-hidden', 'false');

                // Focus management
                const focusableElement = dashboard.querySelector('button, [tabindex]:not([tabindex="-1"])');
                if (focusableElement) {
                    setTimeout(() => focusableElement.focus(), 100);
                }
            }
        }
    }

    /**
     * Show element by key
     * @param {string} elementKey - Element key
     */
    showElement(elementKey) {
        const element = this.getElement(elementKey);
        if (element) {
            element.classList.remove('hidden');
            element.style.display = '';
            element.setAttribute('aria-hidden', 'false');
            console.log(`[UI] Element shown: ${elementKey}`);
        }
    }

    /**
     * Hide element by key
     * @param {string} elementKey - Element key
     */
    hideElement(elementKey) {
        const element = this.getElement(elementKey);
        if (element) {
            element.classList.add('hidden');
            element.style.display = 'none';
            console.log(`[UI] Element hidden: ${elementKey}`);
        }
    }

    /**
     * Update sidebar selection state
     * @param {string} activeView - Active view name
     */
    updateSidebarSelection(activeView) {
        // Clear all data-active attributes first
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(item => {
            item.removeAttribute('data-active');
        });

        // Set data-active for the selected view
        const viewMap = {
            'overview': 'overviewBtn',
            'properties': 'propertiesBtn'
        };

        const buttonId = viewMap[activeView];
        if (buttonId) {
            const button = document.getElementById(buttonId);
            if (button) {
                button.setAttribute('data-active', 'true');
            }
        }

        console.log(`[UI] Sidebar selection updated: ${activeView}`);
    }

    /**
     * Update navigation state
     * @param {string} activeView - Active view name
     */
    updateNavigationState(activeView) {
        console.log(`[UI] Navigation state updated: ${activeView}`);
    }

    /**
     * Update data display after data loading
     * @param {Object} stats - Data statistics
     */
    updateDataDisplay(stats = {}) {
        console.log('[UI] Updating data display with stats:', stats);

        // Show success message if data loaded
        if (stats.totalProperties > 0) {
            this.showToast(`Loaded ${stats.totalProperties} properties with ${stats.totalCategories} categories`, 'success', 3000);
        } else {
            this.showToast('No data loaded', 'warning', 3000);
        }

        // Force UI refresh
        this.hideLoadingState();

        console.log('[UI] Data display updated');
    }

    /**
     * Populate year picker with available years
     * @param {Array} availableYears - Array of available years
     * @param {boolean} includeAll - Whether to include "ALL" option
     * @param {string} selectedYear - Currently selected year (for compact mode)
     */
    populateYearPicker(availableYears, includeAll = true, selectedYear = null) {
        const yearPickerHeader = this.getElement('yearPickerHeader');
        if (!yearPickerHeader) {
            console.warn('[UI] Year picker header not found');
            return;
        }

        // Clear existing year picker items
        yearPickerHeader.innerHTML = '';

        // Use stored selected year if available and valid, otherwise use last available year from database
        if (selectedYear === null) {
            if (this.selectedYear && availableYears && availableYears.includes(this.selectedYear)) {
                // Use previously selected year if it's still available
                selectedYear = this.selectedYear;
            } else if (availableYears && availableYears.length > 0) {
                // Sort years in descending order and pick the most recent (last) year
                const sortedYears = [...availableYears].sort((a, b) => parseInt(b) - parseInt(a));
                selectedYear = sortedYears[0].toString();
                // Update stored year to the new default
                this.selectedYear = selectedYear;
            } else {
                // Fallback to current year if no available years
                selectedYear = new Date().getFullYear().toString();
                this.selectedYear = selectedYear;
            }
        }

        // Show ALL option only for overview dashboard (sankey)
        const showAllOption = this.currentView === 'overview';

        if (showAllOption) {
            // Create combined year picker with ALL option and compact navigation
            this.createCombinedYearPicker(yearPickerHeader, availableYears, selectedYear);
        } else {
            // Create compact year picker without ALL option
            this.createCompactYearPicker(yearPickerHeader, availableYears, selectedYear);
        }

        // Ensure the selected year is properly highlighted
        this.handleYearSelection(selectedYear);

        console.log(`[UI] Populated year picker with selected year: ${selectedYear}, stored: ${this.selectedYear}, showAll: ${showAllOption}, availableYears:`, availableYears);
    }

    /**
     * Create combined year picker with ALL option and compact navigation
     * @param {HTMLElement} container - Container element
     * @param {Array} availableYears - Array of available years
     * @param {string} selectedYear - Currently selected year
     */
    createCombinedYearPicker(container, availableYears, selectedYear) {
        // Create ALL button
        const allButton = document.createElement('button');
        allButton.className = 'year-picker-item';
        allButton.setAttribute('data-year', 'all');
        allButton.textContent = 'ALL';
        allButton.addEventListener('click', () => this.handleYearSelection('all'));
        container.appendChild(allButton);

        // Create compact navigation section
        this.createCompactYearPicker(container, availableYears, selectedYear);
    }

    /**
     * Create compact year picker with single year and navigation arrows
     * @param {HTMLElement} container - Container element
     * @param {Array} availableYears - Array of available years
     * @param {string} selectedYear - Currently selected year
     */
    createCompactYearPicker(container, availableYears, selectedYear) {
        // Handle null/undefined availableYears
        if (!availableYears || !Array.isArray(availableYears) || availableYears.length === 0) {
            console.warn('[UI] No available years provided for compact year picker');
            return;
        }

        // Find current year index in available years
        const currentIndex = availableYears.indexOf(selectedYear);
        const hasPrevious = currentIndex > 0;
        const hasNext = currentIndex < availableYears.length - 1;

        // Create left arrow
        const leftArrow = document.createElement('button');
        leftArrow.className = 'year-nav-arrow year-nav-left';
        leftArrow.innerHTML = '‹';
        leftArrow.setAttribute('aria-label', 'Previous year');
        if (hasPrevious) {
            leftArrow.addEventListener('click', () => {
                const prevYear = availableYears[currentIndex - 1];
                this.populateYearPicker(availableYears, true, prevYear);
                // Year is automatically selected in populateYearPicker
            });
        } else {
            leftArrow.disabled = true;
            leftArrow.style.opacity = '0.3';
        }
        container.appendChild(leftArrow);

        // Create year button
        const yearButton = document.createElement('button');
        yearButton.className = 'year-picker-item selected';
        yearButton.setAttribute('data-year', selectedYear);
        yearButton.textContent = selectedYear;
        yearButton.addEventListener('click', () => this.handleYearSelection(selectedYear));
        container.appendChild(yearButton);

        // Create right arrow
        const rightArrow = document.createElement('button');
        rightArrow.className = 'year-nav-arrow year-nav-right';
        rightArrow.innerHTML = '›';
        rightArrow.setAttribute('aria-label', 'Next year');
        if (hasNext) {
            rightArrow.addEventListener('click', () => {
                const nextYear = availableYears[currentIndex + 1];
                this.populateYearPicker(availableYears, true, nextYear);
                // Year is automatically selected in populateYearPicker
            });
        } else {
            rightArrow.disabled = true;
            rightArrow.style.opacity = '0.3';
        }
        container.appendChild(rightArrow);
    }

    /**
     * Populate month picker with available months
     * @param {boolean} includeAll - Whether to include "ALL" option
     * @param {number} centerMonth - Month to center on (1-12, defaults to current month)
     * @param {Array} availableMonths - Array of available months for the current year
     */
    populateMonthPicker(includeAll = true, centerMonth = null, availableMonths = null) {
        const monthPickerHeader = this.getElement('monthPickerHeader');
        if (!monthPickerHeader) {
            console.warn('[UI] Month picker header not found');
            return;
        }

        // Clear existing month picker items
        monthPickerHeader.innerHTML = '';

        // Prioritize stored selected month, only use defaults if no stored selection
        if (centerMonth === null) {
            if (this.selectedMonth && availableMonths && availableMonths.includes(this.selectedMonth)) {
                // Use previously selected month if it's still available
                centerMonth = parseInt(this.selectedMonth);
            } else if (this.selectedMonth && (!availableMonths || !availableMonths.includes(this.selectedMonth))) {
                // Stored month is not available in current data, but keep it for when data becomes available
                centerMonth = parseInt(this.selectedMonth);
            } else if (availableMonths && availableMonths.length > 0) {
                // No stored selection, use last available month as default
                const sortedMonths = [...availableMonths].sort((a, b) => parseInt(b) - parseInt(a));
                centerMonth = parseInt(sortedMonths[0]);
                // Only update stored month if we don't have a stored selection
                if (!this.selectedMonth) {
                    this.selectedMonth = String(centerMonth).padStart(2, '0');
                }
            } else {
                // Fallback to current month if no available months
                centerMonth = new Date().getMonth() + 1; // 1-12
                if (!this.selectedMonth) {
                    this.selectedMonth = String(centerMonth).padStart(2, '0');
                }
            }
        }

        // Add "ALL" option first if requested
        if (includeAll) {
            const allButton = document.createElement('button');
            allButton.className = 'month-picker-item selected';
            allButton.setAttribute('data-month', 'all');
            allButton.textContent = 'ALL';
            allButton.addEventListener('click', () => this.handleMonthSelection('all'));
            monthPickerHeader.appendChild(allButton);
        } else {
            // Create compact month picker with navigation
            this.createCompactMonthPicker(monthPickerHeader, centerMonth);
        }

        console.log('[UI] Populated month picker with center month:', centerMonth, 'stored:', this.selectedMonth, 'availableMonths:', availableMonths);
    }

    /**
     * Create compact month picker with 3 months and navigation arrows
     * @param {HTMLElement} container - Container element
     * @param {number} centerMonth - Month to center on (1-12)
     */
    createCompactMonthPicker(container, centerMonth) {
        // Month names array
        const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        // Calculate the 3 months to show (previous, current, next)
        const prevMonth = centerMonth - 1 === 0 ? 12 : centerMonth - 1;
        const nextMonth = centerMonth + 1 === 13 ? 1 : centerMonth + 1;

        // Create left arrow
        const leftArrow = document.createElement('button');
        leftArrow.className = 'month-nav-arrow month-nav-left';
        leftArrow.innerHTML = '‹';
        leftArrow.setAttribute('aria-label', 'Previous month');
        leftArrow.addEventListener('click', () => {
            const newCenter = centerMonth - 1 === 0 ? 12 : centerMonth - 1;
            this.populateMonthPicker(false, newCenter);
        });
        container.appendChild(leftArrow);

        // Create month buttons
        const monthsToShow = [prevMonth, centerMonth, nextMonth];

        monthsToShow.forEach((monthNum, index) => {
            const monthButton = document.createElement('button');
            monthButton.className = 'month-picker-item';
            if (index === 1) { // Center month
                monthButton.classList.add('selected');
                // Auto-select the center month
                const monthStr = String(monthNum).padStart(2, '0');
                this.handleMonthSelection(monthStr);
            }
            monthButton.setAttribute('data-month', String(monthNum).padStart(2, '0'));
            monthButton.textContent = monthNames[monthNum - 1];
            monthButton.addEventListener('click', () => this.handleMonthSelection(String(monthNum).padStart(2, '0')));
            container.appendChild(monthButton);
        });

        // Create right arrow
        const rightArrow = document.createElement('button');
        rightArrow.className = 'month-nav-arrow month-nav-right';
        rightArrow.innerHTML = '›';
        rightArrow.setAttribute('aria-label', 'Next month');
        rightArrow.addEventListener('click', () => {
            const newCenter = centerMonth + 1 === 13 ? 1 : centerMonth + 1;
            this.populateMonthPicker(false, newCenter);
        });
        container.appendChild(rightArrow);
    }

    /**
     * Handle month selection from month picker buttons
     * @param {string} selectedMonth - Selected month or 'all'
     */
    handleMonthSelection(selectedMonth) {
        if (this.selectedMonth === selectedMonth) {

            // Update UI but skip event and log

            const monthPickerHeader = this.getElement('monthPickerHeader');
            if (monthPickerHeader) {
                const monthPickerItems = monthPickerHeader.querySelectorAll('.month-picker-item');
                monthPickerItems.forEach(item => {
                    const itemMonth = item.getAttribute('data-month');
                    if (itemMonth === selectedMonth) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                });
            }

            return;
        }

        // Store the selected month for persistence across dashboard switches
        this.selectedMonth = selectedMonth;

        // Update button states
        const monthPickerHeader = this.getElement('monthPickerHeader');
        if (monthPickerHeader) {
            const monthPickerItems = monthPickerHeader.querySelectorAll('.month-picker-item');
            monthPickerItems.forEach(item => {
                if (item.getAttribute('data-month') === selectedMonth) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        }

        // Trigger month change event
        const event = new CustomEvent('monthChange', {
            detail: { selectedMonth }
        });
        document.dispatchEvent(event);

        console.log(`[UI] Month selected: ${selectedMonth}, stored for persistence`);
    }

    /**
     * Handle year selection from year picker buttons
     * @param {string} selectedYear - Selected year or 'all'
     */
    handleYearSelection(selectedYear) {

        if (this.selectedYear === selectedYear) {

            // Still update UI in case of external changes, but skip event and log

            const yearPickerHeader = this.getElement('yearPickerHeader');

            if (yearPickerHeader) {

                const yearPickerItems = yearPickerHeader.querySelectorAll('.year-picker-item');

                yearPickerItems.forEach(item => {

                    const itemYear = item.getAttribute('data-year');

                    if (itemYear === selectedYear) {

                        item.classList.add('selected');

                    } else {

                        item.classList.remove('selected');

                    }

                });

            }

            return;  // Skip dispatch and log

        }

        // Store the selected year for persistence across dashboard switches
        this.selectedYear = selectedYear;

        // Update button states - ensure ALL button is also handled
        const yearPickerHeader = this.getElement('yearPickerHeader');
        if (yearPickerHeader) {
            const yearPickerItems = yearPickerHeader.querySelectorAll('.year-picker-item');
            yearPickerItems.forEach(item => {
                const itemYear = item.getAttribute('data-year');
                if (itemYear === selectedYear) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        }

        // Trigger year change event
        const event = new CustomEvent('yearChange', {
            detail: { selectedYear }
        });
        document.dispatchEvent(event);

        console.log(`[UI] Year selected: ${selectedYear}, stored for persistence`);
    }

    /**
     * Update year picker selection programmatically
     * @param {string} selectedYear - Year to select
     */
    updateYearPickerSelection(selectedYear) {
        if (!selectedYear) return;

        if (this.selectedYear === selectedYear) {

            console.log(`[UI] Year picker already updated to: ${selectedYear}, skipping`);

            return;

        }

        // Store the selected year
        this.selectedYear = selectedYear;

        // Update button states
        const yearPickerHeader = this.getElement('yearPickerHeader');
        if (yearPickerHeader) {
            const yearPickerItems = yearPickerHeader.querySelectorAll('.year-picker-item');
            yearPickerItems.forEach(item => {
                const itemYear = item.getAttribute('data-year');
                if (itemYear === selectedYear) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        }

        console.log(`[UI] Year picker selection updated to: ${selectedYear}`);
    }

    /**
     * Update month picker selection programmatically
     * @param {string} selectedMonth - Month to select
     */
    updateMonthPickerSelection(selectedMonth) {
        if (!selectedMonth) return;

        if (this.selectedMonth === selectedMonth) {

            console.log(`[UI] Month picker already updated to: ${selectedMonth}, skipping`);

            return;

        }

        // Store the selected month
        this.selectedMonth = selectedMonth;

        // Update button states
        const monthPickerHeader = this.getElement('monthPickerHeader');
        if (monthPickerHeader) {
            const monthPickerItems = monthPickerHeader.querySelectorAll('.month-picker-item');
            monthPickerItems.forEach(item => {
                const itemMonth = item.getAttribute('data-month');
                if (itemMonth === selectedMonth) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        }

        console.log(`[UI] Month picker selection updated to: ${selectedMonth}`);
    }

    /**
     * Show year picker (only for overview dashboard)
     */
    showYearPicker() {
        const yearPicker = this.getElement('yearPicker');
        if (yearPicker) {
            yearPicker.style.display = 'flex';
            console.log('[UI] Year picker shown');
        }
    }

    /**
     * Hide year picker
     */
    hideYearPicker() {
        const yearPicker = this.getElement('yearPicker');
        if (yearPicker) {
            yearPicker.style.display = 'none';
            console.log('[UI] Year picker hidden');
        }
    }

    /**
     * Show month picker
     */
    showMonthPicker() {
        const monthPicker = this.getElement('monthPicker');
        if (monthPicker) {
            monthPicker.style.display = 'flex';
            console.log('[UI] Month picker shown');
        }
    }

    /**
     * Hide month picker
     */
    hideMonthPicker() {
        const monthPicker = this.getElement('monthPicker');
        if (monthPicker) {
            monthPicker.style.display = 'none';
            console.log('[UI] Month picker hidden');
        }
    }

    /**
     * Update year picker visibility based on current view
     * @param {string} view - Current view name
     */
    updateYearPickerVisibility(view) {
        if (view === 'overview' || view === 'properties') {
            this.showYearPicker();
            if (view === 'properties') {
                this.showMonthPicker();
            } else {
                this.hideMonthPicker();
            }
        } else {
            this.hideYearPicker();
            this.hideMonthPicker();
        }
    }

    /**
     * Show loading state
     * @param {string} message - Loading message
     */
    showLoadingState(message = 'Loading...') {
        this.isLoading = true;

        // Show appropriate loading state based on current view
        const loadingStates = {
            'overview': 'overviewLoadingState',
            'properties': 'overviewLoadingState',  // Reuse overview loading for properties
        };

        const loadingKey = loadingStates[this.currentView];
        if (loadingKey) {
            const loadingElement = this.getElement(loadingKey);
            if (loadingElement) {
                loadingElement.style.display = 'flex';
                const messageElement = loadingElement.querySelector('p');
                if (messageElement) {
                    messageElement.textContent = message;
                }
            }
        }

        // Disable interactions during loading
        this.setLoadingState(true);

        console.log(`[UI] Showing loading state: ${message}`);
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        this.isLoading = false;

        // Hide all loading states
        const loadingStates = ['overviewLoadingState'];

        loadingStates.forEach(key => {
            const loadingElement = this.getElement(key);
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        });

        // Re-enable interactions
        this.setLoadingState(false);

        console.log('[UI] Loading state hidden');
    }

    /**
     * Set loading state for interactive elements
     * @param {boolean} isLoading - Whether in loading state
     */
    setLoadingState(isLoading) {
        const interactiveElements = document.querySelectorAll('button, input, select, textarea');

        interactiveElements.forEach(element => {
            if (isLoading) {
                element.setAttribute('aria-disabled', 'true');
                element.style.pointerEvents = 'none';
                element.style.opacity = '0.6';
            } else {
                element.removeAttribute('aria-disabled');
                element.style.pointerEvents = '';
                element.style.opacity = '';
            }
        });
    }

    /**
     * Show error message
     * @param {string} message - Error message
     * @param {string} title - Error title
     */
    showError(message, title = 'Error') {
        console.error(`[UI] ${title}: ${message}`);

        // Hide loading state
        this.hideLoadingState();

        // Show error in appropriate container
        const chartContent = this.getElement(`${this.currentView}ChartContent`);
        if (chartContent) {
            chartContent.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">Warning</div>
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <div class="error-actions">
                        <button class="btn btn--primary" onclick="window.location.reload()">
                            Refresh Page
                        </button>
                    </div>
                </div>
            `;
        }

        // Show toast notification
        this.showToast(message, 'error', 5000);
    }

    /**
     * Show empty state
     * @param {string} message - Empty state message
     * @param {string} actionText - Action button text
     * @param {Function} actionCallback - Action callback
     */
    showEmptyState(message = 'No data to display', actionText = null, actionCallback = null) {
        const chartContent = this.getElement(`${this.currentView}ChartContent`);
        if (chartContent) {
            let actionButton = '';
            if (actionText && actionCallback) {
                actionButton = `<button class="btn btn--primary" onclick="(${actionCallback.toString()})()">${actionText}</button>`;
            }

            chartContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">Empty</div>
                    <h3>No Data Available</h3>
                    <p>${message}</p>
                    ${actionButton}
                </div>
            `;
        }

        console.log('[UI] Empty state displayed');
    }

    /**
     * Show toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type ('success', 'error', 'warning', 'info')
     * @param {number} duration - Duration in milliseconds
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = this.getElement('toast');
        const toastMessage = this.getElement('toastMessage');

        if (toast && toastMessage) {
            // Set toast type
            toast.className = `toast ${type}`;

            // Set message with icon
            const icons = {
                success: '[OK]',
                error: '[ERROR]',
                warning: '[WARN]',
                info: '[INFO]',
            };

            toastMessage.innerHTML = `${icons[type] || ''} ${message}`;

            // Show toast
            toast.classList.remove('hidden');
            toast.setAttribute('aria-live', 'polite');

            // Hide after duration
            setTimeout(() => {
                toast.classList.add('hidden');
                toast.removeAttribute('aria-live');
            }, duration);
        }

        console.log(`[UI] Toast shown: ${type} - ${message}`);
    }

    /**
     * Open modal
     * @param {string} modalKey - Modal element key
     */
    openModal(modalKey) {
        const modal = this.getElement(modalKey);
        if (!modal) {return;}

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');

        this.activeModals.add(modalKey);

        // Focus management - move focus to modal
        setTimeout(() => {
            const focusableElement = modal.querySelector('input, textarea, button');
            if (focusableElement) {
                focusableElement.focus();
            }
        }, 100);

        console.log(`[UI] Modal opened: ${modalKey}`);
    }

    /**
     * Close modal
     * @param {string} modalKey - Modal element key
     */
    closeModal(modalKey) {
        const modal = this.getElement(modalKey);
        if (!modal) {return;}

        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');

        this.activeModals.delete(modalKey);

        // Return focus to trigger element
        const triggerBtn = document.querySelector(`[data-triggers="${modalKey}"]`);
        if (triggerBtn) {
            triggerBtn.focus();
        }

        console.log(`[UI] Modal closed: ${modalKey}`);
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        this.activeModals.forEach(modalKey => {
            this.closeModal(modalKey);
        });
    }



    /**
     * Toggle dropdown
     * @param {string} dropdownKey - Dropdown element key
     */
    toggleDropdown(dropdownKey) {
        const dropdown = this.getElement(dropdownKey);
        if (!dropdown) {return;}

        const isOpen = dropdown.classList.contains('open');

        if (isOpen) {
            this.closeDropdown(dropdownKey);
        } else {
            this.openDropdown(dropdownKey);
        }
    }

    /**
     * Open dropdown
     * @param {string} dropdownKey - Dropdown element key
     */
    openDropdown(dropdownKey) {
        const dropdown = this.getElement(dropdownKey);
        const dropdownMenu = this.getElement(dropdownKey.replace('Btn', 'Menu'));
        const dropdownBtn = this.getElement(dropdownKey);

        if (dropdown && dropdownMenu && dropdownBtn) {
            dropdown.classList.add('open');
            dropdownBtn.setAttribute('aria-expanded', 'true');
            dropdownMenu.setAttribute('aria-hidden', 'false');

            // Focus first menu item
            const firstItem = dropdownMenu.querySelector('.dropdown-item');
            if (firstItem) {
                setTimeout(() => firstItem.focus(), 100);
            }
        }
    }

    /**
     * Close dropdown
     * @param {string} dropdownKey - Dropdown element key
     */
    closeDropdown(dropdownKey) {
        const dropdown = this.getElement(dropdownKey);
        const dropdownMenu = this.getElement(dropdownKey.replace('Btn', 'Menu'));
        const dropdownBtn = this.getElement(dropdownKey);

        if (dropdown && dropdownMenu && dropdownBtn) {
            dropdown.classList.remove('open');
            dropdownBtn.setAttribute('aria-expanded', 'false');
            dropdownMenu.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * Open detail panel
     * @param {string} title - Panel title
     * @param {string} content - Panel content HTML
     */
    openDetailPanel(title, content) {
        const detailPanel = this.getElement('detailPanel');
        const detailTitle = this.getElement('detailTitle');
        const detailContent = this.getElement('detailContent');

        if (detailPanel && detailTitle && detailContent) {
            detailTitle.textContent = title;
            detailTitle.setAttribute('aria-label', `Details for ${title}`);

            detailContent.innerHTML = content;
            detailContent.setAttribute('aria-live', 'polite');

            detailPanel.classList.add('open');
            detailPanel.setAttribute('aria-hidden', 'false');

            // Focus close button
            const closeBtn = this.getElement('closeDetailPanel');
            if (closeBtn) {
                setTimeout(() => closeBtn.focus(), 100);
            }
        }

        console.log(`[UI] Detail panel opened: ${title}`);
    }

    /**
     * Close detail panel
     */
    closeDetailPanel() {
        const detailPanel = this.getElement('detailPanel');

        if (detailPanel) {
            detailPanel.classList.remove('open');
            detailPanel.setAttribute('aria-hidden', 'true');

            // Return focus to main content
            const mainContent = this.getElement('mainContent');
            if (mainContent) {
                mainContent.focus();
            }
        }

        console.log('[UI] Detail panel closed');
    }

    /**
     * Handle keyboard navigation
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeydown(event) {
        // Escape key handling
        if (event.key === 'Escape') {
            // Close active modals
            if (this.activeModals.size > 0) {
                const lastModal = Array.from(this.activeModals).pop();
                this.closeModal(lastModal);
                event.preventDefault();
                return;
            }

            // Close detail panel
            const detailPanel = this.getElement('detailPanel');
            if (detailPanel && detailPanel.classList.contains('open')) {
                this.closeDetailPanel();
                event.preventDefault();
                return;
            }

            // Close dropdowns
            const openDropdowns = document.querySelectorAll('.dropdown.open');
            if (openDropdowns.length > 0) {
                openDropdowns.forEach(dropdown => {
                    const dropdownId = dropdown.id;
                    if (dropdownId) {
                        this.closeDropdown(dropdownId.replace('Menu', 'Btn'));
                    }
                });
                event.preventDefault();
                return;
            }
        }

        // Tab navigation within modals
        if (event.key === 'Tab') {
            const activeModal = document.querySelector('.modal:not(.hidden)');
            if (activeModal) {
                this.handleModalTabNavigation(activeModal, event);
            }
        }
    }

    /**
     * Handle modal tab navigation
     * @param {HTMLElement} modal - Modal element
     * @param {KeyboardEvent} event - Tab event
     */
    handleModalTabNavigation(modal, event) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );

        if (focusableElements.length === 0) {return;}

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    }

    /**
     * Handle window resize
     * @param {Event} event - Resize event
     */
    handleResize(event) {
        // Debounce resize handling
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            // Update responsive elements
            this.updateResponsiveLayout();

            // Trigger chart resize if needed
            // No specific chart resize needed for current views
        }, 300);
    }

    /**
     * Update responsive layout
     */
    updateResponsiveLayout() {
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

        // Update layout classes
        const appContainer = this.getElement('appContainer');
        if (appContainer) {
            appContainer.classList.toggle('mobile', isMobile);
            appContainer.classList.toggle('tablet', isTablet);
            appContainer.classList.toggle('desktop', !isMobile && !isTablet);
        }

        console.log(`[UI] Responsive layout updated: ${isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'}`);
    }

    /**
     * Handle theme change
     * @param {CustomEvent} event - Theme change event
     */
    handleThemeChange(event) {
        const { theme, isDark, colors } = event.detail;

        // Update theme toggle button
        this.updateThemeToggle();

        // Update any theme-aware elements
        this.updateThemeAwareElements(theme, colors);

        console.log(`[UI] Theme changed to: ${theme}`);
    }

    /**
     * Handle color theme change
     * @param {CustomEvent} event - Color theme change event
     */
    handleColorThemeChange(event) {
        const { theme, colors } = event.detail;

        // Update color theme button text
        this.updateColorThemeButton(theme);

        console.log(`[UI] Color theme changed to: ${theme}`);
    }

    /**
     * Update color theme button
     * @param {string} themeName - Current color theme name
     */
    updateColorThemeButton(themeName) {
        const colorThemeBtn = this.getElement('colorThemeBtn');
        if (colorThemeBtn) {
            const themeData = this.themeManager.getColorTheme(themeName);
            const displayName = themeData ? themeData.name : 'Default';
            colorThemeBtn.innerHTML = `🎨 ${displayName}`;
            colorThemeBtn.setAttribute('aria-label', `Current color theme: ${displayName}`);
        }
    }

    /**
     * Setup color theme dropdown
     */
    setupColorThemeDropdown() {
        const colorThemeBtn = this.getElement('colorThemeBtn');
        const colorThemeMenu = this.getElement('colorThemeMenu');

        if (colorThemeBtn && colorThemeMenu) {
            // Generate dropdown options dynamically from theme definitions
            this.populateColorThemeDropdown();

            // Toggle dropdown on button click
            this.addEventListener(colorThemeBtn, 'click', (event) => {
                event.preventDefault();
                this.toggleDropdown('colorThemeDropdown');
            });

            // Handle menu item clicks (using event delegation for dynamic content)
            this.addEventListener(colorThemeMenu, 'click', (event) => {
                const menuItem = event.target.closest('.dropdown-item');
                if (menuItem) {
                    event.preventDefault();
                    const themeName = menuItem.getAttribute('data-theme');
                    if (themeName) {
                        this.themeManager.setColorTheme(themeName);
                        this.closeDropdown('colorThemeDropdown');
                    }
                }
            });

            // Close dropdown when clicking outside
            this.addEventListener(document, 'click', (event) => {
                const dropdown = this.getElement('colorThemeDropdown');
                if (dropdown && !dropdown.contains(event.target)) {
                    this.closeDropdown('colorThemeDropdown');
                }
            });

            // Update button with current theme
            this.updateColorThemeButton(this.themeManager.getCurrentColorTheme());
        }
    }

    /**
     * Populate color theme dropdown with options from theme definitions
     */
    populateColorThemeDropdown() {
        const colorThemeMenu = this.getElement('colorThemeMenu');
        if (!colorThemeMenu) return;

        // Clear existing options
        colorThemeMenu.innerHTML = '';

        // Get available themes from ThemeManager
        const themeOptions = this.themeManager.getColorThemeOptions();

        // Create dropdown items for each theme
        themeOptions.forEach(theme => {
            const menuItem = document.createElement('div');
            menuItem.className = 'dropdown-item';
            menuItem.setAttribute('role', 'menuitem');
            menuItem.setAttribute('data-theme', theme.id);
            menuItem.textContent = theme.name;

            colorThemeMenu.appendChild(menuItem);
        });

        console.log(`[UI] Populated color theme dropdown with ${themeOptions.length} themes`);
    }

    /**
     * Update theme-aware elements
     * @param {string} theme - Theme name
     * @param {Object} colors - Theme colors
     */
    updateThemeAwareElements(theme, colors) {
        // Update any elements that need theme-specific styling
        const themeAwareElements = document.querySelectorAll('[data-theme-aware]');

        themeAwareElements.forEach(element => {
            // Apply theme-specific logic here
            element.setAttribute('data-current-theme', theme);
        });
    }

    /**
     * Get form data from modal
     * @param {string} modalKey - Modal key
     * @returns {Object} Form data
     */
    getModalFormData(modalKey) {
        const formData = {};

        const modal = this.getElement(modalKey);
        if (!modal) {return formData;}

        // Get all form inputs
        const inputs = modal.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.name || input.id) {
                const key = input.name || input.id;
                formData[key] = input.value.trim();
            }
        });

        return formData;
    }

    /**
     * Set modal form data
     * @param {string} modalKey - Modal key
     * @param {Object} data - Form data
     */
    setModalFormData(modalKey, data) {
        const modal = this.getElement(modalKey);
        if (!modal) {return;}

        Object.entries(data).forEach(([key, value]) => {
            const input = modal.querySelector(`[name="${key}"], #${key}`);
            if (input) {
                input.value = value || '';
            }
        });
    }

    /**
     * Clear modal form
     * @param {string} modalKey - Modal key
     */
    clearModalForm(modalKey) {
        const modal = this.getElement(modalKey);
        if (!modal) {return;}

        const inputs = modal.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
    }

    /**
     * Update element with real DOM manipulation (for testing coverage)
     * @param {string} id - Element id
     * @param {string} value - Value to set
     */
    updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        } else {
            console.warn(`Element not found`);
        }
    }

    /**
     * Show modal with real DOM operations
     * @param {string} type - Modal type
     */
    showModal(type) {
        const modal = document.querySelector(`#${type}Modal`);
        if (!modal) {
            // Create modal if it doesn't exist
            const newModal = document.createElement('div');
            newModal.id = `${type}Modal`;
            newModal.className = 'modal';
            newModal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${type} Modal</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Modal content for ${type}</p>
                    </div>
                </div>
            `;
            document.body.appendChild(newModal);
            newModal.style.display = 'block';
        } else {
            modal.style.display = 'block';
        }
    }

    /**
     * Hide modal with real DOM operations
     * @param {string} type - Modal type
     * @param {boolean} remove - Whether to remove element instead of hide
     */
    hideModal(type, remove = false) {
        const modal = document.querySelector(`#${type}Modal`);
        if (modal) {
            if (remove) {
                modal.remove();
            } else {
                modal.style.display = 'none';
            }
        }
    }

    /**
     * Subscribe to events (for testing coverage)
     */
    subscribeToEvents() {
        // This would normally subscribe to eventHandler, but for testing we use mock
        if (this.eventHandler) {
            this.eventHandler.subscribe('dataChange', this.handleDataChange.bind(this));
        }
    }

    /**
     * Handle data change events (for testing coverage)
     * @param {Object} data - Data payload
     */
    handleDataChange(data) {
        // Update total display
        const totalEl = document.getElementById('total');
        if (totalEl && data.total !== undefined) {
            totalEl.textContent = this.formatter.formatCurrency(data.total);
        }
    }

    /**
     * Toggle theme with real DOM operations
     */
    toggleTheme() {
        document.documentElement.classList.toggle('dark');
    }

    /**
     * Set element text content
     * @param {string} elementKey - Element key
     * @param {string} text - Text content
     */
    setElementText(elementKey, text) {
        const element = this.getElement(elementKey);
        if (element) {
            element.textContent = text;
        }
    }

    /**
     * Set element HTML content
     * @param {string} elementKey - Element key
     * @param {string} html - HTML content
     */
    setElementHTML(elementKey, html) {
        const element = this.getElement(elementKey);
        if (element) {
            element.innerHTML = html;
        }
    }

    /**
     * Add CSS class to element
     * @param {string} elementKey - Element key
     * @param {string} className - CSS class
     */
    addClass(elementKey, className) {
        const element = this.getElement(elementKey);
        if (element) {
            element.classList.add(className);
        }
    }

    /**
     * Remove CSS class from element
     * @param {string} elementKey - Element key
     * @param {string} className - CSS class
     */
    removeClass(elementKey, className) {
        const element = this.getElement(elementKey);
        if (element) {
            element.classList.remove(className);
        }
    }

    /**
     * Toggle CSS class on element
     * @param {string} elementKey - Element key
     * @param {string} className - CSS class
     */
    toggleClass(elementKey, className) {
        const element = this.getElement(elementKey);
        if (element) {
            element.classList.toggle(className);
        }
    }

    /**
     * Set element attribute
     * @param {string} elementKey - Element key
     * @param {string} attribute - Attribute name
     * @param {string} value - Attribute value
     */
    setAttribute(elementKey, attribute, value) {
        const element = this.getElement(elementKey);
        if (element) {
            element.setAttribute(attribute, value);
        }
    }

    /**
     * Get element attribute
     * @param {string} elementKey - Element key
     * @param {string} attribute - Attribute name
     * @returns {string|null} Attribute value
     */
    getAttribute(elementKey, attribute) {
        const element = this.getElement(elementKey);
        return element ? element.getAttribute(attribute) : null;
    }

    /**
     * Enable element
     * @param {string} elementKey - Element key
     */
    enableElement(elementKey) {
        const element = this.getElement(elementKey);
        if (element) {
            element.disabled = false;
            element.removeAttribute('aria-disabled');
            element.style.opacity = '';
            element.style.pointerEvents = '';
        }
    }

    /**
     * Disable element
     * @param {string} elementKey - Element key
     */
    disableElement(elementKey) {
        const element = this.getElement(elementKey);
        if (element) {
            element.disabled = true;
            element.setAttribute('aria-disabled', 'true');
            element.style.opacity = '0.6';
            element.style.pointerEvents = 'none';
        }
    }

    /**
     * Update undo/redo button states
     * @param {boolean} canUndo - Whether undo is available
     * @param {boolean} canRedo - Whether redo is available
     */
    updateUndoRedoButtons(canUndo = false, canRedo = false) {
        const undoBtn = this.getElement('undoBtn');
        const redoBtn = this.getElement('redoBtn');

        if (undoBtn) {
            undoBtn.disabled = !canUndo;
            undoBtn.style.opacity = canUndo ? '1' : '0.5';
            undoBtn.setAttribute('aria-label', canUndo ? 'Undo last action' : 'Nothing to undo');
        }

        if (redoBtn) {
            redoBtn.disabled = !canRedo;
            redoBtn.style.opacity = canRedo ? '1' : '0.5';
            redoBtn.setAttribute('aria-label', canRedo ? 'Redo last undone action' : 'Nothing to redo');
        }
    }

    /**
     * Update theme toggle button
     */
    updateThemeToggle() {
        if (typeof this.themeManager?.isDarkModeActive !== 'function') {
            console.warn('ThemeManager incomplete; defaulting to light.');
            this.themeManager = { isDarkModeActive: () => false, setDarkMode: () => {} };
        }
        const isDark = this.themeManager.isDarkModeActive();
        const toggleEl = this.getElement('theme-toggle', true); // createIfMissing=true from prev.
        if (toggleEl) {
            toggleEl.classList.toggle('dark-mode', isDark);
            toggleEl.innerHTML = isDark ? '☀️' : '🌙';
            toggleEl.onclick = () => this.themeManager.setDarkMode(!isDark);
        } else {
            console.warn('Theme toggle element missing.');
        }
    }

    /**
     * Set default theme
     */
    setDefaultTheme() {
        this.themeManager?.setDarkMode(false);
    }

    /**
     * Get UI statistics
     * @returns {Object} UI statistics
     */
    getUIStatistics() {
        return {
            cachedElements: this.elements.size,
            activeModals: this.activeModals.size,
            currentView: this.currentView,
            isLoading: this.isLoading,
            eventListeners: this.eventListeners.size,
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Remove all event listeners
        this.eventListeners.forEach((listeners, element) => {
            listeners.forEach((handler, event) => {
                element.removeEventListener(event, handler);
            });
        });

        this.eventListeners.clear();
        this.elements.clear();
        this.activeModals.clear();

        this._initialized = false;  // Reset for potential re-init

        console.log('[UI] UI manager cleaned up');
    }

    /**
     * Debug UI information
     */
    debug() {
        console.log('[UI DEBUG] === UI MANAGER INFO ===');
        console.log('[UI DEBUG] Cached elements:', this.elements.size);
        console.log('[UI DEBUG] Active modals:', this.activeModals.size);
        console.log('[UI DEBUG] Current view:', this.currentView);
        console.log('[UI DEBUG] Is loading:', this.isLoading);
        console.log('[UI DEBUG] Event listeners:', this.eventListeners.size);
        console.log('[UI DEBUG] Statistics:', this.getUIStatistics());
        console.log('[UI DEBUG] === END DEBUG ===');
    }
}

// Export for use in other modules
export default UIManager;

// Expose globally for Babel standalone transpilation
window.UIManager = UIManager;
