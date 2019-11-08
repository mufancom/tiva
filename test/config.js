module.exports = {
  bbuid(value, comment) {
    console.log(comment, value, typeof value === 'number' && value > 0);
    return true;
  },
};
