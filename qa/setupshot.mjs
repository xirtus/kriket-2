import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForSelector('#kplay');
await page.click('#kplay');
await page.waitForSelector('#kstart');
await page.screenshot({ path: 'qa/shots/setup_play.png' });
await browser.close();
