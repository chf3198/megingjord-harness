// eslint.config.devenv.js — DevEnv Ops shared ESLint v9 flat config
// Deploy to each fleet repo's lint-configs/ directory (do not override).
// Enforces: eslint:recommended + Tier 1 JSDoc documentation rules.
// Usage: import this config as base in the repo's eslint.config.js.

import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    plugins: { jsdoc },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,  // window, document, setTimeout, performance, etc.
        ...globals.node,     // require, module, process, __dirname, etc.
      },
    },
    rules: {
      // --- eslint:recommended subset (critical rules) ---
      'no-unused-vars': 'warn',
      'no-undef': 'warn',       // warn not error — cross-file globals are valid in browser multi-script
      'no-console': 'off',
      'eqeqeq': ['warn', 'always'],  // baseline violations waived; enforce on new code
      'no-var': 'error',
      'prefer-const': 'warn',

      // --- Tier 1: JSDoc documentation (P0) ---
      // Require JSDoc on exported/public functions
      'jsdoc/require-jsdoc': ['warn', {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: false,
          FunctionExpression: false,
        },
        publicOnly: true,
      }],
      'jsdoc/require-description': ['warn', { contexts: ['FunctionDeclaration'] }],
      'jsdoc/require-param': 'warn',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns': 'warn',
      'jsdoc/require-returns-description': 'warn',
      'jsdoc/valid-types': 'warn',
      'jsdoc/check-param-names': 'error',

      // --- Tier 2: Code quality (P1) ---
      'jsdoc/no-undefined-types': 'warn',
    },
  },
  {
    // Ignore generated, test, and vendor paths
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.min.js',
    ],
  },
];
