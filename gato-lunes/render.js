// Uso: node render.js [preview]   -> build/video_mudo.mp4  (o build/preview.png con un fotograma por corte)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const FPS = 30, DIR = __dirname;
const data = JSON.parse(fs.readFileSync(path.join(DIR, 'build/data.json'), 'utf8'));
const font = f => fs.readFileSync(path.join(DIR, 'assets', f)).toString('base64');

(async () => {
  const mode = process.argv[2] || 'video';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => { console.error('ERR', e.message); process.exit(1); });
  await page.setContent(`<html><head><style>
    @font-face{font-family:Pop;font-weight:800;src:url(data:font/woff2;base64,${font('poppins-latin-800-normal.woff2')})}
    @font-face{font-family:Pop;font-weight:900;src:url(data:font/woff2;base64,${font('poppins-latin-900-normal.woff2')})}
    body{margin:0;background:#000}</style></head><body><canvas id="c" width="1080" height="1920"></canvas></body></html>`);
  await page.evaluate(d => { window.DATA = d; }, data);
  await page.evaluate(async () => { await document.fonts.load('900 40px Pop'); await document.fonts.load('800 40px Pop'); });
  await page.addScriptTag({ content: fs.readFileSync(path.join(DIR, 'scene.js'), 'utf8') });

  if (mode === 'preview') {
    // hoja de contacto: un fotograma por corte (a 60% del corte), reducido
    const times = (process.argv[3] ? process.argv[3].split(',').map(Number) : data.cuts.map(c => c.start + (c.end - c.start) * 0.6));
    const shots = [];
    for (const t of times) shots.push(await page.evaluate(t => { drawFrame(t); return document.getElementById('c').toDataURL('image/jpeg', 0.8); }, t));
    const html = `<body style="margin:0;background:#222;display:flex;flex-wrap:wrap;width:1800px">${shots.map((s, i) => `<div style="position:relative"><img src="${s}" style="width:300px;height:533px;display:block;border:2px solid #222"><b style="position:absolute;top:4px;left:8px;color:#0f0;font:24px sans-serif">${times[i].toFixed(1)}</b></div>`).join('')}</body>`;
    const p2 = await browser.newPage({ viewport: { width: 1800, height: 600 } });
    await p2.setContent(html); await p2.screenshot({ path: path.join(DIR, 'build/preview.png'), fullPage: true });
    await browser.close(); console.log('preview ok'); return;
  }

  const n = Math.ceil(data.total * FPS);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', path.join(DIR, 'build/video_mudo.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    const url = await page.evaluate(t => { drawFrame(t); return document.getElementById('c').toDataURL('image/jpeg', 0.93); }, i / FPS);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${n}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  await browser.close(); console.log('video ok');
})();
