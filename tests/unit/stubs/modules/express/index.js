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
    all(path, handler) {
      handlers.push({ path, handler });
      return this;
    },
  };
  return app;
};
