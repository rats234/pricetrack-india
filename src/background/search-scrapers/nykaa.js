// Nykaa search results, checked against a live page (2026-10-11): each result is
// a .productWrapper (hashed css-* classes, so none are relied on) containing
// a[href*="/p/"], an img whose alt is the full title (the h2 is truncated with
// "..."), and a visually-hidden span "Regular price ₹645. Discounted price ₹529."
// or "Price ₹1200." for undiscounted items. Rating is aria-label "4 out of 5 star
// rating". Must be fully self-contained — serialized and re-executed inside the tab.
export function nykaaSearchScraper() {
  const results = [];
  if (/captcha|unusual traffic|access denied|robot check/i.test(document.title)) {
    return { results, blocked: true };
  }
  const parsePrice = (t) => Number((t || '').replace(/[^0-9.,]/g, '').replace(/,/g, ''));
  const seen = new Set();
  for (const card of document.querySelectorAll('.productWrapper')) {
    if (results.length >= 8) break;
    const anchor = card.querySelector('a[href*="/p/"]');
    const href = anchor?.getAttribute('href');
    if (!href) continue;
    const url = new URL(href, 'https://www.nykaa.com/').href.split('?')[0];
    if (seen.has(url)) continue;
    const title = card.querySelector('img')?.getAttribute('alt')?.trim() || card.querySelector('h2')?.textContent.trim() || '';
    const sr = [...card.querySelectorAll('span')].map((s) => s.textContent).find((t) => /^(Regular|Discounted|Price)\b/.test(t)) || '';
    const m = sr.match(/Discounted price\s*₹\s*([\d,.]+)/i) || sr.match(/Price\s*₹\s*([\d,.]+)/i);
    const price = parsePrice(m?.[1]);
    if (!title || !Number.isFinite(price) || price <= 0) continue;
    seen.add(url);
    const rating = Number((card.querySelector('[aria-label*="star rating"]')?.getAttribute('aria-label') || '').match(/^([\d.]+)/)?.[1]);
    results.push({
      title,
      price,
      url,
      thumbnail: card.querySelector('img')?.getAttribute('src') || '',
      ...(Number.isFinite(rating) && rating > 0 && rating <= 5 ? { rating } : {}),
    });
  }
  return { results, blocked: false };
}
