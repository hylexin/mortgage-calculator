const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const url = pathToFileURL(path.join(__dirname, "..", "mortgage-calculator.html")).href;
const close = (actual, expected, tolerance = 0.011) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 768, 375, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(url);
      const defaultResult = await page.evaluate(() => {
        const input = getInputs();
        const result = buildSchedule(input);
        return { input, first: result.rows[0], months: result.rows.length, totalInterest: result.totalInterest };
      });
      const rate = 0.0675 / 12;
      const independentPI = 400000 * rate / (1 - Math.pow(1 + rate, -360));
      close(defaultResult.first.payment, 3244.39);
      assert.equal(defaultResult.first.pmi, 0);
      close(defaultResult.first.principalPaid + defaultResult.first.interest, independentPI, 1e-7);
      assert.equal(defaultResult.months, 360);
      assert.equal(await page.locator("#monthlyTotal").innerText(), await page.locator("#mobileTotal").innerText());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

      await page.locator("#extraPayment").fill("500");
      const extra = await page.evaluate(() => {
        const i = getInputs(), a = buildSchedule(i), b = buildSchedule({ ...i, extraPayment: 0, paymentFrequency: "monthly" });
        return { months: a.rows.length, interest: a.totalInterest, first: a.rows[0].payment, baseInterest: b.totalInterest, last: a.rows.at(-1) };
      });
      close(extra.first, 3744.39);
      close(extra.interest, 316459.24);
      assert.equal(extra.months, 232);
      assert.ok(extra.interest <= extra.baseInterest && extra.last.balance >= 0 && extra.last.balance < 0.005);
      assert.ok(extra.last.principalPaid <= 400000);
      assert.match(await page.locator("#extraComparisonBody").innerText(), /232 months/);

      await page.locator("#extraPayment").fill("0");
      const comparisonRows = await page.locator("#extraComparisonBody tr").allInnerTexts();
      assert.ok(comparisonRows.every(row => { const cells = row.split("\t"); return cells[1] === cells[2]; }));
      await page.locator("#downPayment").fill("50000");
      const pmi = await page.evaluate(() => {
        const input = getInputs(), result = buildSchedule(input);
        const stop = result.rows.findIndex(row => row.pmi === 0);
        return { input, first: result.rows[0], second: result.rows[1], previous: result.rows[stop - 1], stop: result.rows[stop], count: stop, total: result.totalPmi };
      });
      close(pmi.first.pmi, 187.5);
      close(pmi.second.pmi, 187.34);
      close(pmi.first.payment, 3756.19);
      assert.ok(pmi.previous.balance <= pmi.input.homePrice * 0.8 && pmi.previous.pmi > 0 && pmi.stop.pmi === 0);
      console.log(JSON.stringify({ width, case: "10% down PMI", first: pmi.first.pmi, second: pmi.second.pmi, chargedMonths: pmi.count, modelTotal: pmi.total, fixedFirstPremiumForSameMonths: pmi.count * pmi.first.pmi }));
      await page.locator("#pmiType").selectOption("monthly");
      await page.locator("#pmi").fill("187.5");
      const fixedPmi = await page.evaluate(() => { const r = buildSchedule(getInputs()); return { first: r.rows[0].pmi, second: r.rows[1].pmi, total: r.totalPmi }; });
      close(fixedPmi.first, 187.5);
      close(fixedPmi.second, 187.5);
      close(fixedPmi.total, 18375);
      await page.locator("#pmiType").selectOption("percent");
      await page.locator("#pmi").fill("0");
      assert.equal(await page.evaluate(() => buildSchedule(getInputs()).totalPmi), 0);
      await page.locator("#paymentFrequency").selectOption("biweekly");
      const biweekly = await page.evaluate(() => { const r = buildSchedule(getInputs()); return { basePI: r.basePI, extra: r.rows[0].extraPrincipal }; });
      close(biweekly.extra, biweekly.basePI / 12, 1e-7);
      assert.ok(await page.locator("#biweeklyScheduleNote").isVisible());
      await page.locator("#paymentFrequency").selectOption("monthly");

      await page.locator("#interestRate").fill("0");
      const zero = await page.evaluate(() => { const r = buildSchedule(getInputs()); return { interest: r.totalInterest, pi: r.basePI, months: r.rows.length }; });
      assert.equal(zero.interest, 0);
      close(zero.pi, 450000 / 360, 1e-7);
      await page.locator("#extraPayment").fill("999999");
      const early = await page.evaluate(() => { const r = buildSchedule(getInputs()); return { rows: r.rows.length, first: r.rows[0] }; });
      assert.equal(early.rows, 1);
      close(early.first.principalPaid, 450000, 1e-7);
      assert.equal(early.first.balance, 0);
      assert.ok(early.first.extraPrincipal < 999999);

      await page.locator("#extraPayment").fill("-1");
      assert.equal(await page.locator("#extraPayment").getAttribute("aria-invalid"), "true");
      assert.ok(await page.locator("#extraPaymentError").isVisible());
      assert.ok(await page.locator("#previewReport").isDisabled());
      await page.locator("#extraPayment").fill("");
      assert.ok(await page.locator("#extraPaymentError").isVisible());
      await page.locator("#extraPayment").fill("0");
      await page.locator("#downPayment").fill("600000");
      assert.ok(await page.locator("#downPaymentError").isVisible());
      await page.locator("#downPaymentType").selectOption("percent");
      await page.locator("#downPayment").fill("101");
      assert.ok(await page.locator("#downPaymentError").isVisible());
      await page.locator("#downPaymentType").selectOption("amount");
      await page.locator("#downPayment").fill("500000");
      assert.equal(await page.locator("#monthlyTotal").innerText(), "$650.00");
      assert.equal(await page.locator("#payoffDate").innerText(), "No loan balance");
      await page.locator("#loanTerm").fill("101");
      assert.ok(await page.locator("#loanTermError").isVisible());
      await page.locator("#loanTerm").fill("1.5");
      assert.ok(await page.locator("#loanTermError").isVisible());
      await page.locator("#loanTerm").fill("30");
      await page.locator("#downPayment").fill("100000");
      await page.locator("#interestRate").fill("6.75");
      await page.locator("#extraPayment").fill("500");

      await page.locator(".pmi-details summary").focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator(".pmi-details").getAttribute("open"), "");

      await page.locator("#annualView").focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#annualView").getAttribute("aria-pressed"), "true");
      await page.locator("#monthlyView").focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#monthlyView").getAttribute("aria-pressed"), "true");
      const [report] = await Promise.all([page.waitForEvent("popup"), page.locator("#previewReport").click()]);
      await report.waitForLoadState();
      assert.equal(await report.locator(".hero strong").innerText(), await page.locator("#monthlyTotal").innerText());
      assert.equal(await report.locator("tbody tr").count(), 232);
      assert.match(await report.locator("body").innerText(), /starting loan balance/);
      if (width === 1280) await report.pdf({ path: "/tmp/mortgage-review-20261122/report.pdf", format: "Letter", printBackground: true });
      await report.close();
      await page.evaluate(() => { window.open = () => null; });
      let blockedMessage = "";
      page.once("dialog", async dialog => { blockedMessage = dialog.message(); await dialog.accept(); });
      await page.locator("#previewReport").click();
      assert.match(blockedMessage, /allow pop-ups/i);
      if (width === 375) {
        await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
        assert.equal(await page.locator(".mobile-estimate").evaluate(element => element.scrollWidth > element.clientWidth), false);
        await page.reload();
        const reached = new Set();
        for (let step = 0; step < 100; step++) {
          await page.keyboard.press("Tab");
          const id = await page.evaluate(() => document.activeElement.id);
          if (id) reached.add(id);
          if (id === "previewReport") break;
        }
        for (const id of ["homePrice", "downPayment", "downPaymentType", "interestRate", "loanTerm", "propertyTax", "insurance", "pmi", "hoa", "extraPayment", "startDate", "paymentFrequency", "previewReport"]) {
          assert.ok(reached.has(id), `Keyboard did not reach ${id}`);
        }
      }
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, case: "all checks passed", defaultMonthly: 3244.39, extraMonthly: 3744.39, extraMonths: 232, extraInterest: 316459.24 }));
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
