import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Netlify stores filenames in lowercase; this plugin ensures build output
// matches so asset URLs in index.html resolve correctly on Netlify's CDN.
function lowercaseFilenames(): Plugin {
  return {
    name: 'lowercase-filenames',
    enforce: 'post',
    generateBundle(_, bundle) {
      // Collect files that need renaming: original → lowercase
      const renamed = new Map<string, string>();
      for (const chunk of Object.values(bundle)) {
        const lower = chunk.fileName.toLowerCase();
        if (lower !== chunk.fileName) renamed.set(chunk.fileName, lower);
      }

      // Rename files and rewrite references inside JS chunks
      for (const key of Object.keys(bundle)) {
        const chunk = bundle[key];
        const lower = chunk.fileName.toLowerCase();

        // Rename the output file
        if (lower !== chunk.fileName) {
          chunk.fileName = lower;
          bundle[lower] = chunk;
          delete bundle[key];
        }

        // Rewrite any uppercase asset URLs baked into JS code
        if (chunk.type === 'chunk' && chunk.code) {
          for (const [orig, lc] of renamed) {
            chunk.code = chunk.code.split(orig).join(lc);
          }
        }
      }
    },
    // Lowercase asset references in index.html (script/link tags)
    transformIndexHtml(html) {
      return html.replace(/\/assets\/[^"']+/g, (m) => m.toLowerCase());
    },
  };
}

export default defineConfig({
  plugins: [react(), lowercaseFilenames()],
  server: {
    port: 5002,
    host: '127.0.0.1',
    open: false,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
