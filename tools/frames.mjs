// usage: node tools/frames.mjs <w> <h> <outdir> t1 t2 t3 ...   (quick previews as PNG)
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startServer } from './serve.mjs';
import { chromium, LAUNCH_ARGS } from './browser.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [w, h, outdir, ...ts] = process.argv.slice(2);
fs.mkdirSync(outdir, { recursive: true });
const { srv, port } = await startServer(root);
const b = await chromium.launch({ args: LAUNCH_ARGS });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => console.log('[page]', m.text()));
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(`http://127.0.0.1:${port}/src/index.html?w=${w}&h=${h}`);
await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
for (const t of ts) {
  const t0 = Date.now();
  await p.evaluate((t) => window.renderAt(t), +t);
  await p.screenshot({ path: path.join(outdir, `f_${(+t).toFixed(2).padStart(5, '0')}.png`) });
  console.log('t', t, Date.now() - t0, 'ms');
}
await b.close(); srv.close();
