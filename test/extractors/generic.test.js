import { describe, it, expect } from 'vitest';
import { runExtractor } from './helpers.js';

// Proves the common.js + generic.js + per-retailer-wrapper wiring works
// mechanically. It does NOT prove this matches real Myntra/AJIO/Croma/
// Reliance Digital markup — those sites' bot protection blocked fetching a
// real page to check (see README "Known MVP limitations"), so this is only
// a synthetic JSON-LD fixture, unlike the Amazon/Flipkart tests.
describe('generic extractor (Myntra/AJIO/Croma/Reliance Digital)', () => {
  it.each([
    ['myntra', 'https://www.myntra.com/test-product/1'],
    ['ajio', 'https://www.ajio.com/p/test-product'],
    ['croma', 'https://www.croma.com/test-product/p/123'],
    ['reliance-digital', 'https://www.reliancedigital.in/test-product/p/123'],
  ])('extracts product fields from JSON-LD for %s', (retailerId, url) => {
    const product = runExtractor({
      fixture: 'generic-product.html',
      url,
      scripts: [
        'src/content/extractors/common.js',
        'src/content/extractors/generic.js',
        `src/content/extractors/${retailerId}.js`,
      ],
    });

    expect(product.retailerId).toBe(retailerId);
    expect(product.title).toBe('Test Brand Running Shoes');
    expect(product.brand).toBe('Test Brand');
    expect(product.variant.color).toBe('Blue');
    expect(product.price).toBe(2499);
    expect(product.currency).toBe('INR');
  });
});
