import { getRetailer } from '../shared/retailer-registry.js';
import { buildSearchQuery, buildSearchQueries } from '../shared/product-model.js';

const statusEl = document.getElementById('status');
const findBtn = document.getElementById('find-cheaper-btn');
const googleBtn = document.getElementById('google-btn');
const resultsEl = document.getElementById('results');

let currentProduct = null;

init();

async function init() {
  const tab = await getActiveTab();
  if (!tab) {
    statusEl.textContent = 'No active tab.';
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PRODUCT' });
    currentProduct = response?.product || null;
  } catch {
    currentProduct = null; // no content script on this page — not a supported retailer
  }

  renderProduct();
}

function renderProduct() {
  if (!currentProduct || !currentProduct.title) {
    statusEl.textContent = 'No supported product detected on this page.';
    return;
  }

  const retailer = getRetailer(currentProduct.retailerId);
  statusEl.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'product-title';
  title.textContent = currentProduct.title;

  const meta = document.createElement('div');
  meta.className = 'product-meta';
  const priceText = currentProduct.price != null ? `₹${currentProduct.price.toLocaleString('en-IN')}` : 'Price unavailable';
  meta.textContent = `${retailer?.name || currentProduct.retailerId} · ${priceText}${ratingSuffix(currentProduct)}`;

  statusEl.append(title, meta);
  findBtn.disabled = currentProduct.price == null;
  googleBtn.disabled = false;
}

function ratingSuffix(option) {
  if (typeof option.rating !== 'number') return '';
  const count = typeof option.ratingCount === 'number' ? ` (${option.ratingCount.toLocaleString('en-IN')})` : '';
  return ` · ★${option.rating.toFixed(1)}${count}`;
}

// Opens a normal, user-visible Google Shopping search tab for the current
// product — the user looks at it themselves. Deliberately NOT scraped or
// read by the extension: Google's bot-protection is far stricter than the
// retailers', and automated querying is against Google's own Terms of
// Service, so this stays a plain, one-click navigation the user triggers.
googleBtn.addEventListener('click', () => {
  if (!currentProduct) return;
  const query = buildSearchQuery(currentProduct);
  const url = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
  chrome.tabs.create({ url, active: true });
});

findBtn.addEventListener('click', async () => {
  findBtn.disabled = true;
  findBtn.textContent = 'Searching…';
  resultsEl.innerHTML = '';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'FIND_CHEAPER', product: currentProduct });
    if (!response?.ok) throw new Error(response?.error || 'Unknown error');
    renderComparison(response.comparison);
  } catch (err) {
    resultsEl.textContent = `Could not complete search: ${err.message}`;
  } finally {
    findBtn.disabled = false;
    findBtn.textContent = 'Find cheaper';
  }
});

function renderComparison(comparison) {
  resultsEl.innerHTML = '';
  const { options, cheapest, bestValue, notFound = [] } = comparison || {};

  if (!options || options.length <= 1) {
    const msg = document.createElement('div');
    msg.className = 'no-match';
    msg.textContent = 'No matching product found on other retailers.';
    resultsEl.appendChild(msg);
    renderNotFound(notFound);
    return;
  }

  if (bestValue) {
    const priceGap = bestValue.price - cheapest.price;
    const note = document.createElement('div');
    note.className = 'best-value-note';
    note.textContent = `${getRetailer(bestValue.retailerId)?.name || bestValue.retailerId} is only ₹${priceGap.toLocaleString('en-IN')} more but rated ★${bestValue.rating.toFixed(1)} (${bestValue.ratingCount.toLocaleString('en-IN')} reviews) vs ★${cheapest.rating != null ? cheapest.rating.toFixed(1) : '?'} for the cheapest option.`;
    resultsEl.appendChild(note);
  }

  const sorted = [...options].sort((a, b) => a.price - b.price);
  for (const option of sorted) {
    resultsEl.appendChild(renderRow(option, { cheapest, bestValue }));
  }
  renderNotFound(notFound);
}

// Lists retailers that were searched with no acceptable match, each linking to
// that retailer's own search page so the user can double-check by hand. These
// are plain user-clicked links — nothing is fetched until the user clicks.
function renderNotFound(retailerIds) {
  if (!retailerIds.length) return;
  const box = document.createElement('div');
  box.className = 'not-found';
  const label = document.createElement('div');
  label.className = 'not-found-label';
  label.textContent = 'Not found — search manually:';
  box.appendChild(label);
  const [query] = buildSearchQueries(currentProduct);
  for (const id of retailerIds) {
    const retailer = getRetailer(id);
    if (!retailer) continue;
    const link = document.createElement('a');
    link.className = 'not-found-link';
    link.href = retailer.buildSearchUrl(currentProduct, query);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = retailer.name;
    box.appendChild(link);
  }
  resultsEl.appendChild(box);
}

function renderRow(option, { cheapest, bestValue }) {
  const retailer = getRetailer(option.retailerId);
  const isCheapest = option === cheapest;
  const isBestValue = option === bestValue;

  const row = document.createElement(option.isCurrent ? 'div' : 'a');
  row.className = `result ${option.confidence}`;
  if (isCheapest) row.classList.add('is-cheapest');
  if (isBestValue) row.classList.add('is-best-value');
  if (!option.isCurrent) {
    row.href = option.url;
    row.target = '_blank';
    row.rel = 'noopener noreferrer';
  }

  const retailerLine = document.createElement('div');
  retailerLine.className = 'result-retailer';
  retailerLine.textContent = `${retailer?.name || option.retailerId} `;

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = option.isCurrent
    ? 'Current page'
    : option.confidence === 'confirmed'
      ? 'Same product'
      : 'Possible match — verify';
  retailerLine.appendChild(badge);

  if (isCheapest) {
    const cheapestBadge = document.createElement('span');
    cheapestBadge.className = 'badge badge-cheapest';
    cheapestBadge.textContent = 'Cheapest';
    retailerLine.appendChild(cheapestBadge);
  }
  if (isBestValue) {
    const bestBadge = document.createElement('span');
    bestBadge.className = 'badge badge-best-value';
    bestBadge.textContent = 'Best value';
    retailerLine.appendChild(bestBadge);
  }

  const titleLine = document.createElement('div');
  titleLine.className = 'result-title';
  titleLine.textContent = option.title;

  const priceLine = document.createElement('div');
  priceLine.className = 'result-price';
  const priceText = `₹${option.price.toLocaleString('en-IN')}`;
  priceLine.textContent = `${priceText}${ratingSuffix(option)}`;

  row.append(retailerLine, titleLine, priceLine);
  return row;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}
