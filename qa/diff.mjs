// Difficulty verification: swing deliberately early (~+0.12s timing error).
// rookie window 0.1485s -> contact; club 0.11 -> miss; pro 0.0935 -> miss.
import { chromium } from 'playwright';
const diff = process.argv[2] ?? 'rookie';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:5199/?qa=1&seed=11&format=T20&difficulty=${diff}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });

const outcomes = [];
for (let ball = 0; ball < 8; ball++) {
  const res = await page.evaluate(() => {
    const k = window.__kriket;
    const c = k.getController();
    const e = k.engine;
    let guard = 0;
    // step until a fresh delivery enters flight
    while (guard++ < 120 * 40) {
      e.stepOnce(1 / 120);
      const d = c['delivery'];
      if (d && d.phase === 'flight' && d.ctx.ball.state.position.z < 2) break;
    }
    // press when timeToPlane ~ 0.255 (early by ~0.12s)
    let pressed = false;
    guard = 0;
    while (guard++ < 120 * 5) {
      const d = c['delivery'];
      if (!d || d.phase !== 'flight') break;
      const s = d.ctx.ball.state;
      if (s.velocity.z > 1) {
        const tPlane = (7.94 - s.position.z) / s.velocity.z;
        if (!pressed && tPlane <= 0.255 && tPlane > 0.1) {
          k.press('Space');
          pressed = true;
        }
        if (pressed && tPlane <= 0) break;
      }
      e.stepOnce(1 / 120);
    }
    // let the ball resolve
    guard = 0;
    while (guard++ < 120 * 12) {
      e.stepOnce(1 / 120);
      const d = c['delivery'];
      if (!d || d.phase === 'dead') break;
    }
    const hist = window.__kriket.stats()[0].history;
    const last = hist[hist.length - 1];
    return last ? { ck: last.ck, cq: last.cq, rob: last.rob, dis: last.dis } : null;
  });
  if (res) outcomes.push(res);
}
const contacts = outcomes.filter((o) => o.ck !== 'missed' && o.ck !== 'none' && o.ck !== null).length;
console.log(diff, JSON.stringify(outcomes), `contacts: ${contacts}/${outcomes.length}`);
await browser.close();
