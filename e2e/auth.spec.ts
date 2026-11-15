import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mailpitApi = process.env['MAILPIT_API_URL'] ?? 'http://127.0.0.1:54324';
const appOrigin = new URL(process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://127.0.0.1:3000').origin;
const password = 'Dairybuy-E2E-Only-2026!';

async function expectAccountRoute(page: Page) {
  await expect(page).toHaveURL((url) => url.origin === appOrigin && url.pathname === '/account');
}

function newTestEmail() {
  return `dairybuy-e2e+${randomUUID()}@example.test`;
}

async function confirmationLink(request: APIRequestContext, email: string): Promise<string> {
  let link: string | undefined;

  await expect.poll(async () => {
    const listResponse = await request.get(`${mailpitApi}/api/v1/messages?limit=50`);
    if (!listResponse.ok()) return false;

    const list = (await listResponse.json()) as {
      messages?: Array<{ ID: string; To?: Array<{ Address?: string }> }>;
    };
    const message = list.messages?.find((item) =>
      item.To?.some((recipient) => recipient.Address?.toLowerCase() === email.toLowerCase()),
    );
    if (!message) return false;

    const detailResponse = await request.get(
      `${mailpitApi}/api/v1/message/${encodeURIComponent(message.ID)}`,
    );
    if (!detailResponse.ok()) return false;

    const detail = (await detailResponse.json()) as { HTML?: string; Text?: string };
    const body = `${detail.HTML ?? ''}\n${detail.Text ?? ''}`;
    const href = body.match(/href=["']([^"']*(?:\/auth\/v1\/verify|\/verify)[^"']*)["']/i)?.[1];
    if (!href) return false;

    link = href.replace(/&amp;/g, '&').replace(/&#x3D;/gi, '=');
    return true;
  }, { timeout: 20_000, intervals: [250, 500, 1_000] }).toBe(true);

  if (!link) throw new Error(`No Supabase confirmation link arrived for ${email}`);
  const parsed = new URL(link);
  expect(parsed.hostname).toBe('127.0.0.1');
  expect(parsed.protocol).toBe('http:');
  return link;
}

async function signupAndConfirm(page: Page, request: APIRequestContext) {
  const email = newTestEmail();

  await page.goto('/signup');
  await page.getByLabel('Full name').fill('Dairybuy E2E Customer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('status')).toContainText('confirmation link');
  const link = await confirmationLink(request, email);
  await page.goto(link);

  await expectAccountRoute(page);
  await expect(page.getByRole('heading', { name: /Hello, Dairybuy E2E Customer/i })).toBeVisible();
  return { email };
}

test.describe('Dairybuy Supabase authentication browser flows', () => {
  test('signup confirms email and provisions a customer account', async ({ page, request }) => {
    await signupAndConfirm(page, request);
    await expect(page.getByText('customer', { exact: true })).toBeVisible();
  });

  test('admin order and inventory audit routes require authentication and reject customer accounts', async ({ page, request }) => {
    await page.goto('/admin/orders');
    await expect(page).toHaveURL((url) =>
      url.origin === appOrigin && url.pathname === '/login' && url.searchParams.get('next') === '/admin/orders',
    );

    await page.goto('/admin/inventory/audit');
    await expect(page).toHaveURL((url) =>
      url.origin === appOrigin && url.pathname === '/login' && url.searchParams.get('next') === '/admin/inventory/audit',
    );

    await signupAndConfirm(page, request);
    await expect(page.getByRole('link', { name: 'Inventory audit' })).toHaveCount(0);

    await page.goto('/admin/orders');
    await expectAccountRoute(page);

    await page.goto('/admin/inventory/audit');
    await expectAccountRoute(page);

    await page.goto('/admin/orders/a5555555-0000-4000-8000-000000000002');
    await expectAccountRoute(page);
  });

  test('invalid credentials do not create an authenticated session', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(newTestEmail());
    await page.getByLabel('Password').fill('Definitely-Wrong-Password-2026!');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText('Email ya password galat hai.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL((url) => url.origin === appOrigin && url.pathname === '/login');
  });

  test('login persists across reload and logout protects the account route', async ({ page, request }) => {
    const { email } = await signupAndConfirm(page, request);

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL((url) => url.origin === appOrigin && url.pathname === '/login');

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expectAccountRoute(page);
    await expect(page.getByText(email, { exact: true })).toBeVisible();

    await page.reload();
    await expectAccountRoute(page);
    await expect(page.getByText(email, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL((url) => url.origin === appOrigin && url.pathname === '/login');
    await page.goto('/account');
    await expect(page).toHaveURL((url) => url.origin === appOrigin && url.pathname === '/login' && url.searchParams.get('next') === '/account');
  });

  test('session refresh keeps the customer authenticated after JWT expiry', async ({ page, request }) => {
    const { email } = await signupAndConfirm(page, request);

    // Local Supabase JWT expiry is configured to 60 seconds for this disposable test stack.
    await page.waitForTimeout(65_000);
    await page.reload();

    await expectAccountRoute(page);
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });
});
