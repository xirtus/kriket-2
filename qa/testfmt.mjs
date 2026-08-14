import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=42&format=TEST', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
for (let i = 0; i < 60; i++) {
  const st = await page.evaluate(() => {
    window.__kriket.fastForward(30);
    const c = window.__kriket.getController();
    return { s: c.summaryText, phase: c.phase, inn: c.match.currentIdx };
  });
  if (i % 8 === 0) console.log(`t+${i * 30}s ${st.s} inn=${st.inn} phase=${st.phase}`);
  if (st.phase === 'matchDone') { console.log('TEST COMPLETE:', st.s); break; }
}
await browser.close();
