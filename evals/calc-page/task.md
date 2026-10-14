Add a paint calculator page to this small static site.

- The formula is a pure function `litresNeeded(areaM2, coveragePerLitreM2, coats)` exported from `site/js/lib/paint.js`. It returns the litres of paint to buy: area divided by coverage, times coats, rounded up to the next 0.5 litre. It throws a `RangeError` for an area or coverage that is not a positive finite number, and for coats that is not a whole number of at least 1.
- The page is `site/paint-calculator/index.html`, linked from the home page, with a canonical URL `https://example.com/paint-calculator/`, a meta description of at most 160 characters, one `<h1>`, and at least 120 visible words (how to use it, how it is calculated, a worked example).
- Add the page to `site/sitemap.xml`. Add a unit test for the function in `tests/unit/`.
- `npm test` must pass. Do not change files you do not need to.
