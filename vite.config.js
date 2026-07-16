import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: './index.html',
        dashboard: './dashboard.html',
        competitions: './competitions.html',
        contribute: './contribute.html',
        about: './about.html',
        sponsors: './sponsors.html',
        admin: './admin.html'
      }
    }
  },
});
