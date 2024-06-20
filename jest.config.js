export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['./src'],
    setupFiles: ["<rootDir>/test/setup.ts"],
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.json',
            useESM: true,
        },
    },
    testPathIgnorePatterns: [
        './src/commands/test.ts',
    ],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
    },
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
};