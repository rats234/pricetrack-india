// Injected into a Flipkart search-results tab via chrome.scripting.executeScript.
// Must be fully self-contained (no closures over outer variables) — Chrome
// serializes this function's source and re-executes it inside the target tab.
//
// Flipkart's result-card class names are obfuscated and change between
// deployments (verified against live search-results markup — previous
// hardcoded classes like "_30jeq3" no longer exist), AND the card layout
// itself differs by category: on earphones/beauty-product searches, the
// product anchor carries a `title` attribute with the full name; on mobile
// phone searches, that same anchor has no `title` at all and the name only
// lives in its `<img alt="...">`. Both are tried. Prices render as a leaf
// element whose text is exactly "₹<amount>", with the current price
// appearing before any struck-through original price in document order.
export function flipkartSearchScraper() {
  const results = [];
  const blocked = /captcha|unusual traffic|access denied/i.test(document.title);
  if (blocked) return { results, blocked: true };

  const PRICE_RE = /^₹[\d,]+(\.\d+)?$/;
  const seenHrefs = new Set();

  function findFirstPriceText(container) {
    for (const el of container.querySelectorAll('div, span')) {
      if (el.children.length > 0) continue; // only leaf nodes carry the literal price text
      const text = el.textContent.trim();
      if (PRICE_RE.test(text)) return text;
    }
    return null;
  }

  const anchors = document.querySelectorAll('a[href*="/p/itm"]');
  for (const a of anchors) {
    if (results.length >= 8) break;

    const href = a.getAttribute('href');
    if (!href || seenHrefs.has(href)) continue;

    const title = a.getAttribute('title') || a.querySelector('img')?.getAttribute('alt');
    if (!title) continue;

    const container = a.closest('div[data-id]') || a.parentElement?.parentElement || a.parentElement;
    const priceText = container ? findFirstPriceText(container) : null;
    if (!priceText) continue;

    const price = Number(priceText.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(price) || price <= 0) continue;

    // Mobile-category cards list spec bullets (RAM/storage/battery/etc.) as
    // <li> items separate from the title/image — e.g. a card titled only
    // "(Crimson Reserve, 128 GB)" shows "6 GB RAM | 128 GB ROM | ..." here.
    // Without this, the matching engine can't see RAM at all for this
    // category and can't tell two different-RAM listings apart. Capped
    // length since some cards' <li> lists include unrelated UI text.
    const specs = container
      ? Array.from(container.querySelectorAll('li'))
          .map((li) => li.textContent.trim())
          .filter(Boolean)
          .join(' | ')
          .slice(0, 300)
      : '';

    // Rating value lives in an element whose id starts with "productRating_"
    // (a semantic, non-obfuscated prefix, unlike most of this page's classes);
    // review count is its next sibling's text, e.g. "6,740 Ratings & 601
    // Reviews" — both verified against a live search-results card. Scoping
    // to that specific sibling (not the whole card's flattened textContent)
    // matters: scanning the whole card concatenated an unrelated adjacent
    // digit onto the real count (e.g. "3" + "6,740" read back as "36740").
    const ratingEl = container?.querySelector('[id^="productRating_"]');
    const ratingMatch = ratingEl?.textContent?.match(/^([\d.]+)/);
    const rating = ratingMatch ? Number(ratingMatch[1]) : null;
    const reviewMatch = ratingEl?.nextElementSibling?.textContent?.match(/([\d,]+)/);
    const ratingCount = reviewMatch ? Number(reviewMatch[1].replace(/,/g, '')) : null;

    seenHrefs.add(href);
    results.push({
      title: title.trim(),
      specs,
      price,
      url: (() => {
        // pid/lid select the specific variant (e.g. 100 ml vs 600 ml); without
        // them Flipkart opens a different default variant of the same product.
        const u = new URL(href, location.origin);
        const keep = new URLSearchParams();
        for (const k of ['pid', 'lid']) if (u.searchParams.get(k)) keep.set(k, u.searchParams.get(k));
        const qs = keep.toString();
        return u.origin + u.pathname + (qs ? `?${qs}` : '');
      })(),
      thumbnail: container?.querySelector('img')?.getAttribute('src') || '',
      rating,
      ratingCount,
    });
  }

  return { results, blocked: false };
}
