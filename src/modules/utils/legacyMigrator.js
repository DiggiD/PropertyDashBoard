const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthKeyToIsoDate(month) {
    if (!month || typeof month !== 'string') {
        return new Date().toISOString().split('T')[0];
    }
    const parts = month.split(' ');
    const monthIndex = MONTH_NAMES.indexOf(parts[0]);
    const year = parseInt(parts[1], 10);
    if (monthIndex < 0 || !year) {
        return new Date().toISOString().split('T')[0];
    }
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
}

export function normalizeProperties(properties) {
    if (!properties) {
        return [];
    }
    if (properties instanceof Map) {
        return Array.from(properties.values()).map(shapeProperty).filter(Boolean);
    }
    if (!Array.isArray(properties)) {
        return Object.values(properties).map(shapeProperty).filter(Boolean);
    }
    return properties.map(item => {
        const prop = Array.isArray(item) ? item[1] : item;
        return shapeProperty(prop);
    }).filter(Boolean);
}

function shapeProperty(prop) {
    if (!prop || prop.id === null || prop.id === undefined) {
        return null;
    }
    return {
        id: prop.id,
        name: prop.name || `Property ${prop.id}`,
        created: prop.created || prop.created_date || new Date().toISOString(),
    };
}

function pushTxn(transactions, propertyId, category, subcategory, amount, date, type) {
    if (typeof amount !== 'number' || amount === 0) {
        return;
    }
    const signed = type === 'income'
        ? Math.abs(amount)
        : (amount > 0 ? -Math.abs(amount) : amount);
    transactions.push({
        propertyId,
        category,
        subcategory: subcategory || undefined,
        amount: signed,
        date,
        type,
    });
}

function walkTree(transactions, propertyId, tree, date, type) {
    if (!tree || typeof tree !== 'object') {
        return;
    }
    Object.entries(tree).forEach(([category, value]) => {
        if (value && typeof value === 'object') {
            Object.entries(value).forEach(([sub, amount]) => {
                pushTxn(transactions, propertyId, category, sub, amount, date, type);
            });
        } else {
            pushTxn(transactions, propertyId, category, undefined, value, date, type);
        }
    });
}

function hierarchicalTransactions(data) {
    const transactions = [];
    const raw = data.properties || [];
    const list = Array.isArray(raw) ? raw : Object.values(raw);
    list.forEach(item => {
        const prop = Array.isArray(item) ? item[1] : item;
        if (!prop || prop.id === null || prop.id === undefined) {
            return;
        }
        if (prop.monthlyData && typeof prop.monthlyData === 'object') {
            Object.entries(prop.monthlyData).forEach(([monthKey, month]) => {
                const date = monthKeyToIsoDate(monthKey);
                walkTree(transactions, prop.id, month && month.expenses, date, 'expense');
                walkTree(transactions, prop.id, month && month.incomes, date, 'income');
            });
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        walkTree(transactions, prop.id, prop.expenses, today, 'expense');
        walkTree(transactions, prop.id, prop.incomes, today, 'income');
    });
    return transactions;
}

export function migrateToFlat(data) {
    if (!data || typeof data !== 'object') {
        return {
            transactions: [],
            properties: [],
            expenseCategories: [],
            incomeCategories: [],
        };
    }

    const expenseCategories = Array.isArray(data.expenseCategories)
        ? data.expenseCategories
        : (Array.isArray(data.categories) ? data.categories : []);
    const incomeCategories = Array.isArray(data.incomeCategories) ? data.incomeCategories : [];
    const properties = normalizeProperties(data.properties);

    if (Array.isArray(data.transactions) && data.transactions.length > 0) {
        return {
            ...data,
            transactions: data.transactions,
            properties,
            expenseCategories,
            incomeCategories,
        };
    }

    return {
        ...data,
        transactions: hierarchicalTransactions(data),
        properties,
        expenseCategories,
        incomeCategories,
    };
}
