import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Snapshot } from '../../src/lib/types';

const origin = 'http://localhost:3100';
const headers = { Origin: origin };
const password = 'A-unique-browser-test-password-782!';
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function signup(request: APIRequestContext, name = 'Integration User') {
  const email = `${unique()}@example.test`;
  const response = await request.post('/api/auth/sign-up/email', {
    headers,
    data: { name, email, password },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return email;
}
async function workspace(request: APIRequestContext, name = 'Verification workspace') {
  const response = await request.post('/api/workspaces', { headers, data: { name } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as { id: string };
}
async function command(
  request: APIRequestContext,
  id: string,
  type: string,
  data: Record<string, unknown>,
) {
  const response = await request.post(`/api/workspaces/${id}/commands`, {
    headers,
    data: { type, data },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as { id: string };
}
async function snapshot(request: APIRequestContext, id: string) {
  const response = await request.get(`/api/workspaces/${id}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as Snapshot;
}
async function closeDialog(page: Page) {
  const close = page.getByRole('button', { name: 'Close dialog', exact: true });
  if (await close.isVisible()) await close.click();
}
async function createTask(page: Page, title: string) {
  await page.getByRole('button', { name: 'Create task', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Create task', exact: true });
  await dialog.getByLabel('Task title', { exact: true }).fill(title);
  await dialog.getByRole('button', { name: 'Create task', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await closeDialog(page);
}

test('register, create real work, validate dependencies, inspect graph and reload persisted data', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Alex Verification');
  await page.getByLabel('Email address', { exact: true }).fill(`${unique()}@example.test`);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Workspace name', { exact: true }).fill('Product launch');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create workspace', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Overview', exact: true })).toBeVisible();

  const list = await page.request.get('/api/workspaces');
  const { workspaces } = (await list.json()) as { workspaces: { id: string }[] };
  const id = workspaces[0].id;
  expect((await snapshot(page.request, id)).projects).toHaveLength(0);

  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Create project', exact: true }).first().click();
  const projectDialog = page.getByRole('dialog', { name: 'Create project', exact: true });
  await projectDialog.getByLabel('Project name', { exact: true }).fill('Atlas launch');
  await projectDialog.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(projectDialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Tasks', exact: true }).click();
  await createTask(page, 'Design system');
  await createTask(page, 'Ship the application');

  let data = await snapshot(page.request, id);
  const design = data.tasks.find((t) => t.title === 'Design system')!;
  const ship = data.tasks.find((t) => t.title === 'Ship the application')!;
  expect(design).toBeTruthy();
  expect(ship).toBeTruthy();

  await page.getByRole('button', { name: 'Ship the application', exact: true }).click();
  const taskDialog = page.getByRole('dialog', { name: 'Ship the application', exact: true });
  await taskDialog.getByLabel('Depends on task', { exact: true }).selectOption(design.id);
  await taskDialog.getByRole('button', { name: 'Add dependency', exact: true }).click();
  await expect.poll(async () => (await snapshot(page.request, id)).dependencies.length).toBe(1);
  await taskDialog.getByLabel('Change task status', { exact: true }).selectOption('done');
  await expect(taskDialog.getByRole('alert')).toContainText('dependencies');
  await closeDialog(page);

  const cycle = await page.request.post(`/api/workspaces/${id}/commands`, {
    headers,
    data: { type: 'createDependency', data: { taskId: design.id, dependsOnId: ship.id } },
  });
  expect(cycle.status()).toBe(409);
  expect((await cycle.json()).error).toMatch(/cycle/i);

  await page.getByLabel('Status for Design system', { exact: true }).selectOption('done');
  await expect
    .poll(
      async () => (await snapshot(page.request, id)).tasks.find((t) => t.id === design.id)?.status,
    )
    .toBe('done');
  await page
    .getByLabel('Status for Ship the application', { exact: true })
    .selectOption('in_progress');
  await expect
    .poll(
      async () => (await snapshot(page.request, id)).tasks.find((t) => t.id === ship.id)?.status,
    )
    .toBe('in_progress');

  await page.getByRole('button', { name: 'Visual workspace', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  await page.locator('.react-flow__node').filter({ hasText: 'Ship the application' }).click();
  const inspector = page.getByRole('complementary', { name: 'Selected record details' });
  await expect(
    inspector.getByRole('heading', { name: 'Ship the application', exact: true }),
  ).toBeVisible();
  await expect(inspector).toContainText('Design system');
  await page.getByRole('button', { name: 'Apply automatic layout', exact: true }).click();
  await page.getByRole('button', { name: 'Save arrangement', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Arrangement saved', exact: true })).toBeVisible();
  data = await snapshot(page.request, id);
  expect(data.positions).toHaveLength(3);
  const positions = data.positions;

  await page.reload();
  await expect(page.getByRole('button', { name: 'Visual workspace', exact: true })).toBeVisible();
  data = await snapshot(page.request, id);
  expect(data.positions).toEqual(positions);
  expect(data.dependencies).toHaveLength(1);
  expect(data.tasks.find((t) => t.id === ship.id)?.status).toBe('in_progress');
  await page.keyboard.press('Control+k');
  const search = page.getByRole('dialog');
  await search.getByRole('textbox').fill('Ship the application');
  await expect(search).toContainText('Ship the application');
  await page.keyboard.press('Escape');
});

test('workspace authorization, viewer protection, and origin checks hold over HTTP', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext({ baseURL: origin });
  const outsiderContext = await browser.newContext({ baseURL: origin });
  try {
    await signup(ownerContext.request, 'Workspace Owner');
    const outsiderEmail = await signup(outsiderContext.request, 'Workspace Viewer');
    const owned = await workspace(ownerContext.request, 'Private workspace');
    const other = await workspace(outsiderContext.request, 'Other private workspace');
    const project = await command(ownerContext.request, owned.id, 'createProject', {
      name: 'Confidential project',
    });
    const forbiddenRead = await outsiderContext.request.get(`/api/workspaces/${owned.id}`);
    expect(forbiddenRead.status()).toBe(404);
    const forbiddenWrite = await outsiderContext.request.post(
      `/api/workspaces/${owned.id}/commands`,
      {
        headers,
        data: { type: 'updateProject', data: { id: project.id, name: 'Intrusion' } },
      },
    );
    expect(forbiddenWrite.status()).toBe(404);
    const crossReference = await outsiderContext.request.post(
      `/api/workspaces/${other.id}/commands`,
      {
        headers,
        data: {
          type: 'createTask',
          data: { projectId: project.id, title: 'Cross-workspace task' },
        },
      },
    );
    expect(crossReference.status()).toBe(404);
    await command(ownerContext.request, owned.id, 'addMember', {
      email: outsiderEmail,
      role: 'viewer',
    });
    expect((await snapshot(outsiderContext.request, owned.id)).projects[0].name).toBe(
      'Confidential project',
    );
    const viewerWrite = await outsiderContext.request.post(`/api/workspaces/${owned.id}/commands`, {
      headers,
      data: { type: 'createProject', data: { name: 'Viewer write' } },
    });
    expect(viewerWrite.status()).toBe(403);
    const badOrigin = await ownerContext.request.post(`/api/workspaces/${owned.id}/commands`, {
      headers: { Origin: 'https://untrusted.example' },
      data: { type: 'createProject', data: { name: 'CSRF attempt' } },
    });
    expect(badOrigin.status()).toBe(403);
    expect((await snapshot(ownerContext.request, owned.id)).projects).toHaveLength(1);
  } finally {
    await ownerContext.close();
    await outsiderContext.close();
  }
});

test('connected operations, exact invoice payments, mobile navigation and accessibility', async ({
  page,
}) => {
  await signup(page.request, 'Operations User');
  const { id } = await workspace(page.request, 'Operations workspace');
  const client = await command(page.request, id, 'createClient', {
    name: 'Orbit Studio',
    organization: 'Orbit Studio Ltd',
    email: 'billing@example.test',
  });
  const project = await command(page.request, id, 'createProject', {
    name: 'Client engagement',
    clientId: client.id,
  });
  const documentRecord = await command(page.request, id, 'createDocument', {
    title: 'Engagement brief',
    projectId: project.id,
    content:
      '# Verified brief\n\nThis content persists.\n\n<script>window.__unsafeDocumentExecuted=true</script>',
  });
  const timer = await command(page.request, id, 'startTimer', {
    projectId: project.id,
    description: 'Discovery session',
  });
  await page.goto('/?view=time');
  await expect(page.getByRole('heading', { name: 'Discovery session', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Discovery session', exact: true })).toBeVisible();
  const overlap = await page.request.post(`/api/workspaces/${id}/commands`, {
    headers,
    data: { type: 'startTimer', data: { projectId: project.id } },
  });
  expect(overlap.status()).toBe(409);
  await page.getByRole('button', { name: 'Stop & save session', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await snapshot(page.request, id)).timeEntries.find((t) => t.id === timer.id)?.endedAt,
    )
    .not.toBeNull();
  const end = new Date(Date.now() - 3_600_000);
  const start = new Date(end.getTime() - 3_600_000);
  await command(page.request, id, 'recordTime', {
    projectId: project.id,
    description: 'Prior research',
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
  });
  const invoice = await command(page.request, id, 'createInvoice', {
    clientId: client.id,
    projectId: project.id,
    currency: 'EUR',
    items: [{ description: 'Discovery', quantity: 2, unitPrice: 12500 }],
    taxBasisPoints: 2000,
    dueDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  });
  let data = await snapshot(page.request, id);
  const draft = data.invoices.find((i) => i.id === invoice.id)!;
  expect(draft.subtotal).toBe(25000);
  expect(draft.tax).toBe(5000);
  expect(draft.total).toBe(30000);
  await command(page.request, id, 'issueInvoice', { id: invoice.id });
  await command(page.request, id, 'recordPayment', { id: invoice.id, amount: 10000 });
  data = await snapshot(page.request, id);
  expect(data.invoices.find((i) => i.id === invoice.id)?.status).toBe('partially_paid');
  await command(page.request, id, 'recordPayment', { id: invoice.id, amount: 20000 });
  data = await snapshot(page.request, id);
  expect(data.invoices.find((i) => i.id === invoice.id)?.status).toBe('paid');
  expect(data.invoices.find((i) => i.id === invoice.id)?.paid).toBe(30000);
  expect(data.projects.find((p) => p.id === project.id)?.clientId).toBe(client.id);
  expect(data.timeEntries.find((t) => t.description === 'Prior research')?.durationMinutes).toBe(
    60,
  );
  await page.goto('/?view=finance');
  await expect(page.getByRole('main')).toContainText(draft.number);
  await page.goto(`/?view=documents&record=${documentRecord.id}`);
  await expect(page.getByRole('main')).toContainText('Engagement brief');
  expect(
    await page.evaluate(
      () => (window as Window & { __unsafeDocumentExecuted?: boolean }).__unsafeDocumentExecuted,
    ),
  ).not.toBe(true);
  await page.reload();
  expect(
    (await snapshot(page.request, id)).documents.find((d) => d.id === documentRecord.id)?.content,
  ).toContain('This content persists.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  const menu = page.getByRole('button', { name: /open navigation|open menu|toggle navigation/i });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Tasks', exact: true }).click();
  await expect(page.getByRole('heading', { name: /tasks/i }).first()).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole('button', { name: 'Use light theme', exact: true }).click();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const lightAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(lightAccessibility.violations).toEqual([]);
  await page.getByRole('button', { name: 'Close navigation', exact: true }).last().click();
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
});
