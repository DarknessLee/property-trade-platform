import { expect, test, type Page } from '@playwright/test';

/**
 * E3 E2E：两级审批流配置闭环、佣金规则配置、看板深化（挂牌价走势/区域下钻）、移动端 H5 导航。
 */

const PASSWORD = '123456';

async function login(page: Page, phone: string): Promise<void> {
  try {
    await page.evaluate(() => localStorage.clear());
  } catch {
    // 首次登录时页面可能尚未加载，忽略
  }
  await page.goto('/login');
  await page.getByTestId('login-phone').fill(phone);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('btn-login').click();
  await page.waitForURL(/\/(portal|admin)/);
}

test.describe.serial('两级审批流配置闭环', () => {
  test('管理员将调价审批切换为两级', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/approvals');
    await page.getByTestId('btn-approval-config').click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('调价审批流配置')).toBeVisible();
    await page.getByTestId('approval-config-mode').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').locator('.ant-select-item-option').filter({ hasText: '两级审批' }).first().click();
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('审批流配置已保存')).toBeVisible({ timeout: 15000 });
  });

  test('经纪人发起调价，店长初审后转管理员终审', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/listings');
    await page.getByTestId('listings-status-filter').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').locator('.ant-select-item-option').filter({ hasText: '在售' }).first().click();
    await page.waitForTimeout(400);
    await page.locator('.ant-table-row').first().getByRole('button', { name: '调价申请' }).click();
    const modal = page.locator('.ant-modal-content');
    const input = page.getByTestId('price-new-total');
    const current = Number((await input.inputValue()).replace(/[^\d]/g, ''));
    await input.fill(String(current - 30000));
    await page.getByTestId('price-reason').fill('E3 验收：两级审批流程验证');
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('调价申请已提交')).toBeVisible({ timeout: 15000 });

    // 店长初审
    await login(page, '13800000003');
    await page.goto('/admin/approvals');
    const pendingRow = page.locator('.ant-table-row').filter({ hasText: '待审批' }).first();
    await expect(pendingRow).toBeVisible({ timeout: 15000 });
    await pendingRow.getByRole('button', { name: /通\s*过/ }).click();
    const reviewModal = page.locator('.ant-modal-content');
    await reviewModal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('初审通过，已转管理员终审')).toBeVisible({ timeout: 15000 });

    // 管理员终审
    await login(page, '13800000001');
    await page.goto('/admin/approvals');
    await page.getByTestId('approval-status').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').locator('.ant-select-item-option').filter({ hasText: '待终审' }).first().click();
    const levelRow = page.locator('.ant-table-row').filter({ hasText: '待终审' }).first();
    await expect(levelRow).toBeVisible({ timeout: 15000 });
    await levelRow.getByRole('button', { name: /终\s*审/ }).click();
    const finalModal = page.locator('.ant-modal-content');
    await expect(finalModal.getByText('管理员终审')).toBeVisible();
    await finalModal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('已通过审批，房源价格已更新')).toBeVisible({ timeout: 15000 });
  });

  test('恢复一级审批配置', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/approvals');
    await page.getByTestId('btn-approval-config').click();
    const modal = page.locator('.ant-modal-content');
    await page.getByTestId('approval-config-mode').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').locator('.ant-select-item-option').filter({ hasText: '一级审批' }).first().click();
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('审批流配置已保存')).toBeVisible({ timeout: 15000 });
  });
});

test.describe.serial('佣金规则与看板深化', () => {
  test('管理员修改佣金分成比例并恢复', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/commissions');
    await page.locator('.ant-table-row').first().waitFor();
    await page.getByTestId('btn-rule-config').click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('佣金分成规则配置')).toBeVisible();
    await page.getByTestId('rule-agent-rate').fill('55');
    await page.getByTestId('rule-coagent-rate').fill('20');
    await page.getByTestId('rule-store-rate').fill('20');
    await page.getByTestId('rule-platform-rate').fill('5');
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('佣金规则已保存')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('房源维护经纪人 55%')).toBeVisible();

    // 恢复默认比例
    await page.getByTestId('btn-rule-config').click();
    await page.getByTestId('rule-agent-rate').fill('60');
    await page.getByTestId('rule-coagent-rate').fill('15');
    await page.getByTestId('rule-store-rate').fill('20');
    await page.getByTestId('rule-platform-rate').fill('5');
    await page.locator('.ant-modal-content .ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('佣金规则已保存')).toBeVisible({ timeout: 15000 });
  });

  test('看板挂牌价走势与区域下钻', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/stats');
    await page.getByRole('tab', { name: '区域行情' }).click();
    await expect(page.getByTestId('stats-price-trend-card')).toBeVisible();
    await expect(page.getByTestId('price-trend-line-chart')).toBeVisible();
    await page.getByTestId('price-district-select').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').locator('.ant-select-item-option').first().click();
    await page.waitForTimeout(500);

    // 展开行政区行，查看小区下钻表
    await page.locator('.ant-table-row-expand-icon').first().click();
    await expect(page.getByText('小区', { exact: true })).toBeVisible();
    await expect(page.getByText('在售均价', { exact: true }).first()).toBeVisible();
  });
});

test.describe.serial('移动端 H5 适配', () => {
  test('390px 视口下 C 端使用抽屉导航并正常找房', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, '13800000040');
    await page.goto('/portal');
    const menuButton = page.getByRole('button', { name: '打开导航' });
    await expect(menuButton).toBeVisible();
    await expect(page.locator('.portal-desktop-menu')).toBeHidden();
    await menuButton.click();
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer.getByRole('link', { name: '找房', exact: true })).toBeVisible();
    await drawer.getByRole('link', { name: '找房', exact: true }).click();
    await expect(page.locator('[data-testid^="listing-card-"]').first()).toBeVisible({ timeout: 15000 });
  });
});
