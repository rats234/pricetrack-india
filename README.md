# PriceTrack India

MV3 Chrome extension that checks whether a product you're viewing on an Indian
retailer is cheaper on another supported retailer. Client-side only — no backend,
no paid APIs, no external LLM.

Supports **Amazon India**, **Flipkart**, **Myntra**, **AJIO**, **Croma**, and
**Reliance Digital**. All six have now been checked against real, live pages
(Myntra, AJIO, Croma and Reliance Digital on 2026-10-09 — search-result
scraping and product-page extraction; see "Verified against live pages" below).
The popup click-through has not yet been run end to end on those four. See
`src/shared/retailer-registry.js` for the extension point.

The popup also has an **"Also check Google"** button that opens a normal Google
Shopping search tab for the current product. This is deliberately a plain,
user-clicked navigation, not something the extension reads or automates —
Google's bot-protection is stricter than the retailers' and automated querying
is against Google's own Terms of Service, so this stays outside the
scrape-and-compare pipeline on purpose.

## How it works

1. A content script (`src/content/extractors/`) runs on a supported product page and
   extracts a structured product signature (title, brand, model, GTIN if available,
   variant, price) by preferring JSON-LD `Product` schema and falling back to
   OpenGraph meta tags / DOM selectors.
2. Clicking "Find cheaper" in the popup sends that signature to the background
   service worker.
3. The service worker opens an inactive background tab per other enabled retailer,
   builds a search URL from the extracted product, and injects a small scraper
   function (`src/background/search-scrapers/`) to read candidate results off the
   real rendered search-results page, then closes the tab.
4. A deterministic, rule-based matching engine (`src/shared/matching-engine.js`)
   scores candidates: exact GTIN match or brand+model match is "confirmed"; textual
   similarity alone is capped at "possible match — verify." Nothing is scraped or
   searched unless the user explicitly clicks the button.
5. The popup renders a **comparison table**: every matched retailer plus the
   current page, each with price and star rating (when the page/card exposes
   one), sorted by price. The cheapest option is marked; a separate option is
   additionally flagged **"Best value"** when it costs only a little more
   (within ₹50 or 10% of the cheapest, whichever is larger) but has a
   meaningfully better rating (+0.2 stars or more) backed by enough reviews to
   trust (10+) — see `buildComparison()` in `matching-engine.js`. This never
   hides the cheapest option; it's a second, clearly-labeled callout alongside
   it, not a silent override.

## Local development

```
npm install
npm test
```

Load the extension in Chrome:

1. Visit `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this project folder.
4. Visit a product page on `www.amazon.in` or `www.flipkart.com`, open the
   extension popup, and click **Find cheaper**.
5. After editing source files, click the reload icon on the extension's card in
   `chrome://extensions`.

## Tests

`npm test` runs Vitest unit tests against saved HTML fixtures in `test/fixtures/` —
they never touch live retailer sites, so they're stable and raise no ToS concerns.
Covers the matching engine's scoring tiers and each extractor's JSON-LD/DOM parsing.

Live-site behavior (search-result scraping, CAPTCHA/block detection, actual page
markup) can only be verified manually against real retailer pages, since retailer
markup changes over time — see "Load unpacked" above.

## Verified end-to-end in a real loaded browser (2026-10-05)

Loaded unpacked in real Chrome via a live automation session, on a real Amazon.in
product page (boAt Bassheads 102): clicking "Find cheaper" correctly opened a
background Flipkart search tab, found the matching listing, closed the tab cleanly
(no leftover tabs), and showed "not cheaper" with the right color-coded confidence
badge (confirmed where price ties, possible-match yellow where the match came from
the fuzzy tier) — the full popup → background orchestrator → content-script
extraction → matching → popup-render pipeline, not just unit tests in isolation.

## Verified against live pages (2026-10-04 – 2026-10-05)

Both Amazon India and Flipkart extractors/scrapers were checked against real,
currently-live product and search pages (fetched directly, with scripts stripped
before parsing so no live site JS ever executes locally) and fixed based on what
real markup actually looks like, not assumptions:

- **Amazon.in has no JSON-LD `Product` schema and no `og:` meta tags at all** —
  confirmed empty on a real product page. Brand/model now come from the
  "Product information" detail table (`#productDetails_feature_div`, th/td pairs
  keyed "Brand Name" / "Model Number"), which is far more reliable than the old
  "Visit the X Store" byline-text guess.
- **Amazon's search-result cards render two `<h2>` elements** — a brand-label h2
  first, then the real title h2 (full text in its `aria-label`, wrapped in the
  product's own `<a>`). The original "first h2 inside an anchor" selector matched
  the brand label, not the title; fixed to pick the h2 carrying `aria-label`.
  Sponsored cards link through a `/sspa/click` redirect with no usable direct URL
  in the stripped href, so they're filtered out rather than returning dead links.
- **Flipkart's product page does carry JSON-LD** (name, brand, sku, color,
  price) — but previously wasn't reading `color` out of it; fixed. Flipkart's
  search-result class names (`_30jeq3` etc., commonly cited in older scraping
  guides) **do not exist on the current build** — replaced with a selector based
  on the product `<a>`'s `title` attribute (carries the full name) plus a
  leaf-element "₹\<amount\>" text pattern for price, which is more resistant to
  the next class-name shuffle.
- **Matching engine**: found that pure Jaccard similarity under-scored a real
  cross-retailer match where Flipkart's own listing had a typo ("Basshads" vs
  "Bassheads") and a much terser title than Amazon's — blended Jaccard with a
  containment/overlap score so this still surfaces as "possible match," not
  silently dropped. See the regression test in `test/matching-engine.test.js`.
- **Both retailers serve more than one frontend template.** Checking an apparel
  listing on each site (not just electronics) surfaced this directly: a Flipkart
  T-shirt page served `jsonLD` as a literal empty array `[]` — the title fallback
  was grabbing `og:title`/`document.title`, both of which carry an SEO suffix
  ("- Buy X Online at Best Prices in India | Flipkart.com"); fixed to prefer the
  page's `<h1>`, confirmed clean on both the JSON-LD and no-JSON-LD page types
  tested (regression test: `flipkart extractor > falls back to the clean <h1>
  title...`). Separately, an Amazon apparel page turned out to use a newer
  "voyager" product-details side-panel instead of the visible table my selector
  targets — title/brand/price still extracted correctly (brand via the
  `bylineInfo` fallback), but `model` comes back empty on that template rather
  than guessed. Both are graceful degradations, not crashes or wrong data, but
  worth knowing: DOM fallback coverage is necessarily partial across the real
  variety of page templates each retailer actually serves.
- **Flipkart's search-card layout also differs by category.** Earphones/beauty
  cards carry a `title` attribute on the product `<a>`; mobile-phone cards don't —
  the name only lives in the card's `<img alt="...">`. Fixed by trying both.
  Mobile cards also state RAM/storage as a separate `<li>` spec-bullet list
  *outside* the title/image (a card titled only "(Crimson Reserve, 128 GB)" shows
  "6 GB RAM | 128 GB ROM | ..." there) — the scraper now captures that into a
  `specs` field so the matching engine can see it at all for this category.
- **Matching engine: a real same-phone-line, different-RAM/storage false-positive,
  found via a live Amazon.in search.** Four "Redmi Note 15 SE 5G" listings with
  different RAM/storage/color all scored ~identically on title overlap (every word
  matches except the spec numbers) — `findCheaperAlternatives` picked the cheaper
  6GB-RAM listing and reported it as a "possible match, save ₹2,000" against an
  8GB-RAM source: a false claim comparing two different products. Added a
  spec-conflict check (`hasSpecConflict` in `matching-engine.js`) that rejects a
  candidate outright when a numeric capacity value (RAM/storage/battery/etc., by
  unit: GB/TB/MB/mAh/inch/cm/mm/ml/kg/W) conflicts between source and candidate.
  Getting this right took three iterations, each caught by testing against the
  *actual* live listings rather than synthetic examples: (1) matching unordered
  sets let one matching value (storage) mask a conflicting one (RAM) sharing the
  same unit — fixed to compare values positionally; (2) operating on
  already-tokenize()'d arrays silently missed "128 GB" (space, splits into two
  tokens) when the source wrote "128GB" (no space, one token) — fixed to
  regex-match on raw text directly; (3) the real listing's title restates "128 GB"
  that's *also* in its spec-bullet list, inflating one side's raw occurrence count
  and defeating a count-based check — fixed to compare *distinct* values per unit.
  All three are now locked in as regression tests in `test/matching-engine.test.js`.

## Live check of Myntra, AJIO, Croma, Reliance Digital (2026-10-09)

Run in a real Chrome session (chrome-devtools MCP, one search + one product
page per retailer, no bot protection encountered or bypassed). Initial run found
real bugs; all fixed and re-verified live:

- **Reliance Digital search URL was wrong** (the guessed `/search?q=` 404s). The
  real format is `/products?q=`; `retailer-registry.js` updated.
- **Myntra scraper reported every price as ~0.x** ("Rs. 2439" left a stray dot).
  Fixed in all scrapers; Myntra, AJIO and Reliance Digital now have dedicated
  scrapers (`src/background/search-scrapers/`) built on the real card markup,
  reading the current price rather than the struck-through MRP. Croma still uses
  the generic heuristic, which worked live.
- **Myntra and Croma emit invalid JSON-LD** (raw newlines in strings; a stray
  trailing `}` on Croma). `common.js` now parses tolerantly, and accepts
  `ProductGroup` (AJIO). Ratings given as strings or under a capitalised
  `AggregateRating` key are now read. Per-retailer current-price DOM fallbacks
  were added.
- Regression tests with fixtures reconstructed from the observed markup:
  `test/scrapers.test.js`, `test/extractors/generic-live-shapes.test.js`.

Live results after the fixes: search scraping returned correct titles, URLs and
current prices on all four. Product-page extraction was correct on Myntra, Croma
and Reliance Digital; on AJIO, price and brand are right.

## Known MVP limitations

- **Remaining gaps on the four newer retailers:**
  - AJIO and Croma product pages expose no rating in JSON-LD, so rating comes
    back empty (the AJIO page visibly shows one; its markup hasn't been mapped).
  - Croma search thumbnails are lazy-loaded and come back empty.
  - Reliance Digital and Croma search is fuzzy: it returns loosely related
    products (and some "currently unavailable" ones). The matching engine, not
    the scraper, filters these.
  - Myntra search can include sponsored cards with truncated titles.
  - Only one product and one search per retailer were checked; other categories
    may use different templates, as happened on Amazon and Flipkart.
  - The popup click-through (Find cheaper from a Myntra/AJIO/Croma/Reliance page)
    has not been run end to end; only the scraper and extractor code was run live.
- No price-drop notifications yet (needs `chrome.alarms` + `chrome.notifications`;
  only works while Chrome is running).
- Shown prices are listed prices; shipping/fees are not computed since that would
  require proceeding toward checkout, which this extension will never automate.
- The full click-through flow (toolbar popup → background tab orchestration →
  content-script extraction → matching → popup render) has been verified once,
  live, end-to-end (see above) — not yet across a wide range of products/categories
  in the real browser itself (most category testing so far was done by fetching
  real pages and running the extractor/scraper code offline against them, which
  validates the logic but not things like popup rendering quirks or timing).
