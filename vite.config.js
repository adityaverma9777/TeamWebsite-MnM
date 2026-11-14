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
          if (req.url && (req.url === '/manitya' || req.url.startsWith('/manitya?'))) {
            const pagePath = resolve(__dirname, 'manitya.html');
            res.setHeader('Content-Type', 'text/html');
            res.end(readFileSync(pagePath, 'utf-8'));
            return;
          }
          if (req.url && (req.url === '/orbix' || req.url.startsWith('/orbix?'))) {
            const pagePath = resolve(__dirname, 'orbix.html');
            res.setHeader('Content-Type', 'text/html');
            res.end(readFileSync(pagePath, 'utf-8'));
            return;
          }
          if (req.url && (req.url === '/orbixclaim' || req.url.startsWith('/orbixclaim?'))) {
            const pagePath = resolve(__dirname, 'orbixclaim.html');
            res.setHeader('Content-Type', 'text/html');
            res.end(readFileSync(pagePath, 'utf-8'));
            return;
          }
          if (req.url && (req.url === '/confirmcatalyst' || req.url.startsWith('/confirmcatalyst?'))) {
            const pagePath = resolve(__dirname, 'confirmcatalyst.html');
            res.setHeader('Content-Type', 'text/html');
            res.end(readFileSync(pagePath, 'utf-8'));
            return;
          }
          if (req.url && (req.url === '/verifycatalyst' || req.url.startsWith('/verifycatalyst?'))) {
            const pagePath = resolve(__dirname, 'verifycatalyst.html');
            res.setHeader('Content-Type', 'text/html');
            res.end(readFileSync(pagePath, 'utf-8'));
            return;
          }
          if (req.url && (req.url === '/catalystassistance' || req.url.startsWith('/catalystassistance?'))) {
            const pagePath = resolve(__dirname, 'catalystassistance.html');
            res.setHeader('Content-Type', 'text/html');
            res.end(readFileSync(pagePath, 'utf-8'));
            return;
          }
          if (req.url && (req.url === '/eternaluniversity' || req.url.startsWith('/eternaluniversity?'))) {
            const pagePath = resolve(__dirname, 'eternaluniversity.html');
            res.setHeader('Content-Type', 'text/html');
            res.end(readFileSync(pagePath, 'utf-8'));
            return;
          }
          if (req.url && (req.url === '/communitycatalouge' || req.url.startsWith('/communitycatalouge?') || req.url === '/communitycatalogue' || req.url.startsWith('/communitycatalogue?'))) {
            const pagePath = resolve(__dirname, 'communitycatalouge.html');
            res.setHeader('Content-Type', 'text/html');
            res.end(readFileSync(pagePath, 'utf-8'));
            return;
          }
          if (req.url && (req.url === '/round2morrow' || req.url.startsWith('/round2morrow?') || req.url === '/round2' || req.url.startsWith('/round2?'))) {
            const pagePath = resolve(__dirname, 'round2morrow.html');
            res.setHeader('Content-Type', 'text/html');
            res.end(readFileSync(pagePath, 'utf-8'));
            return;
          }
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
          manitya: './manitya.html',
          dashboard: './dashboard.html',
          competitions: './competitions.html',
          morrow: './morrow.html',
          contribute: './contribute.html',
          about: './about.html',
          founders: './founders.html',
          sponsors: './sponsors.html',
          careers: './careers.html',
          admin: './admin.html',
          idcard: './idcard.html',
          round2morrow: './round2morrow.html',
          catalyst: './catalyst.html',
          confirmcatalyst: './confirmcatalyst.html',
          verifycatalyst: './verifycatalyst.html',
          catalystassistance: './catalystassistance.html',
          eternaluniversity: './eternaluniversity.html',
          communityCatalogue: './community-catalogue.html',
          communitycatalouge: './communitycatalouge.html',
          communitycatalogue: './communitycatalogue.html',
          orbix: './orbix.html',
          orbixclaim: './orbixclaim.html'
        }
      }
    },
  });
