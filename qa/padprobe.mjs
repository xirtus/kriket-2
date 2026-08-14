import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=99&format=T20&pitch=green_seamer&weather=humid', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
const out = await page.evaluate(() => {
  window.__kriket.fastForward(400);
  const c = window.__kriket.getController();
  return c.ballLog.filter((b) => b.dbg?.__dbgPad || b.dbg?.__dbgCross).map((b) => ({ pad: b.dbg.__dbgPad, cross: b.dbg.__dbgCross, dis: b.dismissal, ck: b.ck }));
});
console.log('pad strikes:', out.length);
for (const b of out) console.log(JSON.stringify(b));
// also count how many missed balls pass close to the pads
const close = await page.evaluate(() => {
  const c = window.__kriket.getController();
  let n = 0;
  for (const b of c.ballLog) if (b.ck === 'missed') n++;
  return n;
});
console.log('missed contacts in log:', close);
await browser.close();
