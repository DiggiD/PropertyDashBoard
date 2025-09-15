/**
 * Test script to verify negative values are correctly applied to expense data
 */

// Load the required modules
import fs from 'fs';

// Read the sample data
const sampleData = JSON.parse(fs.readFileSync('sample-expense-data-3-years.json', 'utf8'));

console.log('=== Testing Negative Values Implementation ===\n');

// Test the convertToExpenseValues function logic
function convertToExpenseValues(expenses) {
    const convertedExpenses = {};

    Object.entries(expenses).forEach(([category, value]) => {
        if (typeof value === 'object' && value !== null) {
            // Handle hierarchical expenses
            convertedExpenses[category] = {};
            Object.entries(value).forEach(([subcategory, subValue]) => {
                // Convert positive values to negative for expenses
                convertedExpenses[category][subcategory] = typeof subValue === 'number' && subValue > 0 ? -subValue : subValue;
            });
        } else if (typeof value === 'number') {
            // Convert positive values to negative for expenses
            convertedExpenses[category] = value > 0 ? -value : value;
        } else {
            // Keep non-numeric values as-is
            convertedExpenses[category] = value;
        }
    });

    return convertedExpenses;
}

// Test with sample data
console.log('Testing with sample expense data...\n');

sampleData.currentData.properties.forEach((property, index) => {
    console.log(`Property ${index + 1}: ${property.name}`);
    console.log('Original expenses:', property.expenses);

    const convertedExpenses = convertToExpenseValues(property.expenses);
    console.log('Converted expenses:', convertedExpenses);

    // Check if all values are negative (expenses)
    let allNegative = true;
    Object.values(convertedExpenses).forEach(value => {
        if (typeof value === 'object' && value !== null) {
            Object.values(value).forEach(subValue => {
                if (typeof subValue === 'number' && subValue > 0) {
                    allNegative = false;
                }
            });
        } else if (typeof value === 'number' && value > 0) {
            allNegative = false;
        }
    });

    console.log(`All values negative (expenses): ${allNegative ? '✅ PASS' : '❌ FAIL'}\n`);
});

// Test hierarchical data specifically
console.log('Testing hierarchical data conversion...\n');

const testHierarchicalData = {
    'Maintenance': {
        'Plumbing': 500,
        'Electrical': 300,
        'General': 200
    },
    'Utilities': 800,
    'Insurance': 1200
};

console.log('Original hierarchical data:', testHierarchicalData);
const convertedHierarchical = convertToExpenseValues(testHierarchicalData);
console.log('Converted hierarchical data:', convertedHierarchical);

// Verify hierarchical conversion
const maintenanceTotal = Object.values(convertedHierarchical.Maintenance).reduce((sum, val) => sum + val, 0);
console.log(`Maintenance total: ${maintenanceTotal} (should be negative: ${maintenanceTotal < 0 ? '✅ PASS' : '❌ FAIL'})`);
console.log(`Utilities value: ${convertedHierarchical.Utilities} (should be negative: ${convertedHierarchical.Utilities < 0 ? '✅ PASS' : '❌ FAIL'})`);
console.log(`Insurance value: ${convertedHierarchical.Insurance} (should be negative: ${convertedHierarchical.Insurance < 0 ? '✅ PASS' : '❌ FAIL'})`);

console.log('\n=== Test Complete ===');
