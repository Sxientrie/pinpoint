import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        performance: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestIdleCallback: 'readonly',
        cancelIdleCallback: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        Node: 'readonly',
        NodeFilter: 'readonly',
        ShadowRoot: 'readonly',
        CSS: 'readonly',
        MutationObserver: 'readonly',
        WeakMap: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        CustomEvent: 'readonly',
        Promise: 'readonly',
        Array: 'readonly',
        Object: 'readonly',
        // extension globals
        Pinpoint: 'readonly',
        chrome: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-useless-escape': 'warn',
      'no-cond-assign': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: 'off',
      'spaced-comment': ['warn', 'always', { markers: ['/'] }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'playwright-report/', 'test-results/'],
  },
];
