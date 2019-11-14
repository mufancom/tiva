module.exports = {
  extends: ['plugin:@magicspace/default', 'prettier'],
  parserOptions: {
    project: 'src/*/tsconfig.json',
  },
};
