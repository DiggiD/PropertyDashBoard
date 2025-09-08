# DataManager Module

## Overview

The **DataManager** is the central data management and business logic module for the Property Expense Dashboard. It handles all data operations, validation, CRUD operations, and business rule enforcement while maintaining data integrity and providing efficient data access patterns.

## Architecture

### Core Responsibilities

- **Data Operations**: Complete CRUD operations for properties and expense categories
- **Business Logic**: Validation, calculations, and data integrity enforcement
- **Persistence**: Multi-layer storage (localStorage + Dexie.js)
- **Time Period Management**: Support for all, year, quarter, and month time periods
- **Historical Data**: Snapshot management and undo/redo support

### Key Features

- **Comprehensive Validation**: Input validation with detailed error messages
- **Multi-Time Period Support**: Flexible time period filtering and aggregation
- **Automatic Integrity Checks**: Data consistency validation and repair
- **Performance Optimization**: Efficient caching and lazy loading
- **Change Tracking**: Automatic change detection and persistence

## API Reference

### Constructor

```javascript
const dataManager = new DataManager(storage, validator, formatter);
```

**Parameters:**
- `storage` (Storage): Storage module for data persistence
- `validator` (Validator): Validation module for data integrity
- `formatter` (Formatter): Formatting module for data display

### Core Methods

#### Data Operations

```javascript
// Initialize with existing data
await dataManager.initialize(initialData);

// Get current data snapshot
const data = dataManager.getData();

// Save changes to storage
await dataManager.save();

// Check for unsaved changes
const hasChanges = dataManager.hasUnsavedChanges();
```

#### Property Management

```javascript
// Add new property
const result = dataManager.addProperty("Downtown Office");
// Returns: { success: true, message: "...", property: {...} }

// Update property name
const result = dataManager.updatePropertyName(propertyId, "New Name");

// Delete property
const result = dataManager.deleteProperty(propertyId);

// Get property by ID
const property = dataManager.getPropertyById(propertyId);
```

#### Category Management

```javascript
// Add expense category
const result = dataManager.addExpenseCategory("Maintenance");

// Update category name
const result = dataManager.updateExpenseCategory("Old Name", "New Name");

// Delete category
const result = dataManager.deleteExpenseCategory("Category Name");
```

#### Expense Management

```javascript
// Update property expense
const result = dataManager.updatePropertyExpense(
    propertyId,
    "Maintenance",
    5000
);
```

#### Time Period Management

```javascript
// Set current time period
dataManager.setCurrentTimePeriod('quarter'); // 'all', 'year', 'quarter', 'month'

// Set current view
dataManager.setCurrentView('trends'); // 'overview', 'trends', 'comparison', 'categories'

// Get current period data for property
const periodData = dataManager.getCurrentPeriodData(property);
```

#### Calculations & Analytics

```javascript
// Calculate total expenses
const total = dataManager.calculateTotalExpenses();

// Calculate average per property
const average = dataManager.calculateAverageExpensePerProperty();

// Get top expense category
const topCategory = dataManager.getTopExpenseCategory();
```

#### Data Statistics

```javascript
// Get comprehensive data statistics
const stats = dataManager.getDataStatistics();
// Returns: {
//   totalProperties: 5,
//   totalCategories: 8,
//   totalExpenses: 125000,
//   averageExpensePerProperty: 25000,
//   topExpenseCategory: { name: "Maintenance", amount: 45000 },
//   currentTimePeriod: "all",
//   currentView: "overview",
//   hasUnsavedChanges: false,
//   lastSaved: Date
// }
```

## Data Structure

### Property Object

```javascript
{
  id: 1,                    // Unique identifier
  name: "Downtown Office",  // Property name
  expenses: {               // Current expense amounts by category
    "Maintenance": 5000,
    "Utilities": 2000,
    "Insurance": 1500
  },
  quarterlyData: {          // Historical quarterly data
    "Q1 2024": {
      total: 8500,
      expenses: { "Maintenance": 3000, ... }
    }
  },
  categoryTrends: {}        // Category trend analysis
}
```

### Application Data Structure

```javascript
{
  properties: [Property],           // Array of property objects
  expenseCategories: [String],      // Array of category names
  currentTimePeriod: "all",         // Current time period filter
  currentView: "overview"           // Current view mode
}
```

## Business Rules

### Property Limits
- Maximum 20 properties per dashboard
- Property names must be unique (case-insensitive)
- Property names limited to 50 characters

### Category Limits
- Maximum 15 expense categories
- Category names must be unique (case-insensitive)
- Category names limited to 30 characters

### Expense Validation
- Amounts must be positive numbers
- Maximum amount: $9,999,999.99
- Minimum amount: $0.01

### Data Integrity
- Automatic validation on all data operations
- Change tracking for undo/redo support
- Data consistency checks on load/save

## Error Handling

### Validation Errors

```javascript
// Example validation error response
{
  success: false,
  message: "Property name cannot be empty",
  property: null
}
```

### Common Error Scenarios

- **Duplicate Names**: Property or category names already exist
- **Invalid Format**: Names contain invalid characters or exceed length limits
- **Limit Exceeded**: Maximum properties/categories reached
- **Invalid Amount**: Expense amounts outside valid range
- **Data Corruption**: Inconsistent data detected during integrity checks

## Performance Considerations

### Optimization Strategies

- **Lazy Loading**: Data loaded on-demand
- **Caching**: Frequently accessed data cached in memory
- **Efficient Queries**: Optimized data structure traversal
- **Change Tracking**: Only save modified data

### Memory Management

- **Automatic Cleanup**: Unused data removed from memory
- **Snapshot Management**: Historical data efficiently stored
- **Reference Management**: Proper object lifecycle management

## Integration Points

### Dependencies

- **Storage Module**: Data persistence and retrieval
- **Validator Module**: Data validation and integrity checks
- **Formatter Module**: Data formatting and display

### Integration with Other Modules

- **UIManager**: Provides data for UI rendering
- **ChartRenderer**: Supplies data for chart visualization
- **EventHandler**: Handles user interactions that modify data
- **HistoryManager**: Manages undo/redo operations

## Testing

### Unit Tests

```javascript
// Example test cases
describe('DataManager', () => {
  test('should add property successfully', () => {
    const result = dataManager.addProperty('Test Property');
    expect(result.success).toBe(true);
    expect(result.property.name).toBe('Test Property');
  });

  test('should reject duplicate property names', () => {
    dataManager.addProperty('Test Property');
    const result = dataManager.addProperty('Test Property');
    expect(result.success).toBe(false);
    expect(result.message).toContain('already exists');
  });
});
```

### Integration Tests

- **Data Persistence**: Verify data survives page reloads
- **Multi-Module Integration**: Test interactions with other modules
- **Performance Tests**: Validate performance under load
- **Edge Cases**: Empty data, corrupted data, large datasets

## Usage Examples

### Basic Property Management

```javascript
// Initialize data manager
const dataManager = new DataManager(storage, validator, formatter);
await dataManager.initialize();

// Add properties
dataManager.addProperty("Downtown Office");
dataManager.addProperty("Warehouse Complex");

// Add expense categories
dataManager.addExpenseCategory("Maintenance");
dataManager.addExpenseCategory("Utilities");

// Update expenses
const propertyId = 1;
dataManager.updatePropertyExpense(propertyId, "Maintenance", 5000);
dataManager.updatePropertyExpense(propertyId, "Utilities", 1200);

// Save changes
await dataManager.save();
```

### Advanced Analytics

```javascript
// Get comprehensive statistics
const stats = dataManager.getDataStatistics();
console.log(`Total Properties: ${stats.totalProperties}`);
console.log(`Total Expenses: $${stats.totalExpenses.toLocaleString()}`);
console.log(`Top Category: ${stats.topExpenseCategory.name}`);

// Calculate period-specific data
dataManager.setCurrentTimePeriod('quarter');
const quarterlyTotal = dataManager.calculateTotalExpenses();
const quarterlyAverage = dataManager.calculateAverageExpensePerProperty();
```

## Troubleshooting

### Common Issues

1. **Data Not Persisting**
   - Check Storage module configuration
   - Verify localStorage availability
   - Check for data corruption

2. **Validation Errors**
   - Review input data format
   - Check business rule constraints
   - Verify data integrity

3. **Performance Issues**
   - Check data size and complexity
   - Review caching configuration
   - Monitor memory usage

### Debug Information

```javascript
// Enable debug logging
dataManager.debug();

// Get detailed statistics
const stats = dataManager.getDataStatistics();
console.log('Data Statistics:', stats);
```

## Future Enhancements

### Planned Features

- **Bulk Operations**: Import/export multiple properties
- **Advanced Filtering**: Complex query support
- **Data Synchronization**: Cloud backup and sync
- **Audit Trail**: Complete change history tracking
- **Advanced Analytics**: Trend analysis and forecasting

### API Extensions

- **REST API Integration**: External data source support
- **Real-time Updates**: Live data synchronization
- **Advanced Search**: Full-text search capabilities
- **Data Export**: Multiple format support (CSV, JSON, PDF)
