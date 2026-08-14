import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?qa=1&seed=5&format=T20', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
for (const target of [0.02, 0.06, 0.135, 0.2, 0.28]) {
  const res = await page.evaluate(async (target) => {
    const k = window.__kriket;
    const c = k.getController();
    const e = k.engine;
    let guard = 0;
    while (guard++ < 120 * 30) {
      e.stepOnce(1 / 120);
      const d = c['delivery'];
      if (d && d.phase === 'flight') {
        const s = d.ctx.ball.state;
        if (s.velocity.z > 1 && s.position.z < 8.84) {
          const tPlane = (7.94 - s.position.z) / s.velocity.z;
          if (tPlane <= target && tPlane > 0) {
            const px = s.position.x + s.velocity.x * tPlane;
            const aimDeg = -Math.atan((px - 0.42) / 1.35) * 180 / Math.PI;
            k.holdAim(aimDeg);
            k.press('Space');
            let swung = false;
            let contact = null;
            for (let i = 0; i < 120 * 8; i++) {
              e.stepOnce(1 / 120);
              if (d['swung']) swung = true;
              if (d['contact']) {
                contact = { out: d['contact'].outcome, q: +d['contact'].quality.toFixed(2), tim: +d['pressTimingError'].toFixed(3) };
                break;
              }
              if (d.phase === 'dead') break;
            }
            return { target, swung, contact, dis: d['dismissal']?.kind ?? null, phase: d.phase };
          }
        }
      }
      if (d && d.phase === 'dead') return { target, outcome: 'dead-no-contact', swung: d['swung'], tim: +d['pressTimingError'].toFixed(3), dis: d['dismissal']?.kind ?? null };
    }
    return { target, outcome: 'timeout' };
  }, target);
  console.log(JSON.stringify(res));
}
await browser.close();
