# Analytics and legacy calculation links

The calculator previously created share URLs containing loan inputs as query parameters. Existing links may still be opened. The first HTTP request can reach the host, CDN, browser history or other systems before the page's JavaScript runs; client-side code cannot remove those earlier copies or erase previously collected analytics data.

## Current behavior

- `analytics-privacy.js` reads the recognized legacy calculator inputs, removes those parameters with `history.replaceState`, and makes the values available once to the calculator. The current calculator stores valid inputs in browser local storage as before.
- Google Analytics is initialized after the document is parsed. If removing recognized input parameters fails, the Google tag is not loaded on that page view. The local `file:` preview does not load Google Analytics.
- The Google tag's global `page_location` and `page_referrer` are configured without query strings and fragments. The referrer policy is `strict-origin`. Other, non-calculator query parameters are retained in the address bar; the index redirect preserves the query so the destination can process legacy links.
- The standalone index redirect does not load Google Analytics itself. On the Vercel configuration, `/` is served directly from the calculator and is counted there.
- Removing query strings from the configured analytics location may affect campaign attribution or reports that rely on full URLs. Test with the real property before relying on attribution data. The current change does not add measurement events or configure user consent.

## Verification and limits

`tests/analytics-privacy.cjs` starts a local test server, uses synthetic values and mocks the tag to check restoration, URL cleanup, reload behavior, redirect handling and the fallback if history rewriting fails. If `/tmp/mortgage-google-tag.js` contains the downloaded official tag, it also runs that tag locally and blocks all non-local requests while inspecting them for sample loan values.

The isolated test is not proof of every possible tag or measurement setting. It cannot inspect production GA property settings, extensions, server/CDN logs, old collected data, other third-party scripts, arbitrary query parameters, or consent requirements. The tag executes in the page's JavaScript environment and can technically access page content; the site must not claim that no third party could ever access user inputs.

Before deployment, an authorized property administrator should review Google Analytics enhanced measurement, events, data streams and consent settings. Google provides [query-parameter data redaction](https://support.google.com/analytics/answer/13544947) as a separate safeguard; configure and test the recognized legacy keys there if appropriate. Review historical records and retention with the administrator. Do not use real loan inputs as test values in a live analytics property.
