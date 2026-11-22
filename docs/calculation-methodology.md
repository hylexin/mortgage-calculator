# Mortgage estimate calculation notes

These notes describe the current calculator model, not a lender quote or legal advice. Values are calculated using JavaScript floating-point numbers and formatted for display; individual rows are not rounded before later balances are calculated. Lenders may use different rounding and servicing rules.

## Inputs and payment

- Loan principal is the entered home price minus the down payment. Annual nominal interest is divided by 12; the fixed principal-and-interest payment uses the standard level-payment formula. At zero interest it is principal divided by the number of months.
- Monthly property tax is either home price times the entered annual percentage divided by 12, the entered annual amount divided by 12, or the entered monthly amount. Insurance is annual amount divided by 12 or the entered monthly amount. HOA is monthly.
- The first-month housing cost includes principal, interest, taxes, insurance, PMI, HOA and any modeled extra principal. It is not necessarily the amount paid to a loan servicer. Closing costs, utilities, maintenance and costs after the loan payoff are excluded from loan-period totals.
- Extra monthly principal begins with the first payment. The model caps the final principal and extra payment at the remaining loan balance. In the biweekly approximation, an additional one-twelfth of the scheduled monthly principal-and-interest payment is applied to principal each month; actual biweekly dates are not modeled.

## PMI

- PMI applies in this model only when the down payment is below 20%, the loan balance is positive, and an entered PMI value is positive.
- For the annual percentage option, each month's PMI equals that month's starting balance times the entered annual rate divided by 12. The monthly-dollar option uses the entered dollar amount each month.
- The model stops charging PMI when a month's starting balance is at or below 80% of the entered purchase price. This is a simplified modeling assumption, not a determination that a particular borrower qualifies for cancellation.
- The CFPB describes eligibility conditions for requesting cancellation and different rules for automatic termination for certain loans. Original value may differ from purchase price; FHA, VA and other situations differ. See [CFPB PMI cancellation guidance](https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/).
- The referenced comparison site describes its percentage as a percentage of the mortgage amount but does not clearly establish in its public explanation whether the premium is recalculated each month. A different lifetime total alone does not establish that either model is incorrect.

## Validation and comparison

Negative, empty or non-finite numeric inputs, a zero home price, a down payment above the price or 100%, and non-integer loan terms outside 1 to 100 years are rejected with field-level messages. The previous valid results are labeled as such and report preview is disabled until corrected. Amounts above one trillion are rejected to bound calculations.

The extra-payment comparison uses the same inputs for both scenarios. The baseline uses monthly payments and no extra principal; the current scenario uses the selected extra payment and frequency. The shown interest savings compares those modeled schedules; actual costs and savings can differ. No assumption is made that taxes or insurance stop after payoff.
