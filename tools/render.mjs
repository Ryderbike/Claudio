// usage: node tools/render.mjs [workers] [w] [h] [fps] [outdir]
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startServer } from './serve.mjs';
import { chromium, LAUNCH_ARGS } from './browser.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [workers = '3', w = '1080', h = '1920', fps = '30', outdir = '/tmp/work/frames'] = process.argv.slice(2);
fs.mkdirSync(outdir, { recursive: true });
const total = Math.round(50 * +fps);
const { srv, port } = await startServer(root);
let next = 0, done = 0; const t0 = Date.now();
async function worker(id) {
  const b = await chromium.launch({ args: LAUNCH_ARGS });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto(`http://127.0.0.1:${port}/src/index.html?w=${w}&h=${h}`);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  while (true) {
    const i = next++; if (i >= total) break;
    const f = path.join(outdir, `f_${String(i).padStart(5, '0')}.png`);
    if (fs.existsSync(f)) { done++; continue; }
    await p.evaluate((t) => window.renderAt(t), i / +fps);
    await p.screenshot({ path: f });
    done++;
    if (done % 50 === 0) console.log(`${done}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await b.close();
}
await Promise.all(Array.from({ length: +workers }, (_, i) => worker(i)));
srv.close();
console.log('render done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
