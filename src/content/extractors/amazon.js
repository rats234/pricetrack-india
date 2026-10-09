(function () {
  // Amazon.in does not embed JSON-LD Product schema or og: meta tags (verified
  // against live product pages), so brand/model/GTIN come from the "Product
  // information" detail table instead, which is far more reliable than scraping
  // the "Visit the X Store" byline text.
  function getProductDetails() {
    const map = {};
    const rows = document.querySelectorAll(
      '#productDetails_feature_div tr, #productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr',
    );
    for (const row of rows) {
      const key = row.querySelector('th')?.textContent?.trim();
      const value = row.querySelector('td')?.textContent?.trim();
      if (key) map[key] = value || '';
    }
    return map;
  }

  function extract() {
    const { getMeta, parsePrice, getJsonLdProducts } = window.__priceTrackCommon;
    const jsonLd = getJsonLdProducts()[0] || {};
    const details = getProductDetails();

    const title =
      jsonLd.name ||
      getMeta('property', 'og:title') ||
      document.getElementById('productTitle')?.textContent?.trim() ||
      document.title;

    const bylineBrand = document
      .getElementById('bylineInfo')
      ?.textContent?.trim()
      .replace(/^(brand|visit the)\s*:?\s*/i, '')
      .replace(/\s*store\s*$/i, '')
      .trim();
    const rawBrand = jsonLd.brand?.name || jsonLd.brand || details['Brand Name'] || bylineBrand || '';
    const brand = (typeof rawBrand === 'string' ? rawBrand : '').trim();

    const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
    const priceFromDom =
      document.querySelector('.a-price .a-offscreen')?.textContent ||
      document.querySelector('#priceblock_ourprice, #priceblock_dealprice')?.textContent;
    const price = parsePrice(offer?.price ?? priceFromDom);

    const gtin = jsonLd.gtin13 || jsonLd.gtin || jsonLd.gtin12 || jsonLd.gtin8 || details['EAN'] || '';
    const model = jsonLd.model || jsonLd.mpn || details['Model Number'] || details['Model Name'] || '';

    const variant = { color: '', size: '', storage: '' };
    const colorRow = document.querySelector('[data-feature-name="color"] .selection, #variation_color_name .selection');
    if (colorRow) variant.color = colorRow.textContent.trim();
    const sizeRow = document.querySelector('[data-feature-name="size"] .selection, #variation_size_name .selection');
    if (sizeRow) variant.size = sizeRow.textContent.trim();

    // Rating value lives in #acrPopover's title attribute ("4.1 out of 5
    // stars"); review count in #acrCustomerReviewText's aria-label
    // ("89,113 Reviews") — both verified against a live product page.
    const ratingTitle = document.getElementById('acrPopover')?.getAttribute('title') || '';
    const ratingMatch = ratingTitle.match(/([\d.]+)\s*out of/);
    const rating = ratingMatch ? Number(ratingMatch[1]) : null;
    const reviewText = document.getElementById('acrCustomerReviewText')?.getAttribute('aria-label') || '';
    const reviewMatch = reviewText.match(/([\d,]+)/);
    const ratingCount = reviewMatch ? Number(reviewMatch[1].replace(/,/g, '')) : null;

    return {
      retailerId: 'amazon',
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
