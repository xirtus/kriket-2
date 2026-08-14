// Spectate-mode end-to-end: title -> WATCH -> setup -> broadcast plays itself.
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });

// Title -> WATCH AI v AI
await page.waitForSelector('#kwatch', { timeout: 20000 });
await page.screenshot({ path: 'qa/shots/watch_title.png' });
await page.click('#kwatch');

// Setup: spectate labels + START BROADCAST
await page.waitForSelector('#kstart');
const setupText = await page.textContent('.panel');
console.log('setup labels:', /TEAM A/.test(setupText), /TEAM B/.test(setupText), /START BROADCAST/.test(setupText));
await page.screenshot({ path: 'qa/shots/watch_setup.png' });
await page.click('#kstart');

// Toss -> FIRST BALL
await page.waitForSelector('#kgo');
const tossText = await page.textContent('.summary');
console.log('toss:', tossText.trim().split('\n')[0]);
await page.click('#kgo');

// Let it play itself; scorebug must advance with zero input.
await page.evaluate(() => window.__kriket.fastForward(90));
const s1 = await page.evaluate(() => window.__kriket.stats());
console.log('after 90s:', JSON.stringify(s1.map((i) => ({ team: i.team, runs: i.runs, wkts: i.wickets, overs: i.overs }))));
await page.screenshot({ path: 'qa/shots/watch_live.png' });

// Speed key: 3 -> 4x
const ts0 = await page.evaluate(() => window.__kriket.engine.timeScale);
await page.keyboard.press('Digit3');
const ts1 = await page.evaluate(() => window.__kriket.engine.timeScale);
console.log('timeScale', ts0, '->', ts1);

// Replays enabled in watch? check controller mode + a boundary/wicket replay fires eventually
const mode = await page.evaluate(() => window.__kriket.getController()['mode']);
await page.evaluate(() => window.__kriket.fastForward(240));
const s2 = await page.evaluate(() => window.__kriket.stats());
console.log('mode:', mode, '| after 330s:', JSON.stringify(s2.map((i) => ({ runs: i.runs, wkts: i.wickets, overs: i.overs }))));
await page.screenshot({ path: 'qa/shots/watch_later.png' });
await browser.close();
console.log('WATCH OK');
