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
  collectCoverageFrom: ['src/modules/**/*.js', 'src/App.js', 'src/index.js', '!**/node_modules/**', '!**/__tests__/**'],
  reporters: ['default'],
  coverageReporters: ['lcov', 'text', 'html'],
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setupTests.js'],
  clearMocks: false,
  maxWorkers: 1, // Reduce to 1 worker to avoid child process exhaustion
  testTimeout: 120000, // 2 minutes for comprehensive tests
  forceExit: true,
  detectOpenHandles: true,
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '@modules/(.*)': '<rootDir>/src/modules/$1',
    '^src/modules/utils/(.*)': '<rootDir>/src/__mocks__/$1.js'
  }
};
