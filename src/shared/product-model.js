export function normalizeText(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenize(s) {
  const n = normalizeText(s);
  return n ? n.split(' ').filter(Boolean) : [];
}

export function createProductSignature({
  retailerId,
  url,
  title,
  brand,
  model,
  gtin,
  variant,
  price,
  currency,
}) {
  return {
    retailerId,
    url,
    title: title || '',
    brand: brand || '',
    model: model || '',
    gtin: gtin || '',
    variant: {
      color: variant?.color || '',
      size: variant?.size || '',
      storage: variant?.storage || '',
    },
    price: typeof price === 'number' ? price : null,
    currency: currency || 'INR',
    scrapedAt: Date.now(),
  };
}

export function buildSearchQuery(product) {
  const parts = [];
  if (product.brand) parts.push(product.brand);
  if (product.model) parts.push(product.model);
  if (!product.model && product.title) {
    // Use the title's own words (so "T-shirt" stays intact, unlike tokenize()),
    // dropping any brand words already added above.
    const brandWords = new Set(tokenize(product.brand));
    const words = product.title
      .split(/\s+/)
      .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
      .filter((w) => w && !brandWords.has(normalizeText(w)));
    parts.push(...words.slice(0, 7));
  }
  if (product.variant?.storage) parts.push(product.variant.storage);
  if (product.variant?.color) parts.push(product.variant.color);
  const q = parts.filter(Boolean).join(' ').trim();
  return q || product.title || '';
}

// Ordered search texts to try on another retailer, richest first: brand + model
// + the full title + every variant detail, then the compact brand/model/variant
// query. The richest text finds the exact item when the other site indexes it
// the same way; very long queries often return nothing on a different
// retailer, so the caller falls back to the next one when no match comes back.
export function buildSearchQueries(product) {
  const seen = new Set();
  const words = [];
  const add = (text) => {
    for (const raw of String(text || '').split(/\s+/)) {
      const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      const key = normalizeText(w);
      if (!w || !key || seen.has(key)) continue;
      seen.add(key);
      words.push(w);
    }
  };
  add(product.brand);
  add(product.model);
  add(product.title);
  add(product.variant?.storage);
  add(product.variant?.color);
  const full = words.slice(0, 16).join(' ').trim();
  const compact = buildSearchQuery(product);
  return [...new Set([full, compact].filter(Boolean))];
}
