import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const mailpitApi = process.env['MAILPIT_API_URL'] ?? 'http://127.0.0.1:54324';
const appOrigin = new URL(process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://127.0.0.1:3000').origin;
const password = 'Dairybuy-Checkout-E2E-Only-2026!';

type ApiResult = { status: number; body: unknown };

async function apiJson(
  page: Page,
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: unknown,
): Promise<ApiResult> {
  const serializedBody = body === undefined ? undefined : JSON.stringify(body);
  return page.evaluate(async ({ path, method, serializedBody }) => {
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: serializedBody === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(serializedBody === undefined ? {} : { body: serializedBody }),
      cache: 'no-store',
    });
    const payload: unknown = await response.json().catch(() => null);
    return { status: response.status, body: payload };
  }, { path, method, serializedBody });
}

function newTestEmail() {
  return `dairybuy-checkout-e2e+${randomUUID()}@example.test`;
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
  await page.getByLabel('Full name').fill('Dairybuy Checkout E2E Customer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('status')).toContainText('confirmation link');
  const link = await confirmationLink(request, email);
  await page.goto(link);
  await expect(page).toHaveURL((url) => url.origin === appOrigin && url.pathname === '/account');
  await expect(page.getByRole('heading', { name: /Hello, Dairybuy Checkout E2E Customer/i })).toBeVisible();
}

function responseBody(value: unknown): Record<string, unknown> {
  expect(value).toBeTruthy();
  expect(typeof value).toBe('object');
  return value as Record<string, unknown>;
}

async function createAddress(page: Page, recipientName: string): Promise<string> {
  const result = await apiJson(page, '/api/addresses', 'POST', {
    addressType: 'Home',
    recipientName,
    phone: '9876543210',
    addressLine1: '10 Checkout Test Road',
    landmark: 'Near Topsia crossing',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700046',
  });
  expect(result.status).toBe(201);
  const payload = responseBody(result.body);
  expect(payload['success']).toBe(true);
  const data = responseBody(payload['data']);
  const address = responseBody(data['address']);
  return address['id'] as string;
}

function tomorrowInKolkata(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

test.describe('Dairybuy authenticated checkout validation against local Supabase', () => {
  test('enforces address ownership, DB slot and live pricing without mutating cart or creating orders', async ({ page, request }) => {
    // Create a genuine second customer and address first. Customer A must not be
    // able to use this address, even when its UUID is supplied by the browser.
    await signupAndConfirm(page, request);
    const foreignAddressId = await createAddress(page, 'Foreign Checkout Customer');

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL((url) => url.origin === appOrigin && url.pathname === '/login');

    // Sign in as a different customer and create a real persisted address/cart.
    await signupAndConfirm(page, request);
    const ownAddressId = await createAddress(page, 'Own Checkout Customer');

    // Stop the React BagProvider before seeding. Its initial empty snapshot
    // can otherwise race the test's direct API write and replace the seeded
    // cart with an empty snapshot. BrowserContext.request shares the signed-in
    // browser cookies but bypasses page-side cart synchronization.
    const browserContext = page.context();
    await page.close();

    const cartSaveResponse = await browserContext.request.put(`${appOrigin}/api/cart`, {
      data: {
        items: [{
          kind: 'catalogue',
          productVariantId: 'ghee-red-cow-200ml',
          quantity: 2,
        }],
      },
    });
    expect(cartSaveResponse.status()).toBe(200);
    const cartSaveBody = responseBody(await cartSaveResponse.json());
    expect(cartSaveBody['success']).toBe(true);
    expect(responseBody(cartSaveBody['data'])['itemCount']).toBe(2);

    const cartBeforeResponse = await browserContext.request.get(`${appOrigin}/api/cart`);
    expect(cartBeforeResponse.status()).toBe(200);
    const beforePayload = responseBody(await cartBeforeResponse.json());
    const beforeData = responseBody(beforePayload['data']);
    const beforeItems = beforeData['items'] as Array<Record<string, unknown>>;
    expect(beforeItems).toHaveLength(1);
    expect(beforeItems[0]?.['productVariantId']).toBe('ghee-red-cow-200ml');

    const checkoutPage = await browserContext.newPage();
    await checkoutPage.goto('/account');
    await expect(checkoutPage).toHaveURL((url) => url.origin === appOrigin && url.pathname === '/account');
    await expect(checkoutPage.getByRole('heading', { name: /Hello, Dairybuy Checkout E2E Customer/i })).toBeVisible();

    const slotsResponse = await apiJson(checkoutPage, '/api/delivery-slots', 'GET');
    expect(slotsResponse.status).toBe(200);
    const slotsPayload = responseBody(slotsResponse.body);
    const slotsData = responseBody(slotsPayload['data']);
    expect(slotsData['timezone']).toBe('Asia/Kolkata');
    const morningSlot = (slotsData['slots'] as Array<{
      id: string;
      slotCode: string;
      startTime: string;
      endTime: string;
      label: string;
    }>).find((slot) => slot.slotCode === 'morning_slot');
    expect(morningSlot).toMatchObject({
      startTime: '08:00:00',
      endTime: '11:00:00',
      label: 'Morning (8 AM - 11 AM)',
    });
    expect(morningSlot).toBeTruthy();

    const deliveryDate = tomorrowInKolkata();
    const crossCustomer = await apiJson(checkoutPage, '/api/checkout/validate', 'POST', {
      addressId: foreignAddressId,
      deliverySlotId: morningSlot!.id,
      deliveryDate,
    });
    expect(crossCustomer.status).toBe(422);
    expect(responseBody(crossCustomer.body)).toMatchObject({
      success: false,
      fieldErrors: { addressId: 'Select a saved delivery address.' },
    });
    expect(responseBody(crossCustomer.body)).not.toHaveProperty('data');

    // Spoofed identity, amount, slot labels and Razorpay request data must not
    // affect the server-side validation result. Only COD is a launch payment
    // method; this preview endpoint does not accept or initiate any payment.
    const valid = await apiJson(checkoutPage, '/api/checkout/validate', 'POST', {
      addressId: ownAddressId,
      deliverySlotId: morningSlot!.id,
      deliveryDate,
      customerId: '00000000-0000-0000-0000-000000000000',
      totalPaise: 1,
      paymentMethod: 'razorpay',
      slotLabel: 'Spoofed slot',
      startTime: '00:00:00',
    });
    expect(valid.status).toBe(200);
    const validPayload = responseBody(valid.body);
    expect(validPayload['success']).toBe(true);
    const validData = responseBody(validPayload['data']);
    expect(validData['customerId']).toBe(beforeData['userId']);
    expect(validData['address']).toMatchObject({
      id: ownAddressId,
      pincode: '700046',
      serviceAreaName: 'Topsia, Kolkata',
    });
    expect(validData['delivery']).toMatchObject({
      slotId: morningSlot!.id,
      slotCode: 'morning_slot',
      label: 'Morning (8 AM - 11 AM)',
      startTime: '08:00:00',
      endTime: '11:00:00',
      timezone: 'Asia/Kolkata',
    });
    const validCart = responseBody(validData['cart']);
    expect(validCart['totalPaise']).toBe(35_800);
    expect(validData['deliveryFeePaise']).toBe(0);
    expect(validData['totalPaise']).toBe(35_800);
    expect(validData).not.toHaveProperty('paymentMethod');
    expect(JSON.stringify(validData)).not.toContain('razorpay');

    const cartAfter = await apiJson(checkoutPage, '/api/cart', 'GET');
    expect(cartAfter.status).toBe(200);
    expect(responseBody(responseBody(cartAfter.body)['data'])).toEqual(beforeData);

    // Anonymous requests must not be able to use a previously observed UUID.
    await checkoutPage.getByRole('button', { name: 'Logout' }).click();
    await expect(checkoutPage).toHaveURL((url) => url.origin === appOrigin && url.pathname === '/login');
    const anonymous = await apiJson(checkoutPage, '/api/checkout/validate', 'POST', {
      addressId: ownAddressId,
      deliverySlotId: morningSlot!.id,
      deliveryDate,
    });
    expect(anonymous.status).toBe(401);
  });
});


test.describe('Dairybuy customer checkout screen', () => {
  test('authenticated customer sees saved-address requirement, DB delivery slots and COD-only checkout', async ({ page, request }) => {
    await signupAndConfirm(page, request);
    await page.goto('/checkout');

    await expect(page.getByRole('heading', { name: 'Complete your order' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '1. Delivery address' })).toBeVisible();
    await expect(page.getByText('You need a saved delivery address before checkout.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add an address in your account' })).toHaveAttribute('href', '/account');
    await expect(page.getByRole('heading', { name: '2. Delivery date and slot' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Order summary' })).toBeVisible();
    await expect(page.getByText(/Pay cash to the delivery agent/)).toBeVisible();
    await expect(page.getByText(/Razorpay|UPI|card payment/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Place COD order' })).toBeDisabled();
  });
});
