import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths work both at the local server root and under the
  // /warehouse-tracker/ path used by this GitHub Pages project site.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
});
