# HouseMoney

A mortgage planner for the awkward middle of a move: you're selling one house to buy
another, and the payment on the next one depends on two things you don't control yet —
**what your current house sells for** and **what rate you get**.

An ordinary mortgage calculator makes you guess one number for each and slide it around.
This shows the whole field at once.

**Live: https://pairic1.github.io/HouseMoney/**

## What it does

- **The grid.** Sale price down one axis, rate across the other, total monthly payment in
  every cell. Blue under your budget, red over, with a contour line drawn where you cross it.
- **Real numbers, not napkin math.** Buyer closing costs come out of your cash *before* the
  down payment — skipping them overstates the down payment by 2–3% of the purchase price.
  PMI is charged whenever the down payment lands under 20%, with the drop-off month computed
  from the amortization schedule.
- **Working backwards.** Give it a payment ceiling and it solves for the most house you
  could buy, at every sale price and rate.
- **Listings you're watching.** Save a house and see its full spread — best case to worst —
  side by side with the others.

The payment is principal, interest, property tax, insurance, HOA, and PMI. Property tax is
figured on the purchase price, since that's what it reassesses to on sale.

## Your numbers stay yours

Everything you enter lives in your browser's `localStorage` and goes nowhere else. There's no
backend, no analytics, and no network calls. The defaults committed here are round
placeholders, not anyone's real position.

## Running it

```bash
npm install
npm run dev
```

```bash
npm test
```

The math lives in `src/lib` as pure functions — `proceeds.ts` (sale → cash to close),
`mortgage.ts` (loan → monthly stack), `grid.ts` (the sweeps and the affordability solve).
The tests anchor to published amortization values, so a formula that drifts fails loudly
rather than silently returning a plausible wrong number.

Pushing to `main` builds and deploys to GitHub Pages.

## Not a lender quote

These are estimates for your own planning. Your actual rate, escrow, and closing costs come
from the Loan Estimate.
