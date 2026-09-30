/** Unit tests: fast, no database. E2E tests live in test/ (see test/jest-e2e.json). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  collectCoverageFrom: ['**/*.ts', '!**/*.module.ts', '!main.ts', '!database/seed/**'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
