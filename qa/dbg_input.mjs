import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?qa=1&seed=5&format=T20', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
const res = await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  const out = { events: [] };
  let guard = 0;
  while (guard++ < 120 * 30) {
    e.stepOnce(1 / 120);
    const d = c['delivery'];
    if (d && d.phase === 'flight') {
      const s = d.ctx.ball.state;
      const tPlane = s.velocity.z > 1 ? (7.94 - s.position.z) / s.velocity.z : 99;
      if (tPlane < 0.25 && tPlane > 0) {
        out.before = +tPlane.toFixed(3);
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
        out.pendingAfterDispatch = c['deps'].input['pendingShot'];
        e.stepOnce(1 / 120);
        out.pendingAfterStep = c['deps'].input['pendingShot'];
        out.swungAfterStep = d['swung'];
        out.battingIsHuman = d.ctx.batting.constructor.name;
        out.phaseAfter = d.phase;
        return out;
      }
    }
  }
  return { err: 'never fired' };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
