import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto('http://localhost:5199/?qa=1&seed=5&format=T20', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
const res = await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  const phases = {};
  let minT = 99;
  let maxZ = -99;
  for (let i = 0; i < 120 * 12; i++) {
    e.stepOnce(1 / 120);
    const d = c['delivery'];
    if (!d) continue;
    phases[d.phase] = (phases[d.phase] ?? 0) + 1;
    if (d.phase === 'flight') {
      const s = d.ctx.ball.state;
      maxZ = Math.max(maxZ, s.position.z);
      if (s.velocity.z > 1) {
        const t = (7.94 - s.position.z) / s.velocity.z;
        if (t > 0) minT = Math.min(minT, t);
      }
    }
  }
  return { phases, minT: +minT.toFixed(3), maxZ: +maxZ.toFixed(2) };
});
console.log(JSON.stringify(res));
await browser.close();
