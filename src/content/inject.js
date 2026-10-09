(function () {
  function buildProduct() {
    try {
      return window.__priceTrackExtract ? window.__priceTrackExtract() : null;
    } catch (e) {
      console.error('[PriceTrack] extraction failed', e);
      return null;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'GET_PRODUCT') {
      sendResponse({ product: buildProduct() });
    }
  });
})();
