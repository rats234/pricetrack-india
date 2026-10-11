// Tira search results, checked against a live page (2026-10-11): CSS-module
// classes ("gridItem--hash"), so the stable prefix is matched. Each card has
// a[href^="/product/"], [class*="productBrand--"], h3[class*="productName--"],
// p.discount-price (current price, "₹1,150" with commas) and p.actual-price (MRP,
// absent when undiscounted). "Get for ₹…" is a coupon price and is ignored.
// Must be fully self-contained — serialized and re-executed inside the tab.
export function tiraSearchScraper() {
  const results = [];
  if (/captcha|unusual traffic|access denied|robot check/i.test(document.title)) {
    return { results, blocked: true };
  }
  const parsePrice = (t) => Number((t || '').replace(/[^0-9.]/g, ''));
  const seen = new Set();
  for (const card of document.querySelectorAll('[class*="gridItem--"]')) {
    if (results.length >= 8) break;
    const anchor = card.querySelector('a[href^="/product/"]');
    const href = anchor?.getAttribute('href');
    if (!href || seen.has(href)) continue;
    const brand = card.querySelector('[class*="productBrand--"]')?.textContent.trim() || '';
    const name = card.querySelector('[class*="productName--"]')?.textContent.trim() || '';
    const title = name || card.querySelector('img[class*="fyImg"]')?.getAttribute('alt') || '';
    const price = parsePrice(card.querySelector('p.discount-price')?.textContent);
    if (!title || !Number.isFinite(price) || price <= 0) continue;
    seen.add(href);
    const rating = Number(card.querySelector('[class*="avgRating--"]')?.textContent.trim());
    results.push({
      title: brand && !title.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${title}` : title,
      price,
      url: new URL(href, 'https://www.tirabeauty.com/').href.split('?')[0],
      thumbnail: card.querySelector('img[class*="fyImg"]')?.getAttribute('src') || '',
      ...(Number.isFinite(rating) && rating > 0 && rating <= 5 ? { rating } : {}),
    });
  }
  return { results, blocked: false };
}
