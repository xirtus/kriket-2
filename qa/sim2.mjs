// Multi-condition balance sweep.
import { chromium } from 'playwright';
const seed = process.argv[2] ?? '42';
const pitch = process.argv[3] ?? 'flat_batting';
const weather = process.argv[4] ?? 'clear';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`http://localhost:5199/?qa=1&sim=1&seed=${seed}&format=${process.env.FMT ?? 'T20'}&pitch=${pitch}&weather=${weather}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
for (let i = 0; i < 1400; i++) {
  const st = await page.evaluate(() => {
    window.__kriket.fastForward(10);
    const c = window.__kriket.getController();
    return { phase: c.phase, stats: window.__kriket.stats() };
  });
  if (st.phase === 'matchDone') break;
}
const stats = await page.evaluate(() => window.__kriket.stats());
for (const inn of stats) {
  const h = inn.history;
  const legal = h.filter((x) => !x.wd && !x.nb).length;
  const dots = h.filter((x) => x.rob === 0 && !x.bd && !x.dis && !x.wd).length;
  const tally = (k) => h.filter((x) => x.dis === k).length;
  const wkts = { bowled: tally('bowled'), caught: tally('caught'), lbw: tally('lbw'), runout: tally('runout'), stumped: tally('stumped') };
  const fours = h.filter((x) => x.bd === 4).length;
  const sixes = h.filter((x) => x.bd === 6).length;
  const singles = h.filter((x) => x.rob === 1).length;
  const twos = h.filter((x) => x.rob === 2).length;
  console.log(`${inn.team}: ${inn.runs}/${inn.wickets} (${inn.overs}ov) | dots ${((100 * dots) / Math.max(1, legal)).toFixed(0)}% 1s ${singles} 2s ${twos} 4s ${fours} 6s ${sixes} | ${JSON.stringify(wkts)}`);
}
await browser.close();
