import { describe, it, expect } from 'vitest';
import { runExtractor } from './helpers.js';

describe('flipkart extractor', () => {
  it('extracts product fields from JSON-LD + DOM fallback', () => {
    const product = runExtractor({
      fixture: 'flipkart-product.html',
      url: 'https://www.flipkart.com/test-product/p/itmTEST123',
      scripts: ['src/content/extractors/common.js', 'src/content/extractors/flipkart.js'],
    });

    expect(product.retailerId).toBe('flipkart');
    expect(product.title).toContain('Widget X200');
    expect(product.brand).toBe('Test Brand');
    expect(product.price).toBe(18999);
    expect(product.currency).toBe('INR');
  });

  it('falls back to the clean <h1> title when JSON-LD is empty, instead of the SEO-suffixed og:title', () => {
    // Real-world case: a live Flipkart apparel listing served `jsonLD` as an
    // empty array (confirmed via a direct fetch of the page), so title had to
    // come from somewhere other than Product schema. og:title/document.title
    // both carry "- Buy X Online at Best Prices in India | Flipkart.com" —
    // <h1> was the one source confirmed clean on that real page.
    const product = runExtractor({
      fixture: 'flipkart-no-jsonld.html',
      url: 'https://www.flipkart.com/test-tshirt/p/itmTEST456',
      scripts: ['src/content/extractors/common.js', 'src/content/extractors/flipkart.js'],
    });

    expect(product.title).toBe('Test Brand Men Round Neck Pure Cotton T-Shirt');
    expect(product.title).not.toContain('Buy');
    expect(product.title).not.toContain('Flipkart.com');
    expect(product.price).toBeNull();
  });
});
