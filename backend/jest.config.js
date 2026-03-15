module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/migrations/**',
    '!src/seeders/**',
    '!src/models/**',
    '!src/database/**',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  coverageReporters: ['lcov', 'text', 'clover'],
  setupFiles: ['./tests/setup.js'],
  testTimeout: 10000,
};
