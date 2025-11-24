module.exports = {
  extends: ['../.eslintrc.cjs'],
  parserOptions: {
    project: null,
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
  },
  ignorePatterns: ['dist', 'node_modules', '**/*.spec.ts'],
};
