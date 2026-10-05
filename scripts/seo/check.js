// Consistency checks for the structured data. Exit 1 on any failure.
//   node scripts/seo/check.js             check the working tree
//   node scripts/seo/check.js --self-test also prove each check fails on a broken copy
const fs = require('fs');
const path = require('path');
const facts = require('./app-facts');
const data = require('./faq-data');
const { generate } = require('./build');

const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const text = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const yen = (n) => `¥${n.toLocaleString('en-US')}`;
// How each plan's price is written on the pages. A swapped price/period pair must fail.
const PRICE_AS_SHOWN = {
  lp: {
    ja: { weekly: (p) => `週額 ${p}`, monthly: (p) => `${p}<small>/月`, yearly: (p) => `${p}<small>/年` },
    en: { weekly: (p) => `${p} weekly`, monthly: (p) => `${p}<small>/mo`, yearly: (p) => `${p}<small>/yr` },
  },
  faq: {
    ja: { weekly: (p) => `週額 ${p}`, monthly: (p) => `月額 ${p}`, yearly: (p) => `年額 ${p}` },
    en: { weekly: (p) => `${p} per week`, monthly: (p) => `${p} per month`, yearly: (p) => `${p} per year` },
  },
};
const PERIOD = { P1W: 'weekly', P1M: 'monthly', P1Y: 'yearly' };

function jsonLd(html, file, errors) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { out.push(JSON.parse(m[1])); } catch (e) { errors.push(`${file}: invalid JSON-LD (${e.message})`); }
  }
  return out;
}
const nodes = (blocks) => blocks.flatMap((b) => b['@graph'] || [b]);

function checkLp(file, lang, html, errors) {
  const graph = nodes(jsonLd(html, file, errors));
  const app = graph.find((n) => n['@type'] === 'SoftwareApplication');
  if (!app) return errors.push(`${file}: no SoftwareApplication`);
  if (!graph.some((n) => n['@type'] === 'Organization')) errors.push(`${file}: no Organization`);
  // The yearly price exists only in the pricing toggle script, so match against the raw HTML.
  for (const o of app.offers) {
    if (o.price === '0') continue;
    const plan = PERIOD[o.priceSpecification?.billingDuration];
    if (!plan) { errors.push(`${file}: offer ${o.name} has no billing period`); continue; }
    const shown = PRICE_AS_SHOWN.lp[lang][plan](yen(Number(o.price)));
    if (!html.includes(shown)) errors.push(`${file}: offer ${o.name} expects "${shown}" on the page`);
  }
  // featureList must be exactly the feature headings (the cards in the feature sections).
  const cards = [...html.matchAll(/<article class="(?:feat|cell)\b[^"]*"[^>]*>([\s\S]*?)<\/article>/g)];
  const headings = cards.map((c) => (c[1].match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1]).filter((h) => h != null).map((h) => text(h).trim());
  if (headings.length !== cards.length) errors.push(`${file}: ${cards.length} feature cards but ${headings.length} headings`);
  for (const f of app.featureList) if (!headings.includes(f)) errors.push(`${file}: feature "${f}" is not a feature heading on the page`);
  for (const h of headings) if (!app.featureList.includes(h)) errors.push(`${file}: feature heading "${h}" is missing from featureList`);
  const page = graph.find((n) => n['@type'] === 'WebPage');
  const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
  if (!page || page.name !== title) errors.push(`${file}: WebPage.name differs from <title>`);
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (decode(desc || '') !== app.description) errors.push(`${file}: JSON-LD description differs from meta description`);
  if (app.aggregateRating) errors.push(`${file}: aggregateRating present but rating is not verified (see app-facts.js)`);
}

function checkFaq(file, lang, html, errors) {
  const graph = nodes(jsonLd(html, file, errors));
  const faq = graph.find((n) => n['@type'] === 'FAQPage');
  if (!faq) return errors.push(`${file}: no FAQPage`);
  const entries = data[lang].sections.flatMap((s) => s.items);
  if (faq.mainEntity.length !== entries.length) errors.push(`${file}: ${faq.mainEntity.length} questions in JSON-LD, ${entries.length} in data`);
  const pageText = text(html);
  for (const q of faq.mainEntity) {
    if (!pageText.includes(decode(q.name))) errors.push(`${file}: question not visible: ${q.name}`);
    const a = text(q.acceptedAnswer.text).trim();
    if (!pageText.includes(a)) errors.push(`${file}: answer not visible: ${q.name}`);
  }
  // Prices quoted in answers must be the ones the LP lists, each with its own period.
  const known = new Set(Object.values(facts.prices).map(yen));
  for (const m of pageText.matchAll(/¥[\d,]+/g)) if (!known.has(m[0])) errors.push(`${file}: price ${m[0]} is not in app-facts.prices`);
  for (const [plan, price] of Object.entries(facts.prices)) {
    const shown = PRICE_AS_SHOWN.faq[lang][plan](yen(price));
    if (!pageText.includes(shown)) errors.push(`${file}: expects "${shown}"`);
  }
}

function checkSite(files, errors) {
  const sitemap = files['sitemap.xml'];
  for (const m of sitemap.matchAll(/<loc>https:\/\/texter\.work\/([^<]*)<\/loc>/g)) {
    const rel = m[1] === '' ? 'index.html' : `${m[1]}index.html`;
    if (!fs.existsSync(path.join(root, rel))) errors.push(`sitemap: ${m[1] || '/'} has no ${rel}`);
  }
  for (const p of ['faq/', 'en/faq/']) if (!sitemap.includes(`https://texter.work/${p}<`)) errors.push(`sitemap: missing ${p}`);
  // Any Disallow, for any user agent (including AI crawlers such as OAI-SearchBot), hides pages from search.
  if (/^[ \t]*Disallow:[ \t]*\S/im.test(files['robots.txt'])) errors.push('robots.txt: has a Disallow rule');
  const alternates = {};
  for (const [rel, html] of Object.entries(files)) {
    if (!rel.endsWith('.html')) continue;
    const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    const expect = 'https://texter.work/' + rel.replace(/index\.html$/, '');
    if (canon !== expect) errors.push(`${rel}: canonical ${canon} != ${expect}`);
    alternates[expect] = Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => [m[1], m[2]]));
  }
  // hreflang must point both ways, and each page must list itself.
  for (const [url, alt] of Object.entries(alternates)) {
    for (const lang of ['ja', 'en', 'x-default']) if (!alt[lang]) errors.push(`${url}: no hreflang=${lang}`);
    if (!Object.values(alt).includes(url)) errors.push(`${url}: hreflang does not list the page itself`);
    for (const [lang, target] of Object.entries(alt)) {
      if (lang === 'x-default' || target === url || !alternates[target]) continue;
      if (!Object.values(alternates[target]).includes(url)) errors.push(`${url}: ${target} does not link back via hreflang`);
    }
  }
}

function run(files, { stale = true } = {}) {
  const errors = [];
  if (stale) for (const [rel, content] of Object.entries(generate())) {
    if (files[rel] !== content) errors.push(`${rel}: out of date, run node scripts/seo/build.js`);
  }
  checkLp('index.html', 'ja', files['index.html'], errors);
  checkLp('en/index.html', 'en', files['en/index.html'], errors);
  checkFaq('faq/index.html', 'ja', files['faq/index.html'], errors);
  checkFaq('en/faq/index.html', 'en', files['en/faq/index.html'], errors);
  checkSite(files, errors);
  return errors;
}

const files = Object.fromEntries(['index.html', 'en/index.html', 'faq/index.html', 'en/faq/index.html', 'sitemap.xml', 'robots.txt'].map((f) => [f, read(f)]));
const errors = run(files);
errors.forEach((e) => console.error('NG', e));
if (errors.length) process.exit(1);
console.log('OK: structured data matches the pages');

if (process.argv.includes('--self-test')) {
  // Each mutation reproduces a real way the pages can drift; the check must catch it.
  const firstQ = data.ja.sections[0].items[0].q;
  const mutations = [
    ['LP price changed', 'index.html', (s) => s.replaceAll('¥1,800', '¥2,000')],
    ['LP feature heading renamed', 'en/index.html', (s) => s.replace('<h3>Topic map</h3>', '<h3>Topic graph</h3>')],
    ['FAQ question edited only in HTML', 'faq/index.html', (s) => s.replace(`>${firstQ}</h3>`, '>別の質問</h3>')],
    ['JSON-LD broken', 'en/faq/index.html', (s) => s.replace('"@type": "FAQPage"', '"@type": "FAQPage",,')],
    ['robots blocks a path', 'robots.txt', (s) => s.replace('Allow: /', 'Allow: /\nDisallow: /faq/')],
    ['sitemap drops FAQ', 'sitemap.xml', (s) => s.replace('https://texter.work/faq/<', 'https://texter.work/faq-old/<')],
    ['robots blocks the whole site', 'robots.txt', (s) => s.replace('Allow: /', 'Disallow: /')],
    ['valid empty Disallow is accepted', 'robots.txt', (s) => s.replace('Allow: /', 'Disallow:'), true],
    ['robots blocks an AI crawler', 'robots.txt', (s) => s + '\nUser-agent: OAI-SearchBot\nDisallow: /\n'],
    ['FAQ monthly/yearly prices swapped', 'faq/index.html', (s) => s.replaceAll('月額 ¥1,800', '月額 ¥X').replaceAll('年額 ¥8,800', '月額 ¥8,800').replaceAll('月額 ¥X', '年額 ¥1,800')],
    ['LP feature card added without featureList', 'index.html', (s) => s.replace('<h3>ワードクラウド</h3>', '<h3>ワードクラウド</h3></article><article class="cell"><h3>新機能</h3>')],
    ['LP feature card with attributes on its heading', 'index.html', (s) => s.replace('<h3>ワードクラウド</h3>', '<h3>ワードクラウド</h3></article><article class="cell"><h3 class="x">新<br>機能</h3>')],
    ['LP feature card with extra attributes', 'index.html', (s) => s.replace('<h3>ワードクラウド</h3>', '<h3>ワードクラウド</h3></article><article class="cell reveal" id="x"><h3>新機能</h3>')],
    ['LP feature card without a heading', 'index.html', (s) => s.replace('<h3>ワードクラウド</h3>', '<h3>ワードクラウド</h3></article><article class="cell"><p>見出しなし</p>')],
    ['hreflang points to a wrong page', 'en/faq/index.html', (s) => s.replace('hreflang="ja" href="https://texter.work/faq/"', 'hreflang="ja" href="https://texter.work/"')],
    ['generated page edited by hand', 'en/faq/index.html', (s) => s.replace('</footer>', '<p>hand edit</p></footer>')],
  ];
  let failed = 0;
  for (const [name, file, mutate, shouldPass] of mutations) {
    const broken = { ...files, [file]: mutate(files[file]) };
    if (broken[file] === files[file]) { console.error(`SELF-TEST BROKEN: mutation "${name}" did not change ${file}`); failed++; continue; }
    // Only the hand-edit case may be caught by the staleness check; the others must trip their own check.
    const n = run(broken, { stale: name === 'generated page edited by hand' }).length;
    if (shouldPass) {
      console.log(`${n ? 'FALSE ALARM' : 'accepted'}: ${name} (${n} error${n === 1 ? '' : 's'})`);
      if (n) failed++;
      continue;
    }
    console.log(`${n ? 'caught' : 'MISSED'}: ${name} (${n} error${n === 1 ? '' : 's'})`);
    if (!n) failed++;
  }
  if (failed) process.exit(1);
}
