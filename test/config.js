module.exports = {
  bbuid(value, comment) {
    console.log(comment);
    return typeof value === 'number' && value > 3;
  },
};
