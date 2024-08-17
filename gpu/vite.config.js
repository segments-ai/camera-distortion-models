// vite.config.js
export default {
  resolve: {
    alias: {
      'three/examples/jsm': 'three/examples/jsm',
      'three/addons': 'three/examples/jsm',
      'three/tsl': 'three/webgpu',
      three: 'three/webgpu',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
  },
};
