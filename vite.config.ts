import { defineConfig } from 'vite';
export default defineConfig({ root: 'site', base: '/agent-failure-recipes/', build: { outDir: '../web-dist', emptyOutDir: true }, server: { port: 4365, strictPort: true } });
