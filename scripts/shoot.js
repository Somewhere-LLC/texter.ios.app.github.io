// Screenshot helper for design review. Usage:
//   node scripts/shoot.js <html-path> <out-prefix> [desktopScrollSteps]
// Produces <out-prefix>-desktop-full.png, -mobile-full.png, -hero.png, -mobile-hero.png
// and prints console errors, horizontal-overflow offenders, and fonts that failed to load.
const puppeteer = require('puppeteer');
const path = require('path');
const [,, file, outPrefix] = process.argv;
if (!file || !outPrefix) { console.error('usage: node scripts/shoot.js <html> <out-prefix>'); process.exit(1); }
const url = 'file://' + path.resolve(file);
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, pipe: true,
    args: ['--hide-scrollbars','--disable-gpu','--font-render-hinting=none','--no-first-run','--no-default-browser-check','--user-data-dir=/tmp/pptr-prof-'+process.pid]
  });
  const errors = [];
  async function shoot(w, h, tag, dpr) {
    const page = await browser.newPage();
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${tag}] console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
    page.on('requestfailed', r => errors.push(`[${tag}] requestfailed: ${r.url()} ${r.failure()?.errorText}`));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: `${outPrefix}-${tag}-hero.png` });
    // scroll through to trigger observers/scroll animations, then back to top
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += Math.floor(h * 0.6)) { await page.evaluate(v => window.scrollTo(0, v), y); await new Promise(r => setTimeout(r, 120)); }
    await new Promise(r => setTimeout(r, 900));
    const report = await page.evaluate(() => {
      const doc = document.documentElement;
      const out = { scrollW: doc.scrollWidth, clientW: doc.clientWidth, height: doc.scrollHeight, overflow: [], fonts: [] };
      if (doc.scrollWidth > doc.clientWidth) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.right > doc.clientWidth + 1 && r.width > 0) out.overflow.push(`${el.tagName.toLowerCase()}${el.id?'#'+el.id:''}${el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):''} right=${Math.round(r.right)}`);
          if (out.overflow.length > 12) break;
        }
      }
      document.fonts.forEach(f => { if (f.status === 'error') out.fonts.push(`${f.family} ${f.weight} ${f.status}`); });
      // families referenced in CSS but with no loaded face at all (likely a typo or a missing <link>)
      const wanted = new Set(); for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) { const ff = r.style && r.style.fontFamily; if (ff) ff.split(',').forEach(x => { x = x.trim().replace(/["']/g,''); if (x && !/^(serif|sans-serif|monospace|system-ui|ui-.*|-apple-system|BlinkMacSystemFont|Segoe UI|Helvetica.*|Arial|Hiragino.*|Yu Gothic|Meiryo|Menlo|Consolas|Courier.*|Georgia|Times.*|cursive|inherit)$/i.test(x)) wanted.add(x); }); } } catch(e) {} }
      const loaded = new Set(); document.fonts.forEach(f => { if (f.status === 'loaded') loaded.add(f.family.replace(/["']/g,'')); });
      for (const w of wanted) if (!loaded.has(w)) out.fonts.push(`${w}: no face loaded`);
      return out;
    });
    console.log(`[${tag}] height=${report.height} scrollW=${report.scrollW} clientW=${report.clientW}` + (report.overflow.length ? `\n  OVERFLOW: ${report.overflow.join(' | ')}` : '') + (report.fonts.length ? `\n  FONTS NOT LOADED: ${report.fonts.slice(0,8).join(' | ')}` : ''));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: `${outPrefix}-${tag}-full.png`, fullPage: true });
    // viewport-sized chunks for close reading (full-page PNGs get downscaled by viewers)
    const chunkH = Math.round(h * 1.5);
    for (let i = 0, y = 0; y < total && i < 14; i++, y += chunkH) {
      await page.screenshot({ path: `${outPrefix}-${tag}-c${String(i).padStart(2,'0')}.png`, clip: { x: 0, y, width: w, height: Math.min(chunkH, total - y) }, captureBeyondViewport: true });
    }
    await page.close();
  }
  await shoot(1440, 900, 'desktop', 1);
  await shoot(390, 844, 'mobile', 2);
  if (errors.length) { console.log('ISSUES:'); errors.slice(0, 30).forEach(e => console.log('  ' + e)); } else console.log('no console/page/request errors');
  await browser.close();
})();
