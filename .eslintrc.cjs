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
  ignorePatterns: [
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/.turbo/**',
    '**/coverage/**',
    'vantademo/**',
    'packages/contracts/artifacts/**',
    'github-actions/**/dist/**',
    'github-actions/**/scripts/**',
    'github-actions/**/src/**/*.js',
    'demo.js',
    'trustsignal-demo.js',
    'bench/**',
    'tests/e2e/**',
    'packages/contracts/test/**',
    'scripts/demo-vanta-terminal.ts',
    'src/**',
    'scripts/*.js',
    'packages/contracts/**/*.js',
    'packages/contracts/**/*.cjs'
  ]
};
