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
  clearMocks: true, // Enable for better cleanup and performance
  maxWorkers: 3, // Fixed number instead of percentage for consistency
  testTimeout: 10000, // Reduced from 60s to 10s for faster feedback
  forceExit: false, // Disable to avoid issues with async operations
  detectOpenHandles: false, // Disable for better performance
  cache: false, // Disable Jest cache for reliability and speed
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '@modules/(.*)': '<rootDir>/src/modules/$1'
  }
};
