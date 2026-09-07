export type PropertyId = number & { readonly __brand: 'PropertyId' };
export type TransactionId = string & { readonly __brand: 'TransactionId' };
export type NonZeroAmount = number & { readonly __brand: 'NonZeroAmount' };

export type TransactionType = 'expense' | 'income';

type TransactionFields = {
    id: TransactionId;
    propertyId: PropertyId;
    category: string;
    subcategory?: string;
    amount: NonZeroAmount;
    date: string;
    description?: string;
};

export type ExpenseTransaction = TransactionFields & { type: 'expense' };
export type IncomeTransaction = TransactionFields & { type: 'income' };
export type Transaction = ExpenseTransaction | IncomeTransaction;

export type PropertyRecord = {
    id: PropertyId | number;
    name: string;
    created: string;
    created_date?: string;
};

export type DashboardData = {
    transactions: Transaction[];
    properties: PropertyRecord[];
    expenseCategories: string[];
    incomeCategories: string[];
    version?: string;
    exportedAt?: string;
    currentTimePeriod?: string;
    currentView?: string;
    _lastSaved?: unknown;
    currentUser?: string;
};

export type TransactionQuery = {
    propertyId?: PropertyId | number;
    type?: TransactionType | string;
    category?: string;
    subcategory?: string;
    dateRange?: { start?: string; end?: string } | null;
    amountRange?: { min?: number; max?: number };
    sortBy?: { field: string; order?: 'asc' | 'desc' };
    limit?: number;
    offset?: number;
};

export type AggregatedSankey = {
    hasIncome: boolean;
    sources: Map<string, number>;
    propIncomes: Map<PropertyId | number, number>;
    propExpenses: Map<PropertyId | number, number>;
    catTotals: Map<string, number>;
    subTotals: Map<string, Map<string, number>>;
};

export function parsePropertyId(value: unknown): PropertyId | null {
    if (typeof value !== 'number') {
        return null;
    }
    if (!value) {
        return null;
    }
    return value as PropertyId;
}

export function parseNonZeroAmount(value: unknown): NonZeroAmount | null {
    if (typeof value !== 'number') {
        return null;
    }
    if (value === 0) {
        return null;
    }
    return value as NonZeroAmount;
}

export function parseTransactionType(value: unknown): TransactionType {
    return value === 'income' ? 'income' : 'expense';
}

export function parseTransaction(
    input: unknown,
    generateId: () => string,
): Transaction | null {
    if (!input || typeof input !== 'object') {
        return null;
    }
    const txn = input as Record<string, unknown>;
    const propertyId = parsePropertyId(txn.propertyId);
    const category = typeof txn.category === 'string' ? txn.category.trim() : '';
    const amount = parseNonZeroAmount(txn.amount);
    if (!propertyId || !category || amount === null) {
        return null;
    }
    const type = parseTransactionType(txn.type);
    const subcategory = txn.subcategory
        ? String(txn.subcategory).trim()
        : undefined;
    const description = txn.description
        ? String(txn.description).trim()
        : undefined;
    const date = (txn.date as string | undefined)
        || new Date().toISOString().split('T')[0];
    const id = (txn.id || generateId()) as TransactionId;
    const parsed = {
        id,
        propertyId,
        category,
        subcategory,
        amount,
        date,
        description,
    };
    if (type === 'income') {
        return { ...parsed, type: 'income' };
    }
    return { ...parsed, type: 'expense' };
}
