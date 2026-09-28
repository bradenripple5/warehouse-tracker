import { defineConfig } from 'vite';

export default defineConfig({
  base: "https://github.com/bradenripple5/warehouse-tracker",
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
