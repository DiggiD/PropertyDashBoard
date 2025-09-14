/**
 * PropertiesManager Module
 * Handles the properties dashboard functionality
 * - Property CRUD operations
 * - Category/Subcategory management per property
 * - Expense data entry and editing
 * - Hierarchical category structure management
 */

class PropertiesManager {
    constructor(dataManager, uiManager, eventHandler, historyManager) {
        this.dataManager = dataManager;
        this.uiManager = uiManager;
        this.eventHandler = eventHandler;
        this.historyManager = historyManager;

        // Current state
        this.currentPropertyId = null;
        this.currentCategoryPath = null; // For hierarchical navigation
        this.isEditMode = false;

        // Double-click detection and single-click delay
        this.clickCounters = new Map();
        this.pendingSelections = new Map();

        console.log('[PROPERTIES] PropertiesManager initialized');
    }

    /**
     * Initialize properties manager
     */
    async initialize() {
        try {
            console.log('[PROPERTIES] Starting PropertiesManager initialization...');

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
            console.log('[PROPERTIES] PropertiesManager initialized successfully');
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
            // Double-click for inline editing of names
            this.uiManager.addEventListener(container, 'dblclick', (e) => {
                const editableElement = e.target.closest('.property-name.editable, .category-name.editable, .subcategory-name.editable');
                if (!editableElement) return;

                // Constrain to direct clicks on the name text (not padding/margins)
                const rect = editableElement.getBoundingClientRect();
                const clickX = e.clientX;
                const clickY = e.clientY;

                // Check if click is within the text bounds (rough approximation)
                const textWidth = editableElement.scrollWidth;
                const textHeight = editableElement.scrollHeight;
                const isInTextArea = clickX >= rect.left && clickX <= rect.left + textWidth &&
                                   clickY >= rect.top && clickY <= rect.top + textHeight;

                if (!isInTextArea) return;

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
                // Check if this click is part of a double-click sequence
                const editableElement = e.target.closest('.property-name.editable, .category-name.editable, .subcategory-name.editable');
                if (editableElement) {
                    // For editable names, delay selection to allow double-click to cancel it
                    const itemElement = editableElement.closest('.property-item');
                    if (itemElement) {
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
        }

        console.log('[PROPERTIES] Event listeners setup');
    }

    /**
     * Render the properties dashboard
     */
    renderPropertiesDashboard() {
        const properties = this.dataManager.getProperties();
        const container = this.uiManager.getElement('propertiesDashboard');

        if (!container) {
            console.error('[PROPERTIES] Properties dashboard container not found');
            return;
        }

        // Always render the multi-panel layout
        const html = this.renderMultiPanelLayout(properties);

        // Update the dashboard content
        const contentElement = container.querySelector('.dashboard-content');
        if (contentElement) {
            contentElement.innerHTML = html;
        }

        console.log('[PROPERTIES] Properties dashboard rendered');
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
                <div class="panel values-panel">
                    <div class="panel-header">
                        ${selectedCategory && selectedProperty && isSelectedCategoryHierarchical ? `
                            <button class="btn btn--outline btn--sm" id="add-subcategory-btn" title="Add Subcategory">
                                +
                            </button>
                        ` : ''}
                    </div>
                    <div class="panel-content">
                        ${selectedCategory && isSelectedCategoryHierarchical ? this.renderValuesPanel(selectedProperty, selectedCategory, selectedSubcategory) : ''}
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

        const hasSelected = properties.some(property => property.id === this.currentPropertyId);

        return `
            <div class="properties-list ${hasSelected ? 'has-selected' : ''}">
                ${properties.map(property => {
                    const isSelected = property.id === this.currentPropertyId;
                    const currentData = this.dataManager.getCurrentPeriodData(property);
                    const categoryCount = Object.keys(property.expenses || {}).length;
                    const totalValue = currentData && currentData.total !== undefined ? currentData.total : 0;
                    const formattedTotal = this.uiManager.formatter ? this.uiManager.formatter.formatNumber(totalValue) : totalValue;

                    return `
                        <div class="property-item ${isSelected ? 'selected' : ''}" data-property-id="${property.id || ''}">
                            <div class="property-info">
                                <h5 class="property-name editable" data-property-id="${property.id || ''}">${property.name || 'Unnamed Property'}</h5>
                                <div class="property-meta">
                                    <span class="property-total">₹${formattedTotal}</span>
                                </div>
                            </div>
                            <div class="property-actions">
                                <button class="property-action" data-action="delete" data-property-id="${property.id || ''}" title="Delete property">
                                    Delete
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

        const hasSelected = categories.some(category => category === this.currentCategoryPath?.category);

        return `
            <div class="properties-list ${hasSelected ? 'has-selected' : ''}">
                ${categories.map(category => {
                    const isSelected = category === this.currentCategoryPath?.category;
                    const expenseValue = this.getCategoryExpenseValue(property, category);
                    const isHierarchical = typeof expenseValue === 'object' && expenseValue !== null;
                    const displayValue = isHierarchical ?
                        `₹${this.uiManager.formatter ? this.uiManager.formatter.formatNumber(this.sumObjectValues(expenseValue)) : this.sumObjectValues(expenseValue)}` :
                        `₹${this.uiManager.formatter ? this.uiManager.formatter.formatNumber(expenseValue || 0) : (expenseValue || 0)}`;

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
                                    <button class="category-action" data-action="delete" data-category="${category || ''}" title="Delete category">
                                        Delete
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
                                    <button class="category-action" data-action="delete" data-category="${category || ''}" title="Delete category">
                                        Delete
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
     * Render values panel (shows flat categories for editing or subcategories for hierarchical categories)
     */
    renderValuesPanel(property, category, subcategory) {
        const expenseValue = this.getCategoryExpenseValue(property, category);
        const isHierarchical = typeof expenseValue === 'object' && expenseValue !== null;

        if (!isHierarchical) {
            // Flat category - show the single value for editing with inline name and value
            const displayValue = `₹${this.uiManager.formatter ? this.uiManager.formatter.formatNumber(expenseValue || 0) : (expenseValue || 0)}`;
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
            const subcategories = Object.entries(expenseValue);
            const hasSelected = subcategories.some(([subcat]) => subcat === subcategory);

            return `
                <div class="properties-list ${hasSelected ? 'has-selected' : ''}">
                    ${subcategories.map(([subcat, value]) => {
                        const isSelected = subcat === subcategory;
                        const displayValue = `₹${this.uiManager.formatter ? this.uiManager.formatter.formatNumber(value || 0) : (value || 0)}`;

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
            const formattedTotal = this.uiManager.formatter ? this.uiManager.formatter.formatNumber(totalValue) : totalValue;

            return `
                <div class="property-item" data-property-id="${property.id || ''}">
                    <div class="property-header">
                        <div class="property-info">
                            <h4 class="property-name">${property.name || 'Unnamed Property'}</h4>
                            <div class="property-meta">
                                <span class="property-categories">${categoryCount} categories</span>
                                <span class="property-total">₹${formattedTotal}</span>
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
                            <span class="summary-item">Total: ₹${this.uiManager.formatter.formatNumber(currentData.total)}</span>
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
            if (e.key === 'Enter') handleConfirm();
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
                            ₹${this.uiManager.formatter.formatNumber(value || 0)}
                        </div>
                    </div>`
                ).join('')}
            </div>
        `;
    }

    /**
     * Get property categories
     */
    getPropertyCategories(property) {
        if (!property || !property.expenses) return [];
        return Object.keys(property.expenses);
    }

    /**
     * Get category expense value
     */
    getCategoryExpenseValue(property, category) {
        if (!property) return 0;

        // For hierarchical detection, check the quarterly data first
        if (property.quarterlyData) {
            const quarters = Object.keys(property.quarterlyData);
            if (quarters.length > 0) {
                const latestQuarter = quarters[quarters.length - 1];
                const quarterData = property.quarterlyData[latestQuarter];
                if (quarterData && quarterData.expenses && quarterData.expenses[category]) {
                    return quarterData.expenses[category];
                }
            }
        }

        // Fallback to expenses object
        if (!property.expenses) return 0;
        return property.expenses[category];
    }

    /**
     * Sum object values
     */
    sumObjectValues(obj) {
        if (typeof obj !== 'object' || obj === null) return 0;
        return Object.values(obj).reduce((sum, val) => sum + (val || 0), 0);
    }

    /**
     * Handle item click (unified handler for all panels)
     */
    handleItemClick(event) {
        const propertyItem = event.target.closest('.property-item');
        if (!propertyItem) return;

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
        if (!propertyItem) return;

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
        if (!button) return;

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
        if (!categoryItem) return;

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
        if (!button) return;

        event.stopPropagation();

        const action = button.dataset.action;
        const category = button.dataset.category;

        switch (action) {
            case 'delete':
                this.confirmDeleteCategory(category);
                break;
        }
    }

    /**
     * Handle expense edit
     */
    handleExpenseEdit(event) {
        const valueElement = event.target.closest('.expense-value');
        if (!valueElement || this.isEditMode) return;

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
        input.min = '0';
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

        if (!input) return;

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
     */
    getCurrentExpenseValue(category, subcategory) {
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property) return 0;

        if (subcategory) {
            // For subcategories, get the value from expenses object first
            const categoryValue = property.expenses[category];
            if (typeof categoryValue === 'object' && categoryValue !== null && categoryValue[subcategory] !== undefined) {
                return categoryValue[subcategory];
            }

            // Fallback to quarterly data
            if (property.quarterlyData) {
                const quarters = Object.keys(property.quarterlyData);
                if (quarters.length > 0) {
                    const latestQuarter = quarters[quarters.length - 1];
                    const quarterData = property.quarterlyData[latestQuarter];
                    if (quarterData && quarterData.expenses && quarterData.expenses[category]) {
                        const categoryData = quarterData.expenses[category];
                        if (typeof categoryData === 'object' && categoryData !== null && categoryData[subcategory] !== undefined) {
                            return categoryData[subcategory];
                        }
                    }
                }
            }

            return 0;
        }

        const value = property.expenses[category];
        return typeof value === 'object' ? this.sumObjectValues(value) : (value || 0);
    }

    /**
     * Save expense value
     */
    saveExpenseValue(category, subcategory, value) {
        const property = this.dataManager.getPropertyById(this.currentPropertyId);
        if (!property) return;

        // Create snapshot for undo
        this.historyManager.createSnapshot(`Updated ${category}${subcategory ? ` - ${subcategory}` : ''} expense`, '', false);

        // Update both expenses object and quarterly data
        if (subcategory) {
            // Update subcategory value
            if (typeof property.expenses[category] !== 'object' || property.expenses[category] === null) {
                property.expenses[category] = {};
            }
            property.expenses[category][subcategory] = value;

            // Update quarterly data as well
            this.updateQuarterlyData(property, category, { [subcategory]: value });
        } else {
            // Update category value
            property.expenses[category] = value;

            // Update quarterly data as well
            this.updateQuarterlyData(property, category, value);
        }

        // Save to storage
        this.dataManager.save();

        // Re-render
        this.renderPropertiesDashboard();

        // Show success message
        this.uiManager.showToast(`Expense updated successfully`, 'success');
    }

    /**
     * Update quarterly data to maintain consistency
     */
    updateQuarterlyData(property, category, value) {
        if (!property.quarterlyData) return;

        // Get the latest quarter
        const quarters = Object.keys(property.quarterlyData);
        if (quarters.length === 0) return;

        const latestQuarter = quarters[quarters.length - 1];
        const quarterData = property.quarterlyData[latestQuarter];

        if (quarterData && quarterData.expenses) {
            if (typeof value === 'object' && value !== null) {
                // Hierarchical update
                if (typeof quarterData.expenses[category] !== 'object' || quarterData.expenses[category] === null) {
                    quarterData.expenses[category] = {};
                }
                Object.assign(quarterData.expenses[category], value);
            } else {
                // Flat update
                quarterData.expenses[category] = value;
            }

            // Recalculate total for the quarter
            const total = Object.values(quarterData.expenses).reduce((sum, expense) => {
                if (typeof expense === 'object' && expense !== null) {
                    return sum + Object.values(expense).reduce((subSum, val) => subSum + (val || 0), 0);
                }
                return sum + (expense || 0);
            }, 0);

            quarterData.total = total;
        }
    }

    /**
     * Cancel expense edit
     */
    cancelExpenseEdit(input) {
        const category = input.dataset.category;
        const subcategory = input.dataset.subcategory;
        const currentValue = this.getCurrentExpenseValue(category, subcategory);

        const valueElement = input.closest('.expense-value');
        valueElement.innerHTML = `₹${this.uiManager.formatter.formatNumber(currentValue)}`;

        this.isEditMode = false;
    }

    /**
     * Handle add property
     */
    handleAddProperty() {
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
        if (!valueItem) return;

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
        if (!propertyItem) return;

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
        if (!categoryItem) return;

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
        if (!valueItem) return;

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
        if (!expenseValue) return;

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
        const propertyNameElement = event.target.closest('.property-name.editable');
        if (!propertyNameElement || this.isEditMode) return;

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
        if (!property) return;

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
        if (!input) return;

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
        if (!categoryNameElement || this.isEditMode) return;

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
        if (!property || !category) return;

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
        if (!input) return;

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
        if (!subcategoryNameElement || this.isEditMode) return;

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
        if (!property || !category || !subcategory) return;

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
        if (!input) return;

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
        this.currentPropertyId = null;
        this.currentCategoryPath = null;
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
            if (e.key === 'Enter') handleConfirm();
        });

        input.focus();
    }

    /**
     * Show edit property modal
     */
    showEditPropertyModal(propertyId) {
        const property = this.dataManager.getPropertyById(propertyId);
        if (!property) return;

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
            if (e.key === 'Enter') handleConfirm();
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
            if (e.key === 'Enter') handleConfirm();
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
                    <input type="number" id="new-subcategory-value-${timestamp}" class="form-control" placeholder="0.00" step="0.01" min="0" value="0">
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
            if (e.key === 'Enter') handleConfirm();
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
            existingModal.remove();
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
    addProperty(name) {
        const result = this.dataManager.addProperty(name);
        if (result.success) {
            this.historyManager.createSnapshot(`Added property "${name}"`, '', false);
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
        if (!property || !property.expenses.hasOwnProperty(oldCategory)) return;

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

        // Update quarterly data if it exists
        if (property.quarterlyData) {
            Object.values(property.quarterlyData).forEach(quarterData => {
                if (quarterData.expenses && quarterData.expenses.hasOwnProperty(oldCategory)) {
                    const quarterValue = quarterData.expenses[oldCategory];
                    delete quarterData.expenses[oldCategory];
                    quarterData.expenses[newCategory] = quarterValue;
                }
            });
        }

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
        if (!property || !property.expenses.hasOwnProperty(category)) return;

        const categoryValue = property.expenses[category];
        if (typeof categoryValue !== 'object' || !categoryValue.hasOwnProperty(oldSubcategory)) return;

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

        // Update quarterly data if it exists
        if (property.quarterlyData) {
            Object.values(property.quarterlyData).forEach(quarterData => {
                if (quarterData.expenses && quarterData.expenses[category] &&
                    typeof quarterData.expenses[category] === 'object' &&
                    quarterData.expenses[category].hasOwnProperty(oldSubcategory)) {
                    const quarterValue = quarterData.expenses[category][oldSubcategory];
                    delete quarterData.expenses[category][oldSubcategory];
                    quarterData.expenses[category][newSubcategory] = quarterValue;
                }
            });
        }

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
        if (!property) return;

        // Show inline confirmation instead of browser popup
        this.showInlineDeleteConfirmation(propertyId, 'property', property.name);
    }

    /**
     * Delete property
     */
    deleteProperty(propertyId) {
        const property = this.dataManager.getPropertyById(propertyId);
        if (!property) return;

        const result = this.dataManager.deleteProperty(propertyId);
        if (result.success) {
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
        if (!property) return;

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
        if (!property || !this.currentCategoryPath) return;

        const category = this.currentCategoryPath.category;
        if (!property.expenses.hasOwnProperty(category)) return;

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
        if (!property || !property.expenses.hasOwnProperty(category)) return;

        // Create snapshot
        this.historyManager.createSnapshot(`Deleted category "${category}" from ${property.name}`, '', false);

        // Remove category
        delete property.expenses[category];

        // Save and refresh
        this.dataManager.save();
        this.renderPropertiesDashboard();
        this.uiManager.showToast(`Category "${category}" deleted successfully`, 'success');
    }

    /**
     * Show inline delete confirmation
     */
    showInlineDeleteConfirmation(itemId, itemType, itemName) {
        const container = this.uiManager.getElement('propertiesDashboard');
        if (!container) return;

        const timestamp = Date.now();
        const confirmationHtml = `
            <div class="delete-confirmation-overlay" id="delete-confirmation-overlay-${timestamp}">
                <div class="delete-confirmation-modal">
                    <div class="delete-confirmation-header">
                        <h4>Confirm Deletion</h4>
                    </div>
                    <div class="delete-confirmation-body">
                        <p>Are you sure you want to delete <strong>"${itemName}"</strong>?</p>
                        <p class="delete-warning">This action cannot be undone.</p>
                    </div>
                    <div class="delete-confirmation-footer">
                        <button class="btn btn--outline" id="cancel-delete-btn-${timestamp}">Cancel</button>
                        <button class="btn btn--danger" id="confirm-delete-btn-${timestamp}">Delete</button>
                    </div>
                </div>
            </div>
        `;

        // Insert confirmation overlay
        const contentElement = container.querySelector('.dashboard-content');
        if (contentElement) {
            contentElement.insertAdjacentHTML('beforeend', confirmationHtml);
        }

        // Setup event listeners
        const cancelBtn = document.getElementById(`cancel-delete-btn-${timestamp}`);
        const confirmBtn = document.getElementById(`confirm-delete-btn-${timestamp}`);
        const overlay = document.getElementById(`delete-confirmation-overlay-${timestamp}`);

        const closeConfirmation = () => {
            if (overlay) {
                overlay.remove();
            }
        };

        cancelBtn.addEventListener('click', closeConfirmation);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeConfirmation();
            }
        });

        confirmBtn.addEventListener('click', () => {
            closeConfirmation();
            if (itemType === 'property') {
                this.deleteProperty(itemId);
            } else if (itemType === 'category') {
                this.deleteCategory(itemName);
            }
        });

        // Focus the cancel button for accessibility
        setTimeout(() => {
            if (cancelBtn) cancelBtn.focus();
        }, 100);
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
     * Cleanup resources
     */
    cleanup() {
        // Remove event listeners if needed
        console.log('[PROPERTIES] PropertiesManager cleaned up');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PropertiesManager;
} else {
    window.PropertiesManager = PropertiesManager;
}
