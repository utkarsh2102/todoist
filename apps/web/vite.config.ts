import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs separately (apps/api, port 8787). Proxying /api and /auth keeps
// everything same-origin, exactly like production on Netlify, so session cookies behave the same.
const API = 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': API,
      '/auth': API,
    },
  },
});
