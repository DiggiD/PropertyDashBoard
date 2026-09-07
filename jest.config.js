export default {
  roots: ['<rootDir>/src'],
  testEnvironment: 'jsdom',
  globals: {
    document: true
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx|mjs)$': 'babel-jest'
  },
  transformIgnorePatterns: ['/node_modules/(?!(d3)/)'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'mjs'],
  testMatch: ['<rootDir>/src/__tests__/**/*.test.{js,jsx,ts,tsx}', '<rootDir>/src/**/__tests__/**/*.test.{js,jsx,ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/\\._'],
  collectCoverageFrom: ['src/modules/**/*.{js,ts}', 'src/index.js', '!**/node_modules/**', '!**/__tests__/**'],
  reporters: ['default'],
  coverageReporters: ['lcov', 'text', 'html'],
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setupTests.js'],
  clearMocks: true, // Enable for better cleanup and performance
  maxWorkers: 3, // Fixed number instead of percentage for consistency
  testTimeout: 10000, // Reduced from 60s to 10s for faster feedback
  forceExit: false, // Disable to avoid issues with async operations
  detectOpenHandles: false, // Disable for better performance
  cache: false, // Disable Jest cache for reliability and speed
  moduleNameMapper: {
    '^src/modules/core/TransactionStore\\.js$': '<rootDir>/src/modules/core/TransactionStore.ts',
    '^src/modules/core/DataManager\\.js$': '<rootDir>/src/modules/core/DataManager.ts',
    '^src/modules/core/ChartRenderer\\.js$': '<rootDir>/src/modules/core/ChartRenderer.ts',
    '^src/modules/utils/Storage\\.js$': '<rootDir>/src/modules/utils/Storage.ts',
    'transactionModel\\.js$': '<rootDir>/src/modules/core/transactionModel.ts',
    'modules/core/TransactionStore\\.js$': '<rootDir>/src/modules/core/TransactionStore.ts',
    'modules/core/DataManager\\.js$': '<rootDir>/src/modules/core/DataManager.ts',
    'modules/core/ChartRenderer\\.js$': '<rootDir>/src/modules/core/ChartRenderer.ts',
    'modules/utils/Storage\\.js$': '<rootDir>/src/modules/utils/Storage.ts',
    '^\\./TransactionStore\\.js$': '<rootDir>/src/modules/core/TransactionStore.ts',
    '^\\./DataManager\\.js$': '<rootDir>/src/modules/core/DataManager.ts',
    '^\\./ChartRenderer\\.js$': '<rootDir>/src/modules/core/ChartRenderer.ts',
    '^src/(.*)$': '<rootDir>/src/$1',
    '@modules/(.*)': '<rootDir>/src/modules/$1'
  }
};
