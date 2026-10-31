// Generates /guides/ and the guide pages from data.js. scripts/seo/build.js writes the output.
const facts = require('../seo/app-facts');
const { VERIFIED, guides, index } = require('./data');

const SITE = facts.site;
const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;
// Same provider token as the app's public note pages. The campaign token ties an App Store install to the guide and link position.
const APP_STORE_PT = '489812';
const CONDITIONS = '無料で始められます。無料版の文字起こしには月ごとの上限があり、要約は1日3回までです。処理の前に広告が表示される場合があります。';
const appStoreLink = (g, pos) => {
  const id = `${g.store}-${pos}`;
  if (id.length > 40) throw new Error(`campaign token too long: ${id}`);
  return `<a class="btn btn-solid" href="${facts.appStore.ja}?pt=${APP_STORE_PT}&amp;ct=${id}&amp;mt=8" target="_blank" rel="noopener noreferrer" data-cta="${id}" data-store="app_store">${esc(g.ctaLabel)}（App Store）</a>`;
};
const inlineCta = (g, pos) => `<aside class="cta inline" aria-label="アプリで試す">${pos === 'after-result' ? `<p>${CONDITIONS}</p>` : ''}<div class="row">${appStoreLink(g, pos)}</div></aside>`;
const TRACK = `<script>
(function(){
  var send=function(name,el){if(window.gtag)gtag('event',name,{location:el.dataset.cta,store:el.dataset.store});};
  var links=document.querySelectorAll('a[data-cta]');
  links.forEach(function(a){
    a.addEventListener('click',function(){send(a.dataset.store==='google_play'?'google_play_click':'app_store_click',a);});
    if(!('IntersectionObserver' in window))return;
    var seen=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){send('guide_cta_view',a);seen.disconnect();}});},{threshold:.5});
    seen.observe(a);
  });
})();
</script>`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonForScript = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

const CSS = `
:root{--accent:#6482FA;--deep:#5460D6;--navy:#17255A;--text:#444444;--sub:#5F6170;--line:rgba(23,37,90,.12);--card:#FFFFFF;--grad-a:#EDF4FF;--grad-b:#D6E4FC;
  --f-jp:-apple-system,BlinkMacSystemFont,"SF Pro JP","Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;--f-mono:ui-monospace,Menlo,monospace;color-scheme:light}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-padding-top:80px}
body{margin:0;color:var(--text);font-family:var(--f-jp);font-size:16px;line-height:1.85;-webkit-font-smoothing:antialiased;background:linear-gradient(180deg,var(--grad-a) 0%,var(--grad-b) 100%) fixed,var(--grad-b)}
a{color:var(--deep)}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}
.skip{position:fixed;left:12px;top:-60px;z-index:100;background:var(--navy);color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600}
.skip:focus{top:12px}
.wrap{max-width:760px;margin-inline:auto;padding-inline:20px}
.nav{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.85);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;height:60px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:700;font-size:18px;color:var(--navy)}
.brand img{width:28px;height:28px;border-radius:7px}
.nav ul{display:flex;gap:4px;margin:0;padding:0;list-style:none}
.nav ul a{display:block;padding:8px 10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;color:var(--text)}
.crumbs{margin:28px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px;font-size:13px;color:var(--sub)}
.crumbs li+li::before{content:"/";margin-right:6px}
.crumbs a{color:var(--sub)}
h1{margin:12px 0 0;color:var(--navy);font-size:clamp(2rem,5vw,2.6rem);line-height:1.25;font-weight:900}
.lead{margin:16px 0 0}
.meta{margin:10px 0 0;font-size:13px;color:var(--sub)}
.toc{margin:28px 0 0;padding:18px 20px;background:rgba(255,255,255,.7);border:1px solid var(--line);border-radius:14px}
.toc h2{margin:0;font-size:13px;color:var(--sub);font-weight:600}
.toc ul{margin:8px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px 18px}
.toc a{font-size:15px;font-weight:500}
.sec{margin-top:48px}
.sec>h2{margin:0;padding-top:12px;border-top:1.5px solid var(--navy);color:var(--navy);font-size:clamp(1.3rem,3vw,1.6rem);line-height:1.4}
.sec h3{margin:24px 0 0;color:var(--navy);font-size:17px;line-height:1.6}
.sec p,.sec ul,.sec ol{margin:12px 0 0}
.sec ul,.sec ol{padding-left:1.3em}
.compare{width:100%;margin-top:16px;border-collapse:collapse;background:var(--card);border-radius:12px;overflow:hidden;font-size:15px}
.compare th,.compare td{padding:12px 14px;border:1px solid var(--line);text-align:left;vertical-align:top;line-height:1.65}
.compare thead th{background:#F2F5FD;color:var(--navy)}
.doc{margin-top:12px;padding:18px 20px;background:var(--card);border:1px solid var(--line);border-radius:14px}
.doc p:first-child{margin-top:0}
.steps{list-style:none;padding:0!important;counter-reset:s}
.steps>li{counter-increment:s;margin-top:32px;padding:20px;background:var(--card);border:1px solid var(--line);border-radius:14px}
.steps>li>h3{margin:0}
.steps>li>h3::before{content:counter(s) ". "}
.shot{display:inline-block;width:min(46%,260px);margin:16px 10px 0 0;vertical-align:top}
.shot img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:14px}
.shot figcaption{margin-top:6px;font-size:13px;line-height:1.5;color:var(--sub)}
.demo{margin:16px 0 0;max-width:300px}
.demo video{display:block;width:100%;height:auto;border-radius:14px;border:1px solid var(--line);background:#fff}
.sample{display:block;width:100%;height:auto;margin-top:16px;border-radius:14px;background:#000}
.note{font-size:14px}
.raw{margin-top:14px}
.raw summary{cursor:pointer;font-weight:600;color:var(--navy)}
.code{margin:12px 0 0;padding:16px;overflow-x:auto;background:var(--navy);color:#fff;border-radius:12px;font:14px/1.7 var(--f-mono);white-space:pre-wrap;overflow-wrap:anywhere}
.facts{display:grid;grid-template-columns:8em 1fr;gap:8px 12px;margin:16px 0 0;font-size:15px}
.facts dt{font-weight:600;color:var(--navy)}
.facts dd{margin:0}
.cards{display:grid;gap:14px;margin:28px 0 0}
.card{display:block;padding:20px 22px;background:var(--card);border:1px solid var(--line);border-radius:14px;text-decoration:none;color:var(--text)}
.card strong{display:block;color:var(--navy);font-size:18px}
.card span{display:block;margin-top:6px;font-size:15px}
.cta{margin:56px 0 0;padding:28px 22px;background:var(--navy);color:#fff;border-radius:18px}
.cta h2{margin:0;font-size:22px;line-height:1.4}
.cta p{margin:8px 0 0;color:rgba(255,255,255,.85);font-size:15px}
.cta .row{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.cta.inline{margin:32px 0 0;padding:20px 22px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 20px;text-align:center;line-height:1.4;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px}
.btn-solid{background:#fff;color:var(--navy)}
.btn-line{color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.5)}
footer{margin-top:64px;padding:28px 0 40px;border-top:1px solid var(--line);font-size:13px;color:var(--sub)}
footer ul{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px 16px}
footer a{color:var(--sub)}
footer p{margin:12px 0 0}
@media (max-width:560px){.shot{width:calc(50% - 8px);margin-right:6px}.shot.wide{width:100%;max-width:320px;margin-right:0}.steps>li{padding:16px}.facts{grid-template-columns:1fr}.facts dd{margin-bottom:8px}.compare{font-size:14px}.compare th,.compare td{padding:10px}}
`;

const shell = ({ title, description, url, ld, body, ogType }) => `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
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
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${ogType}">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:site_name" content="Texter">
<meta property="og:locale" content="ja_JP">
<meta property="og:image" content="${SITE}/img/ogp.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/img/ogp.png">
<meta name="apple-itunes-app" content="app-id=${facts.appStoreId}">
<link rel="icon" href="/assets/favicon/favicon.ico?v=2" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon/favicon-32x32.png?v=2">
<link rel="apple-touch-icon" href="/assets/favicon/apple-touch-icon.png?v=2">
<meta name="theme-color" content="#EDF4FF">
<script type="application/ld+json">
${jsonForScript(ld)}
</script>
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#main">本文へ移動</a>
<header class="nav"><div class="wrap">
  <a class="brand" href="/"><img src="/img/appicon.png" alt="" width="28" height="28">Texter</a>
  <nav aria-label="メイン"><ul><li><a href="/guides/">活用ガイド</a></li><li><a href="/faq/">よくある質問</a></li></ul></nav>
</div></header>
<main id="main" class="wrap">
${body}
</main>
<footer><div class="wrap">
  <ul><li><a href="/">ホーム</a></li><li><a href="/guides/">活用ガイド</a></li><li><a href="/faq/">よくある質問</a></li><li><a href="/terms-of-service/">利用規約</a></li><li><a href="/privacy-policy/">プライバシーポリシー</a></li><li><a href="/tokushoho/">特定商取引法に基づく表記</a></li></ul>
  <p>© 2026 Texter app - Kyoto, Japan.</p>
</div></footer>
${TRACK}
</body>
</html>
`;

const crumbs = (items) => `<nav aria-label="パンくずリスト"><ol class="crumbs">${items.map((c) => (c.href ? `<li><a href="${c.href}">${esc(c.name)}</a></li>` : `<li aria-current="page">${esc(c.name)}</li>`)).join('')}</ol></nav>`;
const crumbLd = (url, items) => ({
  '@type': 'BreadcrumbList',
  '@id': `${url}#breadcrumb`,
  itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.href ? `${SITE}${c.href}` : url })),
});

function renderGuide(g) {
  const url = `${SITE}/guides/${g.slug}/`;
  const items = [{ name: 'Texter', href: '/' }, { name: '活用ガイド', href: '/guides/' }, { name: g.crumb }];
  const v = g.video;
  const player = `<video controls muted playsinline preload="none" poster="${v.poster}" width="${v.w}" height="${v.h}" aria-label="${esc(v.name)}"><source src="${v.src}" type="video/mp4"></video>`;
  const ids = g.sections.map((s) => s.id);
  if (new Set(ids).size !== ids.length) throw new Error(`duplicate section id in ${g.slug}`);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: g.h1,
        description: g.description,
        url,
        inLanguage: 'ja',
        datePublished: VERIFIED,
        dateModified: VERIFIED,
        image: `${SITE}${v.poster}`,
        isPartOf: { '@id': SITE_ID },
        about: { '@id': `${SITE}/#app` },
        publisher: { '@id': ORG_ID },
        video: { '@id': `${url}#video` },
      },
      {
        '@type': 'VideoObject',
        '@id': `${url}#video`,
        name: v.name,
        description: v.description,
        thumbnailUrl: [`${SITE}${v.poster}`],
        contentUrl: `${SITE}${v.src}`,
        uploadDate: `${VERIFIED}T09:00:00+09:00`,
        duration: v.duration,
        inLanguage: 'ja',
      },
      crumbLd(url, items),
    ],
  };
  const sections = g.sections.map((s) => `<section class="sec" id="${s.id}" aria-labelledby="${s.id}-h"><h2 id="${s.id}-h">${esc(s.title)}</h2>${s.html.replace('__VIDEO__', player)}</section>${s.cta ? inlineCta(g, s.cta) : ''}`).join('\n');
  const body = `${crumbs(items)}
<h1>${esc(g.h1)}</h1>
<p class="lead">${g.lead}</p>
<p class="meta">検証日 <time datetime="${VERIFIED}">${VERIFIED}</time></p>
<nav class="toc" aria-labelledby="toc-h"><h2 id="toc-h">目次</h2><ul>${g.sections.map((s) => `<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join('')}</ul></nav>
${sections}
<section class="cta" aria-labelledby="cta-h"><h2 id="cta-h">${esc(g.ctaTitle)}</h2><p>${esc(g.ctaBody)}${CONDITIONS}</p><div class="row">${appStoreLink(g, 'end')}<a class="btn btn-line" href="${facts.googlePlay}" target="_blank" rel="noopener noreferrer" data-cta="${g.store}-end" data-store="google_play">Google Playで見る</a></div></section>`;
  return shell({ title: g.title, description: g.description, url, ld, body, ogType: 'article' });
}

function renderIndex() {
  const url = `${SITE}/guides/`;
  const items = [{ name: 'Texter', href: '/' }, { name: index.crumb }];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        name: index.title,
        description: index.description,
        url,
        inLanguage: 'ja',
        isPartOf: { '@id': SITE_ID },
        publisher: { '@id': ORG_ID },
        hasPart: guides.map((g) => ({ '@id': `${SITE}/guides/${g.slug}/#article` })),
      },
      crumbLd(url, items),
    ],
  };
  const body = `${crumbs(items)}
<h1>${esc(index.h1)}</h1>
<p class="lead">${esc(index.lead)}</p>
<div class="cards">${guides.map((g) => `<a class="card" href="/guides/${g.slug}/"><strong>${esc(g.h1)}</strong><span>${esc(g.description)}</span></a>`).join('')}</div>`;
  return shell({ title: index.title, description: index.description, url, ld, body, ogType: 'website' });
}

function generate() {
  const out = { 'guides/index.html': renderIndex() };
  for (const g of guides) out[`guides/${g.slug}/index.html`] = renderGuide(g);
  return out;
}

module.exports = { generate, guides };
