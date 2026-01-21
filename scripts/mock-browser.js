// Mock browser globals for Node.js environment
if (typeof window === 'undefined') {
  // Only set what is absolutely necessary
  global.localStorage = {
    getItem: () => null,
    setItem: () => null,
    removeItem: () => null,
    clear: () => null,
  };
  global.sessionStorage = {
    getItem: () => null,
    setItem: () => null,
    removeItem: () => null,
    clear: () => null,
  };
  global.document = {
    documentElement: {
      classList: {
        add: () => null,
        remove: () => null,
      },
    },
    createElement: () => ({
      style: {},
      setAttribute: () => {},
      appendChild: () => {},
    }),
  };
  Object.defineProperty(global, 'navigator', {
    value: {
      userAgent: 'node',
    },
    configurable: true,
  });
}

