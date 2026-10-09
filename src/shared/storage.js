const CACHE_PREFIX = 'pt_product_cache:';
const CACHE_TTL_MS = 10 * 60 * 1000;
const SETTINGS_KEY = 'pt_settings';

export async function cacheProduct(url, product) {
  await chrome.storage.local.set({ [CACHE_PREFIX + url]: { product, cachedAt: Date.now() } });
}

export async function getCachedProduct(url) {
  const key = CACHE_PREFIX + url;
  const result = await chrome.storage.local.get(key);
  const entry = result[key];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
  return entry.product;
}

export async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return result[SETTINGS_KEY] || { enabledRetailers: ['amazon', 'flipkart'] };
}

export async function setSettings(settings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}
