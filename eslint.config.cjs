
module.exports = {
  languageOptions: {
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
  },
  },

  rules: {
    'prefer-const': 'error',
    'no-unused-vars': ['error', { caughtErrors: 'none', args: 'none' },],
    'no-var': 'error',
  },
  ignores: [
    '/doc',
    '.eslintrc.js',
    'tests/**/*',
  ]
};
