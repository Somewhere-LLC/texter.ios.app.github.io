// Structured data for texter.work (search engines and AI search read it).
//  1. Injects the Organization / WebSite / SoftwareApplication JSON-LD into the LP (ja, en)
//     between the <!-- seo:jsonld --> markers.
//  2. Generates /faq/ and /en/faq/ from faq-data.js. The visible Q&A and the FAQPage JSON-LD
//     come from the same entries, so they cannot drift apart.
// Usage: node scripts/seo/build.js   (then: node scripts/seo/check.js, which also fails if this was not re-run)
const fs = require('fs');
const path = require('path');
const facts = require('./app-facts');
const data = require('./faq-data');

const root = path.resolve(__dirname, '..', '..');
const SITE = facts.site;
// One app node per language, because description, offer names and install URL differ.
const appId = (lang) => (lang === 'ja' ? `${SITE}/#app` : `${SITE}/en/#app`);
const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Answers are trusted, hand-written HTML limited to the tags Google accepts in Answer.text.
const ALLOWED = /^(a|b|strong|br|ul|ol|li|p)$/i;
const checkAnswer = (html, id) => {
  for (const m of html.matchAll(/<\/?([a-z0-9]+)/gi)) {
    if (!ALLOWED.test(m[1])) throw new Error(`faq ${id}: tag <${m[1]}> not allowed in answers`);
  }
};
// JSON inside <script> must not be able to close the tag.
const jsonForScript = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

const orgNode = () => ({
  '@type': 'Organization',
  '@id': ORG_ID,
  name: facts.org.name,
  url: `${SITE}/`,
  logo: `${SITE}/img/appicon.png`,
  email: facts.org.email,
  address: { '@type': 'PostalAddress', ...facts.org.address },
});

// Subscriptions carry their billing period so the price is not read as a one-time purchase.
const PERIOD = { weekly: 'P1W', monthly: 'P1M', yearly: 'P1Y' };
function offer(name, plan) {
  const base = { '@type': 'Offer', name, priceCurrency: 'JPY', eligibleRegion: { '@type': 'Country', name: 'JP' } };
  if (!plan) return { ...base, price: '0' };
  const price = String(facts.prices[plan]);
  return { ...base, price, priceSpecification: { '@type': 'UnitPriceSpecification', price, priceCurrency: 'JPY', billingDuration: PERIOD[plan] } };
}

const titleOf = (html, file) => {
  const m = html.match(/<title>([^<]*)<\/title>/);
  if (!m) throw new Error(`${file}: no <title>`);
  return m[1].replace(/&amp;/g, '&');
};

function appGraph(lang, pageTitle) {
  const f = facts[lang];
  const pageUrl = lang === 'ja' ? `${SITE}/` : `${SITE}/en/`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      orgNode(),
      {
        '@type': 'WebSite',
        '@id': SITE_ID,
        url: `${SITE}/`,
        name: 'Texter',
        inLanguage: ['ja', 'en'],
        publisher: { '@id': ORG_ID },
      },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: pageTitle,
        inLanguage: lang,
        isPartOf: { '@id': SITE_ID },
        about: { '@id': appId(lang) },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': appId(lang),
        name: 'Texter',
        alternateName: f.alternateName,
        description: f.description,
        url: pageUrl,
        image: `${SITE}/img/appicon.png`,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: f.category,
        operatingSystem: facts.operatingSystem,
        downloadUrl: [facts.appStore[lang], facts.googlePlay],
        installUrl: facts.appStore[lang],
        sameAs: [facts.appStore[lang], facts.googlePlay],
        featureList: f.features,
        offers: [
          offer(f.offers.free),
          offer(f.offers.weekly, 'weekly'),
          offer(f.offers.monthly, 'monthly'),
          offer(f.offers.yearly, 'yearly'),
        ],
        publisher: { '@id': ORG_ID },
        author: { '@id': ORG_ID },
      },
    ],
  };
}

const MARK_START = '<!-- seo:jsonld -->';
const MARK_END = '<!-- /seo:jsonld -->';
function injectLp(lang) {
  const rel = lang === 'ja' ? 'index.html' : 'en/index.html';
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const block = `${MARK_START}\n    <script type="application/ld+json">\n${jsonForScript(appGraph(lang, titleOf(html, rel)))}\n    </script>\n    ${MARK_END}`;
  const re = new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`);
  if (!re.test(html)) throw new Error(`${rel}: missing ${MARK_START} ... ${MARK_END} markers`);
  return [rel, html.replace(re, () => block)];
}

// JSON-LD can be read away from the page, so links inside answers must be absolute.
const absolutize = (html) => html.replace(/href="\//g, `href="${SITE}/`);

function render(lang) {
  const t = data[lang];
  const other = lang === 'ja' ? 'en' : 'ja';
  const url = `${SITE}${t.path}`;
  const altUrl = (l) => `${SITE}${data[l].path}`;
  const entries = t.sections.flatMap((s) => s.items);
  for (const q of entries) checkAnswer(q.a, q.id);
  const ids = [...entries.map((q) => q.id), ...t.sections.flatMap((s) => [s.id, `${s.id}-h`]), 'main', 'toc-h', 'cta-h'];
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`duplicate id on ${t.path}: ${dup}`);

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        url,
        name: t.title,
        inLanguage: t.htmlLang,
        dateModified: data.updated,
        isPartOf: { '@id': SITE_ID },
        about: { '@id': appId(lang) },
        publisher: { '@id': ORG_ID },
        mainEntity: entries.map((q) => ({
          '@type': 'Question',
          name: q.q,
          acceptedAnswer: { '@type': 'Answer', text: absolutize(q.a) },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Texter', item: `${SITE}${t.home}` },
          { '@type': 'ListItem', position: 2, name: t.crumb, item: url },
        ],
      },
      orgNode(),
    ],
  };

  const toc = t.sections.map((s) => `<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join('');
  const body = t.sections.map((s) => `
    <section class="sec" id="${s.id}" aria-labelledby="${s.id}-h">
      <h2 id="${s.id}-h">${esc(s.title)}</h2>
      ${s.items.map((q) => `<article class="qa" id="${q.id}">
        <h3>${esc(q.q)}</h3>
        <div class="a">${/^<(p|ul|ol)\b/.test(q.a) ? q.a : `<p>${q.a}</p>`}</div>
      </article>`).join('\n      ')}
    </section>`).join('\n');

  return `<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://www.googletagmanager.com https://*.google-analytics.com https://*.doubleclick.net https://*.google.com https://*.google.co.jp; connect-src 'self' https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.googletagmanager.com https://*.doubleclick.net https://*.google.com https://*.google.co.jp; base-uri 'self'; form-action 'self'; object-src 'none';">
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-HDB32BHHL8"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-HDB32BHHL8', { 'cookie_flags': 'SameSite=None;Secure' });
</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ja" href="${altUrl('ja')}">
<link rel="alternate" hreflang="en" href="${altUrl('en')}">
<link rel="alternate" hreflang="x-default" href="${altUrl('ja')}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
<meta property="og:site_name" content="Texter">
<meta property="og:locale" content="${t.ogLocale}">
<meta property="og:locale:alternate" content="${data[other].ogLocale}">
<meta property="og:image" content="${SITE}${t.ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(t.title)}">
<meta name="twitter:description" content="${esc(t.description)}">
<meta name="twitter:image" content="${SITE}${t.ogImage}">
<meta name="apple-itunes-app" content="app-id=${facts.appStoreId}">
<link rel="icon" href="/assets/favicon/favicon.ico?v=2" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon/favicon-32x32.png?v=2">
<link rel="apple-touch-icon" href="/assets/favicon/apple-touch-icon.png?v=2">
<meta name="theme-color" content="#EDF4FF">
<script type="application/ld+json">
${jsonForScript(ld)}
</script>
<style>
:root{
  --accent:#6482FA; --deep:#5460D6; --navy:#17255A; --text:#444444; --sub:#5F6170;
  --line:rgba(23,37,90,.12); --card:#FFFFFF; --grad-a:#EDF4FF; --grad-b:#D6E4FC;
  --f-jp:-apple-system,BlinkMacSystemFont,"SF Pro JP","Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;
  --f-mono:ui-monospace,Menlo,monospace;
  color-scheme:light;
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-padding-top:80px}
body{margin:0;color:var(--text);font-family:var(--f-jp);font-size:16px;line-height:1.85;-webkit-font-smoothing:antialiased;
  background:linear-gradient(180deg,var(--grad-a) 0%,var(--grad-b) 100%) fixed,var(--grad-b)}
a{color:var(--deep)}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}
.skip{position:fixed;left:12px;top:-60px;z-index:100;background:var(--navy);color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600}
.skip:focus{top:12px}
.wrap{max-width:860px;margin-inline:auto;padding-inline:20px}
.nav{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.85);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;height:60px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:700;font-size:18px;color:var(--navy)}
.brand img{width:28px;height:28px;border-radius:7px}
.nav ul{display:flex;gap:4px;margin:0;padding:0;list-style:none}
.nav ul a{display:block;padding:8px 10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;color:var(--text)}
.nav ul a:hover{background:rgba(23,37,90,.06)}
.crumbs{margin:28px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px;font-size:13px;color:var(--sub)}
.crumbs li+li::before{content:"/";margin-right:6px}
.crumbs a{color:var(--sub)}
h1{margin:12px 0 0;color:var(--navy);font-size:clamp(2rem,5vw,2.8rem);line-height:1.2;font-weight:900;letter-spacing:-.01em}
.intro{margin:16px 0 0;max-width:40em}
.meta{margin:10px 0 0;font-size:13px;color:var(--sub)}
.toc{margin:28px 0 0;padding:18px 20px;background:rgba(255,255,255,.7);border:1px solid var(--line);border-radius:14px}
.toc h2{margin:0;font-size:13px;letter-spacing:.08em;color:var(--sub);font-weight:600}
.toc ul{margin:8px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px 18px}
.toc a{font-size:15px;font-weight:500}
.sec{margin-top:48px}
.sec>h2{margin:0;padding-top:12px;border-top:1.5px solid var(--navy);color:var(--navy);font-size:clamp(1.3rem,3vw,1.6rem);line-height:1.4}
.qa{margin-top:16px;padding:20px 22px;background:var(--card);border:1px solid var(--line);border-radius:14px}
.qa h3{position:relative;margin:0;color:var(--navy);font-size:17px;line-height:1.6}
.qa:target{border-color:var(--accent);box-shadow:0 0 0 3px rgba(100,130,250,.18)}
.a{margin-top:8px}
.a p,.a ul,.a ol{margin:8px 0 0}
.a p:first-child{margin-top:0}
.a ul,.a ol{padding-left:1.3em}
.cta{margin:56px 0 0;padding:28px 22px;background:var(--navy);color:#fff;border-radius:18px}
.cta h2{margin:0;font-size:22px;line-height:1.4}
.cta p{margin:8px 0 0;color:rgba(255,255,255,.8);font-size:15px}
.cta .row{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 20px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px}
.btn-solid{background:#fff;color:var(--navy)}
.btn-line{color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.5)}
footer{margin-top:64px;padding:28px 0 40px;border-top:1px solid var(--line);font-size:13px;color:var(--sub)}
footer ul{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px 16px}
footer a{color:var(--sub)}
footer p{margin:12px 0 0}
@media (max-width:560px){.nav ul .opt{display:none}.qa{padding:18px 16px}}
</style>
</head>
<body>
<a class="skip" href="#main">${esc(t.skip)}</a>
<header class="nav">
  <div class="wrap">
    <a class="brand" href="${t.home}"><img src="/img/appicon.png" alt="" width="28" height="28">Texter</a>
    <nav aria-label="${esc(t.navLabel)}"><ul>
      ${t.nav.map((n) => `<li${n.opt ? ' class="opt"' : ''}><a href="${n.href}"${n.hreflang ? ` hreflang="${n.hreflang}" lang="${n.hreflang}"` : ''}>${esc(n.label)}</a></li>`).join('')}
    </ul></nav>
  </div>
</header>
<main id="main" class="wrap">
  <nav aria-label="${esc(t.crumbLabel)}"><ol class="crumbs"><li><a href="${t.home}">Texter</a></li><li aria-current="page">${esc(t.crumb)}</li></ol></nav>
  <h1>${esc(t.h1)}</h1>
  <p class="intro">${t.intro}</p>
  <p class="meta">${esc(t.updatedLabel)} <time datetime="${data.updated}">${data.updated}</time></p>
  <nav class="toc" aria-labelledby="toc-h"><h2 id="toc-h">${esc(t.tocTitle)}</h2><ul>${toc}</ul></nav>
${body}
  <section class="cta" aria-labelledby="cta-h">
    <h2 id="cta-h">${esc(t.ctaTitle)}</h2>
    <p>${t.ctaBody}</p>
    <div class="row">
      <a class="btn btn-solid" href="${t.appStore}" target="_blank" rel="noopener noreferrer">App Store</a>
      <a class="btn btn-line" href="${facts.googlePlay}" target="_blank" rel="noopener noreferrer">Google Play</a>
    </div>
  </section>
</main>
<footer>
  <div class="wrap">
    <ul>${t.footer.map((f) => `<li><a href="${f.href}"${f.ext ? ' target="_blank" rel="noopener noreferrer"' : ''}${f.hreflang ? ` hreflang="${f.hreflang}" lang="${f.hreflang}"` : ''}>${esc(f.label)}</a></li>`).join('')}</ul>
    <p>© 2026 Texter app - Kyoto, Japan.</p>
  </div>
</footer>
</body>
</html>
`;
}

// Returns { relativePath: content } for every file this script owns, without writing.
function generate() {
  const out = {};
  for (const lang of ['ja', 'en']) {
    const [rel, html] = injectLp(lang);
    out[rel] = html;
    out[path.join(data[lang].path.slice(1), 'index.html')] = render(lang);
  }
  return out;
}

if (require.main === module) {
  for (const [rel, content] of Object.entries(generate())) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    console.log('wrote', rel);
  }
}

module.exports = { generate };
