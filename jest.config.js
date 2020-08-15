module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>bld/test/*.test.js'],
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  forceExit: true,
};
