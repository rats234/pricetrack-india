import { describe, it, expect } from 'vitest';
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
