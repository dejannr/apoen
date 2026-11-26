import { expect, test } from '@playwright/test';

test('guest progress survives a reload and transfers to a newly registered account', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${1 + Date.now() % 200}` });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Danas ideš do miliona.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Registracija' })).toBeVisible();
  await page.getByRole('link', { name: 'Pokreni današnji kviz' }).click();
  await expect(page.getByRole('heading', { name: 'Na ivici' })).toBeVisible();
  await expect(page.locator('.intro-count')).toHaveText('3');
  await expect(page).toHaveURL(/kviz\/[0-9a-f-]+/);
  expect(await page.evaluate(() => localStorage.getItem('apoen.guest-session.v1'))).toContain('token');

  await page.reload();
  await expect(page.getByRole('button', { name: '40', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '40', exact: true }).click();
  await page.getByRole('button', { name: '60', exact: true }).click();
  await page.getByRole('button', { name: 'Potvrdi odgovor' }).click();
  await expect(page.getByRole('heading', { name: /5\.000 RSD/ })).toBeVisible();

  await page.goto('/register');
  const stamp = Date.now();
  await page.getByLabel('Email').fill(`guest-e2e-${stamp}@example.test`);
  await page.getByLabel('Nadimak').fill(`gost${stamp}`);
  await page.getByLabel('Lozinka').fill('Local-E2E-Guest-Password-2026!');
  await page.getByRole('button', { name: 'Registracija' }).click();
  await expect(page).toHaveURL('http://localhost:3000/');
  expect(await page.evaluate(() => localStorage.getItem('apoen.guest-session.v1'))).toBeNull();

  const today = await page.request.get('/api/game/today').then((response) => response.json());
  expect(today.halves[0].challenges[0]).toMatchObject({ status: 'COMPLETED', reward: 5000 });
  await page.goto('/kviz');
  await expect(page.getByText(/Završeno · 5000 RSD/)).toBeVisible();
});
