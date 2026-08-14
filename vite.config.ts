import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built site works on Cloudflare Pages subpaths too.
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});
