(function () {
  function normalizeText(s) {
    if (!s) return '';
    return s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function getMeta(attr, value) {
    const el = document.querySelector(`meta[${attr}="${value}"]`);
    return el ? el.getAttribute('content') : null;
  }

  function parsePrice(raw) {
    if (raw == null) return null;
    const num = Number(String(raw).replace(/[^0-9.]/g, ''));
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  function toNumber(raw) {
    if (raw == null || raw === '') return null;
    const num = Number(String(raw).replace(/[^0-9.]/g, ''));
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  function hasType(node, wanted) {
    const type = node['@type'];
    return type === wanted || (Array.isArray(type) && type.includes(wanted));
  }

  function collectProducts(node, out) {
    if (!node || typeof node !== 'object') return;
    // ProductGroup (AJIO) carries the same name/brand/offers shape as Product.
    if (hasType(node, 'Product') || hasType(node, 'ProductGroup')) out.push(node);
    if (Array.isArray(node['@graph'])) {
      for (const child of node['@graph']) collectProducts(child, out);
    }
  }

  // Returns the first balanced top-level {...} or [...] in text, string-aware.
  // Needed because some sites (observed on Croma) emit a stray trailing "}".
  function firstBalancedJson(text) {
    const start = text.search(/[\[{]/);
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  // Strict parse first; on failure, retry tolerating raw control characters
  // (literal newlines inside string values — observed on Myntra and Croma)
  // and trailing garbage after the JSON value.
  function parseJsonLd(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      // fall through to the tolerant path
    }
    const cleaned = text.replace(/[\u0000-\u001f]+/g, ' ');
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      const balanced = firstBalancedJson(cleaned);
      return balanced ? JSON.parse(balanced) : null;
    }
  }

  function getJsonLdProducts() {
    const nodes = document.querySelectorAll('script[type="application/ld+json"]');
    const products = [];
    for (const node of nodes) {
      try {
        const data = parseJsonLd(node.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) collectProducts(item, products);
      } catch (e) {
        // Unrecoverable JSON-LD on the page — skip it and rely on DOM/meta fallbacks.
      }
    }
    return products;
  }

  window.__priceTrackCommon = { normalizeText, getMeta, parsePrice, toNumber, getJsonLdProducts };
})();
