import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=42&format=T20', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
const out = await page.evaluate(() => {
  window.__kriket.fastForward(150);
  const c = window.__kriket.getController();
  return c.ballLog.filter((b) => b.dismissal === 'runout' || b.dbg?.__dbgRO).slice(0, 12).map((b) => ({ runs: b.runs, dis: b.dismissal, ro: b.dbg?.__dbgRO, tl: b.timeline }));
});
for (const b of out) console.log(JSON.stringify(b));
await browser.close();
