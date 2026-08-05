# HouseMoney

A mortgage planner for the awkward middle of a move: you're selling one house to buy
another, and the payment on the next one depends on two things you don't control yet —
**what your current house sells for** and **what rate you get**.

An ordinary mortgage calculator makes you guess one number for each and slide it around.
This shows the whole field at once.

**Live: https://pairic1.github.io/HouseMoney/**

Two pages:

- **Payment Estimator** — what a given house costs per month, across every sale price and rate.
- **Long Run** — whether to move at all: sell now, wait and move later, or stay put.

## Payment Estimator

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
figured on the purchase price, since that's what it reassesses to on sale — or as a flat yearly
bill, if you already know the number.

## Long Run

Moving costs roughly 8% round-trip in commission and closing before it buys you anything, so
staying is almost always cheaper early. The question is **when the lines cross** — and whether
they cross before you'd have moved anyway. A single endpoint total can't tell you that, because
the ranking flips depending on when you actually leave.

Each strategy runs the same monthly loop over two accounts: home equity, and a cash balance that
housing costs are drawn from and that compounds at your investment return. Opportunity cost falls
out of the accounting rather than being bolted on — money not tied up in a house is visibly
earning something. Set the return to 0% and it collapses to plain cash-flow accounting.

- **Several move dates at once.** Waiting five years and waiting ten are different bets; add up to
  three and read them side by side against selling now.
- **Everything is plotted against staying put**, so the flat line at zero *is* staying put — it
  never appears as its own curve. A wait-then-move plan is identical to it until the year it moves,
  so that stretch of the line is drawn dashed and the move date is marked. Only the gaps carry
  meaning; ahead and behind are said in a glyph, a color, and a word.
- **Year by year.** Interest, principal, escrow, upkeep, one-offs and moving costs for every year of
  every plan — the amortization schedule the horizon totals come from, including the loan reset at
  a move.
- **Planned repairs** are dated and attached to a specific house, so a roof due in 2030 simply
  doesn't land on a plan that sold in 2027. That asymmetry is frequently the whole argument.

Property tax and upkeep can each be a percent of the home's value or a flat yearly figure, per
house. Percent-of-value upkeep climbs as the house does, which overstates the bill on an expensive
house — land and outbuildings don't get pricier because the house appraises higher. Flat figures
still drift with cost inflation; set that to 0% to freeze them exactly.

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
