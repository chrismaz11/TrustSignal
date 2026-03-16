module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-console': 'off',
    'import/order': ['error', { 'newlines-between': 'always' }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
  },
  overrides: [
    {
      files: [
        'apps/api/src/server.ts',
        'api/**/*.ts',
        'apps/api/src/lib/**/*.ts',
        'apps/api/src/receiptPdf.ts',
        'apps/api/src/security.ts',
        'apps/api/src/db.ts',
        'apps/api/src/registryLoader.ts'
      ],
      rules: {
        'no-restricted-imports': ['error', {
          paths: [
            {
              name: './services/registryAdapters.js',
              message: 'Gateway code must use ./registry/catalog.js for public registry types and the verification engine interface for registry operations.'
            },
            {
              name: './services/compliance.js',
              message: 'Compliance evaluation is engine-owned. Route code must call the verification engine interface.'
            },
            {
              name: './anchor.js',
              message: 'Anchoring is engine-owned. Route code must call the verification engine interface.'
            },
            {
              name: './engine/registry/adapterService.js',
              message: 'Registry adapter orchestration is engine-owned. Route code must call the verification engine interface.'
            },
            {
              name: './engine/compliance/cookCountyComplianceValidator.js',
              message: 'Compliance evaluation is engine-owned. Route code must call the verification engine interface.'
            },
            {
              name: './engine/anchoring/service.js',
              message: 'Anchoring is engine-owned. Route code must call the verification engine interface.'
            }
          ],
          patterns: [
            {
              group: [
                '**/packages/engine-internal/**',
                '**/packages/core/src/**',
                '**/packages/core/dist/**',
                '**/src/core/**',
                '**/src/verifiers/**',
                '**/src/services/polygonMumbaiAnchor.js',
                '**/engine/anchoring/**',
                '**/engine/compliance/**',
                '**/engine/registry/**',
                '**/services/compliance.js',
                '**/services/registryAdapters.js',
                '**/anchor.js'
              ],
              message: 'Gateway-facing code must use public contracts and the narrow verification engine interface only.'
            }
          ]
        }]
      }
    }
  ],
  ignorePatterns: [
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/.turbo/**',
    '**/coverage/**',
    'src/**',
    'scripts/*.js',
    'packages/contracts/**/*.js',
    'packages/contracts/**/*.cjs'
  ]
};
