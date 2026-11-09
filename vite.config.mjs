import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const require = createRequire(import.meta.url);
const { handler } = require('./server/api.js');

// The VaaniLens app: React frontend (app/) + Gnani API routes (server/api.js) in one dev server.
export default defineConfig({
  root: 'app',
  publicDir: '../public',
  plugins: [react(), { name: 'vaanilens-api', configureServer(server) { server.middlewares.use(handler); }, configurePreviewServer(server) { server.middlewares.use(handler); } }],
  server: { port: 5173, open: process.env.NO_OPEN !== '1', strictPort: true },
  build: { outDir: '../dist-app', emptyOutDir: true,
    rollupOptions: { input: { main: here('./app/index.html'), demo: here('./app/demo/index.html') } } },
});
