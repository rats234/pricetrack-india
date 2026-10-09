// Reliance Digital search results, checked against a live page (2026-10-09):
// each result is a div.product-card with a.details-container (href),
// .product-card-title, div.price (current) and div.mrp-amount. A leading
// .auto-tag ("NEWLY_LAUNCHED" etc.) pollutes textContent, so the title is
// read from .product-card-title only. The site's search is fuzzy and returns
// unrelated products; the matching engine is what filters those out.
// Must be fully self-contained — serialized and re-executed inside the tab.
export function relianceDigitalSearchScraper() {
  const results = [];
  if (/captcha|unusual traffic|access denied|robot check/i.test(document.title)) {
    return { results, blocked: true };
  }
  const parsePrice = (t) => Number((t || '').trim().replace(/^(₹|rs\.?)/i, '').replace(/[^0-9.]/g, ''));
  const seen = new Set();
  for (const card of document.querySelectorAll('div.product-card')) {
    if (results.length >= 8) break;
    const anchor = card.querySelector('a.details-container[href]') || card.querySelector('a[href]');
    const href = anchor?.getAttribute('href');
    if (!href || seen.has(href.split('?')[0])) continue;
    const title = card.querySelector('.product-card-title')?.textContent.trim() || '';
    const price = parsePrice(card.querySelector('div.price')?.textContent);
    if (!title || !Number.isFinite(price) || price <= 0) continue;
    seen.add(href.split('?')[0]);
    results.push({
      title,
      price,
      url: new URL(href, 'https://www.reliancedigital.in/').href.split('?')[0],
      thumbnail: card.querySelector('img')?.getAttribute('src') || '',
    });
  }
  return { results, blocked: false };
}
