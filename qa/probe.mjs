import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=42&format=T20', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
for (let ball = 0; ball < 8; ball++) {
  const rec = await page.evaluate(() => {
    const c = window.__kriket.getController();
    const samples = [];
    // step until this delivery finishes
    let guard = 0;
    let startLen = c.ballLog.length;
    while (c.ballLog.length === startLen && guard++ < 120 * 30) {
      window.__kriket.engine.stepOnce(1 / 120);
      const d = c['delivery'];
      if (d && d.phase === 'inplay' && samples.length < 40 && (guard % 12 === 0)) {
        samples.push({
          t: +(guard / 120).toFixed(2),
          bit: d.ctx.fielding.bestInterceptT === Infinity ? 'inf' : +d.ctx.fielding.bestInterceptT.toFixed(2),
          runs: d.running.runsCompleted,
          sd: d.running.strikerDir,
          sz: +d.running.strikerZ.toFixed(1),
          ck: d['contact']?.outcome ?? '-',
          bv: +d.ctx.ball.state.velocity.length().toFixed(1),
          bz: +d.ctx.ball.state.position.z.toFixed(1),
        });
      }
    }
    return { log: c.ballLog[c.ballLog.length - 1], samples };
  });
  console.log('BALL', ball, JSON.stringify(rec.log));
  for (const s of rec.samples.slice(0, 8)) console.log('   ', JSON.stringify(s));
}
await browser.close();
