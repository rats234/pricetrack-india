(function () {
  window.__priceTrackExtract = window.__priceTrackMakeGenericExtractor('myntra', {
    ignoreMpn: true,
    priceSelectors: ['.pdp-price strong'],
  });
})();
