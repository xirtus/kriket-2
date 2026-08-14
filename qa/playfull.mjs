// Full-match human playthrough: bat innings 1 with read+timing, bowl innings 2.
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?qa=1&seed=21&format=T20', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });

const result = await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  const inp = c['deps'].input;
  let guard = 0;
  while (guard++ < 120 * 7200) {
    e.stepOnce(1 / 120);
    if (c.phase === 'matchDone') return { done: true, stats: k.stats() };
    const d = c['delivery'];
    if (!d) continue;

    if (c.phase === 'delivering' && d.phase === 'flight' && d.ctx.batting.constructor.name === 'HumanBatting') {
      const s = d.ctx.ball.state;
      if (s.velocity.z > 1 && !d['swung']) {
        const tPlane = (7.94 - s.position.z) / s.velocity.z;
        if (tPlane < 0.16 && tPlane > 0) {
          // Read the line, aim there; pick shot by height.
          const px = s.position.x + s.velocity.x * tPlane;
          inp.aimDeg = Math.max(-60, Math.min(60, -Math.atan((px - 0.42) / 1.35) * 180 / Math.PI));
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
        }
      }
    }
    if (c.phase === 'bowlingUI') {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      e.stepOnce(1 / 120);
      // hold for decent release timing: press again near ideal
      for (let i = 0; i < 120; i++) {
        e.stepOnce(1 / 120);
        if (d.phase === 'action') break;
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    }
    if (c.phase === 'betweenBalls') {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
    }
  }
  return { timeout: true, phase: c.phase, summary: c.summaryText };
});
console.log(JSON.stringify(result).slice(0, 300));
if (result.stats) {
  for (const inn of result.stats) console.log(`${inn.team}: ${inn.runs}/${inn.wickets} (${inn.overs}) dismissals=${JSON.stringify(inn.dismissals)}`);
}
await browser.close();
