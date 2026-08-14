import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=11&replays=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
// mid-swing hero frame: ball just middled, still near the bat
await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  for (let i = 0; i < 120 * 900; i++) {
    e.stepOnce(1 / 120);
    const d = c['delivery'];
    if (d && d.phase === 'inplay' && d['contact']?.outcome === 'middled') {
      // 3 frames after contact: follow-through visible, ball leaving
      for (let j = 0; j < 5; j++) e.stepOnce(1 / 120);
      k.freeCam(-4.5, 1.8, 13.5, 0.4, 1.0, 8.6);
      return;
    }
  }
});
await page.screenshot({ path: 'qa/shots/hero_swing.png' });
await browser.close();
