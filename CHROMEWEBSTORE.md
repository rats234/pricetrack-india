# Chrome Web Store Listing — PriceTrack India

> Last Updated: 2026-10-04

## Store Listing

**Extension Name** [REQUIRED]
PriceTrack India

**Short Description** [REQUIRED]
<!-- Max 132 characters. -->
Checks if the product you're viewing on Amazon.in or Flipkart is cheaper on the other site, with a clear confidence label.

**Detailed Description** [REQUIRED]
PriceTrack India checks whether the product you're currently viewing is cheaper on another supported Indian retailer.

Click "Find cheaper" on a product page and PriceTrack reads the product's details, searches the other supported retailer, and tells you whether it found the same item or just a similar one — labeled "Same product" or "Possible match, verify" so you always know how sure it is before you trust a price comparison. It shows the retailer, price, and savings, with a link straight to the listing.

To use it: open a product page on Amazon.in or Flipkart, click the PriceTrack icon, then click "Find cheaper." PriceTrack only looks things up when you click the button — it never runs in the background or on a timer.

PriceTrack doesn't collect, store remotely, or sell any personal data. Everything — the product it last looked at, your settings — stays on your own device. It never asks for your accounts, payment details, or browsing history, and it never completes a purchase on your behalf.

Found a bug or have feedback? [FILL IN: support contact/issue tracker URL]

**Category** [REQUIRED]
Shopping

**Single Purpose** [REQUIRED]
Checks whether a product on one supported Indian retailer site is available cheaper on another.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon128.png` (placeholder — replace with real branded artwork before submission) |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

### Screenshot Notes
Recommend capturing: (1) the popup on a real Amazon.in/Flipkart product page showing the extracted product + "Find cheaper" button, (2) the popup showing a "Same product" result with savings, (3) the popup showing a "Possible match — verify" result, to make the confidence-labeling behavior visible to reviewers and prospective users.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Caches the product extracted from the current page and stores the user's enabled-retailer settings locally with `chrome.storage.local`, so results aren't re-scraped on every popup open. Nothing is synced or transmitted off-device. |
| `scripting` | permissions | When the user clicks "Find cheaper," injects a small, read-only script into the background tab opened for the comparison retailer's own search-results page, to read the publicly visible titles and prices already rendered on that page. Never injected without that explicit click. |
| `tabs` | permissions | Needed to (a) find the active tab's id so the popup can ask its content script for the extracted product, and (b) open and then close the background tab used to search the other retailer during a "Find cheaper" lookup. |
| `https://www.amazon.in/*` | host_permissions | The content script that extracts product details (title, brand, price, etc.) runs on Amazon.in product pages, and background search tabs are opened on Amazon.in when Amazon is the comparison target. |
| `https://www.flipkart.com/*` | host_permissions | Same as above, for Flipkart product and search pages. |
| `https://www.myntra.com/*` | host_permissions | Same as above, for Myntra product and search pages. **Not yet verified against live Myntra pages** — see README "Known MVP limitations" before enabling this in the store listing. |
| `https://www.ajio.com/*` | host_permissions | Same as above, for AJIO. **Not yet verified against live AJIO pages.** |
| `https://www.croma.com/*` | host_permissions | Same as above, for Croma. **Not yet verified against live Croma pages.** |
| `https://www.reliancedigital.in/*` | host_permissions | Same as above, for Reliance Digital. **Not yet verified against live Reliance Digital pages**, including the search-URL format itself. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | — | No |
| Health info | No | No | — | No |
| Financial info | No | No | — | No |
| Authentication info | No | No | — | No |
| Personal communications | No | No | — | No |
| Location | No | No | — | No |
| Web history | No | No | — | No |
| User activity | No | No | — | No |
| Website content | Yes (product title/brand/price text visible on the current page) | No — stored only in local `chrome.storage.local`, never sent to any server | Compare the current product's price against other supported retailers | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
[FILL IN — must be a live, publicly accessible URL before submission. Since there's no data transmission to disclose beyond "nothing leaves the device," a one-paragraph policy hosted on GitHub Pages or similar is sufficient — see `.agents/skills/chrome-extensions/references/webstore/privacy-policy.md` for a template.]

## Distribution

**Visibility**: [FILL IN — Public / Unlisted / Private]
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED]
[FILL IN]

**Contact Email** [REQUIRED]
[FILL IN — this is displayed publicly on the store listing, so consider whether to use a dedicated address rather than a personal one]

**Support URL / Email** [RECOMMENDED]
[FILL IN]

**Homepage URL** [RECOMMENDED]
[FILL IN]

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.1.0 | 2026-10-04 | Initial MVP: Amazon India + Flipkart product extraction, cross-retailer search, rule-based same-product matching with confidence labeling. Not yet submitted. | Draft |
| 0.2.0 (unreleased) | 2026-10-05 | Added Myntra, AJIO, Croma, Reliance Digital via a generic JSON-LD extractor + generic price-heuristic scraper — **unverified against live pages**, pending manual testing. Fixed a real matching-engine bug (false "cheaper" result comparing different RAM/storage phone variants) and several Amazon/Flipkart extraction bugs found via live-page testing across electronics/apparel/beauty categories. | Draft |

## Review Notes

### Known Issues / Limitations
- Of the 6 retailers implemented, only Amazon India and Flipkart are verified against real, live pages. Myntra, AJIO, Croma, and Reliance Digital use a generic extractor/scraper and are **untested against real markup** (their bot protection blocked the same verification approach) — do not advertise these 4 in the public store listing copy until manually confirmed working. See README.md "Known MVP limitations" for specifics, including that Reliance Digital's search-URL format itself is an unconfirmed guess.
- No price-drop notifications yet.
- Shown prices are listed prices; shipping/fees aren't computed.
- Icons are placeholder artwork generated programmatically, not final branded assets — replace before submission.

### Rejection History
<!-- None yet — not submitted. -->
