const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const server = http.createServer((req, res) => {
  const request = new URL(req.url, "http://localhost");
  const file = request.pathname === "/" ? "mortgage-calculator.html" : request.pathname.slice(1);
  if (!/^(mortgage-calculator\.html|index\.html|about\.html|contact\.html|privacy\.html|terms\.html|analytics-privacy\.js)$/.test(file)) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : "text/html");
  res.end(fs.readFileSync(path.join(root, file)));
});

async function main() {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const requests = [];
    await page.route("**/*googletagmanager.com/gtag/js**", route => {
      requests.push({ url: route.request().url(), headers: route.request().headers() });
      return route.fulfill({ contentType: "application/javascript", body: "window.mockGoogleTagLoaded = true;" });
    });
    const legacy = "homePrice=432123&downPayment=76543&interestRate=6.25&loanTerm=25";
    await page.goto(`${base}/?${legacy}&utm_source=test_campaign`, { waitUntil: "load" });
    assert.equal(await page.locator("#homePrice").inputValue(), "432123");
    assert.equal(await page.locator("#downPayment").inputValue(), "76543");
    assert.equal(await page.locator("#loanTerm").inputValue(), "25");
    const state = await page.evaluate(() => ({ href: location.href, data: window.dataLayer.map(item => Array.from(item)), hasConsumer: typeof window.consumeLegacyMortgageState }));
    assert.ok(!state.href.includes("432123") && !state.href.includes("76543"));
    assert.ok(state.href.includes("utm_source=test_campaign"));
    assert.equal(state.hasConsumer, "undefined");
    const set = state.data.find(item => item[0] === "set")[1];
    assert.equal(set.page_location, `${base}/`);
    assert.ok(!JSON.stringify(state.data).includes("432123"));
    assert.ok(!JSON.stringify(state.data).includes("76543"));
    assert.equal(requests.length, 1);
    assert.ok(!JSON.stringify(requests).includes("432123"));
    assert.ok(!JSON.stringify(requests).includes("76543"));
    await page.reload();
    assert.equal(await page.locator("#homePrice").inputValue(), "432123");
    await page.goto(`${base}/?utm_source=another_campaign`);
    assert.equal(await page.locator("#homePrice").inputValue(), "432123");

    for (const file of ["about.html", "contact.html", "privacy.html"]) {
      await page.goto(`${base}/${file}?homePrice=432123&utm_source=test_campaign`);
      const details = await page.evaluate(() => ({ url: location.href, data: window.dataLayer.map(item => Array.from(item)), consumer: typeof window.consumeLegacyMortgageState }));
      assert.ok(!details.url.includes("432123"));
      assert.ok(!JSON.stringify(details.data).includes("432123"));
      assert.equal(details.consumer, "undefined");
    }

    await page.goto(`${base}/index.html?${legacy}`);
    await page.waitForURL("**/mortgage-calculator.html**");
    assert.equal(await page.locator("#homePrice").inputValue(), "432123");
    assert.ok(!page.url().includes("432123"));

    const blocked = await browser.newPage();
    await blocked.addInitScript(() => { history.replaceState = () => { throw new Error("blocked"); }; });
    await blocked.route("**/*googletagmanager.com/gtag/js**", () => { throw new Error("Google tag should not load after cleanup failure"); });
    await blocked.goto(`${base}/?${legacy}`);
    assert.equal(await blocked.locator("#homePrice").inputValue(), "432123");
    assert.equal(await blocked.evaluate(() => typeof window.gtag), "undefined");
    await blocked.close();
    console.log("PASS: legacy restoration, URL cleanup, saved inputs, redirect, auxiliary pages, tag configuration and cleanup-failure fallback");
    if (fs.existsSync("/tmp/mortgage-google-tag.js")) {
      const actual = await browser.newPage();
      const outgoing = [];
      await actual.route("**/*", route => {
        const request = route.request();
        const target = new URL(request.url());
        if (target.hostname === "127.0.0.1") return route.continue();
        if (target.hostname === "www.googletagmanager.com" && target.pathname === "/gtag/js") {
          return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync("/tmp/mortgage-google-tag.js") });
        }
        outgoing.push({ url: request.url(), body: request.postData() || "" });
        return route.abort();
      });
      await actual.goto(`${base}/?${legacy}&utm_source=test_campaign`, { waitUntil: "load", referer: "https://example.net/source?homePrice=555888" });
      await actual.waitForTimeout(2500);
      assert.ok(outgoing.some(request => /google-analytics\.com/.test(request.url)), "Official tag did not produce an interceptable GA request");
      const serialized = decodeURIComponent(JSON.stringify(outgoing));
      for (const secret of ["432123", "76543", "555888"]) assert.ok(!serialized.includes(secret), `GA request contains ${secret}`);
      console.log(`PASS: official Google tag produced ${outgoing.length} intercepted requests; no test loan values found`);
      await actual.close();
    } else {
      console.log("LIMIT: official Google tag unavailable; only mocked tag was tested.");
    }
    console.log("LIMIT: GA property settings, historical data, consent behavior and server logs were not verified.");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
