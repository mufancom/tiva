module.exports = {
  extends: ['plugin:@magicspace/recommended', 'prettier'],
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
