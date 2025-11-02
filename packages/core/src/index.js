/**
 * Initializes the Math Visuals application shell.
 *
 * @param {Object} [options] - Options that customise the app bootstrap.
 * @param {HTMLElement} [options.root] - Optional DOM node to mount into.
 * @param {Object} [options.config] - Arbitrary configuration shared with feature bundles.
 * @returns {Object} Minimal lifecycle interface for embedding legacy experiences.
 */
export function createMathVisualsApp(options = {}) {
  const { root = null, config = {} } = options;
  const normalizedConfig = normalizeConfig(config);

  const state = {
    root,
    config: normalizedConfig,
    isMounted: false
  };

  return {
    config: normalizedConfig,
    /**
     * Mounts the application. When `root` is not provided, the consumer must
     * handle DOM insertion themselves.
     */
    mount(target = state.root) {
      if (!target) {
        throw new Error("createMathVisualsApp: mount target is required");
      }

      if (state.isMounted) {
        return state.root;
      }

      state.root = target;
      state.isMounted = true;
      return state.root;
    },
    /**
     * Tears down the application and releases references.
     */
    destroy() {
      state.isMounted = false;
      state.root = null;
    }
  };
}

/**
 * Shallow merges provided configuration with sane defaults.
 *
 * @param {Object} config
 * @returns {Object}
 */
export function normalizeConfig(config = {}) {
  return {
    locale: "nb-NO",
    featureFlags: {},
    ...config
  };
}

/**
 * Utility for creating namespaced loggers that can be swapped out during tests.
 *
 * @param {string} namespace
 * @param {Console} [logger=console]
 */
export function createLogger(namespace, logger = console) {
  const prefix = `[math-visuals:${namespace}]`;

  return {
    log: (...args) => logger.log(prefix, ...args),
    warn: (...args) => logger.warn(prefix, ...args),
    error: (...args) => logger.error(prefix, ...args)
  };
}
