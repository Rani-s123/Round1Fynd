// @ts-check
const { test, expect } = require('@playwright/test');

// Every test gets a brand-new browser context and page from Playwright, and the
// app keeps no storage, so each check starts from a clean state: empty cart,
// empty name field, no order placed.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('₹0');
});

test('1. successful checkout shows exactly one confirmation with a reference', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Wireless Headphones to cart' }).click();
  await page.getByRole('button', { name: 'Add Smart Watch to cart' }).click();
  await expect(page.getByTestId('order-total')).toHaveText('₹4,498');

  await page.getByLabel('Full name').fill('Aarav Mehta');
  await page.getByRole('button', { name: 'Place order' }).click();

  const confirmation = page.getByTestId('confirmation');
  await expect(confirmation).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Order confirmed!' })).toBeVisible();
  await expect(page.getByTestId('confirm-name')).toHaveText('Aarav');
  await expect(page.getByTestId('confirm-total')).toHaveText('₹4,498');
  await expect(page.getByTestId('order-reference')).toHaveText(/^SK-\d{4}-\d{5}$/);
  await expect(page.getByTestId('confirm-delivery')).toHaveText(/^\d{1,2}(\s[A-Z][a-z]{2})?–\d{1,2}\s[A-Z][a-z]{2}$/);
});

test('2. a blank name blocks checkout, shows a clear message, and keeps the cart', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Smart Watch to cart' }).click();
  await page.getByRole('button', { name: 'Increase quantity of Smart Watch' }).click();
  await expect(page.getByTestId('order-total')).toHaveText('₹4,998');

  // Spaces only should count as blank.
  await page.getByLabel('Full name').fill('   ');
  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page.getByText('Please enter your full name.')).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Full name')).toBeFocused();
  await expect(page.getByTestId('confirmation')).toHaveCount(0);

  // What the customer entered is preserved.
  await expect(page.getByLabel('Quantity of Smart Watch', { exact: true })).toHaveText('2');
  await expect(page.getByTestId('order-total')).toHaveText('₹4,998');
  await expect(page.getByLabel('Full name')).toHaveValue('   ');

  // Fixing the field clears the error.
  await page.getByLabel('Full name').fill('Priya');
  await expect(page.getByText('Please enter your full name.')).toHaveCount(0);
});

test('3. changing quantity updates the line total and order total exactly', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Wireless Headphones to cart' }).click();
  await page.getByRole('button', { name: 'Add Smart Watch to cart' }).click();
  await expect(page.getByTestId('line-total-headphones')).toHaveText('₹1,999');
  await expect(page.getByTestId('order-total')).toHaveText('₹4,498');

  const increase = page.getByRole('button', { name: 'Increase quantity of Wireless Headphones' });
  await increase.click();
  await increase.click();
  await expect(page.getByLabel('Quantity of Wireless Headphones', { exact: true })).toHaveText('3');
  await expect(page.getByTestId('line-total-headphones')).toHaveText('₹5,997'); // 3 × 1,999
  await expect(page.getByTestId('line-total-watch')).toHaveText('₹2,499');
  await expect(page.getByTestId('order-total')).toHaveText('₹8,496');        // 5,997 + 2,499

  await page.getByRole('button', { name: 'Decrease quantity of Wireless Headphones' }).click();
  await expect(page.getByTestId('line-total-headphones')).toHaveText('₹3,998');
  await expect(page.getByTestId('order-total')).toHaveText('₹6,497');
});

// Extra regression check for defect DEF-3 (found when running the page, now fixed).
// The header cart badge must be hidden when the cart is empty and after an order is placed.
test('regression DEF-3: cart badge is hidden when empty and after order, shown with items', async ({ page }) => {
  const badge = page.locator('#cart-badge');
  await expect(badge).toBeHidden();
  await expect(page.getByRole('button', { name: 'Cart, 0 items' })).toBeVisible();

  await page.getByRole('button', { name: 'Add Smart Watch to cart' }).click();
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Cart, 1 item' })).toBeVisible();

  await page.getByLabel('Full name').fill('Aarav Mehta');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  // The confirmation header has no cart icon, so no stale count can show.
  await expect(badge).toBeHidden();
  await expect(page.getByRole('button', { name: /^Cart,/ })).toBeHidden();
});

// Extra check: after an order, Continue Shopping returns to a clean page and a second order works.
test('starting a new order after confirmation resets the cart and name', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Smart Watch to cart' }).click();
  await page.getByLabel('Full name').fill('First Customer');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByTestId('confirmation')).toHaveCount(1);

  await page.getByRole('button', { name: 'Continue Shopping' }).click();
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('₹0');
  await expect(page.getByLabel('Full name')).toHaveValue('');

  await page.getByRole('button', { name: 'Add Wireless Headphones to cart' }).click();
  await page.getByLabel('Full name').fill('Second Customer');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('confirm-name')).toHaveText('Second');
  await expect(page.getByTestId('confirm-total')).toHaveText('₹1,999');
});

// Extra regression check for defect DEF-1 (found during manual testing, now fixed).
// Not one of the three required checks.
test('regression DEF-1: double-click gives one confirmation and the cart is locked while placing', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Smart Watch to cart' }).click();
  await page.getByLabel('Full name').fill('Aarav Mehta');
  await page.getByRole('button', { name: 'Place order' }).dblclick();

  await expect(page.getByRole('button', { name: 'Placing order…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Increase quantity of Smart Watch' })).toBeDisabled();
  await expect(page.getByLabel('Full name')).toBeDisabled();

  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveCount(1);
  await expect(page.getByTestId('confirm-total')).toHaveText('₹2,499');
});
