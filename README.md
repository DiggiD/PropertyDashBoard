# RE.Dash

A client-only dashboard that draws a Sankey chart of property expenses and income. There is no server. Data lives in the browser.

## Run it

```
npm install
npm run dev
```

Vite serves the app at `http://localhost:3000`. `index.html` loads `/src/index.js`.

```
npm test
npm run lint
npm run build
```

Add `?debug=1` to the URL to log INFO. The default log level is WARN.

## Data model

The live collection is `TransactionStore`. There is no `NormalizedDataManager` class.

A transaction is:

```
{ id, propertyId, category, subcategory?, amount, date, type }
```

`type` is `expense` or `income`. Expense amounts are negative. Income amounts are positive.

Properties are `{ id, name, created }`. Category lists are string names on `expenseCategories` and `incomeCategories`.

Import JSON that matches that shape. `sample-expense-data-3-years.json` has 2261 transactions, 3 properties, and 57 income rows. Income rows feed the overview Sankey (earnings and profit nodes). There is no separate income dashboard.

Old profiles that still have `monthlyData` or `property.expenses` trees and no `transactions` array are flattened on load by `src/modules/utils/legacyMigrator.js`.

## IndexedDB

Storage uses Dexie (`ExpenseDashboardDB`) from npm, then localStorage if IndexedDB is missing or the schema does not match. A schema mismatch does not call `db.delete()`. The existing IndexedDB database is left in place.

## Properties edits

The Properties view writes amounts through `DataManager.upsertPropertyLine` into `TransactionStore`. Overview Sankey reads those transactions. Tree fields on `property.expenses` are only a display fallback.

## Tests

Jest ignores AppleDouble `._*` files. GitHub Actions runs `npm ci`, `npm run lint`, and `npm test`.
