// filepath: src/__mocks__/ChartRenderer.js

export default class MockChartRenderer {
    constructor(dataManager, uiManager, formatter, themeManager) {
        this.dataManager = dataManager;
        this.uiManager = uiManager;
        this.formatter = formatter;
        this.themeManager = themeManager;
        console.log('[CHART] ChartRenderer initialized');
    }

    async initialize() {
        console.log('[CHART] Chart renderer initialized');
    }

    async renderOverviewSankey() {
        console.log('[CHART] Rendering overview sankey chart');
    }
}