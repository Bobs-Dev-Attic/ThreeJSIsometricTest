import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Static site build. Vercel auto-detects the Vite framework preset, so no
// extra configuration is required on the Vercel side.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

// Short git commit so you can confirm exactly which build is live. Falls back
// to Vercel's commit env var, then to "dev".
function gitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    return sha ? sha.slice(0, 7) : 'dev';
  }
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_HASH__: JSON.stringify(gitHash()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
