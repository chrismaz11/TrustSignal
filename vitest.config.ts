import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/core/src/**/*.test.ts',
      'tests/**/*.test.ts'
    ],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/core/**/*.ts',
        'src/middleware/**/*.ts',
        'src/routes/**/*.ts',
        'src/verifiers/revocationVerifier.ts',
        'src/verifiers/zkProofVerifier.ts',
        'src/services/**/*.ts',
        'src/adapters/**/*.ts',
        'packages/core/src/receipt.ts',
        'packages/core/src/attom/normalize.ts',
        'packages/core/src/anchor/portable.ts'
      ],
      exclude: ['**/*.d.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90
      }
    }
  }
});
