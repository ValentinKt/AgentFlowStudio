import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      'async_hooks': path.resolve(__dirname, 'src/mocks/async_hooks.js'),
      'node:async_hooks': path.resolve(__dirname, 'src/mocks/async_hooks.js'),
    },
  },
  build: {
    sourcemap: 'hidden',
  },
  optimizeDeps: {
    include: [
      '@langchain/ollama',
      '@langchain/langgraph',
      '@langchain/core',
      'langchain',
      'ollama'
    ],
  },
  plugins: [
    nodePolyfills({
      include: ['events', 'path', 'util'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }), 
    tsconfigPaths()
  ],
})
