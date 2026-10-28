import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const api = process.env.VITE_API_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Use the shared package's source directly so the preview always matches the bot.
    alias: { '@csb/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': api,
      '/auth': api,
    },
  },
});
