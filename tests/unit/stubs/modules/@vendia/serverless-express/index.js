module.exports = function serverlessExpress() {
  return () => {
    throw new Error('serverlessExpress stub should not be invoked in unit tests');
  };
};
