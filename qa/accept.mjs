import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=42&replays=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });

// A. mid-flight ball + trail (TV frame)
await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  outer: for (let i = 0; i < 120 * 600; i++) {
    e.stepOnce(1 / 120);
    const d = c['delivery'];
    if (d && d.phase === 'flight') {
      const s = d.ctx.ball.state;
      if (s.position.z > 2 && s.position.z < 5 && s.velocity.z > 10) {
        e.renderFrame();
        break outer;
      }
    }
  }
});
await page.screenshot({ path: 'qa/shots/a_flight.png' });

// B. umpire out-finger + celebration, right after a wicket
await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  const startLen = c.ballLog.length;
  for (let i = 0; i < 120 * 900; i++) {
    e.stepOnce(1 / 120);
    const log = c.ballLog;
    if (log.length > startLen && log[log.length - 1].dismissal) {
      for (let j = 0; j < 150; j++) e.stepOnce(1 / 120); // umpire signal fires ~0.9s
      e.renderFrame();
      return;
    }
  }
});
await page.screenshot({ path: 'qa/shots/a_umpire.png' });

// C. night TV frame
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=42&time=night', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
await page.evaluate(() => window.__kriket.fastForward(2.4));
await page.screenshot({ path: 'qa/shots/a_night_tv.png' });
await browser.close();
