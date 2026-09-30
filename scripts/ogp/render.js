// Render OGP PNGs (1200x630) from the templates with puppeteer + system Chrome (pipe mode; the CLI --screenshot path hangs on this Mac).
// Usage: node scripts/ogp/render.js  → img/ogp.png, img/ogp-en.png
const puppeteer = require('puppeteer');
const path = require('path');
const here = __dirname;
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, pipe: true,
    args: ['--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--user-data-dir=/tmp/pptr-prof-ogp-' + process.pid] });
  for (const [tpl, out] of [['ogp-ja.html', 'ogp.png'], ['ogp-en.html', 'ogp-en.png']]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.goto('file://' + path.join(here, tpl), { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 500));
    const dest = path.join(here, '..', '..', 'img', out);
    await page.screenshot({ path: dest, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log('rendered img/' + out);
    await page.close();
  }
  await browser.close();
})();
