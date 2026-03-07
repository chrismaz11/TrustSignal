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
        'src/routes/**/*.ts'
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
