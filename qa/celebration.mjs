import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=11&replays=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  const startLen = c.ballLog.length;
  for (let i = 0; i < 120 * 900; i++) {
    e.stepOnce(1 / 120);
    const log = c.ballLog;
    if (log.length > startLen && log[log.length - 1].dismissal) {
      for (let j = 0; j < 80; j++) e.stepOnce(1 / 120);
      k.freeCam(-8, 4.5, 16, 0, 1.0, 10.5);
      return;
    }
  }
});
await page.screenshot({ path: 'qa/shots/celebration2.png' });
await browser.close();
