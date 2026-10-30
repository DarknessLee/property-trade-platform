import { expect, test, type Page } from '@playwright/test';

/**
 * M4 E2E：门店与经纪人、业绩统计、实名审核、操作日志、账号权限、财务资金核对。
 */

const PASSWORD = '123456';

async function login(page: Page, phone: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-phone').fill(phone);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('btn-login').click();
  await page.waitForURL(/\/(portal|admin)/);
}

test.describe.serial('机构与业绩', () => {
  test('店长查看门店组织与经纪人团队', async ({ page }) => {
    await login(page, '13800000003');
    await page.goto('/admin/agencies');
    await expect(page.getByTestId('admin-page-title')).toHaveText('门店与经纪人');
    await expect(page.getByText(/安家地产/).first()).toBeVisible();
    await expect(page.getByText('经纪人团队')).toBeVisible();
    const rows = page.locator('.ant-table-row');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
  });

  test('管理员新增门店', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/agencies');
    await page.getByTestId('btn-create-agency').click();
    const modal = page.locator('.ant-modal-content');
    const storeName = `E2E新城店${Date.now() % 10000}`;
    await page.getByTestId('agency-name').fill(storeName);
    await page.getByTestId('agency-license').fill(`JJ-E2E-${Date.now()}`);
    await modal.locator('input').nth(2).fill('江州市高新区测试大道 9 号');
    await modal.locator('input').nth(3).fill('0571-88112233');
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('门店已创建')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(storeName)).toBeVisible();
  });

  test('店长查看业绩统计（卡片 + 趋势图 + 排行）', async ({ page }) => {
    await login(page, '13800000003');
    await page.goto('/admin/stats');
    await expect(page.getByTestId('admin-page-title')).toHaveText('业绩统计');
    await expect(page.getByText('成交单量').first()).toBeVisible();
    await expect(page.getByTestId('stats-trend-card')).toBeVisible();
    await expect(page.getByTestId('trend-chart')).toBeVisible();
    await expect(page.getByTestId('stats-ranking-card')).toBeVisible();
    await expect(page.locator('.ant-table-row').first()).toBeVisible();
  });
});

test.describe.serial('审核与日志', () => {
  test('管理员在审核中心处理实名认证', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/audit');
    await expect(page.getByTestId('admin-page-title')).toHaveText('后台审核');
    await page.getByRole('tab', { name: /实名认证/ }).click();
    await expect(page.getByText('实名认证审核')).toBeVisible();

    const auditButtons = page.locator('.ant-tabs-tabpane-active button').filter({ hasText: '审核' });
    if ((await auditButtons.count()) > 0) {
      await auditButtons.first().click();
      const modal = page.locator('.ant-modal-content');
      await expect(modal.getByText('实名认证审核')).toBeVisible();
      await modal.locator('.ant-modal-footer .ant-btn-primary').click();
      await expect(page.getByText(/实名认证已通过|已驳回/)).toBeVisible({ timeout: 15000 });
    } else {
      // 无待审核记录时校验已通过页签有数据
      await page.locator('.ant-select').first().click();
      const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
      await dropdown.locator('.ant-select-item-option').nth(1).click();
      await expect(page.locator('.ant-tabs-tabpane-active .ant-table-row').first()).toBeVisible();
    }
  });

  test('管理员查询操作日志并按动作筛选', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/logs');
    await expect(page.getByTestId('admin-page-title')).toHaveText('操作日志');
    await expect(page.locator('.ant-table-row').first()).toBeVisible();
    await page.getByPlaceholder('按操作类型筛选，如 sign_contract').fill('create_listing');
    await page.getByPlaceholder('按操作类型筛选，如 sign_contract').press('Enter');
    await expect(page.locator('tr').filter({ hasText: 'create_listing' }).first()).toBeVisible({ timeout: 15000 });
  });

  test('管理员管理账号（禁用/启用）', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/users');
    await expect(page.getByTestId('admin-page-title')).toHaveText('账号权限');
    await page.getByPlaceholder('搜索姓名 / 手机号').fill('张伟');
    await page.getByPlaceholder('搜索姓名 / 手机号').press('Enter');
    const row = page.locator('tr').filter({ hasText: '买方' }).first();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: '禁用' }).click();
    await expect(page.getByText('账号已禁用')).toBeVisible({ timeout: 15000 });
    await page.locator('tr').filter({ hasText: '已禁用' }).first().getByRole('button', { name: '启用' }).click();
    await expect(page.getByText('账号已启用')).toBeVisible({ timeout: 15000 });
  });
});

test.describe.serial('财务资金核对', () => {
  test('财务核对资金并确认入账', async ({ page }) => {
    await login(page, '13800000002');
    await page.goto('/admin/finance');
    await expect(page.getByTestId('admin-page-title')).toHaveText('资金核对');
    await expect(page.getByText('已入账金额')).toBeVisible();
    await expect(page.getByText('待入账金额')).toBeVisible();

    await page.getByTestId('finance-status').click();
    const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await dropdown.locator('.ant-select-item-option').filter({ hasText: '待入账' }).first().click();
    const settleButton = page.locator('button').filter({ hasText: '核对入账' }).first();
    await expect(settleButton).toBeVisible();
    await settleButton.click();
    await expect(page.getByText('已核对入账，并通知交易相关方')).toBeVisible({ timeout: 15000 });
  });
});
