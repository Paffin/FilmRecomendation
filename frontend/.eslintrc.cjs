module.exports = {
  extends: ['../.eslintrc.cjs'],
  parserOptions: {
    project: null,
    tsconfigRootDir: __dirname,
    extraFileExtensions: ['.vue'],
  },
  rules: {
    'vue/require-explicit-emits': 'off',
    'vue/no-use-v-if-with-v-for': 'off',
  },
};
