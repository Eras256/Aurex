module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import', 'unused-imports'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: {
    es6: true,
    node: true, // Enable Node.js environment globally for monorepo configuration files, packages, and bots
  },
  ignorePatterns: [
    '**/dist/**',
    '**/.next/**',
    '**/node_modules/**',
    '**/coverage/**',
    // Ignore any compiled/transpiled JS/D.TS artifacts that might exist in source directories
    'packages/*/src/**/*.js',
    'packages/*/src/**/*.d.ts',
    'packages/*/src/**/*.js.map',
    'packages/*/src/**/*.d.ts.map',
  ],
  rules: {
    // Enforce organized imports using eslint-plugin-import
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          {
            pattern: '@/**',
            group: 'internal',
            position: 'before',
          },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    // Enforce no unused imports and vars using eslint-plugin-unused-imports
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  overrides: [
    {
      // Target apps/web (Next.js) specifically, supporting both root and local execution paths
      files: [
        'apps/web/**/*.{ts,tsx,js,jsx}',
        'app/**/*.{ts,tsx,js,jsx}',
        'pages/**/*.{ts,tsx,js,jsx}',
      ],
      extends: ['next/core-web-vitals', 'prettier'],
      env: {
        browser: true,
        node: true,
      },
    },
  ],
};
