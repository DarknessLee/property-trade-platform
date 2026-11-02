import { expect, test, type Page } from '@playwright/test';

/**
 * E4 E2E：客户跟进/匹配推荐、账号开通与权限菜单、合同模板、钥匙委托审批、投诉审核、数据字典。
 */

const PASSWORD = '123456';

async function login(page: Page, phone: string): Promise<void> {
  try {
    await page.evaluate(() => localStorage.clear());
  } catch {
    // ignore
  }
  await page.goto('/login');
  await page.getByTestId('login-phone').fill(phone);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('btn-login').click();
  await page.waitForURL(/\/(portal|admin)/);
}

test.describe.serial('客户跟进与匹配推荐', () => {
  test('经纪人添加跟进记录并查看匹配房源', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/customers');
    await page.locator('.ant-table-row').first().waitFor();
    const buyerRow = page.locator('.ant-table-row').filter({ hasText: '买方' }).first();
    await buyerRow.getByRole('button', { name: /详\s*情/ }).click();
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer.getByText('跟进记录')).toBeVisible();
    await page.getByTestId('followup-content').fill('E4 验收：已电话确认预算与意向区域');
    await page.getByTestId('followup-next').fill('周末安排二次带看');
    await page.getByTestId('btn-add-followup').click();
    await expect(page.getByText('跟进记录已添加')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('btn-customer-matches').click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('需求匹配推荐')).toBeVisible();
    await expect(modal.getByText('匹配分')).toBeVisible();
  });
});

test.describe.serial('账号开通与权限菜单', () => {
  test('管理员开通账号并配置角色菜单', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/users');
    await page.getByRole('button', { name: /开通账号/ }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('开通账号')).toBeVisible();
    const phone = `139${String(Date.now()).slice(-8)}`;
    await modal.locator('input').nth(0).fill('E4验收账号');
    await modal.locator('input').nth(1).fill(phone);
    // 归属门店：选择第一个门店
    await modal.locator('.ant-select').nth(1).click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').first().click();
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('账号已开通')).toBeVisible({ timeout: 15000 });

    // 权限配置：财务角色取消「业绩统计」再保存，随后恢复
    await page.getByRole('tab', { name: '权限配置' }).click();
    await page.waitForTimeout(400);
    await page.getByTestId('menu-config-role').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: '财务' }).first().click();
    const statCheckbox = page.getByRole('checkbox', { name: /业绩统计/ }).first();
    if (await statCheckbox.isChecked()) await statCheckbox.uncheck();
    await page.getByRole('button', { name: '保存配置' }).click();
    await expect(page.getByText('角色菜单配置已保存').first()).toBeVisible({ timeout: 15000 });
    if (!(await statCheckbox.isChecked())) await statCheckbox.check();
    await page.getByRole('button', { name: '保存配置' }).click();
    await expect(page.getByText('角色菜单配置已保存').first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe.serial('合同模板与钥匙委托', () => {
  test('管理员新增合同模板并停用', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/templates');
    await page.locator('.ant-table-row').first().waitFor();
    await page.getByRole('button', { name: /新增模板/ }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('新增合同模板')).toBeVisible();
    await modal.locator('input').nth(0).fill('E4验收存量房合同');
    await modal.locator('textarea').fill('甲方（卖方）：{{sellerName}}，乙方（买方）：{{buyerName}}，成交价：{{amount}} 元。');
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('合同模板已创建')).toBeVisible({ timeout: 15000 });
    const row = page.locator('.ant-table-row').filter({ hasText: 'E4验收存量房合同' }).first();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /停\s*用/ }).click();
    await expect(page.getByText('模板已停用')).toBeVisible({ timeout: 15000 });
  });

  test('经纪人发起钥匙委托，店长审批通过', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/listings');
    await page.getByTestId('listings-status-filter').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: '在售' }).first().click();
    await page.waitForTimeout(400);
    await page.locator('.ant-table-row').first().getByRole('button', { name: '钥匙委托' }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('钥匙委托审批申请')).toBeVisible();
    await page.getByTestId('key-count').fill('2');
    await page.getByTestId('key-handover-to').fill('城东店钥匙柜');
    await page.getByTestId('key-remark').fill('E4 验收：业主委托门店保管');
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('钥匙委托申请已提交')).toBeVisible({ timeout: 15000 });

    await login(page, '13800000003');
    await page.goto('/admin/approvals');
    const row = page.locator('.ant-table-row').filter({ hasText: '钥匙委托' }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: /通\s*过/ }).click();
    const reviewModal = page.locator('.ant-modal-content');
    await reviewModal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('已通过审批')).toBeVisible({ timeout: 15000 });
  });
});

test.describe.serial('投诉与数据字典', () => {
  test('买方提交投诉，管理员处理并回复', async ({ page }) => {
    await login(page, '13800000040');
    await page.goto('/portal/mine');
    await page.getByRole('tab', { name: /投诉建议/ }).click();
    await page.getByTestId('complaint-content').fill('E4 验收：房源照片与实勘不符，请核实');
    await page.getByTestId('btn-submit-complaint').click();
    await expect(page.getByText('投诉已提交')).toBeVisible({ timeout: 15000 });

    await login(page, '13800000001');
    await page.goto('/admin/complaints');
    const row = page.locator('.ant-table-row').filter({ hasText: 'E4 验收' }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: /处\s*理/ }).click();
    const modal = page.locator('.ant-modal-content');
    await modal.locator('.ant-select').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: '已解决' }).first().click();
    await modal.locator('textarea').fill('E4 验收：已联系经纪人核实并回访客户');
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('投诉处理已保存')).toBeVisible({ timeout: 15000 });
  });

  test('管理员新增并删除数据字典项', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/dicts');
    await page.locator('.ant-table-row').first().waitFor();
    await page.getByRole('button', { name: /新增字典项/ }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('新增字典项')).toBeVisible();
    await modal.locator('input').nth(0).fill('e4_e2e');
    await modal.locator('input').nth(1).fill('t1');
    await modal.locator('input').nth(2).fill('E4验收字典');
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('字典项已创建')).toBeVisible({ timeout: 15000 });
    const row = page.locator('.ant-table-row').filter({ hasText: 'E4验收字典' }).first();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /删\s*除/ }).click();
    await page.locator('.ant-popconfirm .ant-btn-primary').click();
    await expect(page.getByText('字典项已删除')).toBeVisible({ timeout: 15000 });
  });
});
