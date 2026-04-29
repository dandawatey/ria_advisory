import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Netlify stores filenames in lowercase; this plugin ensures build output
// matches so asset URLs in index.html resolve correctly on Netlify's CDN.
function lowercaseFilenames(): Plugin {
  return {
    name: 'lowercase-filenames',
    generateBundle(_, bundle) {
      for (const key of Object.keys(bundle)) {
        const chunk = bundle[key];
        const lower = chunk.fileName.toLowerCase();
        if (lower !== chunk.fileName) {
          chunk.fileName = lower;
          bundle[lower] = chunk;
          delete bundle[key];
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), lowercaseFilenames()],
  server: {
    port: 4000,
    host: '127.0.0.1',
    open: false,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
