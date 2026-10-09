// Fallback heuristic scraper (used by Croma, which was checked against a live
// results page and works with it). For every leaf element whose text is
// exactly "₹<amount>" / "Rs. <amount>", walk up a few ancestors to the nearest
// link and use that link's title/image-alt/text as the product name. Struck-
// through MRP leaves are skipped so the current price is what gets reported.
// Must be fully self-contained (no closures) — Chrome serializes this
// function's source and re-executes it inside the target tab.
export function genericSearchScraper() {
  const results = [];
  const blocked = /captcha|unusual traffic|access denied|robot check/i.test(document.title);
  if (blocked) return { results, blocked: true };

  const PRICE_RE = /^(₹|rs\.?\s?)[\d,]+(\.\d+)?$/i;
  const MAX_ANCESTOR_HOPS = 6;
  const seenHrefs = new Set();

  const MRP_SELECTOR = 'del, s, strike, [class*="strike"], [class*="orginal"], [class*="original"], [class*="mrp"]';
  const priceLeaves = Array.from(document.querySelectorAll('div, span, p, strong')).filter((el) => {
    if (el.children.length > 0) return false; // only leaf nodes carry the literal price text
    if (el.closest(MRP_SELECTOR)) return false;
    return PRICE_RE.test(el.textContent.trim());
  });

  for (const priceEl of priceLeaves) {
    if (results.length >= 8) break;

    let container = priceEl;
    let anchor = null;
    for (let hop = 0; hop < MAX_ANCESTOR_HOPS && container; hop++) {
      anchor = container.querySelector('a[href]');
      if (anchor) break;
      container = container.parentElement;
    }
    if (!anchor) continue;

    const href = anchor.getAttribute('href');
    if (!href || seenHrefs.has(href)) continue;

    // Image-only links come first on some cards, so look across every link in
    // the card (a heading's text wins) for one that actually names the product.
    let title = container.querySelector('h1, h2, h3, h4')?.textContent.trim() || '';
    if (!title) {
      for (const a of container.querySelectorAll('a[href]')) {
        title = a.getAttribute('title') || a.querySelector('img')?.getAttribute('alt') || a.textContent.trim();
        if (title) break;
      }
    }
    if (!title) continue;

    const price = Number(priceEl.textContent.trim().replace(/^(₹|rs\.?)/i, '').replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(price) || price <= 0) continue;

    seenHrefs.add(href);
    results.push({
      title: title.trim(),
      price,
      url: new URL(href, location.origin).href.split('?')[0],
      thumbnail: container.querySelector('img')?.getAttribute('src') || '',
    });
  }

  return { results, blocked: false };
}
