import { describe, it, expect } from 'vitest';
import { runExtractor } from './helpers.js';

describe('amazon extractor', () => {
  it('extracts product fields from JSON-LD + DOM', () => {
    const product = runExtractor({
      fixture: 'amazon-product.html',
      url: 'https://www.amazon.in/dp/TEST123',
      scripts: ['src/content/extractors/common.js', 'src/content/extractors/amazon.js'],
    });

    expect(product.retailerId).toBe('amazon');
    expect(product.title).toContain('Widget X200');
    expect(product.brand).toBe('Test Brand');
    expect(product.model).toBe('X200');
    expect(product.gtin).toBe('1234567890123');
    expect(product.price).toBe(19999);
    expect(product.currency).toBe('INR');
  });
});
