#!/usr/bin/env node
/*
 * gen-seo.cjs — builds static crawler/no-JS content + JSON-LD for the
 * UI Design Showcase and bakes them into index.html between marker comments.
 *
 * The showcase body is hydrated by JS (DC templating engine), so crawlers and
 * no-JS visitors see almost nothing. This script regenerates the real-text
 * <noscript>, a visually-hidden SEO section, and a CollectionPage ItemList
 * JSON-LD so all 112 style names are indexable.
 *
 * Usage:  node gen-seo.cjs
 * Reads:  styles-data.js (as text; regex-extracts STYLES)
 * Writes: index.html (between <!-- SEO-* --> markers), idempotently.
 *
 * Constraints honored:
 *  - Only writes index.html + (this file). Never touches support.js / styles-data.js.
 *  - Static blocks sit OUTSIDE <x-dc> so the templating engine ignores them.
 *  - No {{ }} template syntax inside the generated blocks.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const DATA_PATH = path.join(DIR, 'styles-data.js');
const HTML_PATH = path.join(DIR, 'index.html');

const CANONICAL = 'https://design.umutkorkmaz.net/';
const SITE_NAME = 'Umut Korkmaz — UI Design Showcase';
const TITLE = 'UI Design Showcase — 112 web design languages in one scroll | Umut Korkmaz';
const OG_TITLE = 'UI Design Showcase — 112 web design languages';
const DESCRIPTION =
  'A scrolling gallery where 112 web design languages — from brutalist to glassmorphism, synthwave to Swiss — each render a complete, content-rich website.';
const OG_DESCRIPTION =
  'A scrolling gallery where every design language from brutalist to Swiss renders a complete website. 112 styles, one endless scroll.';
const AUTHOR = 'Umut Korkmaz';

/** Extract the STYLES array from styles-data.js (single-line JSON in the file). */
function loadStyles() {
  const src = fs.readFileSync(DATA_PATH, 'utf8');
  const m = src.match(/export const STYLES = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('Could not find `export const STYLES = [...]` in styles-data.js');
  let arr;
  try {
    arr = JSON.parse(m[1]);
  } catch (e) {
    throw new Error('STYLES assignment is not valid JSON: ' + e.message);
  }
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('STYLES parsed but is empty or not an array');
  }
  // Validate required keys exist.
  arr.forEach((s, i) => {
    if (typeof s.name !== 'string' || typeof s.category !== 'string' ||
        typeof s.slug !== 'string' || typeof s.key !== 'string') {
      throw new Error(`STYLES[${i}] missing required fields (name/category/slug/key)`);
    }
  });
  return arr;
}

/** Group by category, preserving first-appearance order. */
function groupByCategory(styles) {
  const order = [];
  const map = new Map();
  styles.forEach((s) => {
    if (!map.has(s.category)) {
      map.set(s.category, []);
      order.push(s.category);
    }
    map.get(s.category).push(s);
  });
  return order.map((cat) => ({ category: cat, styles: map.get(cat) }));
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** <noscript>: real text, all 112 names grouped by category. */
function buildNoscript(groups) {
  const parts = [];
  parts.push('  <noscript>');
  parts.push('    <h1>UI Design Showcase — 112 web design languages</h1>');
  parts.push(
    '    <p>By ' + AUTHOR + '. A scrolling gallery where every web design language — from brutalist ' +
    'to glassmorphism, synthwave to Swiss — renders a complete, content-rich website. ' +
    'JavaScript is required to browse the interactive gallery; the full list of styles ' +
    'and categories is below.</p>'
  );
  groups.forEach((g) => {
    parts.push('    <h2>' + esc(g.category) + ' (' + g.styles.length + ')</h2>');
    parts.push('    <p>' + g.styles.map((s) => esc(s.name) + ' (' + esc(s.slug) + ')').join(', ') + '</p>');
  });
  parts.push('  </noscript>');
  return parts.join('\n');
}

/** Visually-hidden section: same real text for JS-capable crawlers. */
function buildHidden(groups) {
  const parts = [];
  parts.push('  <section aria-hidden="true" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">');
  parts.push('    <h1>' + esc(TITLE.split('|')[0].trim()) + ' by ' + esc(AUTHOR) + '</h1>');
  parts.push(
    '    <p>' + esc(DESCRIPTION) + ' ' + groups.length + ' categories: ' +
    groups.map((g) => esc(g.category)).join(', ') + '.</p>'
  );
  groups.forEach((g) => {
    parts.push('    <h2>' + esc(g.category) + '</h2>');
    parts.push('    <p>' + g.styles.map((s) => esc(s.name) + ' (' + esc(s.slug) + ')').join(', ') + '</p>');
  });
  parts.push('  </section>');
  return parts.join('\n');
}

/** CollectionPage with an ItemList of all 112 styles (Schema.org JSON-LD). */
function buildJsonLd(groups, total) {
  // Flat list preserving the source array order (position = index+1).
  const items = [];
  groups.forEach((g) => {
    g.styles.forEach((s) => {
      items.push({
        '@type': 'ListItem',
        position: items.length + 1,
        name: s.name,
        // Category carries real meaning; expose via description + url anchor.
        description: s.category + ' design language',
        url: CANONICAL + '#ds-' + encodeURIComponent(s.key),
      });
    });
  });

  const doc = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: OG_TITLE,
    description: OG_DESCRIPTION,
    url: CANONICAL,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: CANONICAL },
    author: { '@type': 'Person', name: AUTHOR },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: items,
    },
  };
  return '  <script type="application/ld+json">' + JSON.stringify(doc) + '</script>';
}

/** Replace content between markers in html, inserting the markers if absent. */
function replaceBetween(html, startMarker, endMarker, replacement) {
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Existing block: replace what is between (markers preserved).
    const afterStart = startIdx + startMarker.length;
    return html.slice(0, afterStart) + '\n' + replacement + '\n' + html.slice(endIdx);
  }
  return null; // caller handles insertion
}

function injectStaticBlock(html, block) {
  const startMarker = '<!-- SEO-NOSCRIPT-START -->';
  const endMarker = '<!-- SEO-NOSCRIPT-END -->';
  const replaced = replaceBetween(html, startMarker, endMarker, block);
  if (replaced !== null) return replaced;
  // First-run insertion: place the block right after <body>.
  return html.replace(
    /(<body[^>]*>)/,
    '$1\n' + startMarker + '\n' + block + '\n' + endMarker
  );
}

function injectHiddenBlock(html, block) {
  // The hidden section lives immediately after the noscript block (SEO-NOSCRIPT-END).
  const anchor = '<!-- SEO-NOSCRIPT-END -->';
  const startMarker = '<!-- SEO-HIDDEN-START -->';
  const endMarker = '<!-- SEO-HIDDEN-END -->';
  const replaced = replaceBetween(html, startMarker, endMarker, block);
  if (replaced !== null) return replaced;
  // First-run: insert after the noscript block.
  const idx = html.indexOf(anchor);
  if (idx === -1) {
    // Fallback: right after <body>.
    return html.replace(/(<body[^>]*>)/, '$1\n' + startMarker + '\n' + block + '\n' + endMarker);
  }
  const insertPos = idx + anchor.length;
  return html.slice(0, insertPos) + '\n' + startMarker + '\n' + block + '\n' + endMarker + html.slice(insertPos);
}

function injectJsonLd(html, block) {
  const startMarker = '<!-- SEO-JSONLD-START -->';
  const endMarker = '<!-- SEO-JSONLD-END -->';
  const replaced = replaceBetween(html, startMarker, endMarker, block);
  if (replaced !== null) return replaced;
  // First-run: insert right after the hidden block (SEO-HIDDEN-END).
  const anchor = '<!-- SEO-HIDDEN-END -->';
  const idx = html.indexOf(anchor);
  const insertPos = idx === -1 ? null : idx + anchor.length;
  if (insertPos === null) {
    return html.replace(/(<body[^>]*>)/, '$1\n' + startMarker + '\n' + block + '\n' + endMarker);
  }
  return html.slice(0, insertPos) + '\n' + startMarker + '\n' + block + '\n' + endMarker + html.slice(insertPos);
}

function main() {
  const styles = loadStyles();
  const total = styles.length;
  const groups = groupByCategory(styles);

  const noscript = buildNoscript(groups);
  const hidden = buildHidden(groups);
  const jsonld = buildJsonLd(groups, total);

  let html = fs.readFileSync(HTML_PATH, 'utf8');
  html = injectStaticBlock(html, noscript);
  html = injectHiddenBlock(html, hidden);
  html = injectJsonLd(html, jsonld);
  fs.writeFileSync(HTML_PATH, html);

  // Report to stdout for reproducibility / debugging.
  const catSummary = groups.map((g) => g.category + '=' + g.styles.length).join(', ');
  console.log('[gen-seo] styles=' + total + ' categories=' + groups.length);
  console.log('[gen-seo] groups: ' + catSummary);
  console.log('[gen-seo] noscript bytes=' + noscript.length +
              ', hidden bytes=' + hidden.length + ', jsonld bytes=' + jsonld.length);
  console.log('[gen-seo] wrote ' + HTML_PATH);
}

main();
