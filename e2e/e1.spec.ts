import { expect, test, type Page } from '@playwright/test';

/**
 * E1 增强 E2E：调价审批（经纪人发起 → 店长通过）、C 端在线咨询（留言 → 经纪人回复 → 买方查看）、录入重复房源提示。
 */

const PASSWORD = '123456';

async function login(page: Page, phone: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-phone').fill(phone);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('btn-login').click();
  await page.waitForURL(/\/(portal|admin)/);
}

test.describe.serial('调价审批闭环', () => {
  test('经纪人在售房源发起调价审批', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/listings');
    await page.locator('.ant-table-row').first().waitFor();

    // 状态筛选为「在售」
    await page.getByTestId('listings-status-filter').click();
    const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await dropdown.locator('.ant-select-item-option').filter({ hasText: '在售' }).first().click();
    await page.waitForTimeout(500);

    const firstRow = page.locator('.ant-table-row').first();
    await expect(firstRow).toBeVisible();
    await firstRow.getByRole('button', { name: '调价申请' }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('调价审批申请')).toBeVisible();

    const input = page.getByTestId('price-new-total');
    const current = Number((await input.inputValue()).replace(/[^\d]/g, ''));
    await input.fill(String(current - 20000));
    await page.getByTestId('price-reason').fill('E1 验收：客户议价，申请小幅下调挂牌价');
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('调价申请已提交')).toBeVisible({ timeout: 15000 });
  });

  test('店长在审批中心通过调价', async ({ page }) => {
    await login(page, '13800000003');
    await page.goto('/admin/approvals');
    await expect(page.getByTestId('approval-table')).toBeVisible();
    const row = page.locator('.ant-table-row').filter({ hasText: '待审批' }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: /通\s*过/ }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('通过调价审批')).toBeVisible();
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('已通过审批，房源价格已更新')).toBeVisible({ timeout: 15000 });

    // 筛选已通过，确认记录状态
    await page.getByTestId('approval-status').click();
    const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await dropdown.locator('.ant-select-item-option').filter({ hasText: '已通过' }).first().click();
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('tr').filter({ hasText: '已通过' }).first()).toBeVisible();
  });

  test('C 端房源详情展示价格走势', async ({ page }) => {
    await page.goto('/portal/listings');
    await page.locator('[data-testid^="listing-card-"]').first().click();
    await expect(page.getByTestId('listing-title')).toBeVisible();
    await expect(page.getByTestId('price-trend-card')).toBeVisible();
    await expect(page.getByTestId('price-trend-chart')).toBeVisible();
  });
});

test.describe.serial('在线咨询闭环', () => {
  test('买方在房源详情发起在线咨询', async ({ page }) => {
    await login(page, '13800000040');
    await page.goto('/portal/listings');
    await page.locator('[data-testid^="listing-card-"]').first().click();
    await expect(page.getByTestId('btn-consult')).toBeVisible();
    await page.getByTestId('btn-consult').click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('在线咨询')).toBeVisible();
    await page.getByTestId('consult-input').fill('E1 验收：请问这套房源周末可以安排看房吗？');
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('咨询已发送')).toBeVisible({ timeout: 15000 });

    await page.goto('/portal/mine');
    await page.getByRole('tab', { name: /我的咨询/ }).click();
    await expect(page.getByText('E1 验收：请问这套房源周末可以安排看房吗？').first()).toBeVisible({ timeout: 15000 });
  });

  test('经纪人在房源咨询页回复', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/consultations');
    await expect(page.getByTestId('consultation-table')).toBeVisible();
    const row = page.locator('.ant-table-row').filter({ hasText: 'E1 验收' }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: /回\s*复/ }).click();
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer.getByText('房源咨询')).toBeVisible();
    await page.getByTestId('consultation-reply-input').fill('E1 验收回复：可以，周六上午 10 点安排看房。');
    await page.getByTestId('btn-submit-reply').click();
    await expect(page.getByText('回复已发送')).toBeVisible({ timeout: 15000 });
  });

  test('买方在我的咨询中看到回复', async ({ page }) => {
    await login(page, '13800000040');
    await page.goto('/portal/mine');
    await page.getByRole('tab', { name: /我的咨询/ }).click();
    await expect(page.getByText('E1 验收回复：可以，周六上午 10 点安排看房。').first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe.serial('录入重复房源提示', () => {
  test('录入表单检测到疑似重复房源', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/listings');
    await page.getByTestId('btn-create-listing').click();
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer.getByText('录入房源')).toBeVisible();

    // 取经纪人本人一套在售/待审房源作为重复样本（保证在同一数据范围内可命中）
    const ownListings = await page.evaluate(async () => {
      const token = localStorage.getItem('ptp_token');
      const response = await fetch('/api/listings?pageSize=60', { headers: { Authorization: `Bearer ${token}` } });
      return (await response.json()) as {
        data: { items: Array<{ area: number; rooms: number; status: string; community: { id: string; name: string } }> };
      };
    });
    const sample = ownListings.data.items.find((item) => ['on_sale', 'pending'].includes(item.status)) ?? ownListings.data.items[0];

    await page.getByTestId('form-community').click();
    await page.keyboard.type(sample.community.name);
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.getByTestId('form-area').fill(String(sample.area));
    await page.getByTestId('form-rooms').fill(String(sample.rooms));
    await expect(page.getByTestId('duplicate-alert')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('疑似重复房源')).toBeVisible();
  });
});
