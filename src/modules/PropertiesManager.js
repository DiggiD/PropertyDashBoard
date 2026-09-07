/**
 * PropertiesManager Module
 * Handles the properties dashboard functionality
 * - Property CRUD operations
 * - Category/Subcategory management per property
 * - Expense data entry and editing
 */

import logger from './utils/Logger.js';

class PropertiesManager {
    constructor(dataManager, uiManager, historyManager, chartRenderer) {
        this.dataManager = dataManager;
        this.uiManager = uiManager;
        this.historyManager = historyManager;
        this.chartRenderer = chartRenderer;

        // Current state
        this.currentPropertyId = null;
        this.currentCategoryPath = null; // For hierarchical navigation
        this.isEditMode = false;

        // Double-click detection and single-click delay
        this.clickCounters = new Map();
        this.pendingSelections = new Map();

        // Long press detection
        this.longPressTimers = new Map();
        this.pendingLongPresses = new Map();
        this.longPressDuration = 500; // ms
        this.visibleDeleteButtons = new Map();

        logger.info('PROPERTIES', 'PropertiesManager initialized');
    }

    /**
     * Show tooltip for add button
     */
    showAddButtonTooltip(button, event) {
        // Remove any existing tooltip
        this.hideAddButtonTooltip();

        // Determine button type and tooltip text
        let tooltipText = '';
        if (button.id === 'add-property-btn') {
            tooltipText = 'Add Property';
        } else if (button.id === 'add-category-btn') {
            tooltipText = 'Add Category';
        } else if (button.id === 'add-subcategory-btn') {
            tooltipText = 'Add Subcategory';
        }

        if (!tooltipText) {return;}

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'add-button-tooltip';
        tooltip.textContent = tooltipText;
        tooltip.style.cssText = `
            position: fixed;
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-base);
            padding: var(--space-8) var(--space-12);
            font-size: var(--font-size-sm);
            color: var(--color-text);
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            pointer-events: none;
            white-space: nowrap;
            max-width: 200px;
            text-align: center;
        `;

        // Position tooltip above the button
        const buttonRect = button.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        // Calculate position (centered above button)
        let top = buttonRect.top - 40; // 40px above button
        let left = buttonRect.left + (buttonRect.width / 2) - (tooltipRect.width / 2);

        // Ensure tooltip stays within viewport
        if (left < 10) {left = 10;}
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        // If not enough space above, position below
        if (top < 10) {
            top = buttonRect.bottom + 10;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;

        // Add to DOM
        document.body.appendChild(tooltip);

        // Store reference for cleanup
        this.currentTooltip = tooltip;
    }

    /**
     * Hide add button tooltip
     */
    hideAddButtonTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
    }

    /**
     * Show tooltip for delete button
     */
    showDeleteButtonTooltip(button, event) {
        if (!button) {return;}
        // Remove any existing tooltip
        this.hideAddButtonTooltip();

        // Determine button type and tooltip text
        let tooltipText = '';
        if (button.classList.contains('property-action')) {
            tooltipText = 'Delete Property';
        } else if (button.classList.contains('category-action')) {
            if (button.dataset.subcategory) {
                tooltipText = 'Delete Subcategory';
            } else {
                tooltipText = 'Delete Category';
            }
        }

        if (!tooltipText) {return;}

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'delete-button-tooltip';
        tooltip.textContent = tooltipText;
        tooltip.style.cssText = `
            position: fixed;
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-base);
            padding: var(--space-8) var(--space-12);
            font-size: var(--font-size-sm);
            color: var(--color-text);
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            pointer-events: none;
            white-space: nowrap;
            max-width: 200px;
            text-align: center;
        `;

        // Add to DOM temporarily to get dimensions
        document.body.appendChild(tooltip);
        const tooltipRect = tooltip.getBoundingClientRect();

        // Get dashboard container bounds for positioning constraints
        const container = this.uiManager.getElement('propertiesDashboard');
        const containerRect = container ? container.getBoundingClientRect() : null;

        // Position tooltip above the button
        const buttonRect = button.getBoundingClientRect();

        // Calculate position (centered above button)
        let top = buttonRect.top - 40; // 40px above button
        let left = buttonRect.left + (buttonRect.width / 2) - (tooltipRect.width / 2);

        // Use container bounds if available, otherwise fallback to viewport
        const maxLeft = containerRect ? containerRect.right - tooltipRect.width - 10 : window.innerWidth - tooltipRect.width - 10;
        const minLeft = containerRect ? containerRect.left + 10 : 10;

        // Ensure tooltip stays within bounds
        if (left < minLeft) {left = minLeft;}
        if (left > maxLeft) {left = maxLeft;}

        // If not enough space above, position below
        if (top < 10) {
            top = buttonRect.bottom + 10;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;

        // Store reference for cleanup
        this.currentTooltip = tooltip;
    }

    /**
     * Hide delete button tooltip
     */
    hideDeleteButtonTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
    }

    /**
     * Initialize properties manager
     */
    async initialize() {
        try {
            logger.info('PROPERTIES', 'Starting PropertiesManager initialization...');

            // Ensure dependencies are available
            if (!this.dataManager) {
                throw new Error('DataManager not available');
            }
            if (!this.uiManager) {
                throw new Error('UIManager not available');
            }
            if (!this.historyManager) {
                throw new Error('HistoryManager not available');
            }

            this.setupEventListeners();
            this.renderPropertiesDashboard();

            // Initialize header year/month pickers
            this.initializeHeaderPickers();

            logger.info('PROPERTIES', 'PropertiesManager initialized successfully');
        } catch (error) {
            console.error('[PROPERTIES] Error during initialization:', error);
            // Don't re-throw the error to prevent breaking the application
            // Just log it and continue with limited functionality
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Use event delegation on the properties dashboard container
        const container = this.uiManager.getElement('propertiesDashboard');
        if (container) {
            // Remove existing event listeners to prevent duplicates
            this.uiManager.removeEventListener(container, 'dblclick');
            this.uiManager.removeEventListener(container, 'click');
            this.uiManager.removeEventListener(container, 'mouseover');
            this.uiManager.removeEventListener(container, 'mouseout');
            this.uiManager.removeEventListener(container, 'blur');
            this.uiManager.removeEventListener(container, 'keydown');
            this.uiManager.removeEventListener(container, 'mousedown');
            this.uiManager.removeEventListener(container, 'mouseup');
            this.uiManager.removeEventListener(container, 'mousemove');
            this.uiManager.removeEventListener(container, 'touchstart');
            this.uiManager.removeEventListener(container, 'touchend');
            this.uiManager.removeEventListener(container, 'touchmove');

            // Add tooltip functionality for add buttons
            this.uiManager.addEventListener(container, 'mouseover', (e) => {
                const target = e.target.closest('#add-property-btn, #add-category-btn, #add-subcategory-btn');
                if (target) {
                    this.showAddButtonTooltip(target, e);
                }
            });

            this.uiManager.addEventListener(container, 'mouseout', (e) => {
                const target = e.target.closest('#add-property-btn, #add-category-btn, #add-subcategory-btn');
                if (target) {
                    this.hideAddButtonTooltip();
                }
            });

            // Add tooltip functionality for delete buttons
            this.uiManager.addEventListener(container, 'mouseover', (e) => {
                const target = e.target.closest('.property-action[data-action="delete"], .category-action[data-action="delete"]');
                if (target) {
                    this.showDeleteButtonTooltip(target, e);
                }
            });

            this.uiManager.addEventListener(container, 'mouseout', (e) => {
                const target = e.target.closest('.property-action[data-action="delete"], .category-action[data-action="delete"]');
                if (target) {
                    this.hideDeleteButtonTooltip();
                }
            });

            // Double-click for inline editing of names
            this.uiManager.addEventListener(container, 'dblclick', (e) => {
                const editableElement = e.target.closest('.property-name.editable, .category-name.editable, .subcategory-name.editable');
                if (!editableElement) {return;}

                // Constrain to direct clicks on the name text (not padding/margins)
                const rect = editableElement.getBoundingClientRect();
                const clickX = e.clientX;
                const clickY = e.clientY;

                // Check if click is within the text bounds (rough approximation)
                const textWidth = editableElement.scrollWidth;
                const textHeight = editableElement.scrollHeight;
                const isInTextArea = clickX >= rect.left && clickX <= rect.left + textWidth &&
                                   clickY >= rect.top && clickY <= rect.top + textHeight;

                if (!isInTextArea) {return;}

                // Cancel any pending selection for this item
                const itemElement = editableElement.closest('.property-item');
                if (itemElement) {
                    const itemId = itemElement.dataset.propertyId || itemElement.dataset.category || itemElement.dataset.subcategory;
                    if (this.pendingSelections.has(itemId)) {
                        clearTimeout(this.pendingSelections.get(itemId));
                        this.pendingSelections.delete(itemId);
                    }
                }

                // Double-click detected on name text
                if (editableElement.classList.contains('property-name')) {
                    this.handlePropertyNameEdit(e);
                } else if (editableElement.classList.contains('category-name')) {
                    this.handleCategoryNameEdit(e);
                } else if (editableElement.classList.contains('subcategory-name')) {
                    this.handleSubcategoryNameEdit(e);
                }

                // Stop propagation to prevent selection from interfering with editing
                e.stopImmediatePropagation();
            });

            // Single-click for other interactions (with double-click protection)
            this.uiManager.addEventListener(container, 'click', (e) => {
                // Ensure we're working with an element, not a text node
                const target = e.target.nodeType === Node.TEXT_NODE ? e.target.parentElement : e.target;

                // First, handle delete button clicks to prevent them from being hidden
                const deleteAction = target.closest('.property-action[data-action="delete"], .category-action[data-action="delete"]');
                if (deleteAction) {
                    // Route to appropriate handler based on button type
                    if (deleteAction.classList.contains('property-action')) {
                        this.handlePropertyAction(e);
                    } else if (deleteAction.classList.contains('category-action')) {
                        this.handleCategoryAction(e);
                    }
                    return; // Don't process further click logic for delete actions
                }

                // Check if there's a visible delete button and click is outside the item
                if (this.currentVisibleDeleteItem) {
                    const isClickOnDeleteButton = target.closest('[data-action="delete"]') !== null;
                    const isClickInsideItem = this.currentVisibleDeleteItem.contains(target);
                    const isClickOnConfirmation = target.closest('.delete-confirmation-overlay') !== null;

                    if (!isClickOnDeleteButton && !isClickInsideItem && !isClickOnConfirmation) {
                        this.hideDeleteButtons();
                        this.currentVisibleDeleteItem = null;
                    }
                }

                // Check if this click is part of a double-click sequence
                const editableElement = e.target.closest('.property-name.editable, .category-name.editable, .subcategory-name.editable');
                if (editableElement) {
                    // For editable names, delay selection to allow double-click to cancel it
                    const itemElement = editableElement.closest('.property-item');
                    if (itemElement && !this.currentVisibleDeleteItem) {
                        const itemId = itemElement.dataset.propertyId || itemElement.dataset.category || itemElement.dataset.subcategory;
                        if (this.pendingSelections.has(itemId)) {
                            clearTimeout(this.pendingSelections.get(itemId));
                        }
                        const timeoutId = setTimeout(() => {
                            this.pendingSelections.delete(itemId);
                            this.handleItemClick(e);
                        }, 300);
                        this.pendingSelections.set(itemId, timeoutId);
                    }
                    return;
                }

                // Only process other interactions if no delete button is visible
                if (!this.currentVisibleDeleteItem) {
                    if (e.target.closest('.expense-value')) {
                        this.handleExpenseEdit(e);
                    } else if (e.target.closest('.property-action')) {
                        this.handlePropertyAction(e);
                    } else if (e.target.closest('.category-action')) {
                        this.handleCategoryAction(e);
                    } else if (e.target.closest('.property-item')) {
                        this.handleItemClick(e);
                    } else if (e.target.closest('#add-property-btn')) {
                        this.handleAddProperty();
                    } else if (e.target.closest('#add-category-btn')) {
                        this.handleAddCategory();
                    } else if (e.target.closest('#add-subcategory-btn')) {
                        this.handleAddSubcategory();
                    } else if (e.target.closest('.back-btn')) {
                        this.handleBackNavigation();
                    } else {
                        // Clear selection when clicking outside button tiles
                        this.clearSelection();
                    }
                }
            });

            // Mouse interactions for highlighting
            this.uiManager.addEventListener(container, 'mouseover', (e) => {
                if (e.target.closest('.property-item')) {
                    this.handlePropertyHover(e, true);
                } else if (e.target.closest('.category-item')) {
                    this.handleCategoryHover(e, true);
                } else if (e.target.closest('.value-item')) {
                    this.handleValueItemHover(e, true);
                } else if (e.target.closest('.expense-value')) {
                    this.handleExpenseValueHover(e, true);
                }
            });

            this.uiManager.addEventListener(container, 'mouseout', (e) => {
                if (e.target.closest('.property-item')) {
                    this.handlePropertyHover(e, false);
                } else if (e.target.closest('.category-item')) {
                    this.handleCategoryHover(e, false);
                } else if (e.target.closest('.value-item')) {
                    this.handleValueItemHover(e, false);
                } else if (e.target.closest('.expense-value')) {
                    this.handleExpenseValueHover(e, false);
                }
            });

            // Property name editing
            this.uiManager.addEventListener(container, 'blur', (e) => {
                if (e.target.closest('.property-name-input')) {
                    this.handlePropertyNameSave(e);
                } else if (e.target.closest('.category-name-input')) {
                    this.handleCategoryNameSave(e);
                } else if (e.target.closest('.subcategory-name-input')) {
                    this.handleSubcategoryNameSave(e);
                }
            }, true);

            this.uiManager.addEventListener(container, 'keydown', (e) => {
                if (e.target.closest('.property-name-input')) {
                    this.handlePropertyNameKeydown(e);
                } else if (e.target.closest('.category-name-input')) {
                    this.handleCategoryNameKeydown(e);
                } else if (e.target.closest('.subcategory-name-input')) {
                    this.handleSubcategoryNameKeydown(e);
                }
            });

            // Long press detection for delete buttons
            this.uiManager.addEventListener(container, 'mousedown', (e) => {
                const propertyItem = e.target.closest('.property-item');
                if (propertyItem && !e.target.closest('.property-action, .category-action')) {
                    this.startLongPressDetection(propertyItem, e);
                }
            });

            this.uiManager.addEventListener(container, 'mouseup', (e) => {
                this.cancelLongPressDetection();
            });

            // Touch events for mobile
            this.uiManager.addEventListener(container, 'touchstart', (e) => {
                const propertyItem = e.target.closest('.property-item');
                if (propertyItem && !e.target.closest('.property-action, .category-action')) {
                    this.startLongPressDetection(propertyItem, e.touches[0]);
                }
            });

            this.uiManager.addEventListener(container, 'touchend', (e) => {
                this.cancelLongPressDetection();
            });

            this.uiManager.addEventListener(container, 'touchmove', (e) => {
                if (this.longPressTimers.size > 0) {
                    // Cancel long press if touch moves significantly
                    this.cancelLongPressDetection();
                }
            });
        }

        // Listen to time period change events from the header pickers
        document.addEventListener('yearChange', (e) => {
            logger.info('PROPERTIES', `Year changed to: ${e.detail.selectedYear}`);
            this.handleTimePeriodChange();
        });

        document.addEventListener('monthChange', (e) => {
            logger.info('PROPERTIES', `Month changed to: ${e.detail.selectedMonth}`);
            this.handleTimePeriodChange();
        });

        logger.info('PROPERTIES', 'Event listeners setup');
    }

    /**
     * Render the properties dashboard
     */
    renderPropertiesDashboard() {
        const properties = this.dataManager.getProperties();
        const container = this.uiManager.getElement('propertiesDashboard');

        if (!container) {
            logger.error('PROPERTIES', 'Properties dashboard container not found');
            return;
        }

        // Update header pickers to reflect current selections
        this.updateHeaderPickerSelections();

        // Always render the multi-panel layout
        const html = this.renderMultiPanelLayout(properties);

        // Update the dashboard content
        const contentElement = container.querySelector('.dashboard-content');
        if (contentElement) {
            contentElement.innerHTML = html;
        }

        logger.info('PROPERTIES', 'Properties dashboard rendered');
    }

    /**
     * Render multi-panel layout
     */
    renderMultiPanelLayout(properties) {
        const selectedProperty = this.currentPropertyId ? this.dataManager.getPropertyById(this.currentPropertyId) : null;
        const categories = selectedProperty ? this.getPropertyCategories(selectedProperty) : [];
        const selectedCategory = this.currentCategoryPath ? this.currentCategoryPath.category : null;
        const selectedSubcategory = this.currentCategoryPath ? this.currentCategoryPath.subcategory : null;

        // Determine if selected category is hierarchical
        let isSelectedCategoryHierarchical = false;
        if (selectedCategory && selectedProperty) {
            const expenseValue = this.getCategoryExpenseValue(selectedProperty, selectedCategory);
            isSelectedCategoryHierarchical = typeof expenseValue === 'object' && expenseValue !== null;
        }

        return `
            <div class="properties-multi-panel">

                <!-- Panel 1: Properties -->
                <div class="panel properties-panel">
                    <div class="panel-header">
                        <button class="btn btn--outline btn--sm" id="add-property-btn" title="Add Property">
                            +
                        </button>
                    </div>
                    <div class="panel-content">
                        ${this.renderPropertiesPanel(properties)}
                    </div>
                </div>

                <!-- Panel 2: Categories -->
                <div class="panel categories-panel">
                    <div class="panel-header">
                        ${selectedProperty ? `
                            <button class="btn btn--outline btn--sm" id="add-category-btn" title="Add Category">
                                +
                            </button>
                        ` : ''}
                    </div>
                    <div class="panel-content">
                        ${selectedProperty ? this.renderCategoriesPanel(categories, selectedProperty) : ''}
                    </div>
                </div>

                <!-- Panel 3: Subcategories -->
                <div class="panel subcategories-panel">
                    <div class="panel-header">
                        ${selectedCategory && selectedProperty && isSelectedCategoryHierarchical ? `
                            <button class="btn btn--outline btn--sm" id="add-subcategory-btn" title="Add Subcategory">
                                +
                            </button>
                        ` : ''}
                    </div>
                    <div class="panel-content">
                        ${selectedCategory && isSelectedCategoryHierarchical ? this.renderSubcategoriesPanel(selectedProperty, selectedCategory, selectedSubcategory) : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render properties panel
     */
    renderPropertiesPanel(properties) {
        if (properties.length === 0) {
            return `
                <div class="empty-state">
                    <h5>No Properties Yet</h5>
                    <p>Start by adding your first property</p>
                </div>
            `;
        }

        // Sort properties by total amount (highest to lowest)
        const sortedProperties = properties.slice().sort((a, b) => {
            const dataA = this.dataManager.getCurrentPeriodData(a);
            const dataB = this.dataManager.getCurrentPeriodData(b);
            const totalA = dataA && dataA.total !== undefined ? dataA.total : 0;
            const totalB = dataB && dataB.total !== undefined ? dataB.total : 0;

            // Sort by amount descending, then by name ascending for stable sort
            if (totalB !== totalA) {
                return totalB - totalA;
            }
            return (a.name || '').localeCompare(b.name || '');
        });

        const hasSelected = sortedProperties.some(property => property.id === this.currentPropertyId);

        return `
            <div class="properties-list ${hasSelected ? 'has-selected' : ''}">
                ${sortedProperties.map(property => {
        const isSelected = property.id === this.currentPropertyId;
        const currentData = this.dataManager.getCurrentPeriodData(property);
        const categoryCount = Object.keys(property.expenses || {}).length;
        const totalValue = currentData && currentData.total !== undefined ? currentData.total : 0;
        const formattedTotal = this.uiManager.formatter ? this.uiManager.formatter.formatCurrency(totalValue) : totalValue;

        return `
                        <div class="property-item ${isSelected ? 'selected' : ''}" data-property-id="${property.id || ''}">
                            <div class="property-info">
                                <h5 class="property-name editable" data-property-id="${property.id || ''}">${property.name || 'Unnamed Property'}</h5>
                                <div class="property-meta">
                                    <span class="property-total">${formattedTotal}</span>
                                </div>
                            </div>
                            <div class="property-actions">
                                <button class="property-action delete-hidden btn btn--outline btn--sm" data-action="delete" data-property-id="${property.id || ''}" title="Delete property">
                                    ×
                                </button>
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        `;
    }

    /**
     * Render categories panel
     */
    renderCategoriesPanel(categories, property) {
        if (categories.length === 0) {
            return `
                <div class="properties-list">
                    <div class="property-item">
                        <div class="property-info">
                            <h5 class="property-name">No Categories Yet</h5>
                            <div class="property-meta">
                                <span class="property-total">Add expense categories</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Sort categories by expense value (highest to lowest)
        const sortedCategories = categories.slice().sort((a, b) => {
            const valueA = this.getCategoryExpenseValue(property, a);
            const valueB = this.getCategoryExpenseValue(property, b);

            // Calculate actual amounts for comparison
            const amountA = typeof valueA === 'object' && valueA !== null ? this.sumObjectValues(valueA) : (valueA || 0);
            const amountB = typeof valueB === 'object' && valueB !== null ? this.sumObjectValues(valueB) : (valueB || 0);

            // Sort by amount descending, then by name ascending for stable sort
            if (amountB !== amountA) {
                return amountB - amountA;
            }
            return (a || '').localeCompare(b || '');
        });

        const hasSelected = sortedCategories.some(category => category === this.currentCategoryPath?.category);

        return `
            <div class="properties-list ${hasSelected ? 'has-selected' : ''}">
                ${sortedCategories.map(category => {
        const isSelected = category === this.currentCategoryPath?.category;
        const expenseValue = this.getCategoryExpenseValue(property, category);
        const isHierarchical = typeof expenseValue === 'object' && expenseValue !== null;
        const displayValue = isHierarchical ?
            `${this.uiManager.formatter ? this.uiManager.formatter.formatCurrency(this.sumObjectValues(expenseValue)) : this.sumObjectValues(expenseValue)}` :
            `${this.uiManager.formatter ? this.uiManager.formatter.formatCurrency(expenseValue || 0) : (expenseValue || 0)}`;

        if (isHierarchical) {
            // Hierarchical category - original layout with navigation
            return `
                            <div class="property-item ${isSelected ? 'selected' : ''}" data-category="${category || ''}">
                                <div class="property-info">
                                    <h5 class="category-name editable" data-category="${category || ''}" title="Click to edit category name">${category || 'Unnamed Category'}</h5>
                                    <div class="property-meta">
                                        <span class="property-total">${displayValue}</span>
                                    </div>
                                </div>
                                <div class="category-actions">
                                    <button class="category-action delete-hidden btn btn--outline btn--sm" data-action="delete" data-category="${category || ''}" title="Delete category">
                                        ×
                                    </button>
                                </div>
                            </div>
                        `;
        } else {
            // Non-hierarchical category - inline name and value
            return `
                            <div class="property-item ${isSelected ? 'selected' : ''}" data-category="${category || ''}">
                                <div class="property-info">
                                    <div class="subcategory-inline">
                                        <span class="category-name editable" data-category="${category || ''}" title="Click to edit category name">${category || 'Unnamed Category'}</span>
                                        <div class="expense-value editable" data-category="${category || ''}" title="Click to edit value">
                                            ${displayValue}
                                        </div>
                                    </div>
                                </div>
                                <div class="category-actions">
                                    <button class="category-action delete-hidden btn btn--outline btn--sm" data-action="delete" data-category="${category || ''}" title="Delete category">
                                        ×
                                    </button>
                                </div>
                            </div>
                        `;
        }
    }).join('')}
            </div>
        `;
    }

    /**
     * Render subcategories panel (shows flat categories for editing or subcategories for hierarchical categories)
     */
    renderSubcategoriesPanel(property, category, subcategory) {
        const expenseValue = this.getCategoryExpenseValue(property, category);
        const isHierarchical = typeof expenseValue === 'object' && expenseValue !== null;

        if (!isHierarchical) {
            // Flat category - show the single value for editing with inline name and value
            const displayValue = `${this.uiManager.formatter ? this.uiManager.formatter.formatCurrency(expenseValue || 0) : (expenseValue || 0)}`;
            return `
                <div class="properties-list">
                    <div class="property-item" data-category="${category}">
                        <div class="property-info">
                            <div class="subcategory-inline">
                                <span class="category-name editable" data-category="${category}" title="Click to edit category name">${category}</span>
                                <div class="expense-value editable" data-category="${category}" title="Click to edit value">
                                    ${displayValue}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Hierarchical category - show subcategories as selectable items
            // Sort subcategories by value (highest to lowest)
            const sortedSubcategories = Object.entries(expenseValue).sort((a, b) => {
                const valueA = a[1] || 0;
                const valueB = b[1] || 0;

                // Sort by amount descending, then by name ascending for stable sort
                if (valueB !== valueA) {
                    return valueB - valueA;
                }
                return (a[0] || '').localeCompare(b[0] || '');
            });

            const hasSelected = sortedSubcategories.some(([subcat]) => subcat === subcategory);

            return `
                <div class="properties-list ${hasSelected ? 'has-selected' : ''}">
                    ${sortedSubcategories.map(([subcat, value]) => {
        const isSelected = subcat === subcategory;
        const displayValue = `${this.uiManager.formatter ? this.uiManager.formatter.formatCurrency(value || 0) : (value || 0)}`;

        return `
                    <div class="property-item ${isSelected ? 'selected' : ''}" data-category="${category}" data-subcategory="${subcat}">
                        <div class="property-info">
                            <div class="subcategory-inline">
                                <span class="subcategory-name editable" data-category="${category}" data-subcategory="${subcat}" title="Click to edit subcategory name">${subcat}</span>
                                <div class="expense-value editable" data-category="${category}" data-subcategory="${subcat}" title="Click to edit value">
                                    ${displayValue}
                                </div>
                            </div>
                        </div>
                        <div class="subcategory-actions">
                            <button class="category-action delete-hidden btn btn--outline btn--sm" data-action="delete" data-category="${category}" data-subcategory="${subcat}" title="Delete subcategory">
                                ×
                            </button>
                        </div>
                    </div>
                `;
    }).join('')}
                </div>
            `;
        }
    }

    /**
     * Render empty panel
     */
    renderEmptyPanel(message) {
        return `
            <div class="empty-state">
                <h5>Nothing Selected</h5>
                <p>${message}</p>
            </div>
        `;
    }

    /**
     * Render properties list
     */
    renderPropertiesList(properties) {
        if (properties.length === 0) {
            return `
                <div class="empty-state">
                    <h3>No Properties Yet</h3>
                    <p>Start by adding your first property to track expenses</p>
                    <button class="btn btn--primary" id="add-property-btn">
                        Add Property
                    </button>
                </div>
            `;
        }

        return `
            <div class="properties-list">
                <div class="properties-header">
                    <h3>Your Properties</h3>
                    <button class="btn btn--outline btn--sm" id="add-property-btn">
                        Add Property
                    </button>
                </div>
                <div class="properties-grid">
                    ${properties.map(property => this.renderPropertyItem(property)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render property item
     */
    renderPropertyItem(property) {
        try {
            const currentData = this.dataManager.getCurrentPeriodData(property);
            const categoryCount = Object.keys(property.expenses || {}).length;
            const totalValue = currentData && currentData.total !== undefined ? currentData.total : 0;
            const formattedTotal = this.uiManager.formatter ? this.uiManager.formatter.formatCurrency(totalValue) : totalValue;

            return `
                <div class="property-item" data-property-id="${property.id || ''}">
                    <div class="property-header">
                        <div class="property-info">
                            <h4 class="property-name">${property.name || 'Unnamed Property'}</h4>
                            <div class="property-meta">
                                <span class="property-categories">${categoryCount} categories</span>
                                <span class="property-total">${formattedTotal}</span>
                            </div>
                        </div>
                        <div class="property-actions">
                            <button class="property-action" data-action="edit" data-property-id="${property.id || ''}" title="Edit property">
                                Edit
                            </button>
                            <button class="property-action" data-action="delete" data-property-id="${property.id || ''}" title="Delete property">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('[PROPERTIES] Error rendering property item:', error);
            return `
                <div class="property-item error">
                    <div class="property-header">
                        <div class="property-info">
                            <h4 class="property-name">Error loading property</h4>
                            <div class="property-meta">
                                <span class="property-error">Unable to load property data</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Render property details
     */
    renderPropertyDetails() {
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property) {
            this.currentPropertyId = null;
            this.renderPropertiesDashboard();
            return;
        }

        const currentData = this.dataManager.getCurrentPeriodData(property);
        const categories = this.getPropertyCategories(property);

        return `
            <div class="property-details">
                <div class="property-details-header">
                    <button class="back-btn btn btn--outline btn--sm">
                        Back to Properties
                    </button>
                    <div class="property-title">
                        <h3>${property.name}</h3>
                        <div class="property-summary">
                            <span class="summary-item">Total: ${this.uiManager.formatter ? this.uiManager.formatter.formatCurrency(currentData.total) : currentData.total}</span>
                            <span class="summary-item">${categories.length} categories</span>
                        </div>
                    </div>
                    <div class="property-actions">
                        <button class="btn btn--outline btn--sm" id="add-category-btn">
                            Add Category
                        </button>
                    </div>
                </div>

                <div class="categories-section">
                    ${this.renderCategoriesList(categories, property)}
                </div>
            </div>
        `;
    }

    /**
     * Render category item
     */
    renderCategoryItem(category, property) {
        const isSelected = category === this.currentCategoryPath?.category;
        const expenseValue = this.getCategoryExpenseValue(property, category);
        const isHierarchical = typeof expenseValue === 'object' && expenseValue !== null;
        const displayValue = isHierarchical ?
            `${this.uiManager.formatter ? this.uiManager.formatter.formatCurrency(this.sumObjectValues(expenseValue)) : this.sumObjectValues(expenseValue)}` :
            `${this.uiManager.formatter ? this.uiManager.formatter.formatCurrency(expenseValue || 0) : (expenseValue || 0)}`;

        if (isHierarchical) {
            // Hierarchical category - original layout with navigation
            return `
                <div class="property-item ${isSelected ? 'selected' : ''}" data-category="${category || ''}">
                    <div class="property-info">
                        <h5 class="category-name editable" data-category="${category || ''}" title="Click to edit category name">${category || 'Unnamed Category'}</h5>
                        <div class="property-meta">
                            <span class="property-total">${displayValue}</span>
                        </div>
                    </div>
                    <div class="category-actions">
                        <button class="category-action delete-hidden btn btn--outline btn--sm" data-action="delete" data-category="${category || ''}" title="Delete category">
                            ×
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Non-hierarchical category - inline name and value
            return `
                <div class="property-item ${isSelected ? 'selected' : ''}" data-category="${category || ''}">
                    <div class="property-info">
                        <div class="subcategory-inline">
                            <span class="category-name editable" data-category="${category || ''}" title="Click to edit category name">${category || 'Unnamed Category'}</span>
                            <div class="expense-value editable" data-category="${category || ''}" title="Click to edit value">
                                ${displayValue}
                            </div>
                        </div>
                    </div>
                    <div class="category-actions">
                        <button class="category-action delete-hidden btn btn--outline btn--sm" data-action="delete" data-category="${category || ''}" title="Delete category">
                            ×
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Render categories list
     */
    renderCategoriesList(categories, property) {
        if (categories.length === 0) {
            return `
                <div class="empty-state">
                    <h4>No Categories Yet</h4>
                    <p>Add expense categories to start tracking costs</p>
                    <button class="btn btn--primary" id="add-category-btn">
                        Add Category
                    </button>
                </div>
            `;
        }

        return `
            <div class="categories-list">
                ${categories.map(category => this.renderCategoryItem(category, property)).join('')}
            </div>
        `;
    }

    /**
     * Show add property modal
     */
    showAddPropertyModal() {
        const timestamp = Date.now();
        const modalHtml = `
            <div class="modal-header">
                <h3>Add New Property</h3>
                <button class="modal-close" id="closePropertyModal-${timestamp}">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label" for="new-property-name-${timestamp}">Property Name</label>
                    <input type="text" id="new-property-name-${timestamp}" class="form-control" placeholder="Enter property name" maxlength="100">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn--outline" id="cancelProperty-${timestamp}">Cancel</button>
                <button class="btn btn--primary" id="confirm-add-property-${timestamp}">Add Property</button>
            </div>
        `;

        this.showModal('addPropertyModal', modalHtml);

        // Setup confirm button
        const confirmBtn = document.getElementById(`confirm-add-property-${timestamp}`);
        const input = document.getElementById(`new-property-name-${timestamp}`);

        const handleConfirm = () => {
            const name = input.value.trim();
            if (name) {
                this.addProperty(name);
                this.closeModal('addPropertyModal');
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {handleConfirm();}
        });

        input.focus();
    }

    /**
     * Render subcategories for hierarchical category
     */
    renderSubcategories(category, subcategories) {
        return `
            <div class="subcategories">
                ${Object.entries(subcategories).map(([subcategory, value]) =>
        `<div class="subcategory-item">
                        <span class="subcategory-name">${subcategory}</span>
                        <div class="subcategory-value expense-value" data-category="${category}" data-subcategory="${subcategory}">
                            ${this.uiManager.formatter ? this.uiManager.formatter.formatCurrency(value || 0) : (value || 0)}
                        </div>
                    </div>`,
    ).join('')}
            </div>
        `;
    }

    /**
     * Get property categories
     */
    getPropertyCategories(property) {
        if (!property || !property.expenses) {return [];}
        return Object.keys(property.expenses);
    }

    /**
     * Get category expense value
     */
    getCategoryExpenseValue(property, category) {
        if (!property) {return 0;}

        // Use getCurrentPeriodData to respect time period filtering
        const currentData = this.dataManager.getCurrentPeriodData(property, null, true);
        if (currentData && currentData.expenses && currentData.expenses.hasOwnProperty(category)) {
            return currentData.expenses[category];
        }

        // Fallback: Check expenses object directly if no current period data
        if (property.expenses && property.expenses.hasOwnProperty(category)) {
            return property.expenses[category];
        }

        // If expenses object doesn't have the category, check if it exists in global categories
        // This handles the case where a category was added but the property hasn't been updated yet
        if (window.dataManager && typeof window.dataManager.getExpenseCategories === 'function') {
            const globalCategories = window.dataManager.getExpenseCategories();
            if (globalCategories.includes(category)) {
                // Category exists globally but not in this property - initialize it
                logger.info('PROPERTIES', `Initializing missing category "${category}" for property: ${property.name}`);
                if (!property.expenses) {property.expenses = {};}

                // Check if any other property has hierarchical data for this category
                const dataManager = window.dataManager;
                const allProperties = dataManager.getProperties();
                const hierarchicalProperty = allProperties.find(prop =>
                    prop.expenses && prop.expenses[category] && typeof prop.expenses[category] === 'object',
                );

                if (hierarchicalProperty) {
                    // Initialize as hierarchical
                    property.expenses[category] = {};
                    const hierarchicalData = hierarchicalProperty.expenses[category];
                    Object.keys(hierarchicalData).forEach(subcategory => {
                        property.expenses[category][subcategory] = 0;
                    });
                    return property.expenses[category];
                } else {
                    // Initialize as flat
                    property.expenses[category] = 0;
                    return 0;
                }
            }
        }

        return 0;
    }

    /**
     * Sum object values
     */
    sumObjectValues(obj) {
        if (typeof obj !== 'object' || obj === null) {return 0;}
        return Object.values(obj).reduce((sum, val) => sum + (val || 0), 0);
    }

    /**
     * Handle item click (unified handler for all panels)
     */
    handleItemClick(event) {
        const propertyItem = event.target.closest('.property-item');
        if (!propertyItem) {return;}

        // Check if it's a property (has property-id)
        if (propertyItem.dataset.propertyId) {
            const propertyId = parseInt(propertyItem.dataset.propertyId);
            if (propertyId) {
                this.currentPropertyId = propertyId;
                this.currentCategoryPath = null;
                this.renderPropertiesDashboard();
            }
            return;
        }

        // Check if it's a category (has category but no subcategory)
        if (propertyItem.dataset.category && !propertyItem.dataset.subcategory) {
            const category = propertyItem.dataset.category;
            if (category) {
                const property = this.dataManager.getPropertyById(this.currentPropertyId);
                if (property) {
                    const expenseValue = this.getCategoryExpenseValue(property, category);
                    const isHierarchical = typeof expenseValue === 'object' && expenseValue !== null;

                    if (isHierarchical) {
                        // Hierarchical category - populate third panel
                        this.currentCategoryPath = { category };
                        this.renderPropertiesDashboard();
                    } else {
                        // Flat category - allow selection but don't populate third panel
                        this.currentCategoryPath = { category };
                        this.renderPropertiesDashboard();
                    }
                }
            }
            return;
        }

        // Check if it's a subcategory (has both category and subcategory)
        if (propertyItem.dataset.category && propertyItem.dataset.subcategory) {
            const category = propertyItem.dataset.category;
            const subcategory = propertyItem.dataset.subcategory;
            if (category && subcategory) {
                // Set as selected for dimming effect
                this.currentCategoryPath = { category, subcategory };
                this.renderPropertiesDashboard();
            }
            return;
        }
    }

    /**
     * Handle property click (legacy method for backward compatibility)
     */
    handlePropertyClick(event) {
        const propertyItem = event.target.closest('.property-item');
        if (!propertyItem) {return;}

        const propertyId = parseInt(propertyItem.dataset.propertyId);
        if (propertyId) {
            this.currentPropertyId = propertyId;
            this.currentCategoryPath = null;
            this.renderPropertiesDashboard();
        }
    }

    /**
     * Handle property action
     */
    handlePropertyAction(event) {
        const button = event.target.closest('.property-action');
        if (!button) {return;}

        event.stopPropagation();

        const action = button.dataset.action;
        const propertyId = parseInt(button.dataset.propertyId);

        switch (action) {
            case 'edit':
                this.showEditPropertyModal(propertyId);
                break;
            case 'delete':
                this.confirmDeleteProperty(propertyId);
                break;
        }
    }

    /**
     * Handle category click
     */
    handleCategoryClick(event) {
        const categoryItem = event.target.closest('.category-item');
        if (!categoryItem) {return;}

        const category = categoryItem.dataset.category;
        if (category) {
            this.currentCategoryPath = { category };
            this.renderPropertiesDashboard();
        }
    }

    /**
     * Handle category action
     */
    handleCategoryAction(event) {
        const button = event.target.closest('.category-action');
        if (!button) {return;}

        event.stopPropagation();

        const action = button.dataset.action;
        const category = button.dataset.category;
        const subcategory = button.dataset.subcategory;

        switch (action) {
            case 'delete':
                if (subcategory) {
                    this.confirmDeleteSubcategory(category, subcategory);
                } else {
                    this.confirmDeleteCategory(category);
                }
                break;
        }
    }

    /**
     * Handle expense edit
     */
    handleExpenseEdit(event) {
        const valueElement = event.target.closest('.expense-value');
        if (!valueElement || this.isEditMode) {return;}

        // Stop event propagation to prevent parent click handlers
        event.stopPropagation();

        // Prevent focus on the value element itself to avoid accessibility issues
        if (event.preventDefault) {
            event.preventDefault();
        }

        const category = valueElement.dataset.category;
        const subcategory = valueElement.dataset.subcategory;

        // Check if the target entity is currently selected
        let needsSelection = false;
        if (subcategory) {
            // For subcategories, check if both category and subcategory are selected
            needsSelection = !this.currentCategoryPath ||
                           this.currentCategoryPath.category !== category ||
                           this.currentCategoryPath.subcategory !== subcategory;
        } else {
            // For categories, check if the category is selected
            needsSelection = !this.currentCategoryPath ||
                           this.currentCategoryPath.category !== category;
        }

        if (needsSelection) {
            // Select the entity first
            if (subcategory) {
                this.currentCategoryPath = { category, subcategory };
            } else {
                this.currentCategoryPath = { category };
            }
            this.renderPropertiesDashboard();

            // Re-find the element after re-render and start editing
            const container = this.uiManager.getElement('propertiesDashboard');
            let selector = `.expense-value[data-category="${category}"]`;
            if (subcategory) {
                selector += `[data-subcategory="${subcategory}"]`;
            }
            const updatedElement = container.querySelector(selector);
            if (updatedElement) {
                this.startExpenseEdit(updatedElement, category, subcategory);
            }
            return;
        }

        this.startExpenseEdit(valueElement, category, subcategory);
    }

    /**
     * Start expense edit (helper method)
     */
    startExpenseEdit(valueElement, category, subcategory) {
        this.isEditMode = true;
        const currentValue = this.getCurrentExpenseValue(category, subcategory);

        // Create input element
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'expense-input';
        input.value = currentValue;
        input.step = '0.01';
        // Allow both positive and negative values (no min constraint)
        input.dataset.category = category;
        if (subcategory) {
            input.dataset.subcategory = subcategory;
        }

        // Remove number input arrows by setting CSS properties directly
        input.style.setProperty('-webkit-appearance', 'none', 'important');
        input.style.setProperty('-moz-appearance', 'textfield', 'important');
        input.style.setProperty('appearance', 'none', 'important');

        // Add event listeners directly to the input
        input.addEventListener('blur', () => {
            this.handleExpenseSave({ target: input });
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                this.cancelExpenseEdit(input);
            }
        });

        // Replace content with input
        valueElement.innerHTML = '';
        valueElement.appendChild(input);

        // Use setTimeout to ensure DOM is updated before focusing
        setTimeout(() => {
            input.focus();
            input.select();
        }, 0);
    }

    /**
     * Handle expense save
     */
    handleExpenseSave(event) {
        // Handle both direct input element and event object
        let input;
        if (event.target && event.target.classList && event.target.classList.contains('expense-input')) {
            input = event.target;
        } else if (event.target) {
            input = event.target.closest('.expense-input');
        }

        if (!input) {return;}

        const category = input.dataset.category;
        const subcategory = input.dataset.subcategory;
        const newValue = parseFloat(input.value) || 0;

        this.saveExpenseValue(category, subcategory, newValue);
        this.isEditMode = false;
    }

    /**
     * Handle expense keydown
     */
    handleExpenseKeydown(event) {
        if (event.key === 'Enter') {
            event.target.blur();
        } else if (event.key === 'Escape') {
            this.cancelExpenseEdit(event.target);
        }
    }

    /**
     * Get current expense value
     * Returns the display value (negative for expenses, positive for income)
     */
    getCurrentExpenseValue(category, subcategory) {
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property) {return 0;}

        if (subcategory) {
            // For subcategories, get the value from current period data
            const categoryValue = this.getCategoryExpenseValue(property, category);
            if (typeof categoryValue === 'object' && categoryValue !== null && categoryValue[subcategory] !== undefined) {
                const rawValue = categoryValue[subcategory];
                // For display, show negative values as negative (expenses) and positive as positive (income)
                // The stored value is already in the correct format, so return as-is for display
                return rawValue;
            }

            return 0;
        }

        const value = this.getCategoryExpenseValue(property, category);
        const rawValue = typeof value === 'object' ? this.sumObjectValues(value) : (value || 0);

        // Return the stored value as-is for display
        // Expense categories will show as negative, income categories as positive
        return rawValue;
    }

    /**
     * Save expense value
     * Note: Expense categories store negative values, income categories store positive values
     * User input is preserved - positive values stay positive, negative values stay negative
     */
    saveExpenseValue(category, subcategory, value) {
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property) {return;}

        // Determine if this is an expense or income category
        const isExpenseCategory = this.isExpenseCategory(category);
        const isIncomeCategory = this.isIncomeCategory(category);

        // Create snapshot for undo
        const categoryType = isIncomeCategory ? 'income' : 'expense';
        this.historyManager.createSnapshot(`Updated ${category}${subcategory ? ` - ${subcategory}` : ''} ${categoryType}`, '', false);

        // Handle NaN and invalid values
        let processedValue = value;
        if (isNaN(value) || value === null || value === undefined) {
            processedValue = 0;
        }

        // Preserve user input: positive for income, negative for expenses
        let finalValue = processedValue;

        if (isExpenseCategory && processedValue > 0) {
            // Convert positive input to negative for expense categories
            finalValue = -processedValue;
        } else if (isIncomeCategory && processedValue < 0) {
            // Convert negative input to positive for income categories
            finalValue = Math.abs(processedValue);
        }
        // For other cases, preserve the processed value

        // Update expenses object
        if (subcategory) {
            // Update subcategory value
            if (typeof property.expenses[category] !== 'object' || property.expenses[category] === null) {
                property.expenses[category] = {};
            }
            property.expenses[category][subcategory] = finalValue;
        } else {
            // Update category value
            property.expenses[category] = finalValue;
        }

        // Save to storage
        this.dataManager.save();

        // Re-render properties dashboard
        this.renderPropertiesDashboard();

        // Force UI refresh to update totals
        if (this.uiManager && typeof this.uiManager.updateDataDisplay === 'function') {
            const stats = this.dataManager.getDataStatistics();
            this.uiManager.updateDataDisplay(stats);
        }

        // Show success message
        const categoryTypeLabel = isIncomeCategory ? 'Income' : 'Expense';
        this.uiManager.showToast(`${categoryTypeLabel} updated successfully`, 'success');
    }


    /**
     * Cancel expense edit
     */
    cancelExpenseEdit(input) {
        const category = input.dataset.category;
        const subcategory = input.dataset.subcategory;
        const currentValue = this.getCurrentExpenseValue(category, subcategory);

        const valueElement = input.closest('.expense-value');
        valueElement.innerHTML = `${this.uiManager.formatter ? this.uiManager.formatter.formatCurrency(currentValue) : currentValue}`;

        this.isEditMode = false;
    }

    /**
     * Handle add property
     */
    async handleAddProperty() {
        this.showAddPropertyModal();
    }

    /**
     * Handle add category
     */
    handleAddCategory() {
        this.showAddCategoryModal();
    }

    /**
     * Handle value item click
     */
    handleValueItemClick(event) {
        const valueItem = event.target.closest('.value-item');
        if (!valueItem) {return;}

        const category = valueItem.dataset.category;
        const subcategory = valueItem.dataset.subcategory;

        if (category && subcategory) {
            this.currentCategoryPath = { category, subcategory };
            this.renderPropertiesDashboard();
        }
    }

    /**
     * Handle add subcategory
     */
    handleAddSubcategory() {
        this.showAddSubcategoryModal();
    }

    /**
     * Handle property hover
     */
    handlePropertyHover(event, isHover) {
        const propertyItem = event.target.closest('.property-item');
        if (!propertyItem) {return;}

        if (isHover) {
            propertyItem.classList.add('hovered');
        } else {
            propertyItem.classList.remove('hovered');
        }
    }

    /**
     * Handle category hover
     */
    handleCategoryHover(event, isHover) {
        const categoryItem = event.target.closest('.category-item');
        if (!categoryItem) {return;}

        if (isHover) {
            categoryItem.classList.add('hovered');
        } else {
            categoryItem.classList.remove('hovered');
        }
    }

    /**
     * Handle value item hover
     */
    handleValueItemHover(event, isHover) {
        const valueItem = event.target.closest('.value-item');
        if (!valueItem) {return;}

        if (isHover) {
            valueItem.classList.add('hovered');
        } else {
            valueItem.classList.remove('hovered');
        }
    }

    /**
     * Handle expense value hover
     */
    handleExpenseValueHover(event, isHover) {
        const expenseValue = event.target.closest('.expense-value');
        if (!expenseValue) {return;}

        if (isHover) {
            expenseValue.classList.add('hovered');
        } else {
            expenseValue.classList.remove('hovered');
        }
    }

    /**
     * Handle property name edit
     */
    handlePropertyNameEdit(event) {
        if (!event || !event.target) {return;}
        const propertyNameElement = event.target.closest('.property-name.editable');
        if (!propertyNameElement || this.isEditMode) {return;}

        const propertyId = parseInt(propertyNameElement.dataset.propertyId);

        // If this property is not currently selected, select it first
        if (this.currentPropertyId !== propertyId) {
            this.currentPropertyId = propertyId;
            this.currentCategoryPath = null;
            this.renderPropertiesDashboard();
            // Re-find the element after re-render
            const container = this.uiManager.getElement('propertiesDashboard');
            const updatedElement = container.querySelector(`.property-name.editable[data-property-id="${propertyId}"]`);
            if (updatedElement) {
                // Start edit mode on the updated element
                this.startPropertyNameEdit(updatedElement, propertyId);
            }
            return;
        }

        this.startPropertyNameEdit(propertyNameElement, propertyId);
    }

    /**
     * Start property name edit (helper method)
     */
    startPropertyNameEdit(propertyNameElement, propertyId) {
        this.isEditMode = true;
        const property = this.dataManager.getPropertyById(propertyId);
        if (!property) {return;}

        // Replace with input
        propertyNameElement.innerHTML = `
            <input type="text" class="property-name-input" value="${property.name}" maxlength="100"
                   data-property-id="${propertyId}">
        `;

        const input = propertyNameElement.querySelector('.property-name-input');
        input.focus();
        input.select();
    }

    /**
     * Handle property name save
     */
    handlePropertyNameSave(event) {
        const input = event.target.closest('.property-name-input');
        if (!input) {return;}

        const propertyId = parseInt(input.dataset.propertyId);
        const newName = input.value.trim();

        if (newName) {
            this.updatePropertyName(propertyId, newName);
        } else {
            // If empty, restore original name
            const property = this.dataManager.getPropertyById(propertyId);
            if (property) {
                const propertyNameElement = input.closest('.property-name');
                if (propertyNameElement) {
                    propertyNameElement.innerHTML = property.name;
                }
            }
        }

        this.isEditMode = false;
    }

    /**
     * Handle property name keydown
     */
    handlePropertyNameKeydown(event) {
        if (event.key === 'Enter') {
            event.target.blur();
        } else if (event.key === 'Escape') {
            const input = event.target;
            const propertyId = parseInt(input.dataset.propertyId);
            const property = this.dataManager.getPropertyById(propertyId);
            if (property) {
                const propertyNameElement = input.closest('.property-name');
                propertyNameElement.innerHTML = property.name;
            }
            this.isEditMode = false;
        }
    }

    /**
     * Handle category name edit
     */
    handleCategoryNameEdit(event) {
        const categoryNameElement = event.target.closest('.category-name.editable');
        if (!categoryNameElement || this.isEditMode) {return;}

        const category = categoryNameElement.dataset.category;

        // If this category is not currently selected, select it first
        if (!this.currentCategoryPath || this.currentCategoryPath.category !== category) {
            this.currentCategoryPath = { category };
            this.renderPropertiesDashboard();
            // Re-find the element after re-render
            const container = this.uiManager.getElement('propertiesDashboard');
            const updatedElement = container.querySelector(`.category-name.editable[data-category="${category}"]`);
            if (updatedElement) {
                // Start edit mode on the updated element
                this.startCategoryNameEdit(updatedElement, category);
            }
            return;
        }

        this.startCategoryNameEdit(categoryNameElement, category);
    }

    /**
     * Start category name edit (helper method)
     */
    startCategoryNameEdit(categoryNameElement, category) {
        this.isEditMode = true;
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property || !category) {return;}

        // Replace with input
        categoryNameElement.innerHTML = `
            <input type="text" class="category-name-input" value="${category}" maxlength="50"
                   data-category="${category}">
        `;

        const input = categoryNameElement.querySelector('.category-name-input');
        input.focus();
        input.select();
    }

    /**
     * Handle category name save
     */
    handleCategoryNameSave(event) {
        const input = event.target.closest('.category-name-input');
        if (!input) {return;}

        const oldCategory = input.dataset.category;
        const newCategory = input.value.trim();

        if (newCategory && newCategory !== oldCategory) {
            this.updateCategoryName(oldCategory, newCategory);
        } else {
            // If empty or unchanged, restore original name
            const categoryNameElement = input.closest('.category-name');
            if (categoryNameElement) {
                categoryNameElement.innerHTML = oldCategory;
            }
        }

        this.isEditMode = false;
    }

    /**
     * Handle category name keydown
     */
    handleCategoryNameKeydown(event) {
        if (event.key === 'Enter') {
            event.target.blur();
        } else if (event.key === 'Escape') {
            const input = event.target;
            const oldCategory = input.dataset.category;
            const categoryNameElement = input.closest('.category-name');
            if (categoryNameElement) {
                categoryNameElement.innerHTML = oldCategory;
            }
            this.isEditMode = false;
        }
    }

    /**
     * Handle subcategory name edit
     */
    handleSubcategoryNameEdit(event) {
        const subcategoryNameElement = event.target.closest('.subcategory-name.editable');
        if (!subcategoryNameElement || this.isEditMode) {return;}

        const category = subcategoryNameElement.dataset.category;
        const subcategory = subcategoryNameElement.dataset.subcategory;

        // If this subcategory is not currently selected, select it first
        if (!this.currentCategoryPath ||
            this.currentCategoryPath.category !== category ||
            this.currentCategoryPath.subcategory !== subcategory) {
            this.currentCategoryPath = { category, subcategory };
            this.renderPropertiesDashboard();
            // Re-find the element after re-render
            const container = this.uiManager.getElement('propertiesDashboard');
            const updatedElement = container.querySelector(`.subcategory-name.editable[data-category="${category}"][data-subcategory="${subcategory}"]`);
            if (updatedElement) {
                // Start edit mode on the updated element
                this.startSubcategoryNameEdit(updatedElement, category, subcategory);
            }
            return;
        }

        this.startSubcategoryNameEdit(subcategoryNameElement, category, subcategory);
    }

    /**
     * Start subcategory name edit (helper method)
     */
    startSubcategoryNameEdit(subcategoryNameElement, category, subcategory) {
        this.isEditMode = true;
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property || !category || !subcategory) {return;}

        // Replace with input
        subcategoryNameElement.innerHTML = `
            <input type="text" class="subcategory-name-input" value="${subcategory}" maxlength="50"
                   data-category="${category}" data-subcategory="${subcategory}">
        `;

        const input = subcategoryNameElement.querySelector('.subcategory-name-input');
        input.focus();
        input.select();
    }

    /**
     * Handle subcategory name save
     */
    handleSubcategoryNameSave(event) {
        const input = event.target.closest('.subcategory-name-input');
        if (!input) {return;}

        const category = input.dataset.category;
        const oldSubcategory = input.dataset.subcategory;
        const newSubcategory = input.value.trim();

        if (newSubcategory && newSubcategory !== oldSubcategory) {
            this.updateSubcategoryName(category, oldSubcategory, newSubcategory);
        } else {
            // If empty or unchanged, restore original name
            const subcategoryNameElement = input.closest('.subcategory-name');
            if (subcategoryNameElement) {
                subcategoryNameElement.innerHTML = oldSubcategory;
            }
        }

        this.isEditMode = false;
    }

    /**
     * Handle subcategory name keydown
     */
    handleSubcategoryNameKeydown(event) {
        if (event.key === 'Enter') {
            event.target.blur();
        } else if (event.key === 'Escape') {
            const input = event.target;
            const oldSubcategory = input.dataset.subcategory;
            const subcategoryNameElement = input.closest('.subcategory-name');
            if (subcategoryNameElement) {
                subcategoryNameElement.innerHTML = oldSubcategory;
            }
            this.isEditMode = false;
        }
    }

    /**
     * Handle back navigation
     */
    handleBackNavigation() {
        if (this.currentCategoryPath && this.currentCategoryPath.subcategory) {
            // From subcategory to category
            this.currentCategoryPath = { category: this.currentCategoryPath.category };
        } else if (this.currentCategoryPath && this.currentCategoryPath.category) {
            // From category to property
            this.currentCategoryPath = null;
        } else if (this.currentPropertyId) {
            // From property to properties list
            this.currentPropertyId = null;
            this.currentCategoryPath = null;
        }
        this.renderPropertiesDashboard();
    }

    /**
     * Show add property modal
     */
    showAddPropertyModal() {
        const timestamp = Date.now();
        const modalHtml = `
            <div class="modal-header">
                <h3>Add New Property</h3>
                <button class="modal-close" onclick="this.closest('.modal').classList.add('hidden')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label" for="new-property-name-${timestamp}">Property Name</label>
                    <input type="text" id="new-property-name-${timestamp}" class="form-control" placeholder="Enter property name" maxlength="100">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn--outline" onclick="this.closest('.modal').classList.add('hidden')">Cancel</button>
                <button class="btn btn--primary" id="confirm-add-property-${timestamp}">Add Property</button>
            </div>
        `;

        this.showModal('addPropertyModal', modalHtml);

        // Setup confirm button
        const confirmBtn = document.getElementById(`confirm-add-property-${timestamp}`);
        const input = document.getElementById(`new-property-name-${timestamp}`);

        const handleConfirm = () => {
            const name = input.value.trim();
            if (name) {
                this.addProperty(name);
                this.closeModal('addPropertyModal');
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {handleConfirm();}
        });

        input.focus();
    }

    /**
     * Show edit property modal
     */
    showEditPropertyModal(propertyId) {
        const property = this.dataManager.getPropertyById(propertyId);
        if (!property) {return;}

        const timestamp = Date.now();
        const modalHtml = `
            <div class="modal-header">
                <h3>Edit Property</h3>
                <button class="modal-close" id="closeEditPropertyModal-${timestamp}" onclick="this.closest('.modal').classList.add('hidden')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label" for="edit-property-name-${timestamp}">Property Name</label>
                    <input type="text" id="edit-property-name-${timestamp}" class="form-control" value="${property.name}" maxlength="100">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn--outline" id="cancelEditProperty-${timestamp}" onclick="this.closest('.modal').classList.add('hidden')">Cancel</button>
                <button class="btn btn--primary" id="confirm-edit-property-${timestamp}">Save Changes</button>
            </div>
        `;

        this.showModal('editPropertyModal', modalHtml);

        // Setup confirm button
        const confirmBtn = document.getElementById(`confirm-edit-property-${timestamp}`);
        const input = document.getElementById(`edit-property-name-${timestamp}`);

        const handleConfirm = () => {
            const name = input.value.trim();
            if (name && name !== property.name) {
                this.updatePropertyName(propertyId, name);
                this.closeModal('editPropertyModal');
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {handleConfirm();}
        });

        input.focus();
        input.select();
    }

    /**
     * Show add category modal
     */
    showAddCategoryModal() {
        const timestamp = Date.now();
        const modalHtml = `
            <div class="modal-header">
                <h3>Add New Category</h3>
                <button class="modal-close" id="closeCategoryModal-${timestamp}" onclick="this.closest('.modal').classList.add('hidden')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label" for="new-category-name-${timestamp}">Category Name</label>
                    <input type="text" id="new-category-name-${timestamp}" class="form-control" placeholder="Enter category name" maxlength="50">
                </div>
                <div class="form-group">
                    <label class="form-check">
                        <input type="checkbox" id="is-hierarchical-${timestamp}">
                        <span class="checkmark"></span>
                        Create as hierarchical category (with subcategories)
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn--outline" id="cancelCategory-${timestamp}" onclick="this.closest('.modal').classList.add('hidden')">Cancel</button>
                <button class="btn btn--primary" id="confirm-add-category-${timestamp}">Add Category</button>
            </div>
        `;

        this.showModal('addCategoryModal', modalHtml);

        // Setup confirm button
        const confirmBtn = document.getElementById(`confirm-add-category-${timestamp}`);
        const input = document.getElementById(`new-category-name-${timestamp}`);

        const handleConfirm = () => {
            const name = input.value.trim();
            const isHierarchical = document.getElementById(`is-hierarchical-${timestamp}`).checked;

            if (name) {
                this.addCategory(name, isHierarchical);
                this.closeModal('addCategoryModal');
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {handleConfirm();}
        });

        input.focus();
    }

    /**
     * Show add subcategory modal
     */
    showAddSubcategoryModal() {
        const timestamp = Date.now();
        const modalHtml = `
            <div class="modal-header">
                <h3>Add New Subcategory</h3>
                <button class="modal-close" id="closeSubcategoryModal-${timestamp}" onclick="this.closest('.modal').classList.add('hidden')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label" for="new-subcategory-name-${timestamp}">Subcategory Name</label>
                    <input type="text" id="new-subcategory-name-${timestamp}" class="form-control" placeholder="Enter subcategory name" maxlength="50">
                </div>
                <div class="form-group">
                    <label class="form-label" for="new-subcategory-value-${timestamp}">Initial Value</label>
                    <input type="number" id="new-subcategory-value-${timestamp}" class="form-control" placeholder="0.00" step="0.01" value="0">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn--outline" id="cancelSubcategory-${timestamp}" onclick="this.closest('.modal').classList.add('hidden')">Cancel</button>
                <button class="btn btn--primary" id="confirm-add-subcategory-${timestamp}">Add Subcategory</button>
            </div>
        `;

        this.showModal('addSubcategoryModal', modalHtml);

        // Setup confirm button
        const confirmBtn = document.getElementById(`confirm-add-subcategory-${timestamp}`);
        const nameInput = document.getElementById(`new-subcategory-name-${timestamp}`);
        const valueInput = document.getElementById(`new-subcategory-value-${timestamp}`);

        // Remove number input arrows from value input
        valueInput.style.setProperty('-webkit-appearance', 'none', 'important');
        valueInput.style.setProperty('-moz-appearance', 'textfield', 'important');
        valueInput.style.setProperty('appearance', 'none', 'important');

        const handleConfirm = () => {
            const name = nameInput.value.trim();
            const value = parseFloat(valueInput.value) || 0;

            if (name) {
                this.addSubcategory(name, value);
                this.closeModal('addSubcategoryModal');
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {handleConfirm();}
        });

        nameInput.focus();
    }

    /**
     * Show modal
     */
    showModal(modalId, content) {
        // Clean up any existing modal with the same ID first
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
            // Remove existing modal safely
            if (typeof existingModal.remove === 'function') {
                existingModal.remove();
            } else if (existingModal.parentNode) {
                existingModal.parentNode.removeChild(existingModal);
            }
        }

        // Create new modal
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal hidden';
        modal.innerHTML = `<div class="modal-content">${content}</div>`;
        document.body.appendChild(modal);

        this.uiManager.openModal(modalId);
    }

    /**
     * Close modal
     */
    closeModal(modalId) {
        this.uiManager.closeModal(modalId);
    }

    /**
     * Add property
     */
    async addProperty(name) {
        const result = await this.dataManager.addProperty(name.trim());
        if (result.success) {
            this.historyManager.createSnapshot(`Added property "${name}"`, '', false);

            // Auto-select the newly added property
            const properties = this.dataManager.getProperties();
            const newProperty = properties.find(p => p.name === name);
            if (newProperty) {
                this.currentPropertyId = newProperty.id;
                this.currentCategoryPath = null; // Clear any previous category selection
            }

            this.renderPropertiesDashboard();

            this.uiManager.showToast(result.message, 'success');
        } else {
            this.uiManager.showToast(result.message, 'error');
        }
    }

    /**
     * Update property name
     */
    updatePropertyName(propertyId, newName) {
        const result = this.dataManager.updatePropertyName(propertyId, newName);
        if (result.success) {
            this.historyManager.createSnapshot(`Renamed property to "${newName}"`, '', false);
            this.renderPropertiesDashboard();
            this.uiManager.showToast(result.message, 'success');
        } else {
            this.uiManager.showToast(result.message, 'error');
        }
    }

    /**
     * Update category name
     */
    updateCategoryName(oldCategory, newCategory) {
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property || !property.expenses.hasOwnProperty(oldCategory)) {return;}

        // Check if new category name already exists
        if (property.expenses.hasOwnProperty(newCategory) && newCategory !== oldCategory) {
            this.uiManager.showToast('Category name already exists', 'error');
            return;
        }

        // Create snapshot
        this.historyManager.createSnapshot(`Renamed category "${oldCategory}" to "${newCategory}"`, '', false);

        // Update the category name in expenses object
        const categoryValue = property.expenses[oldCategory];
        delete property.expenses[oldCategory];
        property.expenses[newCategory] = categoryValue;

        // Save and refresh
        this.dataManager.save();
        this.renderPropertiesDashboard();
        this.uiManager.showToast(`Category renamed to "${newCategory}"`, 'success');
    }

    /**
     * Update subcategory name
     */
    updateSubcategoryName(category, oldSubcategory, newSubcategory) {
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property || !property.expenses.hasOwnProperty(category)) {return;}

        const categoryValue = property.expenses[category];
        if (typeof categoryValue !== 'object' || !categoryValue.hasOwnProperty(oldSubcategory)) {return;}

        // Check if new subcategory name already exists
        if (categoryValue.hasOwnProperty(newSubcategory) && newSubcategory !== oldSubcategory) {
            this.uiManager.showToast('Subcategory name already exists', 'error');
            return;
        }

        // Create snapshot
        this.historyManager.createSnapshot(`Renamed subcategory "${oldSubcategory}" to "${newSubcategory}" in ${category}`, '', false);

        // Update the subcategory name in expenses object
        const subcategoryValue = categoryValue[oldSubcategory];
        delete categoryValue[oldSubcategory];
        categoryValue[newSubcategory] = subcategoryValue;

        // Save and refresh
        this.dataManager.save();
        this.renderPropertiesDashboard();
        this.uiManager.showToast(`Subcategory renamed to "${newSubcategory}"`, 'success');
    }

    /**
     * Confirm delete property
     */
    confirmDeleteProperty(propertyId) {
        const property = this.dataManager.getPropertyById(propertyId);
        if (!property) {return;}

        // Show inline confirmation instead of browser popup
        this.showInlineDeleteConfirmation(propertyId, 'property', property.name);
    }

    /**
     * Delete property
     */
    async deleteProperty(propertyId) {
        const property = this.dataManager.getPropertyById(propertyId);
        if (!property) {return;}

        const result = await this.dataManager.deleteProperty(propertyId);
        if (result.success) {
            // Save the changes to storage to ensure persistence
            const saveResult = await this.dataManager.save();
            if (!saveResult) {
                console.error('[PROPERTIES] Failed to save property deletion to storage');
                this.uiManager.showToast('Failed to save changes to storage', 'error');
                return;
            }

            this.historyManager.createSnapshot(`Deleted property "${property.name}"`, '', false);
            this.currentPropertyId = null;
            this.renderPropertiesDashboard();
            this.uiManager.showToast(result.message, 'success');
        } else {
            this.uiManager.showToast(result.message, 'error');
        }
    }

    /**
     * Add category
     */
    addCategory(name, isHierarchical = false) {
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property) {return;}

        // Check if category already exists
        if (property.expenses.hasOwnProperty(name)) {
            this.uiManager.showToast('Category already exists', 'error');
            return;
        }

        // Create snapshot
        this.historyManager.createSnapshot(`Added category "${name}" to ${property.name}`, '', false);

        // Add category
        property.expenses[name] = isHierarchical ? {} : 0;

        // Save and refresh
        this.dataManager.save();
        this.renderPropertiesDashboard();
        this.uiManager.showToast(`Category "${name}" added successfully`, 'success');
    }

    /**
     * Add subcategory
     */
    addSubcategory(name, value = 0) {
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property || !this.currentCategoryPath) {return;}

        const category = this.currentCategoryPath.category;
        if (!property.expenses.hasOwnProperty(category)) {return;}

        // Ensure the category is hierarchical
        if (typeof property.expenses[category] !== 'object' || property.expenses[category] === null) {
            property.expenses[category] = {};
        }

        // Check if subcategory already exists
        if (property.expenses[category].hasOwnProperty(name)) {
            this.uiManager.showToast('Subcategory already exists', 'error');
            return;
        }

        // Create snapshot
        this.historyManager.createSnapshot(`Added subcategory "${name}" to ${category}`, '', false);

        // Add subcategory
        property.expenses[category][name] = value;

        // Save and refresh
        this.dataManager.save();
        this.renderPropertiesDashboard();
        this.uiManager.showToast(`Subcategory "${name}" added successfully`, 'success');
    }



    /**
     * Confirm delete category
     */
    confirmDeleteCategory(category) {
        // Show inline confirmation instead of browser popup
        this.showInlineDeleteConfirmation(this.currentPropertyId, 'category', category);
    }

    /**
     * Delete category
     */
    deleteCategory(category) {
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property || !property.expenses.hasOwnProperty(category)) {return;}

        // Create snapshot
        this.historyManager.createSnapshot(`Deleted category "${category}" from ${property.name}`, '', false);

        // Remove category from property expenses
        delete property.expenses[category];

        // Save and refresh
        this.dataManager.save();
        this.renderPropertiesDashboard();
        this.uiManager.showToast(`Category "${category}" deleted successfully`, 'success');
    }

    /**
     * Confirm delete subcategory
     */
    confirmDeleteSubcategory(category, subcategory) {
        // Show inline confirmation instead of browser popup
        this.showInlineDeleteConfirmation(this.currentPropertyId, 'subcategory', subcategory, category);
    }

    /**
     * Delete subcategory
     */
    deleteSubcategory(category, subcategory) {
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property) {return;}

        // Use the expenses object
        const categoryValue = property.expenses[category];

        if (categoryValue === null) {return;}

        if (typeof categoryValue !== 'object' || categoryValue === null) {return;}

        if (!categoryValue.hasOwnProperty(subcategory)) {return;}

        // Create snapshot
        this.historyManager.createSnapshot(`Deleted subcategory "${subcategory}" from ${category}`, '', false);

        // Remove from expenses object
        if (property.expenses[category] && typeof property.expenses[category] === 'object') {
            delete property.expenses[category][subcategory];

            // If category becomes empty, convert it to flat category
            if (Object.keys(property.expenses[category]).length === 0) {
                property.expenses[category] = 0;
            }
        }

        // Save and refresh
        this.dataManager.save();
        this.renderPropertiesDashboard();
        this.uiManager.showToast(`Subcategory "${subcategory}" deleted successfully`, 'success');
    }

    /**
     * Show inline delete confirmation as a speech bubble popup
     */
    showInlineDeleteConfirmation(itemId, itemType, itemName, category = null) {
        // Remove any existing confirmation popups
        this.removeExistingConfirmations();

        const container = this.uiManager.getElement('propertiesDashboard');
        if (!container) {return;}

        // Find the delete button that triggered this confirmation
        const deleteButton = this.findDeleteButton(itemId, itemType, itemName, category);
        if (!deleteButton) {return;}

        const timestamp = Date.now();
        const confirmationHtml = `
            <div class="delete-confirmation-popup" id="delete-confirmation-popup-${timestamp}">
                <div class="delete-confirmation-content">
                    <div class="delete-confirmation-message">
                        Delete <strong>"${itemName}"</strong>?
                    </div>
                    <div class="delete-confirmation-actions">
                        <button class="btn btn--outline btn--sm" id="cancel-delete-btn-${timestamp}">Cancel</button>
                        <button class="btn btn--danger btn--sm" id="confirm-delete-btn-${timestamp}">Delete</button>
                    </div>
                </div>
                <div class="delete-confirmation-arrow"></div>
            </div>
        `;

        // Insert confirmation popup
        document.body.insertAdjacentHTML('beforeend', confirmationHtml);

        const popup = document.getElementById(`delete-confirmation-popup-${timestamp}`);
        const cancelBtn = document.getElementById(`cancel-delete-btn-${timestamp}`);
        const confirmBtn = document.getElementById(`confirm-delete-btn-${timestamp}`);

        // Position the popup relative to the delete button
        this.positionConfirmationPopup(popup, deleteButton);

        const closeConfirmation = () => {
            if (popup) {
                popup.remove();
            }
        };

        // Event listeners
        cancelBtn.addEventListener('click', closeConfirmation);
        confirmBtn.addEventListener('click', () => {
            closeConfirmation();
            if (itemType === 'property') {
                this.deleteProperty(itemId);
            } else if (itemType === 'category') {
                this.deleteCategory(itemName);
            } else if (itemType === 'subcategory') {
                this.deleteSubcategory(category, itemName);
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!popup.contains(e.target) && !deleteButton.contains(e.target)) {
                closeConfirmation();
            }
        }, { once: true });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeConfirmation();
            }
        }, { once: true });

        // Focus the cancel button for accessibility
        setTimeout(() => {
            if (cancelBtn) {cancelBtn.focus();}
        }, 100);
    }

    /**
     * Remove existing confirmation popups
     */
    removeExistingConfirmations() {
        const existingPopups = document.querySelectorAll('.delete-confirmation-popup');
        existingPopups.forEach(popup => popup.remove());
    }

    /**
     * Find the delete button that triggered the confirmation
     */
    findDeleteButton(itemId, itemType, itemName, category = null) {
        let selector = '';

        if (itemType === 'property') {
            selector = `.property-action[data-action="delete"][data-property-id="${itemId}"]`;
        } else if (itemType === 'category') {
            selector = `.category-action[data-action="delete"][data-category="${CSS.escape(itemName)}"]:not([data-subcategory])`;
        } else if (itemType === 'subcategory') {
            selector = `.category-action[data-action="delete"][data-category="${CSS.escape(category)}"][data-subcategory="${CSS.escape(itemName)}"]`;
        }

        return document.querySelector(selector);
    }

    /**
     * Position the confirmation popup relative to the delete button
     */
    positionConfirmationPopup(popup, deleteButton) {
        const buttonRect = deleteButton.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate preferred position (above the button, centered)
        let top = buttonRect.top - popupRect.height - 8; // 8px gap
        let left = buttonRect.left + (buttonRect.width / 2) - (popupRect.width / 2);

        // Adjust if popup would go off-screen
        if (top < 10) {
            // Not enough space above, position below
            top = buttonRect.bottom + 8;
            popup.classList.add('below');
        } else {
            popup.classList.add('above');
        }

        if (left < 10) {
            left = 10;
        } else if (left + popupRect.width > viewportWidth - 10) {
            left = viewportWidth - popupRect.width - 10;
        }

        popup.style.position = 'fixed';
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
        popup.style.zIndex = '1000';
    }

    /**
     * Clear current selection
     */
    clearSelection() {
        if (this.currentPropertyId !== null || this.currentCategoryPath !== null) {
            this.currentPropertyId = null;
            this.currentCategoryPath = null;
            this.renderPropertiesDashboard();
        }
    }

    /**
     * Start long press detection
     */
    startLongPressDetection(propertyItem, event) {
        // Clear any existing timers
        this.cancelLongPressDetection();

        // Create a unique id for this long press
        const longPressId = `lp-${Date.now()}-${Math.random()}`;

        // Store the item data
        this.pendingLongPresses.set(longPressId, {
            propertyId: propertyItem.dataset.propertyId,
            category: propertyItem.dataset.category,
            subcategory: propertyItem.dataset.subcategory,
        });

        // Set up the long press timer
        const timerId = setTimeout(() => {
            // Get the stored data
            const data = this.pendingLongPresses.get(longPressId);
            if (!data) {return;}

            this.pendingLongPresses.delete(longPressId);

            // Find the current element
            const currentItem = this.findItemElement(data.propertyId, data.category, data.subcategory);

            if (currentItem) {
                this.showDeleteButton(currentItem);
            }
        }, this.longPressDuration);

        // Store the timer
        this.longPressTimers.set(longPressId, timerId);
    }

    /**
     * Cancel long press detection
     */
    cancelLongPressDetection() {
        // Clear all pending timers
        for (const [itemId, timerId] of this.longPressTimers) {
            clearTimeout(timerId);
        }
        this.longPressTimers.clear();
        this.pendingLongPresses.clear();
    }

    /**
     * Show delete button for a specific item
     */
    showDeleteButton(propertyItem) {
        // First, hide any other visible delete buttons
        this.hideDeleteButtons();

        // Update selection state based on the item type
        if (propertyItem.dataset.propertyId) {
            this.currentPropertyId = parseInt(propertyItem.dataset.propertyId);
            this.currentCategoryPath = null;
        } else if (propertyItem.dataset.category && !propertyItem.dataset.subcategory) {
            this.currentCategoryPath = { category: propertyItem.dataset.category };
        } else if (propertyItem.dataset.category && propertyItem.dataset.subcategory) {
            this.currentCategoryPath = {
                category: propertyItem.dataset.category,
                subcategory: propertyItem.dataset.subcategory,
            };
        }

        // Re-render to update selection styling
        this.renderPropertiesDashboard();

        // After re-render, find the current element again using consistent approach
        const currentItem = this.findItemElement(propertyItem.dataset.propertyId, propertyItem.dataset.category, propertyItem.dataset.subcategory);

        if (currentItem) {
            // Find the delete button within this item
            const deleteButton = currentItem.querySelector('.property-action[data-action="delete"], .category-action[data-action="delete"]');
            if (deleteButton) {
                // Remove the hidden class to show the button
                deleteButton.classList.remove('delete-hidden');

                // Add to visible map for tracking
                this.visibleDeleteButtons.set(currentItem, {
                    propertyId: currentItem.dataset.propertyId,
                    category: currentItem.dataset.category,
                    subcategory: currentItem.dataset.subcategory,
                });

                // Store reference to the item with visible delete button
                this.currentVisibleDeleteItem = currentItem;
            }
        }
    }

    /**
     * Find item element using consistent approach across all panels
     */
    findItemElement(propertyId, category, subcategory) {
        if (propertyId) {
            // Properties panel - use simple selector
            return document.querySelector(`[data-property-id="${propertyId}"]`);
        } else if (category && subcategory) {
            // Subcategories panel - use compound selector
            return document.querySelector(`[data-category="${CSS.escape(category)}"][data-subcategory="${CSS.escape(subcategory)}"]`);
        } else if (category && !subcategory) {
            // Categories panel - use precise CSS selector
            return document.querySelector(`.property-item[data-category="${CSS.escape(category)}"]:not([data-subcategory])`);
        }
        return null;
    }

    /**
     * Hide all visible delete buttons
     */
    hideDeleteButtons() {
        // Add hidden class back to all visible delete buttons
        for (const [item, itemData] of this.visibleDeleteButtons) {
            const deleteButton = item.querySelector('.property-action[data-action="delete"], .category-action[data-action="delete"]');
            if (deleteButton) {
                deleteButton.classList.add('delete-hidden');
            }
            // Also remove selected class if it was added manually
            item.classList.remove('selected');
        }

        // Clear the visible map
        this.visibleDeleteButtons.clear();
    }


    /**
     * Check if a category is an expense category
     * @param {string} category - Category name to check
     * @returns {boolean} True if expense category, false otherwise
     */
    isExpenseCategory(category) {
        // For now, all categories are treated as expense categories
        // In the future, this will check against incomeCategories array
        const expenseCategories = this.dataManager.getExpenseCategories();
        return expenseCategories.includes(category);
    }

    /**
     * Check if a category is an income category
     * @param {string} category - Category name to check
     * @returns {boolean} True if income category, false otherwise
     */
    isIncomeCategory(category) {
        const incomeCategories = this.dataManager.getIncomeCategories();
        return incomeCategories && incomeCategories.includes(category);
    }

    /**
     * Initialize header year/month pickers
     */
    initializeHeaderPickers() {
        logger.info('PROPERTIES', 'Initializing header year/month pickers...');

        // Set current selections first
        this.setCurrentHeaderSelections();

        // Populate year picker in header (without ALL option for properties dashboard)
        this.uiManager.populateYearPicker(this.dataManager.getAvailableYears(), false);

        // Populate month picker in header (without ALL option for properties dashboard)
        this.uiManager.populateMonthPicker(false);

        // Update picker selections to reflect current data selections
        this.updateHeaderPickerSelections();

        logger.info('PROPERTIES', 'Header year/month pickers initialized');
    }

    /**
     * Set current selections for header pickers
     */
    setCurrentHeaderSelections() {
        // Get current date info
        const now = new Date();
        const currentYear = now.getFullYear().toString();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

        // Set default selections
        this.dataManager.setSelectedYear(currentYear);
        this.dataManager.setSelectedMonth(currentMonth);

        logger.info('PROPERTIES', `Set header picker defaults to: ${currentMonth}/${currentYear}`);
    }

    /**
     * Initialize year/month pickers
     */
    initializeYearMonthPickers() {
        logger.info('PROPERTIES', 'Initializing year/month pickers...');

        // Populate year picker
        this.populateYearPicker();

        // Populate month picker (already has static options)
        this.setCurrentMonth();

        // Setup event listeners for pickers
        this.setupPickerEventListeners();

        logger.info('PROPERTIES', 'Year/month pickers initialized');
    }

    /**
     * Populate year picker with available years from data
     */
    populateYearPicker() {
        const yearSelect = document.getElementById('propertiesYearSelect');
        if (!yearSelect) {
            logger.warn('PROPERTIES', 'Year picker not found');
            return;
        }

        // Get available years from data
        const availableYears = this.dataManager.getAvailableYears();
        if (availableYears.length === 0) {
            logger.info('PROPERTIES', 'No years available in data');
            return;
        }

        // Clear existing options except "All Years"
        const allYearsOption = yearSelect.querySelector('option[value="all"]');
        yearSelect.innerHTML = '';
        if (allYearsOption) {
            yearSelect.appendChild(allYearsOption);
        } else {
            // Add "All Years" option if it doesn't exist
            const allOption = document.createElement('option');
            allOption.value = 'all';
            allOption.textContent = 'All Years';
            yearSelect.appendChild(allOption);
        }

        // Add available years
        availableYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });

        logger.info('PROPERTIES', `Populated year picker with ${availableYears.length} years:`, availableYears);
    }

    /**
     * Set current month as default selection, or last available if current has no data
     */
    setCurrentMonth() {
        const monthSelect = document.getElementById('propertiesMonthSelect');
        const yearSelect = document.getElementById('propertiesYearSelect');

        if (!monthSelect || !yearSelect) {
            logger.warn('PROPERTIES', 'Month or year picker not found');
            return;
        }

        // Get current date info
        const now = new Date();
        const currentYear = now.getFullYear().toString();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

        // Check if current month/year has data
        const hasCurrentData = this.hasDataForMonthYear(currentYear, currentMonth);

        if (hasCurrentData) {
            // Use current month/year
            yearSelect.value = currentYear;
            monthSelect.value = currentMonth;
            logger.info('PROPERTIES', `Set to current month/year: ${currentMonth}/${currentYear}`);
        } else {
            // Find the most recent month/year with data
            const lastAvailable = this.getLastAvailableMonthYear();
            if (lastAvailable) {
                yearSelect.value = lastAvailable.year;
                monthSelect.value = lastAvailable.month;
                logger.info('PROPERTIES', `Current month/year has no data, set to last available: ${lastAvailable.month}/${lastAvailable.year}`);
            } else {
                // Fallback to current if no data at all
                yearSelect.value = currentYear;
                monthSelect.value = currentMonth;
                logger.info('PROPERTIES', `No data found, defaulting to current month/year: ${currentMonth}/${currentYear}`);
            }
        }
    }

    /**
     * Setup event listeners for year/month pickers
     */
    setupPickerEventListeners() {
        const yearSelect = document.getElementById('propertiesYearSelect');
        const monthSelect = document.getElementById('propertiesMonthSelect');

        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => {
                logger.info('PROPERTIES', `Year changed to: ${e.target.value}`);
                this.handleYearMonthChange();
            });
        }

        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                logger.info('PROPERTIES', `Month changed to: ${e.target.value}`);
                this.handleYearMonthChange();
            });
        }
    }

    /**
     * Handle year/month picker changes
     */
    handleYearMonthChange() {
        const yearSelect = document.getElementById('propertiesYearSelect');
        const monthSelect = document.getElementById('propertiesMonthSelect');

        if (!yearSelect || !monthSelect) {return;}

        const selectedYear = yearSelect.value;
        const selectedMonth = monthSelect.value;

        logger.info('PROPERTIES', `Filtering data by year: ${selectedYear}, month: ${selectedMonth}`);

        // Update data filtering in DataManager
        this.dataManager.setSelectedYear(selectedYear);
        this.dataManager.setSelectedMonth(selectedMonth);

        // Re-render the properties dashboard to reflect filtered data
        this.renderPropertiesDashboard();

        // Update chart calculations if needed
        this.updateChartCalculations();

        // Show feedback
        const yearText = selectedYear === 'all' ? 'all years' : selectedYear;
        const monthText = selectedMonth === 'all' ? 'all months' : this.getMonthName(selectedMonth);
        this.uiManager.showToast(`Showing data for ${monthText} ${yearText}`, 'info');
    }

    /**
     * Get month name from month number
     * @param {string} monthNumber - Month number (01-12)
     * @returns {string} Month name
     */
    getMonthName(monthNumber) {
        const monthNames = {
            '01': 'January',
            '02': 'February',
            '03': 'March',
            '04': 'April',
            '05': 'May',
            '06': 'June',
            '07': 'July',
            '08': 'August',
            '09': 'September',
            '10': 'October',
            '11': 'November',
            '12': 'December',
        };
        return monthNames[monthNumber] || monthNumber;
    }

    _storeTransactions() {
        const txns = this.dataManager?.store?.transactions;
        return Array.isArray(txns) ? txns : [];
    }

    _periodFromTxn(txn) {
        if (!txn || !txn.date) {
            return null;
        }
        const d = new Date(txn.date);
        if (Number.isNaN(d.getTime())) {
            return null;
        }
        return {
            year: String(d.getFullYear()),
            month: String(d.getMonth() + 1).padStart(2, '0'),
        };
    }

    hasDataForMonthYear(year, month) {
        const yearStr = String(year);
        const monthStr = String(month).padStart(2, '0');
        return this._storeTransactions().some(txn => {
            const period = this._periodFromTxn(txn);
            return period && period.year === yearStr && period.month === monthStr;
        });
    }

    getLastAvailableMonthYear() {
        let latest = null;
        for (const txn of this._storeTransactions()) {
            const period = this._periodFromTxn(txn);
            if (!period) {
                continue;
            }
            const stamp = `${period.year}${period.month}`;
            if (!latest || stamp > `${latest.year}${latest.month}`) {
                latest = period;
            }
        }
        return latest;
    }

    getLastAvailableMonthForYear(year) {
        const yearStr = String(year);
        let latestMonth = null;
        for (const txn of this._storeTransactions()) {
            const period = this._periodFromTxn(txn);
            if (!period || period.year !== yearStr) {
                continue;
            }
            if (!latestMonth || period.month > latestMonth) {
                latestMonth = period.month;
            }
        }
        return latestMonth;
    }

    /**
     * Update header picker selections to reflect current data selections
     */
    updateHeaderPickerSelections() {
        const selectedYear = this.dataManager.getSelectedYear();
        const selectedMonth = this.dataManager.getSelectedMonth();

        // Update year picker selection state
        if (this.uiManager.updateYearPickerSelection) {
            this.uiManager.updateYearPickerSelection(selectedYear);
        }

        // Update month picker selection state
        if (this.uiManager.updateMonthPickerSelection) {
            this.uiManager.updateMonthPickerSelection(selectedMonth);
        }

        // Force update the picker UI elements to reflect the current selections
        this.forceUpdatePickerUI(selectedYear, selectedMonth);

        logger.info('PROPERTIES', `Updated header pickers to: ${selectedMonth}/${selectedYear}`);
    }

    /**
     * Force update picker UI elements to match current selections
     * @param {string} selectedYear - Currently selected year
     * @param {string} selectedMonth - Currently selected month
     */
    forceUpdatePickerUI(selectedYear, selectedMonth) {
        // Update year picker UI
        const yearPickerItems = document.querySelectorAll('.year-picker-item');
        yearPickerItems.forEach(item => {
            const itemYear = item.getAttribute('data-year');
            if (itemYear === selectedYear) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        // Update month picker UI
        const monthPickerItems = document.querySelectorAll('.month-picker-item');
        monthPickerItems.forEach(item => {
            const itemMonth = item.getAttribute('data-month');
            if (itemMonth === selectedMonth) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        logger.info('PROPERTIES', `Forced UI update for pickers: ${selectedMonth}/${selectedYear}`);
    }

    /**
     * Handle time period change events from header pickers
     */
    handleTimePeriodChange() {
        logger.info('PROPERTIES', 'Time period changed, re-rendering dashboard');

        // Re-render the properties dashboard to show filtered data
        this.renderPropertiesDashboard();

        // Update chart calculations if needed
        this.updateChartCalculations();

        // Show feedback about the current time period
        const selectedYear = this.dataManager.getSelectedYear();
        const selectedMonth = this.dataManager.getSelectedMonth();
        const yearText = selectedYear === 'all' ? 'all years' : selectedYear;
        const monthText = selectedMonth === 'all' ? 'all months' : this.getMonthName(selectedMonth);
        this.uiManager.showToast(`Properties dashboard updated for ${monthText} ${yearText}`, 'info');
    }

    /**
     * Update chart calculations (placeholder for future implementation)
     */
    updateChartCalculations() {
        // This method can be expanded to update any chart calculations
        // that depend on the filtered data
        logger.info('PROPERTIES', 'Chart calculations updated');
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Cancel any pending long press timers
        this.cancelLongPressDetection();
        this.hideDeleteButtons();

        // Hide any visible tooltips
        this.hideAddButtonTooltip();

        // Remove event listeners if needed
        logger.info('PROPERTIES', 'PropertiesManager cleaned up');
    }

    updateData(_data) {
        this.renderPropertiesDashboard();
    }
}

export default PropertiesManager;

if (typeof window !== 'undefined') {
    window.PropertiesManager = PropertiesManager;
}
