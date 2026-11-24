// Scripted run of the manual/exploratory checks in TEST-PLAN.md (M1 to M8).
// Also reproduces DEF-1 and DEF-3 on throwaway copies of index.html with the fix removed,
// so anyone can see the defects without needing the old build. Run: npm run manual
const { chromium } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'index.html');
const EVIDENCE = path.join(ROOT, 'evidence');
const results = [];

function rec(id, ok, note = '') {
  results.push({ id, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${note ? '  (' + note + ')' : ''}`);
}

// A copy of index.html with one fix removed; throws if the fix text is not found.
function withoutFix(name, from, to) {
  const html = fs.readFileSync(PAGE, 'utf8');
  if (!html.includes(from)) throw new Error(`Fix text for ${name} not found in index.html`);
  const file = path.join(os.tmpdir(), `shopkart-${name}.html`);
  fs.writeFileSync(file, html.replace(from, to));
  return file;
}

(async () => {
  const browser = await chromium.launch();
  const shot = (page, rel) => page.screenshot({ path: path.join(EVIDENCE, rel), fullPage: true });
  const open = async (file = PAGE, viewport = { width: 1280, height: 900 }) => {
    const page = await (await browser.newContext({ viewport })).newPage();
    page.dialogs = [];
    page.on('dialog', (d) => { page.dialogs.push(d.message()); d.dismiss(); });
    await page.goto(pathToFileURL(file).href);
    return page;
  };
  const confirmations = (p) => p.getByTestId('confirmation').count();
  const add = (p, name) => p.getByRole('button', { name: `Add ${name} to cart` }).click();

  // M1: empty cart is blocked and the typed name is kept
  let p = await open();
  await shot(p, 'screens/1-start-empty.png');
  await p.getByLabel('Full name').fill('Aarav');
  await p.getByRole('button', { name: 'Place Order' }).click();
  await shot(p, 'manual/01-empty-cart-blocked.png');
  rec('M1  empty cart blocked, name kept',
    (await p.getByTestId('cart-error').isVisible()) && (await confirmations(p)) === 0 && (await p.getByLabel('Full name').inputValue()) === 'Aarav');

  // M1b: empty cart and blank name together
  p = await open();
  await p.getByRole('button', { name: 'Place Order' }).click();
  await shot(p, 'manual/02-empty-cart-and-blank-name.png');
  rec('M1b both messages at once',
    (await p.getByTestId('cart-error').isVisible()) && (await p.getByText('Please enter your full name.').isVisible()));

  // Screens for the report: cart, name error, confirmation
  p = await open();
  await add(p, 'Wireless Headphones');
  await add(p, 'Smart Watch');
  await shot(p, 'screens/2-cart.png');
  await p.getByRole('button', { name: 'Place Order' }).click();
  await shot(p, 'screens/3-name-error.png');
  await p.getByLabel('Full name').fill('Aarav Mehta');
  await p.getByRole('button', { name: 'Place Order' }).click();
  await p.getByTestId('confirmation').waitFor();
  await shot(p, 'screens/4-confirmation.png');

  // M2: rapid double-click gives one confirmation
  p = await open();
  await add(p, 'Smart Watch');
  await p.getByLabel('Full name').fill('Aarav Mehta');
  await p.getByRole('button', { name: 'Place Order' }).dblclick();
  await shot(p, 'manual/03a-double-click-placing.png');
  await p.getByTestId('confirmation').waitFor();
  await p.waitForTimeout(1000);
  await shot(p, 'manual/03b-double-click-one-confirmation.png');
  rec('M2  double-click: one confirmation, one reference',
    (await confirmations(p)) === 1 && (await p.getByTestId('order-reference').count()) === 1);

  // M3: five fast clicks, then a form submit (Enter)
  p = await open();
  await add(p, 'Smart Watch');
  await p.getByLabel('Full name').fill('Aarav');
  await p.evaluate(() => { const b = document.getElementById('place-order'); for (let i = 0; i < 5; i++) b.click(); });
  await p.evaluate(() => document.getElementById('full-name')?.form.requestSubmit());
  await p.getByTestId('confirmation').waitFor();
  await p.waitForTimeout(1000);
  rec('M3  five clicks plus submit: one confirmation', (await confirmations(p)) === 1);

  p = await open();
  await add(p, 'Smart Watch');
  await p.getByLabel('Full name').fill('Enter User');
  await p.getByLabel('Full name').press('Enter');
  await p.getByTestId('confirmation').waitFor();
  rec('M3b Enter key places exactly one order', (await confirmations(p)) === 1);

  // M4: cart edited while the order is being placed (fixed page, then page without the fix)
  const noLock = withoutFix('def1',
    "${state.status === 'placing' ? 'disabled' : ''}>", '>')
  const noGuard = fs.readFileSync(noLock, 'utf8').replace(
    "if (state.status === 'placing' && btn.dataset.action !== 'new-order') return;", '');
  fs.writeFileSync(noLock, noGuard);
  for (const [label, file] of [['fixed page', PAGE], ['page without the DEF-1 fix', noLock]]) {
    p = await open(file);
    await add(p, 'Smart Watch');
    await p.getByLabel('Full name').fill('Aarav');
    await p.getByRole('button', { name: 'Place Order' }).click();
    await p.evaluate(() => document.querySelector('[data-action="inc"]')?.click());
    const onScreen = await p.getByTestId('order-total').textContent();
    const dir = label === 'fixed page' ? 'after-fix' : 'before-fix';
    await shot(p, label === 'fixed page' ? `${dir}/DEF-1a-cart-locked-while-placing.png` : `${dir}/DEF-1a-cart-edited-while-placing.png`);
    await p.getByTestId('confirmation').waitFor();
    await shot(p, label === 'fixed page' ? `${dir}/DEF-1b-confirmation-total-matches.png` : `${dir}/DEF-1b-confirmation-shows-old-total.png`);
    const confirmed = await p.getByTestId('confirm-total').textContent();
    const note = `screen ${onScreen}, confirmation ${confirmed}`;
    if (label === 'fixed page') rec('M4  fixed page: totals agree', onScreen === confirmed, note);
    else rec('DEF-1 reproduces without the fix (totals disagree)', onScreen !== confirmed, note);
  }

  // M5: quantity bounds
  p = await open();
  for (let i = 0; i < 12; i++) await add(p, 'Smart Watch').catch(() => {});
  const qty = await p.getByLabel('Quantity of Smart Watch', { exact: true }).textContent();
  const total = await p.getByTestId('order-total').textContent();
  await p.getByRole('button', { name: 'Remove Smart Watch' }).click();
  await add(p, 'Smart Watch');
  const decOff = await p.getByRole('button', { name: 'Decrease quantity of Smart Watch' }).isDisabled();
  rec('M5  quantity capped at 10, minus disabled at 1', qty === '10' && /24,990/.test(total) && decOff, `qty ${qty}, total ${total}`);

  // M6: HTML in the name is shown as text
  p = await open();
  await add(p, 'Smart Watch');
  await p.getByLabel('Full name').fill('<img src=x onerror=alert(1)> Mehta');
  await p.getByRole('button', { name: 'Place Order' }).click();
  await p.getByTestId('confirmation').waitFor();
  await p.waitForTimeout(500);
  rec('M6  HTML in name is plain text, no script runs',
    (await p.getByTestId('confirm-name').textContent()) === '<img' && p.dialogs.length === 0 && (await p.locator('main img[src="x"]').count()) === 0);

  // M7: mobile width, no sideways scroll
  p = await open(PAGE, { width: 390, height: 844 });
  await add(p, 'Smart Watch');
  const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  rec('M7  390 px wide: no horizontal overflow', o.sw <= o.iw, `scrollWidth ${o.sw}, innerWidth ${o.iw}`);

  // M8: cart badge hidden when empty (fixed page, then page without the [hidden] rule)
  const noHidden = withoutFix('def3', '[hidden] { display: none !important; }', '');
  for (const [label, file] of [['fixed page', PAGE], ['page without the DEF-3 fix', noHidden]]) {
    p = await open(file);
    const display = await p.evaluate(() => getComputedStyle(document.getElementById('cart-badge')).display);
    if (label === 'fixed page') rec('M8  fixed page: no badge on an empty cart', display === 'none', `display ${display}`);
    else rec('DEF-3 reproduces without the fix (badge visible when empty)', display !== 'none', `display ${display}`);
  }

  // M9: starting a new order resets everything and a second order works
  p = await open();
  await add(p, 'Smart Watch');
  await p.getByLabel('Full name').fill('First Customer');
  await p.getByRole('button', { name: 'Place Order' }).click();
  await p.getByTestId('confirmation').waitFor();
  await p.getByRole('button', { name: /Continue Shopping/ }).click();
  const clean = (await p.getByTestId('order-total').textContent()) === '₹0' && (await p.getByLabel('Full name').inputValue()) === '';
  await add(p, 'Wireless Headphones');
  await p.getByLabel('Full name').fill('Second Customer');
  await p.getByRole('button', { name: 'Place Order' }).click();
  await p.getByTestId('confirmation').waitFor();
  rec('M9  new order starts clean and a second order succeeds',
    clean && (await p.getByTestId('confirm-total').textContent()) === '₹1,999');

  // M10: images show when the page is opened as a data: URL (some preview panes do this)
  p = await (await browser.newContext()).newPage();
  await p.goto('data:text/html;charset=utf-8,' + encodeURIComponent(fs.readFileSync(PAGE, 'utf8')));
  await add(p, 'Smart Watch');
  const widths = await p.evaluate(() => [...document.images].map((i) => i.naturalWidth));
  rec('M10 images render from a data: URL (no external files needed)', widths.length >= 3 && widths.every((w) => w > 0), `widths ${widths.join(',')}`);

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} checks as expected`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
