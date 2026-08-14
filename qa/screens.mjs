import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=42&time=twilight', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
await page.evaluate(() => { window.__kriket.fastForward(3); });
await page.screenshot({ path: 'qa/shots/p_twilight.png' });

// innings break screen
await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  for (let i = 0; i < 120 * 4000; i++) {
    e.stepOnce(1 / 120);
    if (c.match.currentIdx === 1) break;
  }
});
// innings break only shows in play mode... sim auto-resumes. Force-check via play mode? Just continue to result.
await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  for (let i = 0; i < 120 * 8000; i++) {
    e.stepOnce(1 / 120);
    if (c.phase === 'matchDone') break;
  }
});
await page.screenshot({ path: 'qa/shots/p_ingame_end.png' });
await browser.close();
