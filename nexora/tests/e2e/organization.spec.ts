import { expect, test, type Page } from '@playwright/test';
import type { Snapshot } from '../../src/lib/types';

const headers = { Origin: 'http://localhost:3100' };
const password = 'Organization-browser-verification-384!';
async function establish(page: Page) {
  const email = `organization-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const signup = await page.request.post('/api/auth/sign-up/email', {
    headers,
    data: { name: 'Operations Owner', email, password },
  });
  expect(signup.ok(), await signup.text()).toBeTruthy();
  const workspace = await page.request.post('/api/workspaces', {
    headers,
    data: { name: 'Operations verification' },
  });
  expect(workspace.ok(), await workspace.text()).toBeTruthy();
  const { id } = (await workspace.json()) as { id: string };
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Clients', exact: true })).toBeVisible();
  return id;
}
async function snapshot(page: Page, id: string) {
  const result = await page.request.get(`/api/workspaces/${id}`);
  expect(result.ok(), await result.text()).toBeTruthy();
  return (await result.json()) as Snapshot;
}
async function navigate(page: Page, view: string) {
  await page.getByRole('button', { name: view, exact: true }).click();
}

test('organization: actual client, linked project, document, manual time, invoice and payment forms persist', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const workspaceId = await establish(page);
  await navigate(page, 'Clients');
  await page.getByRole('button', { name: 'New client', exact: true }).click();
  const clientForm = page.getByRole('dialog', { name: 'Create a client', exact: true });
  await clientForm.getByLabel('Contact name', { exact: true }).fill('Elena Verification');
  await clientForm.getByLabel('Organization', { exact: true }).fill('Forma Verification Studio');
  await clientForm.getByLabel('Email', { exact: true }).fill('elena@example.test');
  await clientForm.getByRole('button', { name: 'Create client', exact: true }).click();
  await expect(clientForm).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Elena Verification', exact: true }),
  ).toBeVisible();
  let state = await snapshot(page, workspaceId);
  const client = state.clients.find((c) => c.name === 'Elena Verification')!;
  expect(client.email).toBe('elena@example.test');

  await navigate(page, 'Projects');
  await page.getByRole('button', { name: 'Create project', exact: true }).first().click();
  const projectForm = page.getByRole('dialog', { name: 'Create project', exact: true });
  await projectForm.getByLabel('Project name', { exact: true }).fill('Forma launch');
  await projectForm.getByLabel('Client', { exact: true }).selectOption(client.id);
  await projectForm.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(projectForm).not.toBeVisible();
  state = await snapshot(page, workspaceId);
  const project = state.projects.find((p) => p.name === 'Forma launch')!;
  expect(project.clientId).toBe(client.id);

  await navigate(page, 'Documents');
  await page.getByRole('button', { name: 'New document', exact: true }).click();
  const newDoc = page.getByRole('dialog', { name: 'New document', exact: true });
  await newDoc.getByLabel('Title', { exact: true }).fill('Forma project brief');
  await newDoc.getByLabel('Project', { exact: true }).selectOption(project.id);
  await newDoc.getByRole('button', { name: 'Create document', exact: true }).click();
  await expect(newDoc).not.toBeVisible();
  await page
    .getByLabel('Document content', { exact: true })
    .fill('# Launch direction\n\nA persisted project brief.\n\n- Clarity\n- Focus');
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await navigate(page, 'Clients');
  await expect(page.getByLabel('Document content', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Launch direction', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Forma project brief/ }).click();
  await expect(page.getByLabel('Document content', { exact: true })).toHaveValue(
    /persisted project brief/,
  );

  await navigate(page, 'Time tracking');
  await page.getByRole('button', { name: 'Add time', exact: true }).click();
  const timeForm = page.getByRole('dialog', { name: 'Record a work session', exact: true });
  const interval = await page.evaluate(() => {
    function local(value: number) {
      const d = new Date(value);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return { start: local(Date.now() - 3 * 3600_000), end: local(Date.now() - 2 * 3600_000) };
  });
  await timeForm.getByLabel('Project', { exact: true }).selectOption(project.id);
  await timeForm.getByLabel('Description', { exact: true }).fill('Project discovery');
  await timeForm.getByLabel('Started (your local time)', { exact: true }).fill(interval.start);
  await timeForm.getByLabel('Ended (your local time)', { exact: true }).fill(interval.end);
  await timeForm.getByRole('button', { name: 'Record session', exact: true }).click();
  await expect(timeForm).not.toBeVisible();
  await expect(page.getByRole('cell', { name: 'Project discovery', exact: true })).toBeVisible();
  state = await snapshot(page, workspaceId);
  expect(
    state.timeEntries.find((t) => t.description === 'Project discovery')?.durationMinutes,
  ).toBe(60);

  await navigate(page, 'Finance');
  await page.getByRole('button', { name: 'New invoice', exact: true }).click();
  const invoiceForm = page.getByRole('dialog', { name: 'Create a draft invoice', exact: true });
  await invoiceForm.getByLabel('Client', { exact: true }).selectOption(client.id);
  await invoiceForm.getByLabel('Project', { exact: true }).selectOption(project.id);
  await invoiceForm.getByLabel('Line 1 description', { exact: true }).fill('Discovery sprint');
  await invoiceForm.getByLabel('Line 1 quantity', { exact: true }).fill('2');
  await invoiceForm.getByLabel('Line 1 unit price', { exact: true }).fill('123.45');
  await invoiceForm.getByLabel('Tax rate (%)', { exact: true }).fill('20');
  await invoiceForm.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(invoiceForm).not.toBeVisible();
  state = await snapshot(page, workspaceId);
  const invoice = state.invoices[0];
  expect(invoice).toMatchObject({ subtotal: 24690, tax: 4938, total: 29628, status: 'draft' });
  const invoiceDetail = page.getByRole('dialog', { name: invoice.number, exact: true });
  await expect(invoiceDetail).toContainText('296.28');
  await invoiceDetail.getByRole('button', { name: 'Issue invoice', exact: true }).click();
  await expect(
    invoiceDetail.getByRole('button', { name: 'Issue invoice', exact: true }),
  ).not.toBeVisible();
  await invoiceDetail.getByRole('button', { name: 'Record payment', exact: true }).click();
  await invoiceDetail.getByLabel('Payment amount (EUR)', { exact: true }).fill('100.00');
  await invoiceDetail.getByRole('button', { name: 'Save payment', exact: true }).click();
  await expect.poll(async () => (await snapshot(page, workspaceId)).invoices[0].paid).toBe(10000);
  await expect(invoiceDetail).toContainText('196.28');
  const popupPromise = page.waitForEvent('popup');
  await invoiceDetail.getByRole('button', { name: 'Print / PDF', exact: true }).click();
  const print = await popupPromise;
  await print.waitForLoadState('domcontentloaded');
  await expect(
    print.getByRole('heading', { name: `Invoice ${invoice.number}`, exact: true }),
  ).toBeVisible();
  await expect(print.locator('body')).toContainText('Forma Verification Studio');
  await expect(print.locator('body')).toContainText('296.28');
  await print.close();
  await page.reload();
  await page.getByRole('button', { name: invoice.number, exact: true }).click();
  await expect(page.getByRole('dialog', { name: invoice.number, exact: true })).toContainText(
    'partially paid',
  );
  state = await snapshot(page, workspaceId);
  expect(state.documents[0].content).toContain('persisted project brief');
  expect(state.invoices[0].paid).toBe(10000);
  expect(state.projects[0].clientId).toBe(client.id);
});
