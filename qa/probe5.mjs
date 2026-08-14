import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=42&format=T20', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
const out = await page.evaluate(() => {
  window.__kriket.fastForward(200);
  const c = window.__kriket.getController();
  return c.ballLog.map((b) => ({ r: b.runs, d: b.dismissal, bd: b.boundary, c: b.dbg?.__dbgContact ?? null }));
});
for (const b of out.slice(0, 24)) console.log(JSON.stringify(b));
await browser.close();
