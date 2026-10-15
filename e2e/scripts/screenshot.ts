import { chromium } from '@playwright/test';

// Dev helper: node --experimental-strip-types scripts/screenshot.ts <url> <out.png> [width] [height]
const [url = 'http://localhost:3000', out = 'shot.png', w = '1440', h = '900'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
await page.waitForTimeout(5000);
// STEPS=n takes n viewport-sized shots scrolling down the page: out-0.png, out-1.png, ...
const steps = Number(process.env.STEPS ?? 0);
if (steps > 0) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * Number(h));
    await page.waitForTimeout(800);
    await page.screenshot({ path: out.replace(/\.png$/, `-${i}.png`) });
  }
} else {
  await page.screenshot({ path: out, fullPage: process.env.FULL === '1' });
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
