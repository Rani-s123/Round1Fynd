# ShopKart Mini Checkout

A single-page checkout with two synthetic products and a Playwright browser test suite. No backend, database, payments, or external services; the page is one self-contained HTML file (no CDN fonts, scripts, or remote images; the images are inlined).

**Live demo:** https://fyndround.vercel.app (static page hosted on Vercel; the Playwright suite passes 6 of 6 against it).
**Demo video:** [demo/shopkart-demo.webm](demo/shopkart-demo.webm), about 65 s with captions, recorded on the live site (`node tools/record-demo.js <url>` records it again).

## What the page does

- Two products with fixed prices: Wireless Headphones (₹1,999) and Smart Watch (₹2,499).
- Add items, remove items, clear the cart, and change quantities (1 to 10 per item). Line totals, subtotal, and order total update immediately. Shipping is free, so subtotal = order total.
- One required field: **Full name**. A name of only spaces counts as blank.
- **Place order** is blocked when the cart is empty or the name is blank. A clear message appears, and the cart and anything typed in the name field are kept.
- On success, a single confirmation shows the customer's first name, the order total, an estimated delivery window, and an order reference in the form `SK-YYYY-NNNNN`.
- A simulated 600 ms "Placing order…" step stands in for a server call. During it the button and the whole form are disabled, and a guard in code allows only one order per checkout, so double-clicking or pressing Enter cannot create a second confirmation.

## Design

The page follows the supplied ShopKart design (cart and details, empty cart, name error, order confirmed): same colour tokens, radii, shadows, header, steps, summary card and copy, in plain CSS with inline SVG icons. The three product and empty-cart images from the design are resized (384 px WebP) and inlined in `index.html`, so the page makes no network requests and still shows its images when opened in a preview pane; the full-size originals are in `assets/source/`. Differences from the design:

- A small **Products** section sits above the cart so the customer can add and remove the two products, which the design does not show.
- The empty cart and the name error appear inside the same page rather than as separate screens, so Place Order can be clicked (and blocked) with an empty cart.
- The font is Inter when installed, otherwise the system font (no web font is loaded).
- The design's copy about payment ("Payment received securely", "payment details are encrypted") is kept as supplied, although this demo takes no payment.

## Project layout

```
index.html               The checkout page (HTML, CSS and JS in one file)
assets/source/           Full-size originals of the images inlined in index.html
serve.js                 Tiny static server (Node built-ins only)
tools/manual-checks.js   Scripted manual checks M1 to M10, plus defect reproduction (npm run manual)
results.txt              Output of the last npm test
manual-results.txt       Output of the last npm run manual
playwright.config.js     Test config: starts the server, runs Chromium
tests/checkout.spec.js   Browser tests (3 required checks + 3 extra checks)
TEST-PLAN.md             Risks, test cases, manual results, defects
evidence/                Screenshots referenced in TEST-PLAN.md
```

## Run the page

Requires Node.js 18 or newer.

```bash
npm start
```

Open http://localhost:4173. You can also open `index.html` directly in a browser; it has no dependencies.

## Run the browser tests

```bash
npm install
npx playwright install chromium   # first time only, downloads the browser
npm test
```

The Playwright config starts the server automatically. Other options:

```bash
npm run test:headed               # watch the tests run in a visible browser
npx playwright test --repeat-each=5   # check for flakiness
npm run report                    # open the HTML report after a run
npm run manual                    # scripted manual checks M1 to M10 + reproduces DEF-1 and DEF-3
```

### What the tests check

| # | Test | Key assertions |
|---|------|----------------|
| 1 | Successful checkout | Exactly one confirmation; heading "Order confirmed!"; first name, total ₹4,498, delivery window, and a reference matching `SK-YYYY-NNNNN` |
| 2 | Missing name blocks checkout | Name of only spaces shows "Please enter your full name.", field is invalid and focused, no confirmation; quantity, total and typed value are preserved; typing a name clears the error |
| 3 | Quantity updates the exact total | Headphones ×3 → line ₹5,997, total ₹8,496; then ×2 → line ₹3,998, total ₹6,497 |
| R | Regression for DEF-1 | Double-click → button, quantity controls and name field disabled while placing; exactly one confirmation with the correct total |
| R4 | New order after confirmation | Continue Shopping returns a clean page (cart empty, ₹0, name blank); a second order gives one confirmation with the right total |
| R3 | Regression for DEF-3 | Cart badge hidden when empty and after the order; shows "1" with one item; label "Cart, 0 items" when empty; no cart icon on the confirmation screen |

Each test starts from a clean state: Playwright gives every test a new browser context, the page stores nothing, and a `beforeEach` asserts the cart is empty and the total is ₹0 before any step. Assertions are on what the customer sees (headings, labels, messages, totals) using Playwright's auto-waiting `expect`, with no fixed waits.

## Results (24 Nov 2026, Chromium 153, Playwright 1.63.0)

- 6 of 6 tests passed.
- `--repeat-each=10`: 60 of 60 passed. (One earlier x5 run had 4 simultaneous failures that I could not reproduce; details in [TEST-PLAN.md](TEST-PLAN.md).)
- `npm run manual`: 14 of 14 checks as expected (M1 to M10, plus DEF-1 and DEF-3 reproduced on pages with the fix removed).
- Manual/exploratory checks and the four defects found (all fixed) are in [TEST-PLAN.md](TEST-PLAN.md).
