import { normalizeText, tokenize } from './product-model.js';

// Fuzzy token-overlap matches can only ever reach "possible" confidence, never
// "confirmed" — textual similarity alone isn't proof of same-product identity
// (e.g. "Widget X200" vs "Widget X300" overlap heavily on every word but the model).
const WEAK_THRESHOLD = 0.6;

// Blends Jaccard (penalizes length mismatch) with containment/overlap
// (rewards a short search-result title being mostly a subset of a verbose
// source title) — pure Jaccard alone was found, against real Amazon/Flipkart
// titles, to under-score genuine matches where one retailer's title is much
// terser than the other's, or has a minor typo in the model number.
function titleOverlapScore(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  if (intersection === 0) return 0;
  const union = new Set([...a, ...b]).size;
  const jaccard = intersection / union;
  const containment = intersection / Math.min(a.size, b.size);
  return (jaccard + containment) / 2;
}

// Catches real-world cases like "Redmi Note 15 SE ... 6GB RAM, 128GB" vs
// "... 8GB RAM, 128GB" — two different-spec variants of the same phone line
// that share almost every other word, so title-overlap alone scores them
// nearly identically. Operates on raw (lowercased) text, not pre-tokenized
// arrays: retailers write the same spec both as "128GB" (one token once
// tokenize() strips non-alnum chars) and "128 GB" (two tokens) — matching on
// already-split tokens silently missed the space-separated form entirely.
// A product can carry two numbers with the *same* unit (RAM and storage are
// both "...GB"), so an unordered overlap check is not enough — e.g. source
// {8, 128} vs candidate {6, 128} "overlaps" on 128 (storage) and would hide
// the conflicting RAM value. Compares *distinct* values per unit (not raw
// occurrence counts): real text repeats the same number (e.g. "128 GB" in
// both the title and a "128 GB ROM" spec bullet), which would otherwise
// make the two sides' counts look mismatched and skip the comparison
// entirely. Only fires when both sides mention a unit the same number of
// *distinct* times — otherwise there's not enough signal to safely compare.
const SPEC_RE = /(\d+)\s?(gb|tb|mb|mah|inch|cm|mm|ml|kg|w)\b/gi;

function extractSpecsByUnit(text) {
  const specs = {};
  for (const m of (text || '').toLowerCase().matchAll(SPEC_RE)) {
    const [, value, unit] = m;
    (specs[unit] ??= new Set()).add(value);
  }
  return specs;
}

function hasSpecConflict(sourceText, candidateText) {
  const sourceSpecs = extractSpecsByUnit(sourceText);
  const candidateSpecs = extractSpecsByUnit(candidateText);
  for (const unit of Object.keys(sourceSpecs)) {
    const sourceValues = sourceSpecs[unit];
    const candidateValues = candidateSpecs[unit];
    if (!candidateValues || candidateValues.size !== sourceValues.size) continue;
    for (const v of sourceValues) {
      if (!candidateValues.has(v)) return true;
    }
  }
  return false;
}

export function scoreCandidate(source, candidate) {
  if (source.gtin && candidate.gtin && source.gtin === candidate.gtin) {
    return { score: 1, tier: 'gtin', confidence: 'confirmed' };
  }

  // Some search-result cards (observed on Flipkart mobile-category listings)
  // show RAM/storage/etc. as separate spec bullets outside the title/image —
  // a card titled just "(Crimson Reserve, 128 GB)" can carry "6 GB RAM" only
  // in that bullet list. `candidate.specs`, when a scraper supplies it, is
  // folded in for the conflict check only — kept out of the general
  // title-overlap score below so its extra words (camera/display/etc.) don't
  // dilute containment against a terser source title.
  const sourceSpecText = `${source.brand} ${source.model} ${source.title}`;
  const candidateSpecText = `${candidate.brand || ''} ${candidate.title || ''} ${candidate.specs || ''}`;

  // A conflicting capacity spec overrides every other signal, including an
  // otherwise-exact brand+model substring match — two storage/RAM variants of
  // the same phone line can easily share the identical "model" field.
  if (hasSpecConflict(sourceSpecText, candidateSpecText)) {
    return { score: 0, tier: 'spec-conflict', confidence: 'none' };
  }

  const sourceTokens = tokenize(sourceSpecText);
  const candidateTokens = tokenize(`${candidate.brand || ''} ${candidate.title || ''}`);

  const sourceBrand = normalizeText(source.brand);
  const candidateBrand = normalizeText(candidate.brand || candidate.title);
  const brandMatch = !!sourceBrand && candidateBrand.includes(sourceBrand);

  if (source.model && brandMatch) {
    const sourceModel = normalizeText(source.model);
    const candidateHay = normalizeText(`${candidate.brand || ''} ${candidate.title || ''}`);
    if (sourceModel && candidateHay.includes(sourceModel)) {
      return { score: 0.95, tier: 'brand+model', confidence: 'confirmed' };
    }
  }

  let score = titleOverlapScore(sourceTokens, candidateTokens);

  if (brandMatch) score += 0.1;

  const variantBits = [source.variant?.storage, source.variant?.color, source.variant?.size].filter(Boolean);
  if (variantBits.length) {
    const candidateText = normalizeText(candidate.title);
    const matchedVariantBits = variantBits.filter((v) => candidateText.includes(normalizeText(v)));
    score += 0.05 * matchedVariantBits.length;
  }

  score = Math.min(score, 0.94);
  const confidence = score >= WEAK_THRESHOLD ? 'possible' : 'none';
  return { score, tier: 'fuzzy', confidence };
}

export function rankCandidates(source, candidates) {
  return candidates
    .map((c) => ({ candidate: c, ...scoreCandidate(source, c) }))
    .filter((r) => r.confidence !== 'none')
    .sort((a, b) => b.score - a.score);
}

export function findCheaperAlternatives(source, candidatesByRetailer) {
  const results = [];
  for (const [retailerId, candidates] of Object.entries(candidatesByRetailer)) {
    const ranked = rankCandidates(source, candidates);
    if (ranked.length === 0) continue;
    const best = ranked[0];
    const bothPriced = typeof best.candidate.price === 'number' && typeof source.price === 'number';
    results.push({
      retailerId,
      confidence: best.confidence,
      tier: best.tier,
      score: best.score,
      product: best.candidate,
      isCheaper: bothPriced ? best.candidate.price < source.price : null,
      savings: bothPriced ? Math.max(0, source.price - best.candidate.price) : null,
    });
  }
  return results.sort((a, b) => (a.product.price ?? Infinity) - (b.product.price ?? Infinity));
}

// A small price gap is "not much difference" — scales with the price itself
// (₹50 flat on a ₹300 item is a big deal; on a ₹30,000 phone it's nothing),
// floored at ₹50 so cheap items aren't treated as all "basically the same
// price." A rating only counts as "better reviews" when it's enough of an
// edge to not be noise (0.2+ stars) AND has enough ratings behind it to
// trust (at least 10) — a 5.0 from one review shouldn't outrank a 4.3 from
// thousands.
const NEAR_PRICE_MIN_RUPEES = 50;
const NEAR_PRICE_PERCENT = 0.1;
const MIN_RATING_EDGE = 0.2;
const MIN_TRUSTED_RATING_COUNT = 10;

// Builds the full price+rating comparison across the current page's product
// and every matched retailer — for showing a comparison table, not just a
// single "cheapest" link. `cheapest` is the lowest-priced option; `bestValue`
// is a different option worth calling out when it costs only a little more
// but has meaningfully better, trustworthy ratings (null when the cheapest
// option is already the best call, i.e. nothing to trade off).
export function buildComparison(source, candidatesByRetailer) {
  const cheaperResults = findCheaperAlternatives(source, candidatesByRetailer);

  const options = [];
  if (typeof source.price === 'number') {
    options.push({
      retailerId: source.retailerId,
      isCurrent: true,
      confidence: 'current',
      price: source.price,
      rating: typeof source.rating === 'number' ? source.rating : null,
      ratingCount: typeof source.ratingCount === 'number' ? source.ratingCount : null,
      url: source.url,
      title: source.title,
    });
  }
  for (const r of cheaperResults) {
    options.push({
      retailerId: r.retailerId,
      isCurrent: false,
      confidence: r.confidence,
      price: r.product.price,
      rating: typeof r.product.rating === 'number' ? r.product.rating : null,
      ratingCount: typeof r.product.ratingCount === 'number' ? r.product.ratingCount : null,
      url: r.product.url,
      title: r.product.title,
    });
  }

  if (options.length === 0) return { options, cheapest: null, bestValue: null };

  const cheapest = options.reduce((a, b) => (b.price < a.price ? b : a));

  const threshold = Math.max(NEAR_PRICE_MIN_RUPEES, cheapest.price * NEAR_PRICE_PERCENT);
  const trustedNearCheapest = options.filter(
    (o) =>
      o !== cheapest &&
      o.price - cheapest.price <= threshold &&
      typeof o.rating === 'number' &&
      o.ratingCount >= MIN_TRUSTED_RATING_COUNT &&
      (cheapest.rating == null || o.rating >= cheapest.rating + MIN_RATING_EDGE),
  );
  const bestValue = trustedNearCheapest.length
    ? trustedNearCheapest.reduce((a, b) => (b.rating > a.rating ? b : a))
    : null;

  return { options, cheapest, bestValue };
}
