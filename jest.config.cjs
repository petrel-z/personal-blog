const nextJest = require('next/jest')

const createConfig = nextJest({ dir: './' })({
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@/auth$': '<rootDir>/auth.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
})

module.exports = async () => {
  const config = await createConfig()
  // Let Jest resolve aliases for both imports and jest.mock. Next 14's SWC
  // path rewriting otherwise resolves the root @/auth alias as src/auth.
  for (const transform of Object.values(config.transform)) {
    transform[1].jsConfig = { compilerOptions: {} }
  }
  return config
}
