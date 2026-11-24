// Records a captioned walkthrough of the checkout as demo/shopkart-demo.webm.
// Usage: node tools/record-demo.js [url]   (default: the local index.html)
const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const URL = process.argv[2] || pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const OUT = path.join(__dirname, '..', 'demo');
const RAW = path.join(OUT, '_raw');
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(RAW, { recursive: true, force: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: RAW, size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();
  const wait = (ms) => page.waitForTimeout(ms);
  await page.goto(URL, { waitUntil: 'load' });

  // Caption bar and a visible cursor, outside #main so re-renders never remove them.
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      #demo-caption { position: fixed; left: 0; right: 0; bottom: 0; z-index: 99999; padding: 14px 24px; background: rgba(36,33,42,.93);
        color: #fff; font: 600 20px/1.3 Inter, "Segoe UI", system-ui, sans-serif; text-align: center; pointer-events: none; }
      #demo-cursor { position: fixed; left: -50px; top: -50px; width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%;
        border: 3px solid #6312B7; background: rgba(99,18,183,.25); z-index: 100000; pointer-events: none; transition: transform .1s; }
      #demo-cursor.down { transform: scale(.65); }`;
    document.head.appendChild(style);
    const cap = document.createElement('div'); cap.id = 'demo-caption'; document.body.appendChild(cap);
    const cur = document.createElement('div'); cur.id = 'demo-cursor'; document.body.appendChild(cur);
    document.addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    document.addEventListener('mousedown', () => cur.classList.add('down'), true);
    document.addEventListener('mouseup', () => cur.classList.remove('down'), true);
  });

  const caption = (text) => page.evaluate((t) => { document.getElementById('demo-caption').textContent = t; }, text);
  const target = async (loc) => {
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await wait(700);
    const b = await loc.boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y, { steps: 25 });
    await wait(250);
    return { x, y };
  };
  const click = async (loc) => { const { x, y } = await target(loc); await page.mouse.click(x, y); };
  const type = async (loc, text) => { await click(loc); await page.keyboard.type(text, { delay: 90 }); };
  const place = () => page.getByRole('button', { name: 'Place Order' });
  const name = () => page.getByLabel('Full name');
  const frame = (n) => page.screenshot({ path: path.join(require('os').tmpdir(), `shopkart-demo-frame-${n}.png`) });

  await caption('ShopKart checkout: starting with an empty cart');
  await wait(2500);

  // 1. Empty cart and blank name
  await click(place());
  await expect(page.getByTestId('cart-error')).toBeVisible();
  await expect(page.getByText('Please enter your full name.')).toBeVisible();
  await caption('Empty cart and blank name: checkout is blocked with clear messages');
  await wait(1200);
  await frame(1);
  await wait(2000);

  // 2. Name kept while the cart is still empty
  await type(name(), 'Aarav');
  await caption('Typing a name clears its error, and what was typed is kept');
  await wait(1500);
  await click(place());
  await expect(page.getByTestId('cart-error')).toBeVisible();
  await expect(name()).toHaveValue('Aarav');
  await caption('Still blocked: the cart is empty. The name is still there');
  await wait(3000);

  // 3. Add products and change quantity
  await click(page.getByRole('button', { name: 'Add Wireless Headphones to cart' }));
  await wait(1200);
  await click(page.getByRole('button', { name: 'Add Smart Watch to cart' }));
  await expect(page.getByTestId('order-total')).toHaveText('₹4,498');
  await caption('Add products: line totals and the order total update (₹1,999 + ₹2,499 = ₹4,498)');
  await wait(3000);
  const plus = page.getByRole('button', { name: 'Increase quantity of Wireless Headphones' });
  await click(plus);
  await wait(700);
  await click(plus);
  await expect(page.getByTestId('order-total')).toHaveText('₹8,496');
  await caption('Quantity 3: 3 × ₹1,999 + ₹2,499 = ₹8,496, exact');
  await frame(2);
  await wait(3500);

  // 4. Blank name with a full cart
  await click(name());
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await wait(600);
  await click(place());
  await expect(page.getByText('Please enter your full name.')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('₹8,496');
  await caption('Blank name blocks checkout; the cart and total are kept');
  await wait(3500);

  // 5. Valid order, rapid double-click
  await type(name(), 'Aarav Mehta');
  await caption('Valid name and items: now a rapid double-click on Place Order');
  await wait(1500);
  const { x, y } = await target(place());
  await page.mouse.dblclick(x, y);
  await wait(150);
  await caption('The order is being placed: the cart and the form are locked');
  await frame(3);
  await expect(page.getByTestId('confirmation')).toBeVisible();
  await wait(800);
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(900);
  await caption('Exactly one confirmation, with an order reference');
  await frame(4);
  await wait(4500);

  // 6. New order is clean
  await click(page.getByRole('button', { name: 'Continue Shopping' }));
  await expect(page.getByTestId('order-total')).toHaveText('₹0');
  await caption('Continue Shopping starts a clean order');
  await wait(3000);
  await caption('Code, tests and test plan are in the GitHub repo. 6 of 6 Playwright tests pass.');
  await wait(3500);

  const videoPath = await page.video().path();
  await ctx.close();
  await browser.close();
  fs.copyFileSync(videoPath, path.join(OUT, 'shopkart-demo.webm'));
  fs.rmSync(RAW, { recursive: true, force: true });
  console.log('saved', path.join(OUT, 'shopkart-demo.webm'), (fs.statSync(path.join(OUT, 'shopkart-demo.webm')).size / 1048576).toFixed(2), 'MB');
})().catch((e) => { console.error(e); process.exit(1); });
