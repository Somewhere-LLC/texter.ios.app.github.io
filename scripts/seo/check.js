// Consistency checks for the structured data. Exit 1 on any failure.
//   node scripts/seo/check.js             check the working tree
//   node scripts/seo/check.js --self-test also prove each check fails on a broken copy
const fs = require('fs');
const path = require('path');
const facts = require('./app-facts');
const data = require('./faq-data');
const { guides } = require('../guides/data');
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
  },
  faq: {
    ja: { weekly: (p) => `週額 ${p}`, monthly: (p) => `月額 ${p}`, yearly: (p) => `年額 ${p}` },
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
  // Safari's Smart App Banner is built from this meta tag, so the campaign goes in affiliate-data.
  if (!/<meta name="apple-itunes-app" content="app-id=\d+, affiliate-data=pt=\d+&amp;ct=[a-z0-9-]+">/.test(html)) errors.push(`${file}: Smart App Banner without campaign (affiliate-data)`);
  // App Store links carry the campaign (pt/ct) so App Store Connect can split downloads by page.
  for (const m of html.matchAll(/href="(https:\/\/apps\.apple\.com[^"]*)"/g)) if (!/[?]pt=\d+&amp;ct=[a-z0-9-]+&amp;mt=8$/.test(m[1])) errors.push(`${file}: App Store link without campaign (pt/ct): ${m[1]}`);
  if (!html.includes("'app_store_click'")) errors.push(`${file}: store clicks are not sent to GA4 (app_store_click)`);
  const graph = nodes(jsonLd(html, file, errors));
  const app = graph.find((n) => n['@type'] === 'SoftwareApplication');
  if (!app) return errors.push(`${file}: no SoftwareApplication`);
  if (!graph.some((n) => n['@type'] === 'Organization')) errors.push(`${file}: no Organization`);
  // English pages state no prices: they differ by country, and a yen price misleads readers abroad.
  if (lang === 'en') {
    if (html.includes('¥')) errors.push(`${file}: English page shows a yen price`);
    if (app.offers.some((o) => o.price !== '0')) errors.push(`${file}: English JSON-LD lists a paid price`);
  }
  // The weekly plan is offered only when cancelling, so it must not be listed as a general offer.
  if (app.offers.some((o) => o.priceSpecification?.billingDuration === 'P1W')) errors.push(`${file}: weekly plan listed in JSON-LD (it is only offered on cancellation)`);
  // The yearly price exists only in the pricing toggle script, so match against the raw HTML.
  for (const o of app.offers) {
    if (lang === 'en') break;
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
  // Safari's Smart App Banner is built from this meta tag, so the campaign goes in affiliate-data.
  if (!/<meta name="apple-itunes-app" content="app-id=\d+, affiliate-data=pt=\d+&amp;ct=[a-z0-9-]+">/.test(html)) errors.push(`${file}: Smart App Banner without campaign (affiliate-data)`);
  // App Store links carry the campaign (pt/ct) so App Store Connect can split downloads by page.
  for (const m of html.matchAll(/href="(https:\/\/apps\.apple\.com[^"]*)"/g)) if (!/[?]pt=\d+&amp;ct=[a-z0-9-]+&amp;mt=8$/.test(m[1])) errors.push(`${file}: App Store link without campaign (pt/ct): ${m[1]}`);
  if (!html.includes("'app_store_click'")) errors.push(`${file}: store clicks are not sent to GA4 (app_store_click)`);
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
  if (lang === 'en' && html.includes('¥')) errors.push(`${file}: English page shows a yen price`);
  if (lang === 'en') return;
  for (const [plan, price] of Object.entries(facts.prices)) {
    const shown = PRICE_AS_SHOWN.faq[lang][plan](yen(price));
    if (!pageText.includes(shown)) errors.push(`${file}: expects "${shown}"`);
  }
}

function checkGuide(rel, html, errors) {
  try {
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
  } catch (e) {
    errors.push(`${rel}: JSON-LD does not parse`);
  }
  for (const m of html.matchAll(/(?:src|poster|href)="(\/assets\/guides\/[^"]+)"/g)) {
    if (!fs.existsSync(path.join(root, m[1]))) errors.push(`${rel}: missing asset ${m[1]}`);
  }
  if (html.includes('__VIDEO__')) errors.push(`${rel}: video placeholder left in the page`);
}

function checkPricing(html, errors) {
  const shown = { ...facts.jaPlans, monthly: facts.prices.monthly, yearly: facts.prices.yearly };
  for (const [plan, price] of Object.entries(shown)) {
    if (!html.includes(yen(price))) errors.push(`pricing/index.html: ${plan} price ${yen(price)} not shown`);
  }
}

function checkSite(files, errors) {
  if (!files['sitemap.xml'].includes('https://texter.work/en/interview/<')) errors.push('sitemap: missing en/interview/');
  const sitemap = files['sitemap.xml'];
  for (const m of sitemap.matchAll(/<loc>https:\/\/texter\.work\/([^<]*)<\/loc>/g)) {
    const rel = m[1] === '' ? 'index.html' : `${m[1]}index.html`;
    if (!fs.existsSync(path.join(root, rel))) errors.push(`sitemap: ${m[1] || '/'} has no ${rel}`);
  }
  for (const p of ['faq/', 'en/faq/', 'guides/', ...guides.map((g) => `guides/${g.slug}/`), 'pricing/', 'interview/', 'subtitle/']) if (!sitemap.includes(`https://texter.work/${p}<`)) errors.push(`sitemap: missing ${p}`);
  // Any Disallow, for any user agent (including AI crawlers such as OAI-SearchBot), hides pages from search.
  if (/^[ \t]*Disallow:[ \t]*\S/im.test(files['robots.txt'])) errors.push('robots.txt: has a Disallow rule');
  const alternates = {};
  for (const [rel, html] of Object.entries(files)) {
    if (!rel.endsWith('.html')) continue;
    const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    const expect = 'https://texter.work/' + rel.replace(/index\.html$/, '');
    if (canon !== expect) errors.push(`${rel}: canonical ${canon} != ${expect}`);
    if (rel === 'interview/index.html') checkGuide(rel, html, errors);
    if (rel.startsWith('guides/') || rel.startsWith('pricing/') || rel.startsWith('subtitle/')) {
      checkGuide(rel, html, errors);
      continue; // Guides exist in Japanese only, so they have no hreflang pairs.
    }
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

function checkInterview(html, errors) {
  const file = 'en/interview/index.html';
  const graph = nodes(jsonLd(html, file, errors));
  const webpage = graph.find((node) => node['@type'] === 'WebPage');
  if (!webpage || !webpage.isPartOf || webpage.isPartOf['@id'] !== `${facts.site}/#website`) errors.push(`${file}: WebPage must reference the existing WebSite`);
  if (html.includes('¥') || html.includes('apps.apple.com/jp/')) errors.push(`${file}: Japan-specific price or storefront`);
  const content = html.match(/<script type="application\/json" id="interview-demo-content">([\s\S]*?)<\/script>/);
  try {
    const demo = JSON.parse(content ? content[1] : '');
    for (const id of ['first', 'second', 'third']) {
      const transcript = read(`assets/interview/en/${id}.txt`).trim();
      if (!html.includes(transcript) || !transcript.includes(demo.sources[id].quote)) errors.push(`${file}: ${id} transcript does not match its source`);
    }
    for (const id of ['budget', 'change', 'access']) {
      const example = demo.examples[id];
      if (!example.answer || !example.sources.length) throw new Error(`missing example ${id}`);
      for (const source of example.sources) {
        if (!demo.sources[source]) throw new Error(`unknown source ${source}`);
        const quote = (example.quotes || {})[source];
        if (quote && !read(`assets/interview/en/${source}.txt`).includes(quote)) errors.push(`${file}: ${id} quote missing from transcript`);
      }
    }
  } catch (e) {
    errors.push(`${file}: invalid demo content (${e.message})`);
  }
  checkLocalLinks(file, html, errors);
}

// Every relative link, asset and anchor on a hand-written page must exist in the repo.
function checkLocalLinks(file, html, errors) {
  for (const match of html.matchAll(/(?:href|src|poster)="([^"]+)"/g)) {
    const url = decode(match[1]);
    if (/^(https?:|data:)/.test(url)) continue;
    const [pathname, hash] = url.split('#');
    const target = pathname ? path.resolve(root, path.dirname(file), pathname.split('?')[0]) : path.join(root, file);
    const resolved = pathname.endsWith('/') || (pathname && !path.extname(target)) ? path.join(target, 'index.html') : target;
    if (!fs.existsSync(resolved)) { errors.push(`${file}: missing ${url}`); continue; }
    if (hash && !read(path.relative(root, resolved)).includes(`id="${hash}"`)) errors.push(`${file}: missing anchor ${url}`);
  }
}

function checkSubtitle(html, errors) {
  const file = 'subtitle/index.html';
  const graph = nodes(jsonLd(html, file, errors));
  const webpage = graph.find((node) => node['@type'] === 'WebPage');
  if (!webpage || !webpage.isPartOf || webpage.isPartOf['@id'] !== `${facts.site}/#website`) errors.push(`${file}: WebPage must reference the existing WebSite`);
  const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
  if (webpage && webpage.name !== title) errors.push(`${file}: WebPage.name differs from <title>`);
  if (!/<meta name="apple-itunes-app" content="app-id=\d+, affiliate-data=pt=\d+&amp;ct=[a-z0-9-]+">/.test(html)) errors.push(`${file}: Smart App Banner without campaign (affiliate-data)`);
  for (const m of html.matchAll(/href="(https:\/\/apps\.apple\.com[^"]*)"/g)) if (!/[?]pt=\d+&amp;ct=subtitle-[a-z0-9-]+&amp;mt=8$/.test(m[1])) errors.push(`${file}: App Store link without campaign (pt/ct): ${m[1]}`);
  if (!html.includes('src="../assets/subtitle/tracking.js"') || !read('assets/subtitle/tracking.js').includes("'subtitle_store_click'")) errors.push(`${file}: store clicks are not sent to GA4 (subtitle_store_click)`);
  // Prices must be the ones the pricing data lists.
  const known = new Set([...Object.values(facts.prices), ...Object.values(facts.jaPlans)].map(yen).concat(['¥0', '¥733']));
  for (const m of text(html).matchAll(/¥[\d,]+/g)) if (!known.has(m[0])) errors.push(`${file}: price ${m[0]} is not in app-facts`);
  // The SRT shown on the page must be the exported file, unedited.
  const shown = decode((html.match(/<pre class="srt"[^>]*><code>([\s\S]*?)<\/code><\/pre>/) || [])[1] || '').trim();
  if (shown !== read('assets/guides/video-subtitles/sample.srt').replace(/\r/g, '').trim()) errors.push(`${file}: the SRT on the page differs from the exported file`);
  checkLocalLinks(file, html, errors);
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
  checkPricing(files['pricing/index.html'], errors);
  checkInterview(files['en/interview/index.html'], errors);
  checkSubtitle(files['subtitle/index.html'], errors);
  checkSite(files, errors);
  return errors;
}

const files = Object.fromEntries(['index.html', 'en/index.html', 'faq/index.html', 'en/faq/index.html', 'guides/index.html', ...guides.map((g) => `guides/${g.slug}/index.html`), 'pricing/index.html', 'interview/index.html', 'en/interview/index.html', 'subtitle/index.html', 'sitemap.xml', 'robots.txt'].map((f) => [f, read(f)]));
const errors = run(files);
errors.forEach((e) => console.error('NG', e));
if (errors.length) process.exit(1);
console.log('OK: structured data matches the pages');

if (process.argv.includes('--self-test')) {
  // Each mutation reproduces a real way the pages can drift; the check must catch it.
  const firstQ = data.ja.sections[0].items[0].q;
  const mutations = [
    ['LP price changed', 'index.html', (s) => s.replaceAll('¥1,800', '¥2,000')],
    ['LP App Store link loses its campaign', 'index.html', (s) => s.replace('?pt=489812&amp;ct=lp&amp;mt=8"', '"')],
    ['FAQ App Store link loses its campaign', 'en/faq/index.html', (s) => s.replace('?pt=489812&amp;ct=faq-en&amp;mt=8"', '"')],
    ['Smart App Banner loses its campaign', 'faq/index.html', (s) => s.replace(/, affiliate-data=[^"]*"/, '"')],
    ['LP store click tracking removed', 'index.html', (s) => s.replaceAll("'app_store_click'", "'x'")],
    ['FAQ store click tracking removed', 'faq/index.html', (s) => s.replaceAll("'app_store_click'", "'x'")],
    ['weekly plan back in LP JSON-LD', 'index.html', (s) => s.replace('"billingDuration": "P1M"', '"billingDuration": "P1W"')],
    ['LP feature heading renamed', 'en/index.html', (s) => s.replace('<h3>Topic map</h3>', '<h3>Topic graph</h3>')],
    ['FAQ question edited only in HTML', 'faq/index.html', (s) => s.replace(`>${firstQ}</h3>`, '>別の質問</h3>')],
    ['JSON-LD broken', 'en/faq/index.html', (s) => s.replace('"@type": "FAQPage"', '"@type": "FAQPage",,')],
    ['pricing page loses a plan price', 'pricing/index.html', (s) => s.replaceAll('¥500', '¥600')],
    ['guide points at a missing asset', 'guides/ai-minutes/index.html', (s) => s.replaceAll('demo.mp4', 'gone.mp4')],
    ['speaker guide points at a missing image', 'guides/multi-speaker-meeting-minutes/index.html', (s) => s.replaceAll('speaker-labels.png', 'gone.png')],
    ['guide JSON-LD broken', 'guides/video-subtitles/index.html', (s) => s.replace('"@type": "Article"', '"@type": "Article",,')],
    ['writer guide JSON-LD broken', 'guides/interview-transcription-writing/index.html', (s) => s.replace('"@type": "Article"', '"@type": "Article",,')],
    ['sitemap drops writer guide', 'sitemap.xml', (s) => s.replace('https://texter.work/guides/interview-transcription-writing/<', 'https://texter.work/guides/x/<')],
    ['sitemap drops a guide', 'sitemap.xml', (s) => s.replace('https://texter.work/guides/ai-minutes/<', 'https://texter.work/guides/x/<')],
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
    ['interview demo source changed', 'en/interview/index.html', (s) => s.replace('"quote":"We have budgeted five thousand dollars."', '"quote":"An unsupported statement."')],
    ['interview audio missing', 'en/interview/index.html', (s) => s.replace('en/first.m4a', 'en/missing.m4a')],
    ['interview anchor missing', 'en/interview/index.html', (s) => s.replace('../faq/#import', '../faq/#missing')],
    ['interview hreflang missing', 'interview/index.html', (s) => s.replace('<link rel="alternate" hreflang="en" href="https://texter.work/en/interview/">', '')],
    ['Japanese interview JSON-LD broken', 'interview/index.html', (s) => s.replace('"@type":"WebPage"', '"@type":"WebPage",,')],
    ['interview references a missing WebSite', 'en/interview/index.html', (s) => s.replace('"isPartOf":{"@id":"https://texter.work/#website"}', '"isPartOf":{"@id":"https://texter.work/en/#website"}')],
    ['subtitle page points at a missing sample', 'subtitle/index.html', (s) => s.replace('subtitled-video/sample.mp4', 'subtitled-video/gone.mp4')],
    ['subtitle page anchor missing', 'subtitle/index.html', (s) => s.replace('../faq/#silence-cut', '../faq/#missing')],
    ['subtitle page SRT edited by hand', 'subtitle/index.html', (s) => s.replace('机の片付けを紹介します。', '机の片づけを紹介します。')],
    ['subtitle page price changed', 'subtitle/index.html', (s) => s.replaceAll('¥500', '¥700')],
    ['subtitle App Store link loses its campaign', 'subtitle/index.html', (s) => s.replace('?pt=489812&amp;ct=subtitle-end&amp;mt=8"', '"')],
    ['subtitle page tracking removed', 'subtitle/index.html', (s) => s.replace('<script src="../assets/subtitle/tracking.js" defer></script>', '')],
    ['subtitle page JSON-LD broken', 'subtitle/index.html', (s) => s.replace('"@type":"WebPage"', '"@type":"WebPage",,')],
    ['sitemap drops the subtitle page', 'sitemap.xml', (s) => s.replace('https://texter.work/subtitle/<', 'https://texter.work/subtitles/<')],
    ['yen price back on the English LP', 'en/index.html', (s) => s.replace('</body>', '<p>¥600</p></body>')],
    ['yen price back in the English FAQ', 'en/faq/index.html', (s) => s.replace('comes in weekly, monthly, and yearly plans.', 'is ¥1,800 per month.')],
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
