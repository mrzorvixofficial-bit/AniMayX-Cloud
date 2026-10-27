
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['cloud.animayx.qzz.io'],
  },

  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: ['cloud.animayx.qzz.io'],
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
