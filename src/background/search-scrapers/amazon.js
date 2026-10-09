// Injected into an Amazon search-results tab via chrome.scripting.executeScript.
// Must be fully self-contained (no closures over outer variables) — Chrome
// serializes this function's source and re-executes it inside the target tab.
//
// Amazon.in renders TWO <h2> elements per result card: a brand-label h2 first,
// then the actual title h2 (carrying the full untruncated text in aria-label),
// which is itself wrapped in the product's <a> link — verified against live
// search-results markup, where a naive "first h2 inside an anchor" selector
// matches the brand label instead of the title.
export function amazonSearchScraper() {
  const results = [];
  const blocked =
    /captcha|robot check|unusual traffic/i.test(document.title) ||
    document.querySelector('form[action*="captcha"], img[src*="captcha"]') != null;
  if (blocked) return { results, blocked: true };

  const cards = document.querySelectorAll('div[data-component-type="s-search-result"]');
  for (const card of cards) {
    if (results.length >= 8) break;

    const h2s = card.querySelectorAll('h2');
    const titleH2 = Array.from(h2s).find((h) => h.hasAttribute('aria-label')) || h2s[h2s.length - 1];
    if (!titleH2) continue;

    const linkEl = titleH2.closest('a') || card.querySelector('a.a-link-normal.s-line-clamp-3, a.a-link-normal.s-link-style');
    const priceEl = card.querySelector('.a-price .a-offscreen');
    if (!linkEl || !priceEl) continue;

    const href = linkEl.getAttribute('href');
    // Sponsored cards link through a /sspa/click redirect whose real destination
    // is URL-encoded in a query param, not a usable direct product link — skip
    // them rather than send the user to a stripped tracking URL.
    if (href && href.startsWith('/sspa/click')) continue;

    const price = Number(priceEl.textContent.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(price) || price <= 0) continue;

    const title = titleH2.getAttribute('aria-label') || titleH2.textContent.trim();

    // Rating text lives in a ".a-icon-alt" span ("4.0 out of 5 stars");
    // review count in a link whose aria-label ends in " ratings" — both
    // verified against a live search-results card.
    const ratingText = card.querySelector('.a-icon-alt')?.textContent || '';
    const ratingMatch = ratingText.match(/([\d.]+)\s*out of/);
    const rating = ratingMatch ? Number(ratingMatch[1]) : null;
    const reviewLink = Array.from(card.querySelectorAll('a[aria-label]')).find((a) => /ratings?$/i.test(a.getAttribute('aria-label') || ''));
    const reviewMatch = reviewLink?.getAttribute('aria-label')?.match(/([\d,]+)/);
    const ratingCount = reviewMatch ? Number(reviewMatch[1].replace(/,/g, '')) : null;

    results.push({
      title: title.trim(),
      price,
      url: href ? new URL(href, location.origin).href.split('?')[0] : location.href,
      thumbnail: card.querySelector('img')?.getAttribute('src') || '',
      rating,
      ratingCount,
    });
  }

  return { results, blocked: false };
}
