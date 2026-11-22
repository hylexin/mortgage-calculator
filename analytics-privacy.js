(function () {
  const legacyKeys = new Set([
    "homePrice", "downPayment", "downPaymentType", "interestRate", "loanTerm",
    "propertyTax", "propertyTaxType", "insurance", "insuranceType", "pmi", "pmiType",
    "extraPayment", "hoa", "startDate", "paymentFrequency"
  ]);
  const url = new URL(window.location.href);
  let legacyState = {};
  let foundLegacyInputs = false;
  for (const [key, value] of url.searchParams) {
    if (legacyKeys.has(key)) {
      legacyState[key] = value;
      foundLegacyInputs = true;
    }
  }
  window.consumeLegacyMortgageState = function () {
    const state = foundLegacyInputs ? legacyState : null;
    legacyState = {};
    foundLegacyInputs = false;
    delete window.consumeLegacyMortgageState;
    return state;
  };

  let safeToLoadAnalytics = true;
  if (foundLegacyInputs) {
    legacyKeys.forEach(key => url.searchParams.delete(key));
    try {
      window.history.replaceState(window.history.state, "", url.href);
    } catch (error) {
      safeToLoadAnalytics = false;
    }
  }

  function withoutQueryOrFragment(value) {
    if (!value) return "";
    try {
      const clean = new URL(value);
      clean.search = "";
      clean.hash = "";
      return clean.href;
    } catch (error) {
      return "";
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (typeof window.consumeLegacyMortgageState === "function") window.consumeLegacyMortgageState();
    if (!safeToLoadAnalytics || !/^https?:$/.test(window.location.protocol)) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("set", {
      page_location: withoutQueryOrFragment(window.location.href),
      page_referrer: withoutQueryOrFragment(document.referrer)
    });
    window.gtag("config", "G-RX2JMN8KR5");
    const tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtag/js?id=G-RX2JMN8KR5";
    document.head.append(tag);
  });
})();
