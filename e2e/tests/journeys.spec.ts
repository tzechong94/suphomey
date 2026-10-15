import { expect, test } from '@playwright/test';

test('explore: chips re-rank blocks and lead to a block page', async ({ page }) => {
  await page.goto('/?mode=rent&type=4-ROOM&must=&nice=mrt,hawker');
  const count = page.getByText(/blocks pass your must-haves/);
  await expect(count).toContainText(/\d/);
  const before = await count.innerText();

  // Make MRT a must-have: fewer blocks should pass.
  await page.getByRole('button', { name: /^MRT: nice to have/ }).click();
  await expect(page.getByRole('button', { name: /^MRT: must have/ })).toBeVisible();
  await expect(count).not.toHaveText(before);
  await expect(page).toHaveURL(/must=mrt/);

  const first = page.getByRole('listitem').getByRole('link').first();
  const name = await first.innerText();
  await first.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(page.getByRole('heading', { name: /The damage/ })).toBeVisible();
});

test('search jumps straight to a block', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Find a block' }).fill('406 ang mo kio ave 10');
  await page.getByRole('option', { name: /Blk 406 Ang Mo Kio Avenue 10/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blk 406 Ang Mo Kio Avenue 10');
  await expect(page.getByText(/years of lease left/).first()).toBeVisible();
});

test('fair price check gives a verdict', async ({ page }) => {
  await page.goto('/check');
  await page.getByRole('combobox', { name: 'Find a block' }).fill('406 ang mo kio ave 10');
  await page.getByRole('option', { name: /Blk 406/ }).click();
  await page.getByLabel('Flat').selectOption('3-ROOM');
  await page.getByLabel(/Asking rent per month/).fill('9000');
  await page.getByRole('button', { name: 'Check it' }).click();
  await expect(page.getByText('Bit atas. Most people here paid less.')).toBeVisible();
  await expect(page.getByText(/higher than \d+% of deals/)).toBeVisible();
});

test('shortlist and compare survive navigation', async ({ page }) => {
  await page.goto('/');
  const cards = page.getByRole('article');
  await cards.nth(0).getByRole('button', { name: 'Add to shortlist' }).click();
  await cards.nth(0).getByRole('button', { name: 'Add to compare' }).click();
  await cards.nth(1).getByRole('button', { name: 'Add to compare' }).click();

  await page.getByRole('link', { name: /Shortlist/ }).click();
  await expect(page.getByRole('heading', { name: /Your shortlist/ })).toBeVisible();
  await expect(page.getByRole('article').or(page.locator('li a[href^="/blocks/"]')).first()).toBeVisible();

  await page.goto('/compare');
  await expect(page.getByRole('heading', { name: /Face-off/ })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Lease left' })).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(3);
});

test('rent vs buy uses a block’s real numbers', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Find a block' }).fill('406 ang mo kio ave 10');
  await page.getByRole('option', { name: /Blk 406/ }).click();
  await page.getByRole('link', { name: /Do the maths/ }).click();
  await expect(page.getByText(/Using Blk 406 Ang Mo Kio Avenue 10/)).toBeVisible();
  await expect(page.getByText(/(Buying wins after \d+ years?|Renting wins for all \d+ years)\./)).toBeVisible();
});

test('the tea page renders its insights', async ({ page }) => {
  await page.goto('/tea');
  await expect(page.getByRole('heading', { name: 'How rents moved since 2021' })).toBeVisible();
  await expect(page.getByText(/Within 300 m: \d+% more per m²/)).toBeVisible();
});

test('main navigation fits the screen, collapsing into a menu on phones', async ({ page, isMobile }) => {
  await page.goto('/check');
  if (isMobile) {
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'The Tea' }).click();
  } else {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'The Tea' }).click();
  }
  await expect(page).toHaveURL(/\/tea$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
