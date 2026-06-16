# design.umutkorkmaz.net — UI Design Showcase

A static **UI Design Showcase** gallery that renders **112 UI design styles** across **13 categories**, live, from specs defined in `styles-data.js`. No build step, no backend, no framework scaffolding — it is an exhibit, not an application.

## What it is

- A single static site: 112 design styles, 13 categories.
- Each style renders a complete, content-rich page from a spec (palette, type tokens, typography, motif, copy) authored once in `styles-data.js`.
- Same components, 112 radically different design languages, in one continuous scroll.

## How it works (architecture)

- **`styles-data.js`** is the only hand-authored content source. It exports two globals:
  - `STYLES` — the 112 style specs (palette, typography, motif, copy).
  - `FONT_LINKS` — Google Fonts CSS URLs used across styles.
- **`index.html`** is a `.dc.html`-style template. It uses `{{ }}` bindings (e.g. `{{ total }}`, `{{ curLabel }}`, `{{ prev }}`, `{{ next }}`) that are resolved at runtime by the bundle.
- **`support.js`** is a **generated, opaque runtime bundle** produced from a `dc-runtime` (Design Composer) source. It is **not hand-maintained product code**. Treat it as a black-box exhibit artifact — do not hand-edit it.
- **Dependencies are vendored locally** under `/vendor/`, not loaded from any CDN:
  - `vendor/react.18.3.1.min.js` (React 18.3.1)
  - `vendor/react-dom.18.3.1.min.js` (ReactDOM 18.3.1)
  - `vendor/babel.7.26.4.min.js` (Babel standalone 7.26.4, if kept)
- No `unpkg`, no script CDN, no remote runtime.

## Hardening

- **Vendored dependencies** — `unpkg` removed entirely; React, ReactDOM, and Babel live under `/vendor/`.
- **Lazy per-style fonts** — fonts are loaded only as each style is viewed, not all up front.
- **SEO shell** — title, meta description, canonical URL, Open Graph tags, JSON-LD `ItemList`, plus a `<noscript>` static index so crawlers see the content without executing JavaScript.
- **Content-Security-Policy** header applied by nginx (see `CSP.header`).
- **gzip + long cache** for static assets.

## Suggested Content-Security-Policy

```
default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'self' https://umutkorkmaz.net https://*.umutkorkmaz.net
```

Notes:
- `'unsafe-inline'` appears on `style-src` **only** because the runtime injects inline styles. There is no way around this without regenerating the bundle.
- `script-src` stays locked to `'self'` — no inline or remote scripts.
- `frame-ancestors` restricts embedding to the `umutkorkmaz.net` family of sites.
- This exact line is written to `CSP.header`.

## Privacy

- **Google Fonts is still contacted** for non-Inter style fonts. Font loading is lazy (per style), but each non-Inter style triggers a request to `fonts.googleapis.com` / `fonts.gstatic.com`. This is inherent to a typography showcase and is documented as such — it cannot be removed without stripping the varied typefaces that are the point of the exhibit.
- **React and Babel are fully local** (vendored). No third-party script CDN is contacted at runtime.

## Deploy

- `rsync` the directory to `/var/www/design`.
- nginx serves it with the CSP header applied (the line in `CSP.header`).
- Files are **fingerprint-less**, so cache-busting is not required. Recommended cache policy:
  - HTML: short cache (e.g. minutes), since it is the entry point.
  - Static assets (`support.js`, `styles-data.js`, `/vendor/*`, images): long cache.

## Repo

- Mirror: https://github.com/UmutKorkmaz/design
