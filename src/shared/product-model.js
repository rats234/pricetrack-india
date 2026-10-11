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

// Compact query: brand + model (or the product-name part of the title, first
// few words) + storage/colour. Used as the last-resort fallback search.
export function buildSearchQuery(product) {
  const base = product.model || productNameHead(product.title);
  const q = dedupeWords([product.brand, base, product.variant?.storage, product.variant?.color], 8)
    .replace(/\s+(?:in|of|and|the|a|an|to|on)$/i, '');
  return q || product.title || '';
}

// Cuts a marketing-heavy title down to the product name itself, e.g. "The True
// Therapy 10% Azelaic Acid Face Serum with Witch Hazel Extract for Acne ... 30 ml"
// -> "True Therapy 10% Azelaic Acid Face Serum". Stops at the first descriptive
// clause ("with ...", "for ...", a comma, dash or bracket).
function productNameHead(title) {
  const head = String(title || '')
    .split(/\s+(?:with|for|by|suitable|ideal|helps)\s+|[,|(\[]|\s[-–—]\s/i)[0]
    .trim();
  return head.replace(/^(the|a|an)\s+/i, '');
}

// Quantities/sizes anywhere in the title ("30 ml", "100 g", "pack of 2",
// "128GB") — the details that tell variants of one product apart, and that a
// truncated title would lose.
function extractQuantities(text) {
  const out = [];
  const re = /\b(\d+(?:\.\d+)?\s?(?:ml|l|ltr|g|gm|gms|kg|oz|gb|tb|mah|inch|cm|mm|pcs|tablets|capsules))\b|\b((?:pack|set|combo) of \d+)\b/gi;
  for (const m of String(text || '').matchAll(re)) out.push(m[1] || m[2]);
  return out;
}

function dedupeWords(parts, limit) {
  const seen = new Set();
  const words = [];
  for (const part of parts) {
    for (const raw of String(part || '').replace(/[()\[\],;|]/g, ' ').split(/\s+/)) {
      // keep a trailing % ("10%") — it identifies the strength
      const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, '');
      const key = normalizeText(w);
      if (!w || !key || seen.has(key)) continue;
      seen.add(key);
      words.push(w);
    }
  }
  return words.slice(0, limit).join(' ').trim();
}

// Ordered search texts to try on another retailer. Retailers' search engines
// choke on long marketing titles, so the first query is the product *name* plus
// every identifying detail (brand, model, strength, size, colour, storage); the
// second adds more of the title; the last is the bare brand + model/name.
export function buildSearchQueries(product) {
  const head = productNameHead(product.title);
  const qty = extractQuantities(product.title);
  const detailed = dedupeWords(
    [product.brand, product.model, head, ...qty, product.variant?.storage, product.variant?.color],
    14,
  );
  const wide = dedupeWords(
    [product.brand, product.model, product.title, product.variant?.storage, product.variant?.color],
    16,
  );
  const compact = buildSearchQuery(product);
  return [...new Set([detailed, wide, compact].filter(Boolean))];
}
