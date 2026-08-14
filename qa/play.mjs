// Interactive-play QA: simulate a human pressing keys during live deliveries.
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?qa=1&seed=5&format=T20', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });

// Wait for runup, then swing with timing, then screenshot mid-follow-through.
async function playBall(shotKey, aimDeg, shotName) {
  await page.evaluate(() => window.__kriket.holdAim(0));
  // step to just before the ball reaches the batsman, pressing swing at the right moment
  const res = await page.evaluate(async ({ shotKey, aimDeg }) => {
    const k = window.__kriket;
    const c = k.getController();
    const e = k.engine;
    // advance until flight phase
    let guard = 0;
    while (guard++ < 120 * 20) {
      e.stepOnce(1 / 120);
      const d = c['delivery'];
      if (d && d.phase === 'flight') {
        const s = d.ctx.ball.state;
        // time until ball reaches contact plane (~z=7.9)
        if (s.velocity.z > 1 && s.position.z > 3) {
          const tPlane = (7.9 - s.position.z) / s.velocity.z;
          if (tPlane < 0.13) {
            k.holdAim(aimDeg);
            k.press(shotKey);
            // step a few frames for contact + anim
            for (let i = 0; i < 26; i++) e.stepOnce(1 / 120);
            return { phase: d.phase, contact: d['contact']?.outcome ?? null };
          }
        }
      }
    }
    return { phase: 'timeout' };
  }, { shotKey, aimDeg });
  await page.screenshot({ path: `qa/shots/play_${shotName}.png` });
  console.log(shotName, JSON.stringify(res));
}
await playBall('Space', -10, 'drive');
await playBall('Space', 15, 'drive2');
await playBall('Space', -30, 'on_drive');
await browser.close();
