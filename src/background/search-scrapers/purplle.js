// Purplle search results, checked against a live page (2026-10-11): each result is
// an <app-listing-item> with a[href^="/product/"], .product-title (includes the
// size), the current price as the first "₹…" span in "p span" and the MRP in <s>.
// Rating is .star-rating. Prices render as "₹452"; hrefs are relative.
// Must be fully self-contained — serialized and re-executed inside the tab.
export function purplleSearchScraper() {
  const results = [];
  if (/captcha|unusual traffic|access denied|robot check/i.test(document.title)) {
    return { results, blocked: true };
  }
  const parsePrice = (t) => Number((t || '').trim().replace(/^(₹|rs\.?)/i, '').replace(/[^0-9.]/g, ''));
  const seen = new Set();
  for (const card of document.querySelectorAll('app-listing-item')) {
    if (results.length >= 8) break;
    const anchor = card.querySelector('a[href^="/product/"]');
    const href = anchor?.getAttribute('href');
    if (!href || seen.has(href)) continue;
    const title = (card.querySelector('.product-title')?.textContent || anchor.getAttribute('data-evlbl') || '').replace(/\s+/g, ' ').trim();
    const priceEl = [...card.querySelectorAll('p span')].find((s) => /^\s*₹/.test(s.textContent));
    const price = parsePrice(priceEl?.textContent);
    if (!title || !Number.isFinite(price) || price <= 0) continue;
    seen.add(href);
    const rating = Number(card.querySelector('.star-rating')?.textContent.trim().split(/\s/)[0]);
    results.push({
      title,
      price,
      url: new URL(href, 'https://www.purplle.com/').href.split('?')[0],
      thumbnail: card.querySelector('img')?.getAttribute('src') || '',
      ...(Number.isFinite(rating) && rating > 0 && rating <= 5 ? { rating } : {}),
    });
  }
  return { results, blocked: false };
}
