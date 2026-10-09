// AJIO search results, checked against a live page (2026-10-09): each result is
// a .rilrtl-products-list__item containing an <a> (relative href), .brand,
// .nameCls, span.price (current price, inside a <strong>) and .orginal-price
// (MRP — sic). Must be fully self-contained — serialized and re-executed
// inside the tab.
export function ajioSearchScraper() {
  const results = [];
  if (/captcha|unusual traffic|access denied|robot check/i.test(document.title)) {
    return { results, blocked: true };
  }
  const parsePrice = (t) => Number((t || '').trim().replace(/^(₹|rs\.?)/i, '').replace(/[^0-9.]/g, ''));
  const seen = new Set();
  for (const card of document.querySelectorAll('.rilrtl-products-list__item')) {
    if (results.length >= 8) break;
    const anchor = card.querySelector('a[href]');
    const href = anchor?.getAttribute('href');
    if (!href || seen.has(href)) continue;
    const brand = card.querySelector('.brand')?.textContent.trim() || '';
    const name = card.querySelector('.nameCls')?.textContent.trim() || '';
    const title = `${brand} ${name}`.trim() || card.querySelector('img')?.getAttribute('alt') || '';
    const price = parsePrice((card.querySelector('span.price') || card.querySelector('.price'))?.textContent);
    if (!title || !Number.isFinite(price) || price <= 0) continue;
    seen.add(href);
    results.push({
      title,
      price,
      url: new URL(href, 'https://www.ajio.com/').href.split('?')[0],
      thumbnail: card.querySelector('img')?.getAttribute('src') || '',
    });
  }
  return { results, blocked: false };
}
