import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { genericSearchScraper } from '../src/background/search-scrapers/generic.js';
import { myntraSearchScraper } from '../src/background/search-scrapers/myntra.js';
import { ajioSearchScraper } from '../src/background/search-scrapers/ajio.js';
import { relianceDigitalSearchScraper } from '../src/background/search-scrapers/reliance-digital.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

// Re-executes the scraper from its serialized source inside the page, the same
// way chrome.scripting.executeScript does — this also proves it is self-contained.
function runScraper(fn, fixture, url) {
  const html = readFileSync(path.join(fixtures, fixture), 'utf8');
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  return dom.window.eval(`(${fn.toString()})()`);
}

// Fixtures are reconstructed from the live markup structure observed on
// 2026-10-09, not saved copies of the full pages.
describe('retailer search scrapers', () => {
  it('myntra: parses "Rs. N" prices correctly and uses the current price, not the MRP', () => {
    const { results } = runScraper(myntraSearchScraper, 'myntra-search.html', 'https://www.myntra.com/nike');
    expect(results.map((r) => r.price)).toEqual([2439, 3436]);
    expect(results[0].title).toBe('Nike Men Revolution 7 Running Shoes');
    expect(results[0].url).toBe('https://www.myntra.com/sports-shoes/nike/nike-revolution-7/43102955/buy');
    expect(results[0].rating).toBe(4.3);
  });

  it('ajio: finds results and reports the current price, not the MRP', () => {
    const { results } = runScraper(ajioSearchScraper, 'ajio-search.html', 'https://www.ajio.com/search/?text=nike');
    expect(results.map((r) => r.price)).toEqual([5397, 4199]);
    expect(results[0].title).toBe('NIKE Men Winflo 12 Road Running Shoes');
    expect(results[0].url).toBe('https://www.ajio.com/nike-men-winflo-12-road-running-shoes/p/469815059_white');
  });

  it('reliance digital: title comes from the card title, not tags or icon alts', () => {
    const { results } = runScraper(relianceDigitalSearchScraper, 'reliance-digital-search.html', 'https://www.reliancedigital.in/products?q=boat');
    expect(results.map((r) => r.title)).toEqual(['boAt Rockerz 200 Wireless Neckband', 'Sony MDR-EX255AP Wired Earphones']);
    expect(results.map((r) => r.price)).toEqual([879, 1490]);
    expect(results[0].url).toBe('https://www.reliancedigital.in/product/boat-rockerz-200-neckband-abc123');
  });

  it('croma (generic heuristic): returns current prices with correct URLs', () => {
    const { results } = runScraper(genericSearchScraper, 'croma-search.html', 'https://www.croma.com/searchB?q=boat');
    expect(results.map((r) => r.price)).toEqual([1099, 1199]);
    expect(results[0].url).toBe('https://www.croma.com/boat-rockerz-prime-255z/p/319897');
  });

  it('generic heuristic parses "Rs. N" without leaving a stray dot', () => {
    const { results } = runScraper(genericSearchScraper, 'myntra-search.html', 'https://www.myntra.com/nike');
    expect(results.map((r) => r.price)).toEqual([2439, 3436]);
  });
});
