import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// The dashboard lives in web/ and is built into dist/web, which the CLI's server serves.
export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@core': fileURLToPath(new URL('./src/core', import.meta.url)) } },
  build: { outDir: '../dist/web', emptyOutDir: true },
  preview: { port: 4173, strictPort: true },
});
