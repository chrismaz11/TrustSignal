import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts', '../../sandbox/**/*.test.ts'],
        environment: 'node'
    }
});
