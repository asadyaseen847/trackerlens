import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // API_PROXY_TARGET lets the end-to-end test point the dashboard at its own API.
      '/api': {
        target: process.env['API_PROXY_TARGET'] ?? 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
});
