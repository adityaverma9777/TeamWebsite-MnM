import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  base: '/',
  plugins: [
    {
      name: 'id-card-rewrite',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/id/')) {
            const idcardPath = resolve(__dirname, 'idcard.html');
            res.setHeader('Content-Type', 'text/html');
            res.end(readFileSync(idcardPath, 'utf-8'));
            return;
          }
          next();
        });
      },
    },
  ],
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
        careers: './careers.html',
        admin: './admin.html',
        idcard: './idcard.html'
      }
    }
  },
});
