(function () {
  // Shared by Myntra/AJIO/Croma/Reliance Digital. Reads schema.org JSON-LD
  // (Product or ProductGroup) via the tolerant parser in common.js, which
  // handles malformed blocks seen on live Myntra/Croma pages, then falls back to
  // <h1>/og:title and a per-retailer current-price DOM selector. Checked
  // against live product pages on 2026-10-09 (JSON-LD shapes only; the
  // popup click-through hasn't been run on these four). Expect no model/GTIN
  // where the site doesn't emit them.
  function makeGenericExtractor(retailerId, options = {}) {
    const priceSelectors = options.priceSelectors || [];
    return function extract() {
      const { getMeta, parsePrice, toNumber, getJsonLdProducts } = window.__priceTrackCommon;
      const jsonLd = getJsonLdProducts()[0] || {};

      const title =
        jsonLd.name ||
        document.querySelector('h1')?.textContent?.trim() ||
        getMeta('property', 'og:title') ||
        document.title;

      const rawBrand = jsonLd.brand?.name || jsonLd.brand || '';
      const brand = (typeof rawBrand === 'string' ? rawBrand : '').trim();

      // ProductGroup (AJIO) may only carry offers on its variants.
      const rawOffers = jsonLd.offers || jsonLd.hasVariant?.[0]?.offers;
      const offer = Array.isArray(rawOffers) ? rawOffers[0] : rawOffers;
      let price = parsePrice(offer?.price ?? offer?.lowPrice);
      if (price == null) {
        // Site-specific DOM fallback (current/selling price, not the MRP).
        for (const selector of priceSelectors) {
          price = parsePrice(document.querySelector(selector)?.textContent);
          if (price != null) break;
        }
      }

      const gtin = jsonLd.gtin13 || jsonLd.gtin || jsonLd.gtin12 || jsonLd.gtin8 || '';
      // Myntra's mpn/sku is its own style id, not a manufacturer model; using it
      // polluted matching against other retailers' titles.
      const model = jsonLd.model || (options.ignoreMpn ? '' : jsonLd.mpn) || '';
      const rawModel = typeof model === 'string' ? model : model?.name || '';

      const variant = {
        color: jsonLd.color || '',
        size: jsonLd.size || '',
        storage: '',
      };

      // Sites differ on key casing (Myntra: "AggregateRating") and emit values as strings.
      const aggregateRating = jsonLd.aggregateRating || jsonLd.AggregateRating || {};
      const rating = toNumber(aggregateRating.ratingValue);
      const ratingCount = toNumber(aggregateRating.ratingCount ?? aggregateRating.reviewCount);

      // AJIO's JSON-LD name omits the brand ("Men Winflo 12 ...") while its search
      // cards include it; prefix it so both sides compare consistently.
      const fullTitle = (title || '').trim();
      const displayTitle =
        brand && !fullTitle.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${fullTitle}` : fullTitle;

      return {
        retailerId,
        url: location.href.split('?')[0],
        title: displayTitle,
        brand,
        model: String(rawModel || '').trim(),
        gtin: (gtin || '').trim(),
        variant,
        price,
        currency: offer?.priceCurrency || 'INR',
        rating,
        ratingCount,
      };
    };
  }

  window.__priceTrackMakeGenericExtractor = makeGenericExtractor;
})();
