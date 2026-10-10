import { describe, it, expect } from 'vitest';
import { buildSearchQueries } from '../src/shared/product-model.js';
import { RETAILERS, getRetailer, getOtherRetailers } from '../src/shared/retailer-registry.js';

const product = {
  brand: 'boAt',
  model: 'Bassheads 102',
  title: 'boAt Bassheads 102 in Ear Wired Earphones with Mic(Charcoal Black)',
  variant: { color: 'Black', size: '', storage: '' },
};

describe('getRetailer', () => {
  it('finds a retailer by id', () => {
    expect(getRetailer('amazon')?.name).toBe('Amazon India');
    expect(getRetailer('flipkart')?.name).toBe('Flipkart');
  });

  it('returns null for an unknown id', () => {
    expect(getRetailer('not-a-real-retailer')).toBeNull();
  });
});

describe('getOtherRetailers', () => {
  it('excludes the source retailer', () => {
    const others = getOtherRetailers('amazon');
    expect(others.map((r) => r.id)).not.toContain('amazon');
    expect(others.map((r) => r.id)).toContain('flipkart');
  });

  it('returns every retailer when the source is not in the registry', () => {
    expect(getOtherRetailers('not-a-real-retailer')).toHaveLength(RETAILERS.length);
  });
});

describe('buildSearchUrl', () => {
  it('builds a well-formed, encoded Amazon search URL from the product signature', () => {
    const url = getRetailer('amazon').buildSearchUrl(product);
    expect(url.startsWith('https://www.amazon.in/s?k=')).toBe(true);
    const query = decodeURIComponent(new URL(url).searchParams.get('k'));
    expect(query).toContain('boAt');
    expect(query).toContain('Bassheads 102');
  });

  it('builds a well-formed, encoded Flipkart search URL from the product signature', () => {
    const url = getRetailer('flipkart').buildSearchUrl(product);
    expect(url.startsWith('https://www.flipkart.com/search?q=')).toBe(true);
    const query = decodeURIComponent(new URL(url).searchParams.get('q'));
    expect(query).toContain('boAt');
  });

  const unverifiedHosts = {
    myntra: 'www.myntra.com',
    ajio: 'www.ajio.com',
    croma: 'www.croma.com',
    'reliance-digital': 'www.reliancedigital.in',
  };

  it.each(Object.entries(unverifiedHosts))('builds a well-formed search URL for %s (unverified)', (id, host) => {
    const url = getRetailer(id).buildSearchUrl(product);
    expect(new URL(url).hostname).toBe(host);
    expect(url).toContain(encodeURIComponent('boAt'));
  });
});

describe('reliance digital search URL', () => {
  it('uses the live-confirmed /products?q= format (the /search?q= guess 404s)', () => {
    const url = getRetailer('reliance-digital').buildSearchUrl(product);
    expect(new URL(url).pathname).toBe('/products');
    expect(new URL(url).searchParams.get('q')).toContain('boAt');
  });
});

describe('buildSearchQuery', () => {
  it('does not repeat the brand or split hyphenated words', () => {
    const q = decodeURIComponent(
      new URL(
        getRetailer('flipkart').buildSearchUrl({
          brand: 'Roadster',
          model: '',
          title: 'Roadster Men Solid Round Neck T-shirt',
          variant: { color: '', size: '', storage: '' },
        }),
      ).searchParams.get('q'),
    );
    expect(q).toBe('Roadster Men Solid Round Neck T-shirt');
  });
});

describe('buildSearchQueries', () => {
  const phone = {
    brand: 'Redmi',
    model: 'Note 15 SE',
    title: 'Redmi Note 15 SE 5G (Crimson Reserve, 8GB RAM, 128GB Storage)',
    variant: { color: 'Crimson Reserve', size: '', storage: '128GB' },
  };

  it('puts everything known about the product in the first query, without repeating words', () => {
    const [full] = buildSearchQueries(phone);
    expect(full).toContain('Redmi');
    expect(full).toContain('Note');
    expect(full).toContain('8GB');
    expect(full).toContain('128GB');
    expect(full).toContain('Crimson');
    expect(full.split(' ').filter((w) => w.toLowerCase() === 'redmi')).toHaveLength(1);
  });

  it('falls back to a shorter compact query', () => {
    const queries = buildSearchQueries(phone);
    expect(queries).toHaveLength(2);
    expect(queries[1].length).toBeLessThan(queries[0].length);
  });

  it('uses a custom query in the retailer search URL', () => {
    const url = getRetailer('flipkart').buildSearchUrl(phone, 'custom words');
    expect(new URL(url).searchParams.get('q')).toBe('custom words');
  });
});
