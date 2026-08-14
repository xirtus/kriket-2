// Full-match simulation + balance report.
import { chromium } from 'playwright';
const seed = process.argv[2] ?? '42';
const format = process.argv[3] ?? 'T20';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:5199/?qa=1&sim=1&seed=${seed}&format=${format}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
let done = false;
for (let i = 0; i < 600 && !done; i++) {
  const st = await page.evaluate(() => {
    window.__kriket.fastForward(10);
    const c = window.__kriket.getController();
    return { summary: c.summaryText, phase: c.phase, stats: window.__kriket.stats() };
  });
  if (st.phase === 'matchDone') {
    done = true;
    for (const inn of st.stats) {
      const h = inn.history;
      const legal = h.filter((x) => !x.wd && !x.nb);
      const dots = h.filter((x) => x.rob === 0 && !x.bd && !x.dis && !x.wd).length;
      const fours = h.filter((x) => x.bd === 4).length;
      const sixes = h.filter((x) => x.bd === 6).length;
      const singles = h.filter((x) => x.rob === 1).length;
      const twos = h.filter((x) => x.rob === 2).length;
      const threes = h.filter((x) => x.rob >= 3).length;
      const wides = h.filter((x) => x.wd > 0).length;
      const nbs = h.filter((x) => x.nb > 0).length;
      const dis = {};
      for (const x of h) if (x.dis) dis[x.dis] = (dis[x.dis] ?? 0) + 1;
      const contacts = {};
      for (const x of h) contacts[x.ck] = (contacts[x.ck] ?? 0) + 1;
      const avgQ = h.reduce((a, x) => a + x.cq, 0) / Math.max(1, h.length);
      console.log(`\n${inn.team}: ${inn.runs}/${inn.wickets} (${inn.overs} ov)  RR ${(inn.runs / Math.max(1, parseFloat(inn.overs.replace('.', '/') * 0 + inn.overs.split('.')[0] * 1 + inn.overs.split('.')[1] / 6))).toFixed(2)}`);
      console.log(`  legal=${legal.length} dots=${dots} (${((dots / Math.max(1, legal.length)) * 100).toFixed(0)}%) 1s=${singles} 2s=${twos} 3s=${threes} 4s=${fours} 6s=${sixes} wd=${wides} nb=${nbs}`);
      console.log(`  dismissals=${JSON.stringify(dis)}`);
      console.log(`  contacts=${JSON.stringify(contacts)} avgQ=${avgQ.toFixed(0)}`);
    }
  }
}
if (!done) console.log('did not finish');
await browser.close();
