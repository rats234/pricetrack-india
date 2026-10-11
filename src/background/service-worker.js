import { getOtherRetailers } from '../shared/retailer-registry.js';
import { buildComparison, rankCandidates } from '../shared/matching-engine.js';
import { buildSearchQueries } from '../shared/product-model.js';
import { amazonSearchScraper } from './search-scrapers/amazon.js';
import { flipkartSearchScraper } from './search-scrapers/flipkart.js';
import { genericSearchScraper } from './search-scrapers/generic.js';
import { myntraSearchScraper } from './search-scrapers/myntra.js';
import { ajioSearchScraper } from './search-scrapers/ajio.js';
import { relianceDigitalSearchScraper } from './search-scrapers/reliance-digital.js';
import { nykaaSearchScraper } from './search-scrapers/nykaa.js';
import { purplleSearchScraper } from './search-scrapers/purplle.js';
import { tiraSearchScraper } from './search-scrapers/tira.js';

const SCRAPERS = {
  amazon: amazonSearchScraper,
  flipkart: flipkartSearchScraper,
  // Checked against live pages on 2026-10-09 (search pages and product-page
  // JSON-LD only; end-to-end click-through not yet run) — see README.
  myntra: myntraSearchScraper,
  ajio: ajioSearchScraper,
  croma: genericSearchScraper,
  'reliance-digital': relianceDigitalSearchScraper,
  nykaa: nykaaSearchScraper,
  purplle: purplleSearchScraper,
  tira: tiraSearchScraper,
};
const TAB_LOAD_TIMEOUT_MS = 15000;
const RENDER_SETTLE_MS = 1200; // let SPA search results finish client-side rendering after "complete"

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'FIND_CHEAPER') {
    (async () => {
      try {
        const comparison = await findCheaper(message.product);
        sendResponse({ ok: true, comparison });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
    })();
    return true; // keep the message channel open for the async response
  }
});

async function findCheaper(sourceProduct) {
  const targets = getOtherRetailers(sourceProduct.retailerId);
  const candidatesByRetailer = {};

  // Retailers are searched in parallel (each in its own background tab) so the
  // wait doesn't grow with the number of supported sites.
  await Promise.all(
    targets.map(async (retailer) => {
      try {
        candidatesByRetailer[retailer.id] = await fetchCandidatesForRetailer(retailer, sourceProduct);
      } catch (err) {
        console.warn(`[PriceTrack] ${retailer.id} search failed`, err);
        candidatesByRetailer[retailer.id] = [];
      }
    }),
  );

  return buildComparison(sourceProduct, candidatesByRetailer);
}

// Tries the richest query first (everything known about the product); if that
// returns no acceptable match on this retailer, falls back to the compact one
// and merges the results. At most two page loads per retailer.
async function fetchCandidatesForRetailer(retailer, sourceProduct) {
  const queries = buildSearchQueries(sourceProduct);
  let merged = [];
  for (const query of queries) {
    const batch = await searchOnce(retailer, sourceProduct, query);
    const seenUrls = new Set(merged.map((c) => c.url));
    merged = merged.concat(batch.filter((c) => !seenUrls.has(c.url)));
    if (rankCandidates(sourceProduct, merged).length > 0) break;
  }
  return merged;
}

async function searchOnce(retailer, sourceProduct, query) {
  const scraperFn = SCRAPERS[retailer.id];
  if (!scraperFn) return [];

  const url = retailer.buildSearchUrl(sourceProduct, query);
  const tab = await chrome.tabs.create({ url, active: false });

  try {
    await waitForTabLoad(tab.id);
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scraperFn,
    });

    const { results = [], blocked = false } = injection?.result || {};
    if (blocked) {
      console.warn(`[PriceTrack] ${retailer.id} showed a block/CAPTCHA page; skipping`);
      return [];
    }
    return results.map((r) => ({ ...r, retailerId: retailer.id }));
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timed out waiting for the search results page to load'));
    }, TAB_LOAD_TIMEOUT_MS);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, RENDER_SETTLE_MS);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}
