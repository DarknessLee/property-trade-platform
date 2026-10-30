import { expect, test, type Page } from '@playwright/test';

/**
 * E2 E2E：交易后链路（贷款/资金监管/过户/佣金）+ 看板增强 + C 端合同交易后链路。
 */

const PASSWORD = '123456';

async function login(page: Page, phone: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-phone').fill(phone);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('btn-login').click();
  await page.waitForURL(/\/(portal|admin)/);
}

test.describe.serial('贷款与资金监管', () => {
  test('管理员查看贷款列表并通过已提交贷款', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/loans');
    await page.locator('.ant-table-row').first().waitFor();
    await expect(page.getByTestId('admin-page-title')).toBeVisible();

    await page.getByTestId('loans-status').click();
    const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await dropdown.locator('.ant-select-item-option').filter({ hasText: '已提交' }).first().click();
    await page.waitForTimeout(400);
    const row = page.locator('.ant-table-row').filter({ hasText: '已提交' }).first();
    if (await row.count()) {
      await row.getByRole('button', { name: /批\s*贷/ }).click();
      const modal = page.locator('.ant-modal-content');
      await expect(modal.getByText('批贷确认')).toBeVisible();
      await modal.locator('.ant-modal-footer .ant-btn-primary').click();
      await expect(page.getByText('已批贷（Mock）').first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('财务登记资金监管解冻流水', async ({ page }) => {
    await login(page, '13800000002');
    await page.goto('/admin/escrows');
    await expect(page.getByTestId('admin-page-title').getByText('资金监管')).toBeVisible();
    await page.locator('.ant-table-row').first().waitFor();
    await page.locator('.ant-table-row').first().getByRole('button', { name: '明细' }).click();
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer.getByText('资金流水')).toBeVisible();
    const addButton = drawer.getByRole('button', { name: '登记流水' }).first();
    if (await addButton.count()) {
      await addButton.click();
      const modal = page.locator('.ant-modal-content');
      await expect(modal.getByText('登记资金流水')).toBeVisible();
      await page.getByTestId('tx-type').click();
      await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').locator('.ant-select-item-option').filter({ hasText: '解冻' }).first().click();
      await page.getByTestId('tx-amount').fill('10000');
      await modal.locator('.ant-modal-footer .ant-btn').first().click();
      await expect(modal).toBeHidden({ timeout: 15000 });
    }
  });
});

test.describe.serial('过户办理与佣金结算', () => {
  test('过户管理：材料核验与税费/预约/登记信息', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/transfers');
    await page.locator('.ant-table-row').first().waitFor();
    await page.locator('.ant-table-row').first().getByRole('button', { name: /办\s*理/ }).click();
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer.getByRole('heading', { name: '过户材料清单' })).toBeVisible();
    await expect(drawer.getByRole('heading', { name: '税费', exact: true })).toBeVisible();
    await expect(drawer.getByRole('heading', { name: '政务预约' })).toBeVisible();
    await expect(drawer.getByRole('heading', { name: '不动产登记', exact: true })).toBeVisible();
    const verifyButton = drawer.getByRole('button', { name: /核\s*验/ }).first();
    if (await verifyButton.count()) {
      await verifyButton.click();
      await expect(page.getByText('材料已核验')).toBeVisible({ timeout: 15000 });
    }
  });

  test('佣金结算：查看分摊明细并确认待确认结算单', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/commissions');
    await page.locator('.ant-table-row').first().waitFor();
    await page.locator('.ant-table-row').first().getByRole('button', { name: '分摊明细' }).click();
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer.getByText('分摊明细')).toBeVisible();
    await expect(drawer.getByText('房源维护经纪人')).toBeVisible();
    await drawer.locator('.ant-drawer-close').click();

    const pendingRow = page.locator('.ant-table-row').filter({ hasText: '待确认' }).first();
    if (await pendingRow.count()) {
      await pendingRow.getByRole('button', { name: /确\s*认/ }).click();
      await expect(page.getByText('佣金已确认')).toBeVisible({ timeout: 15000 });
    }
  });
});

test.describe.serial('看板增强与 C 端全链路', () => {
  test('业绩统计新增区域行情/客群画像/转化漏斗 Tab', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/stats');
    await page.getByRole('tab', { name: '区域行情' }).click();
    await expect(page.getByTestId('stats-market-card')).toBeVisible();
    await page.getByRole('tab', { name: '客群画像' }).click();
    await expect(page.getByTestId('stats-customer-card')).toBeVisible();
    await page.getByRole('tab', { name: '转化漏斗' }).click();
    await expect(page.getByTestId('stats-funnel-card')).toBeVisible();
    await expect(page.getByText('房源浏览', { exact: true })).toBeVisible();
  });

  test('C 端合同详情展示交易后链路', async ({ page }) => {
    await login(page, '13800000040');
    await page.goto('/portal/mine');
    await page.getByRole('tab', { name: /我的合同/ }).click();
    await page.locator('.ant-tabs-tabpane-active .ant-table-row').first().waitFor();
    const viewButton = page.locator('.ant-tabs-tabpane-active .ant-table-row').first().getByRole('button', { name: /查\s*看/ });
    await viewButton.click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('交易后链路')).toBeVisible({ timeout: 15000 });
    await expect(modal.getByText('资金监管')).toBeVisible();
    await expect(modal.getByText('不动产登记')).toBeVisible();
  });
});
