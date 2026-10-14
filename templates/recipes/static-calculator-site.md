---
id: R-static-calculator-site
title: Add a calculator page to a static niche site
kind: feature
stack:
  - node@20
tags:
  - calculator
  - static
  - seo
  - html
status: CONFIRMED
source: Minntooos/Compounding-Loop templates/static-site, five live sites built unattended in round 1
uses: 0
passes: 0
updated: 2026-10-14
---

## When to use

A static site (plain HTML, CSS and ES modules, no build step) needs one more tool page: a calculator or converter that must be correct and rank for one search intent. Not for sites with a build step or a backend.

## Steps

1. Put the formula in a pure function in `site/js/lib/<topic>.js`, no DOM access. Proof: `npm run unit` imports it.
2. Write `tests/unit/<topic>.test.mjs` (`node:test`) with at least two reference cases from an authoritative source (URL in a comment above each) and the edges: zero, empty, impossible input, both unit directions. Proof: `npm run unit`.
3. Make the page `site/<slug>/index.html`, slug lowercase and keyword-first, with `<title>`, a meta description of at most 160 characters, one `<h1>`, a canonical on the site's own host, and JSON-LD. Proof: `npm run check`.
4. Add the page script as an external module (no inline script or handler); show a clear message for bad input, never `NaN`, `Infinity` or `undefined`. Write results with `textContent`. Proof: `npm run check`.
5. Write 300+ original visible words: how to use it, how it is calculated, a worked example, a short FAQ. Proof: `npm run check`.
6. Link the page from the home page and from related pages, and add its URL to `site/sitemap.xml`. Proof: `npm run check`.
7. Run everything and fix what the messages say. Proof: `npm test`.

## Traps

- A test that re-derives your own formula proves nothing; take the cases from a source (K-0003 in the starter kit).
- Never change a published URL; add a 301 redirect to both `netlify.toml` and `vercel.json` if you must.
- A sitemap entry is easy to forget; the check fails without it.
- Inline scripts, `innerHTML` with user input and CDN scripts break the CSP; use modules and `textContent`.
- Pages that differ by one swapped word are doorway pages; the check fails above 60% shared phrasing.
- Meta descriptions over 160 characters are cut in results.

## Checks

- `npm run check`
- `npm run unit`
- `npm test`

## Start from

- `templates/static-site` in the Compounding Loop package (`loop new` copies it): `site/`, `scripts/check.mjs`, `tests/`.
