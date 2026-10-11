import { describe, it, expect } from 'vitest';
import { runExtractor } from './helpers.js';

const scripts = (id) => [
  'src/content/extractors/common.js',
  'src/content/extractors/generic.js',
  `src/content/extractors/${id}.js`,
];

// Fixtures reconstruct the JSON-LD shapes observed on live pages on 2026-10-09.
describe('generic extractor on live-observed JSON-LD quirks', () => {
  it('myntra: recovers a Product block with a raw newline in a string, and a capitalised AggregateRating with string values', () => {
    const p = runExtractor({ fixture: 'myntra-product.html', url: 'https://www.myntra.com/x/43102955/buy', scripts: scripts('myntra') });
    expect(p.title).toBe("Nike Revolution 7 Men's Road Running Shoes");
    expect(p.brand).toBe('Nike');
    // Myntra's mpn/sku is its own style id, not a manufacturer model.
    expect(p.model).toBe('');
    expect(p.price).toBe(2439);
    expect(p.rating).toBe(4.3);
    expect(p.ratingCount).toBe(1204);
  });

  it('croma: recovers a Product block with raw newlines and a stray trailing brace; empty rating stays null', () => {
    const p = runExtractor({ fixture: 'croma-product.html', url: 'https://www.croma.com/x/p/319897', scripts: scripts('croma') });
    expect(p.title).toBe('boAt Rockerz Prime 255Z');
    expect(p.brand).toBe('boAt');
    expect(p.price).toBe(1099);
    expect(p.rating).toBeNull();
    expect(p.ratingCount).toBeNull();
  });

  it('ajio: accepts a schema.org ProductGroup', () => {
    const p = runExtractor({ fixture: 'ajio-product.html', url: 'https://www.ajio.com/x/p/469815059_white', scripts: scripts('ajio') });
    expect(p.title).toBe('NIKE Men Winflo 12 Road Running Shoes');
    expect(p.brand).toBe('NIKE');
    expect(p.price).toBe(5397);
  });

  it('reliance digital: string brand and string rating values are read', () => {
    const p = runExtractor({ fixture: 'reliance-digital-product.html', url: 'https://www.reliancedigital.in/product/x', scripts: scripts('reliance-digital') });
    expect(p.brand).toBe('boAt');
    expect(p.price).toBe(879);
    expect(p.rating).toBe(2.4);
    expect(p.ratingCount).toBe(8);
  });

  it('falls back to the site price selector when JSON-LD has no offer', () => {
    const p = runExtractor({ fixture: 'croma-product.html', url: 'https://www.croma.com/x/p/1', scripts: scripts('croma') });
    expect(p.price).toBe(1099);
  });

  it('nykaa: string brand, numeric price, no rating', () => {
    const p = runExtractor({ fixture: 'nykaa-product.html', url: 'https://www.nykaa.com/x/p/6004', scripts: scripts('nykaa') });
    expect(p.brand).toBe('NIVEA');
    expect(p.price).toBe(363);
    expect(p.rating).toBeNull();
  });

  it('purplle: object brand, string price, numeric rating', () => {
    const p = runExtractor({ fixture: 'purplle-product.html', url: 'https://www.purplle.com/product/x', scripts: scripts('purplle') });
    expect(p.brand).toBe('Nivea');
    expect(p.price).toBe(543);
    expect(p.rating).toBe(4.4);
    expect(p.ratingCount).toBe(5329);
  });

  it('tira: no Product JSON-LD, so title comes from the h1 and price from the current-price element', () => {
    const p = runExtractor({ fixture: 'tira-product.html', url: 'https://www.tirabeauty.com/product/x', scripts: scripts('tira') });
    expect(p.title).toBe('Nivea Soft Light Moisturizer Cream (100ml)');
    expect(p.price).toBe(252);
  });
});
