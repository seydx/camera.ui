module.exports = {
  parserOptions: {
    parser: 'babel-eslint',
    ecmaVersion: 12,
  },
  root: true,
  env: {
    node: true,
    browser: true,
  },
  extends: ['plugin:vue/recommended', 'eslint:recommended', '@vue/prettier'],
  rules: {
    quotes: ['error', 'single'],
    'comma-dangle': ['error', 'only-multiline'],
    'no-multiple-empty-lines': ['warn', { max: 1, maxEOF: 0 }],
    'eol-last': ['error', 'always'],
    'space-before-function-paren': ['error', { named: 'never' }],
    'vue/multi-word-component-names': 'off',
  },
};
