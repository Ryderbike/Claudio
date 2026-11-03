// usage: node tools/shot.mjs <page> <out.png> [w] [h]    (page like "src/test.html?pose=1")
import path from 'path';
import { fileURLToPath } from 'url';
import { startServer } from './serve.mjs';
import { chromium, LAUNCH_ARGS } from './browser.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [page, out, w = '540', h = '960'] = process.argv.slice(2);
const { srv, port } = await startServer(root);
const b = await chromium.launch({ args: LAUNCH_ARGS });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => console.log('[page]', m.text()));
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(`http://127.0.0.1:${port}/${page}`);
await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
await p.screenshot({ path: out });
await b.close(); srv.close();
