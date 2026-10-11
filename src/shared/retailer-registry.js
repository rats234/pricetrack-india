import { buildSearchQuery } from './product-model.js';

export const RETAILERS = [
  {
    id: 'amazon',
    name: 'Amazon India',
    hostPattern: /(^|\.)amazon\.in$/,
    buildSearchUrl(product, query = buildSearchQuery(product)) {
      return `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
    },
  },
  {
    id: 'flipkart',
    name: 'Flipkart',
    hostPattern: /(^|\.)flipkart\.com$/,
    buildSearchUrl(product, query = buildSearchQuery(product)) {
      return `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
    },
  },
  // Everything below is UNVERIFIED against live markup — see README "Known
  // MVP limitations". Search-URL formats come from real indexed examples
  // found via web search (not fetched directly, since these sites block
  // non-browser requests), except Reliance Digital's, which is an unconfirmed
  // best guess — expect it to be wrong until checked against a real page.
  {
    id: 'myntra',
    name: 'Myntra',
    hostPattern: /(^|\.)myntra\.com$/,
    buildSearchUrl(product, query = buildSearchQuery(product)) {
      const q = encodeURIComponent(query);
      return `https://www.myntra.com/${q}?rawQuery=${q}`;
    },
  },
  {
    id: 'ajio',
    name: 'AJIO',
    hostPattern: /(^|\.)ajio\.com$/,
    buildSearchUrl(product, query = buildSearchQuery(product)) {
      return `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`;
    },
  },
  {
    id: 'croma',
    name: 'Croma',
    hostPattern: /(^|\.)croma\.com$/,
    buildSearchUrl(product, query = buildSearchQuery(product)) {
      const q = encodeURIComponent(query);
      return `https://www.croma.com/searchB?q=${q}:relevance&text=${q}`;
    },
  },
  {
    id: 'reliance-digital',
    name: 'Reliance Digital',
    hostPattern: /(^|\.)reliancedigital\.in$/,
    buildSearchUrl(product, query = buildSearchQuery(product)) {
      // Confirmed live 2026-10-09 via the site's own search box. The earlier
      // guessed /search?q= format returns a "page not found" page.
      return `https://www.reliancedigital.in/products?q=${encodeURIComponent(query)}`;
    },
  },
  // Beauty/personal-care retailers, checked against live pages on 2026-10-11.
  {
    id: 'nykaa',
    name: 'Nykaa',
    hostPattern: /(^|\.)nykaa\.com$/,
    buildSearchUrl(product, query = buildSearchQuery(product)) {
      return `https://www.nykaa.com/search/result/?q=${encodeURIComponent(query)}&root=search&searchType=Manual`;
    },
  },
  {
    id: 'purplle',
    name: 'Purplle',
    hostPattern: /(^|\.)purplle\.com$/,
    buildSearchUrl(product, query = buildSearchQuery(product)) {
      // The site's own search box navigates with a double-encoded q (%2520 for
      // a space); that is the form reproduced here.
      return `https://www.purplle.com/search?q=${encodeURIComponent(encodeURIComponent(query))}`;
    },
  },
  {
    id: 'tira',
    name: 'Tira',
    hostPattern: /(^|\.)tirabeauty\.com$/,
    buildSearchUrl(product, query = buildSearchQuery(product)) {
      return `https://www.tirabeauty.com/products/?q=${encodeURIComponent(query)}`;
    },
  },
];

export function getRetailer(id) {
  return RETAILERS.find((r) => r.id === id) || null;
}

export function getOtherRetailers(sourceRetailerId) {
  return RETAILERS.filter((r) => r.id !== sourceRetailerId);
}
