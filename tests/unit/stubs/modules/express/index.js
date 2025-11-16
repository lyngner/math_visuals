module.exports = function express() {
  const handlers = [];
  const app = {
    handlers,
    disable() {
      return this;
    },
    set() {
      return this;
    },
    use() {
      return this;
    },
    all() {
      return this;
    },
  };
  return app;
};
