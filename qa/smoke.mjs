import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForSelector('#kplay', { timeout: 20000 });
await page.click('#kplay');
await page.waitForSelector('#kstart');
await page.click('#kstart');
await page.waitForSelector('#kgo'); // toss
await page.screenshot({ path: 'qa/shots/smoke_toss.png' });
await page.click('#kgo');
await page.waitForTimeout(2500);
await page.screenshot({ path: 'qa/shots/smoke_live.png' });
console.log('smoke OK');
await browser.close();
