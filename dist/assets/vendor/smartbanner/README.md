# smartbanner.js 1.21.1 (self-hosted)

- Upstream: https://github.com/ain/smartbanner.js (npm `smartbanner.js@1.21.1`)
- License: GPL-3.0 — see `LICENSE`
- Files: `smartbanner.min.js` / `smartbanner.min.css` are the unmodified upstream `dist/` builds.
  `src/` is the upstream corresponding source (JS + SCSS) for that exact version, included to satisfy GPL-3.0 §6 for the minified distribution.
  `package.json` records the upstream version.
- Why self-hosted: texter.work ships a strict Content-Security-Policy that allows scripts and styles only from `'self'`
  (plus Google Fonts / GA4). Loading from jsDelivr would require widening the CSP.
- Used by: `/index.html` and `/en/index.html` (Android smart banner; configured through `<meta name="smartbanner:*">`).
- To upgrade: replace all files here with the same-version `dist/`, `src/`, `LICENSE`, `package.json` from npm.
