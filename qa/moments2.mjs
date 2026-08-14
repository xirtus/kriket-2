import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=11&format=T20&replays=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });

// celebration close-up at first wicket
const w = await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  const startLen = c.ballLog.length;
  for (let i = 0; i < 120 * 900; i++) {
    e.stepOnce(1 / 120);
    const log = c.ballLog;
    if (log.length > startLen && log[log.length - 1].dismissal) {
      for (let j = 0; j < 55; j++) e.stepOnce(1 / 120);
      k.freeCam(6, 3.2, 16, 0, 1.2, 10);
      return log[log.length - 1].dismissal;
    }
  }
  return null;
});
console.log('dismissal:', w);
await page.screenshot({ path: 'qa/shots/m2_celebration.png' });

// replay framing
await page.evaluate(() => { window.__kriket.unfreezeCam(); window.__kriket.fastForward(1.5); });
await page.screenshot({ path: 'qa/shots/m2_replay.png' });

// boundary ball follow cam
const b = await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  const startLen = c.ballLog.length;
  for (let i = 0; i < 120 * 900; i++) {
    e.stepOnce(1 / 120);
    const log = c.ballLog;
    if (log.length > startLen && log[log.length - 1].boundary === 4) return 4;
    if (log.length > startLen && log[log.length - 1].boundary === 6) return 6;
  }
  return null;
});
console.log('boundary:', b);
await page.screenshot({ path: 'qa/shots/m2_boundary.png' });
await browser.close();
