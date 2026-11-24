# Test Plan: ShopKart Mini Checkout

**Scope:** the single checkout page in `index.html`: cart, totals, name validation, order placement, confirmation.
**Out of scope:** payments, backend, persistence across reloads, cross-browser testing beyond Chromium.
**Environment:** Chromium 153.0.8010.12 (Playwright 1.63.0), Node 25.8.2 on Windows 11, desktop 1280×900 and mobile 390×844, served by `serve.js`.
**Date:** 24 Nov 2026

## 1. Risks, in priority order

| Priority | Risk | Why it matters | Covered by |
|---|---|---|---|
| P1 | Duplicate orders from a double-click or Enter + click | Customer is charged twice or gets two references | Manual M2, M3; regression test R |
| P1 | Wrong totals (line total, order total, or confirmation total) | Customer pays a different amount than shown | Auto 1, 3; manual M4 |
| P1 | Order placed with an empty cart or blank name | Invalid orders reach fulfilment | Auto 2; manual M1 |
| P2 | Customer input lost after a validation error | Frustration and abandonment | Auto 2; manual M1 |
| P2 | Validation message unclear or not near the problem | Customer can't fix the error | Auto 2; manual M1 |
| P2 | Confirmation missing the reference or showing wrong details | No proof of order | Auto 1 |
| P3 | Quantity limits broken (0, negative, or unbounded) | Odd totals, accidental bulk orders | Manual M5 |
| P3 | Layout breaks on mobile | Customer can't see steps or controls | Manual M7 |
| P3 | Name rendered as HTML | Script injection | Manual M6 |

## 2. Automated checks

`tests/checkout.spec.js`, run with `npm test`. Every test starts from a fresh browser context and first asserts the clean state: cart empty, total ₹0.

| ID | Check | Steps | Expected | Result |
|---|---|---|---|---|
| A1 | Successful checkout | Add both products → name "Aarav Mehta" → Place order | One confirmation; "Order Confirmed!"; first name shown; total ₹4,498; delivery window; reference `SK-YYYY-NNNNN` | Pass |
| A2 | Missing name blocks checkout | Add Smart Watch, qty 2 → name "   " → Place order | "Please enter your full name." visible; field invalid and focused; no confirmation; qty 2, total ₹4,998 and typed value kept; typing a name clears the error | Pass |
| A3 | Quantity updates exact total | Add both → Headphones + twice → then − once | ×3: line ₹5,997, total ₹8,496; ×2: line ₹3,998, total ₹6,497 | Pass |
| R | Regression for DEF-1 | Add Smart Watch → name → double-click Place order | While placing: button, + control and name field disabled; one confirmation; total ₹2,499 | Pass |
| R3 | Regression for DEF-3 | Open page → add item → place order | Badge hidden when empty; "1" with one item; hidden after the order; label "Cart, 0 items" when empty; no cart icon on the confirmation screen (as in the design) | Pass |
| R4 | New order after confirmation | Place an order → Continue Shopping → add Headphones, name "Second Customer" → Place order | Clean page (cart empty, ₹0, name blank); second order gives one confirmation, total ₹1,999 | Pass |

Run of 24 Nov 2026: **6/6 passed**. With `--repeat-each=10`: **60/60 passed**. One earlier `--repeat-each=5` run had 4 simultaneous failures (one repeat group, 1.6 min total, the machine was slow); I did not capture the error text and could not reproduce it in the 90 repeat runs that followed. I suspect machine load, but did not prove it. A clean cold-start run later showed the first tests taking 18 to 20 s, close to Playwright's 30 s default timeout, so the config now allows 60 s per test (the tests themselves take 2 to 5 s once warm). Retries are off on purpose so a real flake would show.

## 3. Manual and exploratory checks

**Method:** each check is run step by step in a real Chromium browser through a Playwright script, not by hand, recording what appeared on screen and saving screenshots in `evidence/`. Anyone can repeat it with `npm run manual`: it prints PASS or FAIL per check (saved in `manual-results.txt`), regenerates `evidence/manual/` and `evidence/screens/`, and reproduces DEF-1 and DEF-3 on throwaway copies of the page with the fix removed. The same steps can be followed by hand in a browser at `http://localhost:4173`.

| ID | Check | Steps | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|---|
| M1 | Empty cart | Fresh page → type name "Aarav" → Place order | Blocked; "Your cart is empty. Add at least one item to place an order."; name kept | Blocked with that message in the order summary; no confirmation; name field still "Aarav" | Pass | `manual/01-empty-cart-blocked.png` |
| M1b | Empty cart and blank name | Fresh page → Place order | Both messages shown at once | Cart message and name message both shown | Pass | `manual/02-empty-cart-and-blank-name.png` |
| M2 | Rapid double-click | Add Smart Watch → name → double-click Place order | One confirmation, one reference | Button showed "Placing order…" disabled; then exactly 1 confirmation with one reference | Pass | `manual/03a-double-click-placing.png`, `manual/03b-double-click-one-confirmation.png` |
| M3 | Five fast clicks, then Enter in the name field | Add item → name → 5 clicks 10 ms apart → press Enter | One confirmation | 1 confirmation | Pass | (no screenshot) |
| M4 | Edit cart while order is placing | Add Smart Watch → name → Place order → click + during "Placing order…" | Cart can't change, or confirmation matches what was shown | **Before fix: failed (DEF-1).** After fix: + is disabled; confirmation ₹2,499 matches | Pass after fix | `before-fix/DEF-1*.png`, `after-fix/DEF-1*.png` |
| M5 | Quantity bounds | Click "Add to cart" 12 times; check − at qty 1 | Max 10, total ₹19,990; − disabled at 1 | Qty stopped at 10, Add disabled, total ₹19,990; − disabled at 1 | Pass | (no screenshot) |
| M6 | HTML in name | Name `<img src=x onerror=alert(1)>` → place order | Shown as plain text, no script runs | Shown as text; no alert dialog | Pass | (no screenshot) |
| M7 | Mobile layout, 390 px wide | Open page, add one item | No sideways scrolling; all steps visible | **Before fix: failed (DEF-2).** After fix: no overflow | Pass after fix | `before-fix/DEF-2*.png`, `after-fix/DEF-2*.png` |
| M8 | Header cart badge | Open page; add item; place order; check the icon each time | No badge when empty or after the order; label "Cart, 0 items" | **Before fix: failed (DEF-3).** After fix: badge hidden, label correct | Pass after fix | `before-fix/DEF-3*.png`, `after-fix/DEF-3*.png` |
| M9 | New order after confirmation | Place an order → Continue Shopping → check the page → place a second order | Cart empty, ₹0, name blank; second order succeeds | Clean page; second confirmation total ₹1,999 | Pass | (script output) |
| M10 | Images in a preview pane | Open the page as a `data:` URL, as some preview panes do | Product and empty-cart images still show | The first build loaded images from `assets/` and showed none in such a pane; images are now inlined (384 px WebP) and all render | Pass after fix | (script output) |

## 4. Defects found

All four defects were real, found while running the page (DEF-4 by the reviewer), and fixed in the submitted code. Before and after screenshots are in `evidence/`.

### DEF-1: Cart can be changed while an order is being placed, so the confirmation total doesn't match the screen

- **Severity:** High (customer sees one total, order is recorded with another)
- **Steps:**
  1. Open the page. Add Smart Watch (total ₹2,499).
  2. Enter name "Aarav". Click **Place order**.
  3. While the button shows "Placing order…", click **+** on Smart Watch.
- **Expected:** the cart is locked while the order is placed, or the confirmation reflects what the customer saw.
- **Actual (before fix):** quantity went to 2 and the page showed an order total of ₹4,998, but the confirmation said ₹2,499.
- **Evidence:** `evidence/before-fix/DEF-1a-cart-edited-while-placing.png`, `evidence/before-fix/DEF-1b-confirmation-shows-old-total.png`. These are regenerated by `npm run manual` on the current layout, from a copy of the page with the fix removed (the first-build screenshots were replaced).
- **Cause:** only the Place order button was disabled during the placing step; the cart controls and name field stayed active, and the order had already been captured.
- **Fix:** the whole form is wrapped in a `<fieldset>` that is disabled while placing, and the click and input handlers ignore changes in that state.
- **Verified:** + is disabled during placing and the confirmation shows ₹2,499 (`evidence/after-fix/`). Regression test R fails on the old build and passes on the fixed build. `npm run manual` reproduces the defect on a copy of the page with the fix removed (screen ₹4,998, confirmation ₹2,499).

### DEF-2: Checkout steps overflow the screen on mobile

- **Severity:** Low (cosmetic, but causes sideways scrolling)
- **Steps:** open the page at 390×844 (iPhone 12–14 size).
- **Expected:** content fits the width; no horizontal scrolling.
- **Actual (before fix):** the "Cart / Details / Confirmation" row was wider than the screen; "Confirmation" was cut off and the page scrolled sideways (`scrollWidth > innerWidth`).
- **Evidence:** `evidence/before-fix/DEF-2-mobile-steps-overflow.png`
- **Fix:** below 560 px the step labels are visually hidden (still read by screen readers) and the gap is smaller, matching the original design's mobile behaviour.
- **Verified:** no horizontal overflow at 390 px (`evidence/after-fix/DEF-2-mobile-steps-fit.png`).

### DEF-3: Cart badge in the header never hides (stale count after the order)

- **Severity:** Low (cosmetic and accessibility, but the page shows a wrong cart count)
- **Steps:**
  1. Open the page. Look at the cart icon in the header.
  2. Add Smart Watch, enter a name, click **Place order**.
  3. On the confirmation screen, look at the cart icon again.
- **Expected:** no badge on an empty cart or after the order is placed; the cart button's accessible name says "Cart, 0 items".
- **Actual (before fix):** a "0" badge shows on the empty page, and a "1" badge stays on the confirmation screen. The accessible name read "Cart, 0 item".
- **Evidence:** `evidence/before-fix/DEF-3a-badge-on-empty-cart.png`, `evidence/before-fix/DEF-3b-badge-after-order.png`
- **Cause:** the code sets `badge.hidden = true`, but `.badge { display: grid }` overrides the browser's built-in hide rule, so the badge stays visible. The aria-label used the item count before the order was cleared, so "0" got the singular "item".
- **Fix:** `.badge[hidden] { display: none; }`, and one `n` (0 once placed) now drives the badge text, visibility and aria-label.
- **Verified:** badge is `display: none` on the empty page and after the order; label reads "Cart, 0 items" (`evidence/after-fix/DEF-3*.png`, taken on the redesigned page; the before-fix shots show the earlier layout). The redesign also added a global `[hidden] { display: none !important; }` rule so the same mistake cannot recur. `npm run manual` reproduces the defect by removing that rule (badge shows with `display: grid` on an empty cart). Regression test R3 fails on the old build ("expected hidden, received visible") and passes on the fixed build.
- **How it was found:** by running the page and looking at it, not by the manual cases M1 to M7, which only checked the main flow. Added as manual check M8.

### DEF-4: Product and empty-cart images do not show in a preview pane

- **Severity:** Medium (the page looks broken to a reviewer, although the checkout still works)
- **Reported by:** the person reviewing the page ("images are not showing"); my own tests missed it because they load the page over HTTP, where the images worked.
- **Steps:** open `index.html` in a preview that loads it as a `data:` URL (the desktop app's file preview does), then look at the product cards.
- **Expected:** the three images from the design show.
- **Actual (before fix):** the `<img>` tags pointed at `assets/*.png`; a `data:` page cannot resolve relative files, so all three had `naturalWidth` 0 and only a blank box showed. Over `npm start` or by opening the file directly they loaded fine.
- **Evidence:** measured in the app's browser pane (`naturalWidth` 0 for all three before the fix). I did not save a screenshot of the broken state; check M10 now guards it.
- **Cause:** relative image paths.
- **Fix:** the images were resized to 384 px WebP (about 10 to 15 KB each) and inlined in `index.html` as data URIs; the full-size originals are kept in `assets/source/`.
- **Verified:** `npm run manual` check M10 loads the page as a `data:` URL and all three images render (`naturalWidth` 384).

## 5. Known limitations (by design, not defects)

- Reloading the page clears the cart and any confirmation, since there is no storage or backend.
- Order references use date + random 5 digits; with no server, uniqueness across separate visits isn't guaranteed.
- Only Chromium was tested.
- DEF-2 (mobile step labels) was fixed in the first layout; the page was later restyled to match the supplied design, which hides step labels below 640 px by design. DEF-2 is covered today by check M7, but it cannot be reproduced on the current page.
- The design's wording about payment and email ("Payment received securely", "A receipt will be sent to your email") is shown as supplied, although this demo takes no payment and collects no email.
