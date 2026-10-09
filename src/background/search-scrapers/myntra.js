// Myntra search results, checked against a live page (2026-10-09): each result
// is an li.product-base with .product-brand, .product-product and
// .product-discountedPrice (current price; MRP is .product-strike). Prices
// render as "Rs. 3436" and hrefs are relative with no leading slash.
// Must be fully self-contained — serialized and re-executed inside the tab.
export function myntraSearchScraper() {
  const results = [];
  if (/captcha|unusual traffic|access denied|robot check/i.test(document.title)) {
    return { results, blocked: true };
  }
  const parsePrice = (t) => Number((t || '').trim().replace(/^(₹|rs\.?)/i, '').replace(/[^0-9.]/g, ''));
  const seen = new Set();
  for (const card of document.querySelectorAll('li.product-base')) {
    if (results.length >= 8) break;
    const anchor = card.querySelector('a[href]');
    const href = anchor?.getAttribute('href');
    if (!href || seen.has(href)) continue;
    const brand = card.querySelector('.product-brand')?.textContent.trim() || '';
    const name = card.querySelector('.product-product')?.textContent.trim() || '';
    const title = `${brand} ${name}`.trim() || anchor.getAttribute('title') || card.querySelector('img')?.getAttribute('alt') || '';
    const price = parsePrice((card.querySelector('.product-discountedPrice') || card.querySelector('.product-price'))?.textContent);
    if (!title || !Number.isFinite(price) || price <= 0) continue;
    seen.add(href);
    const ratingText = card.querySelector('.product-ratingsContainer span')?.textContent;
    const rating = Number(ratingText);
    results.push({
      title,
      price,
      url: new URL(href, 'https://www.myntra.com/').href.split('?')[0],
      thumbnail: card.querySelector('img')?.getAttribute('src') || '',
      ...(Number.isFinite(rating) && rating > 0 && rating <= 5 ? { rating } : {}),
    });
  }
  return { results, blocked: false };
}
