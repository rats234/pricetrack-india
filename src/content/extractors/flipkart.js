(function () {
  function extract() {
    const { getMeta, parsePrice, getJsonLdProducts } = window.__priceTrackCommon;
    const jsonLd = getJsonLdProducts()[0] || {};

    // Verified against live pages: Flipkart does not consistently serve JSON-LD
    // Product data (confirmed empty `[]` on at least some apparel listings, which
    // render on a visibly different frontend build than electronics listings do).
    // When it's missing, <h1> is the one title source confirmed clean and present
    // on both page types — og:title/document.title carry an SEO suffix like
    // "- Buy X Online at Best Prices in India | Flipkart.com".
    const title =
      jsonLd.name ||
      document.querySelector('h1')?.textContent?.trim() ||
      getMeta('property', 'og:title') ||
      document.title;

    const rawBrand = jsonLd.brand?.name || jsonLd.brand || '';
    const brand = (typeof rawBrand === 'string' ? rawBrand : '').trim();

    const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
    // Flipkart's price-display class names are obfuscated/build-specific and
    // change frequently; this selector is a best-effort fallback behind JSON-LD.
    const priceFromDom = document.querySelector('div._30jeq3')?.textContent;
    const price = parsePrice(offer?.price ?? priceFromDom);

    const gtin = jsonLd.gtin13 || jsonLd.gtin || '';
    const model = jsonLd.model || jsonLd.mpn || '';

    // Flipkart's JSON-LD often includes "color" at the top level (verified on
    // live product pages), even though it omits model/mpn/gtin entirely.
    const variant = { color: jsonLd.color || '', size: jsonLd.size || '', storage: '' };

    // aggregateRating is standard schema.org, present in the same JSON-LD
    // block — verified on a live product page (ratingValue + reviewCount).
    const aggregateRating = jsonLd.aggregateRating || {};
    const rating = typeof aggregateRating.ratingValue === 'number' ? aggregateRating.ratingValue : null;
    const ratingCount =
      typeof aggregateRating.ratingCount === 'number'
        ? aggregateRating.ratingCount
        : typeof aggregateRating.reviewCount === 'number'
          ? aggregateRating.reviewCount
          : null;

    return {
      retailerId: 'flipkart',
      url: location.href.split('?')[0],
      title: title?.trim() || '',
      brand,
      model: model?.trim() || '',
      gtin: gtin?.trim() || '',
      variant,
      price,
      currency: offer?.priceCurrency || 'INR',
      rating,
      ratingCount,
    };
  }

  window.__priceTrackExtract = extract;
})();
