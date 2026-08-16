import { defineConfig, Plugin } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Dev-only frame capture. POST a canvas dataURL to /__shot?name=foo and it
 * lands in shots/foo.png, so the game can be inspected without a display.
 * Stripped from production builds (apply: 'serve').
 */
function shotPlugin(): Plugin {
  return {
    name: 'tld-shot',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          const q = new URL(req.url ?? '', 'http://x').searchParams;
          const name = (q.get('name') ?? 'shot').replace(/[^\w-]/g, '');
          // `into` selects a whitelisted destination; default is scratch shots
          const into = q.get('into') === 'art' ? resolve(process.cwd(), 'public', 'art')
                                               : resolve(process.cwd(), 'shots');
          mkdirSync(into, { recursive: true });
          const b64 = body.replace(/^data:image\/\w+;base64,/, '');
          writeFileSync(resolve(into, `${name}.png`), Buffer.from(b64, 'base64'));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [shotPlugin()],
  server: { port: 5173, strictPort: false },
  // es2022 for top-level await in main.ts (asset preload before first frame).
  // Supported by every browser since 2021, incl. iOS Safari 15+.
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
