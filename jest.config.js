export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['./src', './test'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  testPathIgnorePatterns: ['./src/commands/test.ts'],
  transform: {
    // Use the ESM/esnext test tsconfig so top-level `await import()` (ESM
    // module mocking) compiles. Requires `NODE_OPTIONS=--experimental-vm-modules`,
    // set in the `test` script.
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.jest.json' }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}
