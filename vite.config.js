import { defineConfig } from 'vite';

// Static site build. Vercel auto-detects the Vite framework preset, so no
// extra configuration is required on the Vercel side.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
