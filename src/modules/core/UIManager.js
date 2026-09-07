/**
 * UIManager Module
 * Handles all DOM manipulation and UI state management
 * - Element selection and manipulation
 * - UI state updates and synchronization
 * - Modal management
 * - Loading states and error displays
 * - Responsive UI updates
 */

import logger from '../utils/Logger.js';

class UIManager {
    constructor(formatter, themeManager) {
        // Dependency injection with fallbacks
        this.formatter = formatter || {
            formatCurrency: (value) => `$${value}`,
            formatDate: (date) => date.toISOString().split('T')[0],
            formatNumber: (num) => num.toString(),
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

        // Create module-specific logger
        this.logger = logger.createModuleLogger('UI');
        this.logger.info('UIManager initialized');
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
            setColorTheme: (theme) => this.logger.debug(`Setting color theme to: ${theme}`),
            toggleDarkMode: () => this.logger.debug('Toggling dark mode'),
        };
    }

    /**
     * Initialize UI manager (idempotent)
     */
    async initialize() {
        if (this.initialized) {
            this.logger.info('UI manager already initialized, skipping');
            return;
        }

        this.initialized = true; // Mark as initialized early to prevent re-entry

        await new Promise(r => setTimeout(r, 0)); // DOM ready

        this.cacheElements();
        this.setupEventListeners();
        this.initializeUIState();

        this.logger.info(`UI manager initialized with ${this.elements.size} cached elements`);
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

            // Chart containers
            'chartContainer': '#chart-container',
            'tooltip': '#tooltip',
            'overviewChart': '#overviewChart',
            'overviewChartContent': '#overviewChartContent',

            // Dashboard views
            'overviewDashboard': '#overviewDashboard',
            'propertiesDashboard': '#propertiesDashboard',

            // Buttons
            'undoBtn': '#undoBtn',
            'redoBtn': '#redoBtn',
            'darkModeToggle': '#darkModeToggle',
            'theme-toggle': '#darkModeToggle',
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

        // Cache elements with consolidated logging
        Object.entries(elementSelectors).forEach(([key, selector]) => {
            const element = document.querySelector(selector);
            if (element) {
                this.elements.set(key, element);
                logger.logElementCache(key, selector, true);
            } else {
                logger.logElementWarning(key, selector);
            }
        });

        // Flush consolidated element cache logs
        logger.flushElementCacheLogs('UI');
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
            if (el) {this.elements.set(id, el);} else { this.logger.warn(`Element '${id}' missing; creating fallback.`); el = this.createFallbackElement(id); this.elements.set(id, el); }
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
            this.logger.info('Event listeners already set up, skipping');
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

        this.logger.info('Event listeners setup complete');
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
     * Emit custom event
     * @param {string} eventName - Event name
     * @param {Object} detail - Event detail data
     */
    emit(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
        this.logger.debug(`Emitted event: ${eventName}`, detail);
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
        try { this.updateThemeToggle(); } catch(e) { this.logger.error('Theme init failed', e); this.setDefaultTheme(); } // Fallback: document.documentElement.setAttribute('data-theme', 'light');

        // Setup color theme dropdown
        this.setupColorThemeDropdown();

        // Ensure dropdown starts in closed state
        this.closeDropdownDirect('colorThemeDropdown');

        // Setup navigation event listeners
        this.setupNavigationListeners();

        // Hide loading states
        this.hideLoadingState();
    }

    /**
     * Setup initial state (alias for initializeUIState)
     * @returns {Promise<void>}
     */
    async setupInitialState() {
        if (this.initialized) {
            this.logger.info('Initial state setup complete');
            return;
        }
        this.initializeUIState();
        this.logger.info('Initial state setup complete');
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

        this.logger.info(`Switched to view: ${view}`);
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
            this.logger.debug(`Element shown: ${elementKey}`);
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
            this.logger.debug(`Element hidden: ${elementKey}`);
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
            'properties': 'propertiesBtn',
        };

        const buttonId = viewMap[activeView];
        if (buttonId) {
            const button = document.getElementById(buttonId);
            if (button) {
                button.setAttribute('data-active', 'true');
            }
        }

        this.logger.debug(`Sidebar selection updated: ${activeView}`);
    }

    /**
     * Update navigation state
     * @param {string} activeView - Active view name
     */
    updateNavigationState(activeView) {
        this.logger.debug(`Navigation state updated: ${activeView}`);
    }

    /**
     * Update data display after data loading
     * @param {Object} stats - Data statistics
     */
    updateDataDisplay(stats = {}) {
        this.logger.debug('Updating data display with stats:', stats);

        // Show success message if data loaded
        if (stats.totalProperties > 0) {
            this.showToast(`Loaded ${stats.totalProperties} properties with ${stats.totalCategories} categories`, 'success', 3000);
        } else {
            this.showToast('No data loaded', 'warning', 3000);
        }

        // Force UI refresh
        this.hideLoadingState();

        this.logger.info('Data display updated');
    }

    /**
     * Force complete UI refresh
     */
    forceUIRefresh() {
        this.logger.info('Forcing complete UI refresh...');

        // Hide loading states
        this.hideLoadingState();

        // Update all UI elements that depend on data
        this.updateDataDisplay();

        // Refresh any charts or visualizations
        if (window.chartRenderer && typeof window.chartRenderer.renderOverviewSankey === 'function') {
            window.chartRenderer.renderOverviewSankey();
        }

        // Update navigation state
        this.updateNavigationState(this.currentView);

        this.logger.info('UI refresh complete');
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
            this.logger.warn('Year picker header not found');
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

        this.logger.debug(`Populated year picker with selected year: ${selectedYear}, stored: ${this.selectedYear}, showAll: ${showAllOption}, availableYears:`, availableYears);
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
            this.logger.warn('No available years provided for compact year picker');
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
            this.logger.warn('Month picker header not found');
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

        this.logger.debug('Populated month picker with center month:', centerMonth, 'stored:', this.selectedMonth, 'availableMonths:', availableMonths);
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
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
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
            detail: { selectedMonth },
        });
        document.dispatchEvent(event);

        this.logger.debug(`Month selected: ${selectedMonth}, stored for persistence`);
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
            detail: { selectedYear },
        });
        document.dispatchEvent(event);

        this.logger.debug(`Year selected: ${selectedYear}, stored for persistence`);
    }

    /**
     * Update year picker selection programmatically
     * @param {string} selectedYear - Year to select
     */
    updateYearPickerSelection(selectedYear) {
        if (!selectedYear) {return;}

        if (this.selectedYear === selectedYear) {

            this.logger.info(`Year picker already updated to: ${selectedYear}, skipping`);

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

        this.logger.debug(`Year picker selection updated to: ${selectedYear}`);
    }

    /**
     * Update month picker selection programmatically
     * @param {string} selectedMonth - Month to select
     */
    updateMonthPickerSelection(selectedMonth) {
        if (!selectedMonth) {return;}

        if (this.selectedMonth === selectedMonth) {

            this.logger.info(`Month picker already updated to: ${selectedMonth}, skipping`);

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

        this.logger.debug(`Month picker selection updated to: ${selectedMonth}`);
    }

    /**
     * Show year picker (only for overview dashboard)
     */
    showYearPicker() {
        const yearPicker = this.getElement('yearPicker');
        if (yearPicker) {
            yearPicker.style.display = 'flex';
            this.logger.debug('Year picker shown');
        }
    }

    /**
     * Hide year picker
     */
    hideYearPicker() {
        const yearPicker = this.getElement('yearPicker');
        if (yearPicker) {
            yearPicker.style.display = 'none';
            this.logger.debug('Year picker hidden');
        }
    }

    /**
     * Show month picker
     */
    showMonthPicker() {
        const monthPicker = this.getElement('monthPicker');
        if (monthPicker) {
            monthPicker.style.display = 'flex';
            this.logger.debug('Month picker shown');
        }
    }

    /**
     * Hide month picker
     */
    hideMonthPicker() {
        const monthPicker = this.getElement('monthPicker');
        if (monthPicker) {
            monthPicker.style.display = 'none';
            this.logger.debug('Month picker hidden');
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

        this.logger.info(`Showing loading state: ${message}`);
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

        this.logger.info('Loading state hidden');
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
        this.logger.error(`${title}: ${message}`);

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

        this.logger.info('Empty state displayed');
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

        this.logger.debug(`Toast shown: ${type} - ${message}`);
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

        this.logger.debug(`Modal opened: ${modalKey}`);
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

        this.logger.debug(`Modal closed: ${modalKey}`);
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
        // Use direct DOM queries for reliability
        const dropdown = document.getElementById(dropdownKey);
        if (!dropdown) {
            return;
        }

        const isOpen = dropdown.classList.contains('open');

        if (isOpen) {
            this.closeDropdownDirect(dropdownKey);
        } else {
            this.openDropdownDirect(dropdownKey);
        }
    }

    /**
     * Open dropdown using direct DOM queries
     * @param {string} dropdownKey - Dropdown element key
     */
    openDropdownDirect(dropdownKey) {
        const dropdown = document.getElementById(dropdownKey);
        const dropdownMenu = document.getElementById(dropdownKey.replace('Dropdown', 'Menu'));
        const dropdownBtn = document.getElementById(dropdownKey.replace('Dropdown', 'Btn'));

        if (dropdown && dropdownMenu && dropdownBtn) {
            dropdown.classList.add('open');
            dropdownBtn.setAttribute('aria-expanded', 'true');
            dropdownMenu.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * Close dropdown using direct DOM queries
     * @param {string} dropdownKey - Dropdown element key
     */
    closeDropdownDirect(dropdownKey) {
        const dropdown = document.getElementById(dropdownKey);
        const dropdownMenu = document.getElementById(dropdownKey.replace('Dropdown', 'Menu'));
        const dropdownBtn = document.getElementById(dropdownKey.replace('Dropdown', 'Btn'));

        if (dropdown && dropdownMenu && dropdownBtn) {
            dropdown.classList.remove('open');
            dropdownBtn.setAttribute('aria-expanded', 'false');
            dropdownMenu.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * Open dropdown
     * @param {string} dropdownKey - Dropdown element key
     */
    openDropdown(dropdownKey) {
        this.logger.debug(`Opening dropdown: ${dropdownKey}`);
        const dropdown = this.getElement(dropdownKey);
        const dropdownMenu = this.getElement(dropdownKey.replace('Btn', 'Menu'));
        const dropdownBtn = this.getElement(dropdownKey);

        this.logger.debug(`Dropdown elements:`, {
            dropdown: !!dropdown,
            dropdownMenu: !!dropdownMenu,
            dropdownBtn: !!dropdownBtn,
            dropdownMenuChildren: dropdownMenu ? dropdownMenu.children.length : 0
        });

        if (dropdown && dropdownMenu && dropdownBtn) {
            dropdown.classList.add('open');
            dropdownBtn.setAttribute('aria-expanded', 'true');
            dropdownMenu.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * Close dropdown
     * @param {string} dropdownKey - Dropdown element key
     */
    closeDropdown(dropdownKey) {
        this.logger.debug(`Closing dropdown: ${dropdownKey}`);
        const dropdown = this.getElement(dropdownKey);
        const dropdownMenu = this.getElement(dropdownKey.replace('Btn', 'Menu'));
        const dropdownBtn = this.getElement(dropdownKey);

        if (dropdown && dropdownMenu && dropdownBtn) {
            this.logger.debug(`Removing 'open' class from dropdown`);
            dropdown.classList.remove('open');
            dropdownBtn.setAttribute('aria-expanded', 'false');
            dropdownMenu.setAttribute('aria-hidden', 'true');
            this.logger.debug(`Dropdown should now be closed`);
        } else {
            this.logger.error(`Missing dropdown elements for: ${dropdownKey}`);
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

        this.logger.debug(`Detail panel opened: ${title}`);
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

        this.logger.debug('Detail panel closed');
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

        this.logger.debug(`Responsive layout updated: ${isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'}`);
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

        this.logger.info(`Theme changed to: ${theme}`);
    }

    /**
     * Handle color theme change
     * @param {CustomEvent} event - Color theme change event
     */
    handleColorThemeChange(event) {
        const { theme, colors } = event.detail;

        // Update color theme button text
        this.updateColorThemeButton(theme);

        this.logger.info(`Color theme changed to: ${theme}`);
    }

    /**
     * Update color theme button
     * @param {string} themeName - Current color theme name
     */
    updateColorThemeButton(themeName) {
        const colorThemeBtn = document.getElementById('colorThemeBtn');
        if (colorThemeBtn) {
            const themeData = this.themeManager.getColorTheme(themeName);
            const displayName = themeData ? themeData.name : 'Default';
            colorThemeBtn.innerHTML = `🎨 ${displayName}`;
            colorThemeBtn.setAttribute('aria-label', `Current color theme: ${displayName}`);
        }
    }

    /**
     * Setup navigation event listeners
     */
    setupNavigationListeners() {
        this.logger.debug('Setting up navigation listeners...');

        // Use direct DOM queries to ensure we find elements
        const overviewBtn = document.getElementById('overviewBtn');
        const propertiesBtn = document.getElementById('propertiesBtn');
        const darkModeToggle = document.getElementById('darkModeToggle');
        const historyBtn = document.getElementById('historyBtn');
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        const colorThemeBtn = document.getElementById('colorThemeBtn');

        this.logger.debug('Direct element queries:', {
            overviewBtn: !!overviewBtn,
            propertiesBtn: !!propertiesBtn,
            darkModeToggle: !!darkModeToggle,
            historyBtn: !!historyBtn,
            undoBtn: !!undoBtn,
            redoBtn: !!redoBtn,
            colorThemeBtn: !!colorThemeBtn
        });

        // Sidebar navigation
        if (overviewBtn) {
            overviewBtn.addEventListener('click', (e) => {
                this.logger.debug('Overview button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.setCurrentView('overview');
                this.emit('viewChange', { view: 'overview' });
            });
            this.logger.debug('Overview button listener attached');
        } else {
            this.logger.warn('Overview button not found');
        }

        if (propertiesBtn) {
            propertiesBtn.addEventListener('click', (e) => {
                this.logger.debug('Properties button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.setCurrentView('properties');
                this.emit('viewChange', { view: 'properties' });
            });
            this.logger.debug('Properties button listener attached');
        } else {
            this.logger.warn('Properties button not found');
        }

        // Header actions
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', (e) => {
                this.logger.debug('Dark mode toggle clicked');
                e.preventDefault();
                e.stopPropagation();
                if (this.themeManager && this.themeManager.toggleTheme) {
                    this.themeManager.toggleTheme();
                }
            });
            this.logger.debug('Dark mode toggle listener attached');
        }

        if (historyBtn) {
            historyBtn.addEventListener('click', (e) => {
                this.logger.debug('History button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.emit('historyClick');
            });
            this.logger.debug('History button listener attached');
        }

        if (undoBtn) {
            undoBtn.addEventListener('click', (e) => {
                this.logger.debug('Undo button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.emit('undoClick');
            });
            this.logger.debug('Undo button listener attached');
        }

        if (redoBtn) {
            redoBtn.addEventListener('click', (e) => {
                this.logger.debug('Redo button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.emit('redoClick');
            });
            this.logger.debug('Redo button listener attached');
        }

        if (colorThemeBtn) {
            this.logger.debug('Color theme button found, attaching listener');
            this.logger.debug('Button attributes:', {
                id: colorThemeBtn.id,
                className: colorThemeBtn.className,
                ariaExpanded: colorThemeBtn.getAttribute('aria-expanded'),
                disabled: colorThemeBtn.disabled,
                style: colorThemeBtn.style.pointerEvents
            });

            colorThemeBtn.addEventListener('click', (e) => {
                this.logger.debug('Color theme button clicked - attempting to toggle dropdown');
                this.logger.debug('Dropdown element exists:', !!document.getElementById('colorThemeDropdown'));
                this.logger.debug('Dropdown menu exists:', !!document.getElementById('colorThemeMenu'));
                e.preventDefault();
                e.stopPropagation();
                this.toggleDropdown('colorThemeDropdown');
            });
            this.logger.debug('Color theme button listener attached');
        } else {
            this.logger.warn('Color theme button not found');
        }

        // Also try to find and setup the dropdown menu click handlers
        const colorThemeMenu = this.getElement('colorThemeMenu');
        if (colorThemeMenu) {
            this.logger.debug('Color theme menu found, children:', colorThemeMenu.children.length);
            this.addEventListener(colorThemeMenu, 'click', (event) => {
                const menuItem = event.target.closest('.dropdown-item');
                if (menuItem) {
                    event.preventDefault();
                    event.stopPropagation();
                    const themeName = menuItem.getAttribute('data-theme');
                    this.logger.debug('Color theme menu item clicked:', themeName);
                    if (themeName && this.themeManager) {
                        this.themeManager.setColorTheme(themeName);
                        this.closeDropdown('colorThemeDropdown');
                    }
                }
            });
            this.logger.debug('Color theme menu click listener attached');
        } else {
            this.logger.warn('Color theme menu not found');
        }

        this.logger.info('Navigation listeners setup complete');
    }

    /**
     * Setup color theme dropdown
     */
    setupColorThemeDropdown() {
        const colorThemeBtn = document.getElementById('colorThemeBtn');
        const colorThemeMenu = document.getElementById('colorThemeMenu');

        if (colorThemeBtn && colorThemeMenu) {
            // Generate dropdown options dynamically from theme definitions
            this.populateColorThemeDropdown();

            // Toggle dropdown on button click
            colorThemeBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.toggleDropdown('colorThemeDropdown');
            });

            // Handle menu item clicks (using event delegation for dynamic content)
            colorThemeMenu.addEventListener('click', (event) => {
                const menuItem = event.target.closest('.dropdown-item');
                if (menuItem) {
                    event.preventDefault();
                    event.stopPropagation();
                    const themeName = menuItem.getAttribute('data-theme');
                    if (themeName && this.themeManager) {
                        this.themeManager.setColorTheme(themeName);
                        this.closeDropdownDirect('colorThemeDropdown');
                    }
                }
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (event) => {
                const dropdown = document.getElementById('colorThemeDropdown');
                if (dropdown && !dropdown.contains(event.target)) {
                    this.closeDropdownDirect('colorThemeDropdown');
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
        const colorThemeMenu = document.getElementById('colorThemeMenu');
        if (!colorThemeMenu) {
            return;
        }

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
            this.logger.warn('Element not found');
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
            this.logger.warn('ThemeManager incomplete; defaulting to light.');
            this.themeManager = { isDarkModeActive: () => false, toggleTheme: () => {} };
        }
        const isDark = this.themeManager.isDarkModeActive();
        const toggleEl = this.getElement('theme-toggle', true); // createIfMissing=true from prev.
        if (toggleEl) {
            toggleEl.classList.toggle('dark-mode', isDark);
            toggleEl.textContent = isDark ? 'Light' : 'Dark';
        } else {
            this.logger.warn('Theme toggle element missing.');
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

        this.logger.info('UI manager cleaned up');
    }

    /**
     * Show onboarding tooltips for empty state
     */
    showOnboardingTooltips() {
        this.logger.info('Showing onboarding tooltips for empty state');

        // Remove any existing tooltips first
        this.hideOnboardingTooltips();

        // Create tooltip for history button (import data or snapshot)
        const historyBtn = this.getElement('historyBtn');
        if (historyBtn) {
            this.createTooltip(historyBtn, 'Import data or snapshot', 'bottom', 'history-tooltip');
        }

        // Create tooltip for properties button (add property)
        const propertiesBtn = this.getElement('propertiesBtn');
        if (propertiesBtn) {
            this.createTooltip(propertiesBtn, 'Add property', 'right', 'properties-tooltip');
        }

        this.logger.info('Onboarding tooltips displayed');
    }

    /**
     * Hide onboarding tooltips
     */
    hideOnboardingTooltips() {
        // Remove existing tooltips
        const existingTooltips = document.querySelectorAll('.onboarding-tooltip');
        existingTooltips.forEach(tooltip => tooltip.remove());

        this.logger.info('Onboarding tooltips hidden');
    }

    /**
     * Create a tooltip for an element
     * @param {HTMLElement} targetElement - Element to attach tooltip to
     * @param {string} text - Tooltip text
     * @param {string} position - Tooltip position ('top', 'bottom', 'left', 'right')
     * @param {string} tooltipId - Unique ID for the tooltip
     */
    createTooltip(targetElement, text, position = 'top', tooltipId = null) {
        if (!targetElement) {
            this.logger.warn('Cannot create tooltip: target element not found');
            return;
        }

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'onboarding-tooltip';
        tooltip.textContent = text;
        tooltip.setAttribute('data-position', position);
        if (tooltipId) {
            tooltip.id = tooltipId;
        }

        // Position the tooltip
        this.positionTooltip(tooltip, targetElement, position);

        // Add to DOM
        document.body.appendChild(tooltip);

        // Add animation class after a brief delay
        setTimeout(() => {
            tooltip.classList.add('visible');
        }, 100);

        // Auto-hide after 10 seconds
        setTimeout(() => {
            this.hideTooltip(tooltip);
        }, 10000);

        // Hide on click
        targetElement.addEventListener('click', () => {
            this.hideTooltip(tooltip);
        }, { once: true });

        this.logger.debug(`Created tooltip: ${text} on ${targetElement.id || targetElement.className}`);
    }

    /**
     * Position tooltip relative to target element
     * @param {HTMLElement} tooltip - Tooltip element
     * @param {HTMLElement} target - Target element
     * @param {string} position - Position ('top', 'bottom', 'left', 'right')
     */
    positionTooltip(tooltip, target, position) {
        const targetRect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top, left;

        switch (position) {
            case 'top':
                top = targetRect.top - 10 - tooltipRect.height;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'bottom':
                top = targetRect.bottom + 10;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'left':
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                left = targetRect.left - 10 - tooltipRect.width;
                break;
            case 'right':
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                left = targetRect.right + 10;
                break;
            default:
                // Default to bottom
                top = targetRect.bottom + 10;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        }

        // Ensure tooltip stays within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left < 10) left = 10;
        if (left + tooltipRect.width > viewportWidth - 10) {
            left = viewportWidth - tooltipRect.width - 10;
        }
        if (top < 10) top = 10;
        if (top + tooltipRect.height > viewportHeight - 10) {
            top = viewportHeight - tooltipRect.height - 10;
        }

        tooltip.style.position = 'fixed';
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.zIndex = '10000';
    }

    /**
     * Hide a specific tooltip
     * @param {HTMLElement} tooltip - Tooltip element to hide
     */
    hideTooltip(tooltip) {
        if (tooltip && tooltip.parentNode) {
            tooltip.classList.remove('visible');
            setTimeout(() => {
                if (tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
            }, 300); // Allow time for fade out animation
        }
    }

    /**
     * Debug UI information
     */
    debug() {
        this.logger.info('=== UI MANAGER INFO ===');
        this.logger.info('Cached elements:', this.elements.size);
        this.logger.info('Active modals:', this.activeModals.size);
        this.logger.info('Current view:', this.currentView);
        this.logger.info('Is loading:', this.isLoading);
        this.logger.info('Event listeners:', this.eventListeners.size);
        this.logger.info('Statistics:', this.getUIStatistics());
        this.logger.info('=== END DEBUG ===');
    }
}

// Export for use in other modules
export default UIManager;

// Expose globally for Babel standalone transpilation
window.UIManager = UIManager;
