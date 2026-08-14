import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/?qa=1&sim=1&seed=42', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });

const shots = [
  ['cu_stance', 0.3, [2.6, 1.5, 12.6, 0.3, 1.1, 8.6]],      // batsman close
  ['cu_runup', 1.2, [-3, 2.0, -18, 0.4, 1.2, -16]],         // bowler running in
  ['cu_action', 1.75, [-2.2, 1.6, -12.5, 0.4, 1.3, -9.5]],  // delivery stride
  ['cu_keeper', 0.4, [2.2, 1.4, 14.6, 0.4, 0.9, 11.5]],     // keeper crouch
];
for (const [name, ff, cam] of shots) {
  await page.evaluate(({ ff, cam }) => {
    const k = window.__kriket;
    k.unfreezeCam();
    k.fastForward(ff);
    k.freeCam(...cam.slice(0, 3), ...cam.slice(3));
  }, { ff, cam });
  await page.screenshot({ path: `qa/shots/${name}.png` });
  console.log('saved', name);
}
await browser.close();
