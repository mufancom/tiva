module.exports = {
  // project: '../test/tsconfig.json',

  // typeName: 'AAA',
  // extensions: {
  //   bbuid(value, comment) {
  //     console.log(comment);
  //     return typeof value === 'number' && value > 3;
  //   },
  // },

  // project is required if module is not specified
  module: '../test.ts', // '@types/foo-bar'
  typeName: 'AAA',
  extensions: {
    bbuid(value, comment) {
      console.log(comment);
      return typeof value === 'number' && value > 3;
    },
  },
};
