import { readFileSync, writeFileSync } from 'fs';
import TransactionStore from '../src/modules/core/TransactionStore.js';

const sample = JSON.parse(readFileSync('sample-expense-data-3-years.json', 'utf8'));

const mockStorage = {
    load: async () => null,
    save: async () => true,
    initialize: async () => {},
};

async function timeMs(fn) {
    const start = performance.now();
    await fn();
    return performance.now() - start;
}

async function runOnce(label, payload) {
    const samples = [];
    for (let i = 0; i < 3; i += 1) {
        const store = new TransactionStore(mockStorage, null, null, { debounceMs: 0 });
        samples.push(await timeMs(() => store.initialize(payload)));
    }
    const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    return { label, samples, avg };
}

const empty = await runOnce('empty', {
    transactions: [],
    properties: [],
    expenseCategories: [],
});
const loaded = await runOnce('sample', sample);

const report = {
    emptyAvgMs: Number(empty.avg.toFixed(2)),
    emptySamplesMs: empty.samples.map(value => Number(value.toFixed(2))),
    sampleAvgMs: Number(loaded.avg.toFixed(2)),
    sampleSamplesMs: loaded.samples.map(value => Number(value.toFixed(2))),
    sampleTransactions: sample.transactions.length,
    sampleProperties: sample.properties.length,
    measuredAt: new Date().toISOString(),
};

writeFileSync('scripts/measure-init-last.json', JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
