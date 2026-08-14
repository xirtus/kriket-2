import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?qa=1&seed=5&format=T20', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
// Play through the player's innings quickly: sim past it by forcing swings? Faster: step until innings 2 (player bowls).
const st = await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  for (let i = 0; i < 120 * 3600; i++) {
    e.stepOnce(1 / 120);
    if (c.match.currentIdx === 1 && c.phase === 'bowlingUI') return { ok: true, summary: c.summaryText };
    if (c.phase === 'matchDone') return { done: true };
  }
  return { timeout: true, phase: c.phase, idx: c.match.currentIdx };
});
console.log('state:', JSON.stringify(st));
await page.screenshot({ path: 'qa/shots/bowlui.png' });
// press 2 for outswing, start runup, release
const r = await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  k.press('Digit2');
  e.stepOnce(1 / 120);
  k.press('Space');
  e.stepOnce(1 / 120);
  const d = c['delivery'];
  return { phase: c.phase, dphase: d?.phase };
});
console.log('after space1:', JSON.stringify(r));
await page.evaluate(() => {
  const k = window.__kriket;
  const e = k.engine;
  for (let i = 0; i < 100; i++) e.stepOnce(1 / 120);
  k.press('Space'); // release press
  for (let i = 0; i < 60; i++) e.stepOnce(1 / 120);
  e.renderFrame();
});
await page.screenshot({ path: 'qa/shots/bowlui_flight.png' });
const r2 = await page.evaluate(() => {
  const c = window.__kriket.getController();
  const d = c['delivery'];
  return { phase: d?.phase, plan: d?.ctx.plan };
});
console.log('after release:', JSON.stringify(r2));
await browser.close();
