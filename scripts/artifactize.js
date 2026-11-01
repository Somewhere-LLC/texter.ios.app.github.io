// Turn a standalone proposal HTML into an Artifact-publishable fragment:
// drop doctype/html/head/body wrappers, drop GA (blocked by the artifact CSP) and favicon links,
// keep <title>, <meta>, <link rel=stylesheet>, <style>, body content and scripts,
// and make site-relative links absolute so they work from claude.ai.
const fs = require('fs');
const [,, src, dest] = process.argv;
let s = fs.readFileSync(src, 'utf8');
s = s.replace(/<!doctype[^>]*>/i, '').replace(/<html[^>]*>|<\/html>/gi, '');
// GA snippet
s = s.replace(/<!--\s*Google Analytics 4\s*-->/i, '')
     .replace(/<script async src="https:\/\/www\.googletagmanager\.com[^"]*"><\/script>\s*/i, '')
     .replace(/<script>\s*window\.dataLayer[\s\S]*?<\/script>\s*/i, '');
s = s.replace(/<link[^>]*rel="(icon|apple-touch-icon)"[^>]*>\s*/gi, '');
// head/body wrappers
s = s.replace(/<head[^>]*>|<\/head>/gi, '').replace(/<body([^>]*)>/i, (m, attrs) => attrs.trim() ? `<div${attrs}>` : '').replace(/<\/body>/i, s.match(/<body[^>]*\S[^>]*>/i) ? '</div>' : '');
// meta viewport dup is harmless; canonical/hreflang fine. Make site-relative hrefs absolute.
s = s.replace(/(href|src)="\/(?!\/)([^"]*)"/g, '$1="https://texter.work/$2"')
     .replace(/href="(assets\/[^"]*)"/g, 'href="https://texter.work/$1"')
     .replace(/href="en\/"/g, 'href="https://texter.work/en/"');
// a body class carried over onto a div would break `body.x` selectors; keep it simple: prefer no attrs on body.
fs.writeFileSync(dest, s.trim() + '\n');
console.log('wrote', dest, s.length, 'bytes');
