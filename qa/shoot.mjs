// QA screenshot harness. Usage:
//   node qa/shoot.mjs <outName> [evalJs] [viewport]
// Opens the dev server, waits for boot, optionally evaluates JS in page context
// (e.g. fastForward or camera moves via window hooks), then screenshots.
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shot';
const evalJs = process.argv[3] ?? '';
const url = process.env.QA_URL ?? 'http://localhost:5173/?qa=1';

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__kriket !== undefined, null, { timeout: 20000 });
await page.waitForTimeout(600);

if (evalJs) {
  const res = await page.evaluate(evalJs);
  if (res !== undefined) console.log('EVAL:', JSON.stringify(res));
  await page.waitForTimeout(150);
}

await page.screenshot({ path: `qa/shots/${out}.png` });
console.log('LOGS:'); for (const l of logs.slice(-30)) console.log(' ', l);
console.log('SAVED qa/shots/' + out + '.png');
await browser.close();
