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
    parts.push(...tokenize(product.title).slice(0, 6));
  }
  if (product.variant?.storage) parts.push(product.variant.storage);
  if (product.variant?.color) parts.push(product.variant.color);
  const q = parts.filter(Boolean).join(' ').trim();
  return q || product.title || '';
}
