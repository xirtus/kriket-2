import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=7&format=T20', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });

// Run until a wicket falls; screenshot the celebration + replay.
const got = await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  let phase = '';
  for (let i = 0; i < 120 * 600; i++) {
    e.stepOnce(1 / 120);
    const d = c['delivery'];
    if (d && d['dismissal'] && c.phase === 'delivering') {
      // let the celebration begin
      for (let j = 0; j < 100; j++) e.stepOnce(1 / 120);
      e.renderFrame();
      return { kind: d['dismissal'].kind, replay: c['replayReason'] };
    }
  }
  return null;
});
console.log('wicket:', JSON.stringify(got));
await page.screenshot({ path: 'qa/shots/moment_wicket.png' });
// replay moment
await page.evaluate(() => { window.__kriket.fastForward(1.4); });
await page.screenshot({ path: 'qa/shots/moment_replay.png' });
// boundary follow-cam: run until a boundary
const b = await page.evaluate(() => {
  const k = window.__kriket;
  const c = k.getController();
  const e = k.engine;
  for (let i = 0; i < 120 * 900; i++) {
    e.stepOnce(1 / 120);
    const d = c['delivery'];
    if (d && d.phase === 'inplay' && d['boundaryRuns'] !== null) {
      for (let j = 0; j < 14; j++) e.stepOnce(1 / 120);
      e.renderFrame();
      return { b: d['boundaryRuns'] };
    }
  }
  return null;
});
console.log('boundary:', JSON.stringify(b));
await page.screenshot({ path: 'qa/shots/moment_boundary.png' });
await browser.close();
