import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

// 1. Menus (no qa param → real boot flow)
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: 'qa/shots/p_title.png' });
await page.click('#kplay');
await page.waitForTimeout(400);
await page.screenshot({ path: 'qa/shots/p_setup.png' });

// 2. Perf: measure stepOnce cost during live play
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=42&replays=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
const perf = await page.evaluate(() => {
  const e = window.__kriket.engine;
  window.__kriket.fastForward(30); // get into the flow
  const t0 = performance.now();
  for (let i = 0; i < 1200; i++) e.stepOnce(1 / 120);
  const t1 = performance.now();
  const r0 = performance.now();
  for (let i = 0; i < 60; i++) e.renderFrame();
  const r1 = performance.now();
  return { stepMs: (t1 - t0) / 1200, renderMs: (r1 - r0) / 60 };
});
console.log('PERF step ms:', perf.stepMs.toFixed(3), 'render ms:', perf.renderMs.toFixed(2));

// 3. Replay camera: fast-forward until a wicket, then sit in the replay window
const rep = await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  const startLen = c.ballLog.length;
  for (let i = 0; i < 120 * 900; i++) {
    e.stepOnce(1 / 120);
    const log = c.ballLog;
    if (log.length > startLen && (log[log.length - 1].dismissal || log[log.length - 1].boundary)) {
      // get into the replay: wait for phase 'replay' then ~1.2s in
      for (let j = 0; j < 120 * 8; j++) {
        e.stepOnce(1 / 120);
        if (c.phase === 'replay') {
          for (let q = 0; q < 110; q++) e.stepOnce(1 / 120);
          e.renderFrame();
          return { phase: c.phase, ev: log[log.length - 1] };
        }
      }
      return { phase: c.phase, note: 'no replay phase seen', ev: log[log.length - 1] };
    }
  }
  return null;
});
console.log('replay probe:', JSON.stringify(rep)?.slice(0, 140));
await page.screenshot({ path: 'qa/shots/p_replay.png' });
await browser.close();
