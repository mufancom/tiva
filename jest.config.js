// @ts-check

/** @type {import('@jest/types/build/Config').InitialOptions} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>src/test/*.test.ts'],
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
