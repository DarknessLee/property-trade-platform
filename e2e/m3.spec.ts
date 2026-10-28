import { expect, test, type Page } from '@playwright/test';
import dayjs from 'dayjs';

/**
 * M3 E2E：客户建档 → 带看预约/确认/完成 → 发起合同 → 电子签署 → 交易进度推进；
 * C 端：房源详情预约看房、我的预约、我的合同与交易进度。
 */

const PASSWORD = '123456';
const CUSTOMER_NAME = `E2E客户${Date.now() % 100000}`;
const B2B_BOOK_DATE = dayjs().add(30, 'day').format('YYYY-MM-DD');
const CUSTOMER_BOOK_DATE = dayjs().add(45, 'day').format('YYYY-MM-DD');

async function fillBookingTime(page: Page, scope: string, date: string, time: string): Promise<void> {
  const container = page.locator(scope);
  const inputs = container.locator('.ant-picker input');
  await inputs.nth(0).fill(date);
  await inputs.nth(0).press('Enter');
  await inputs.nth(1).fill(time);
  await inputs.nth(1).press('Enter');
  await page.waitForTimeout(200);
}

async function login(page: Page, phone: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-phone').fill(phone);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('btn-login').click();
  await page.waitForURL(/\/(portal|admin)/);
}

async function pickSelect(page: Page, testId: string, index = 0): Promise<void> {
  await page.getByTestId(testId).click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  await dropdown.locator('.ant-select-item-option').nth(index).click();
  await page.waitForTimeout(300);
}

test.describe.serial('B 端客户与带看', () => {
  test('经纪人新增客户建档', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/customers');
    await expect(page.getByTestId('admin-page-title')).toHaveText('客户管理');
    await page.getByTestId('btn-create-customer').click();
    await page.getByTestId('customer-name').fill(CUSTOMER_NAME);
    await page.getByTestId('customer-phone').fill(`139${String(Date.now()).slice(-8)}`);
    await page.getByTestId('btn-save-customer').click();
    await expect(page.getByText('客户已创建')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('tr').filter({ hasText: CUSTOMER_NAME }).first()).toBeVisible();
  });

  test('新建带看预约并在日历中展示', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/showings');
    await expect(page.getByTestId('showing-calendar')).toBeVisible();

    await page.getByTestId('btn-create-showing').click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('新建带看预约')).toBeVisible();
    await pickSelect(page, 'showing-listing');
    await pickSelect(page, 'showing-customer');
    await fillBookingTime(page, '.ant-modal-content', B2B_BOOK_DATE, '03:00');
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('带看预约已创建')).toBeVisible({ timeout: 15000 });
  });

  test('带看记录可确认并完成（含反馈）', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/showings');
    const row = page.locator('.ant-table-row').first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: '处理' }).click();
    const modal = page.locator('.ant-modal-content');
    await modal.getByRole('button', { name: '确认带看' }).click();
    await expect(page.getByText('带看已确认')).toBeVisible({ timeout: 15000 });
  });
});

test.describe.serial('B 端合同与进度', () => {
  test('发起签约并生成合同', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/contracts');
    await expect(page.getByTestId('admin-page-title')).toHaveText('合同签约');
    await page.getByTestId('btn-create-contract').click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('发起签约')).toBeVisible();

    await pickSelect(page, 'contract-listing');
    await pickSelect(page, 'contract-buyer');
    await pickSelect(page, 'contract-seller');
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText(/合同 HT\d+ 已生成/)).toBeVisible({ timeout: 15000 });
  });

  test('合同详情电子签署（Mock e签宝）', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/contracts');
    await page.locator('.ant-table-row').first().getByRole('button', { name: '查看' }).click();
    await expect(page.getByText('合同详情')).toBeVisible();
    await page.getByTestId('btn-sign-contract').click();
    await expect(page.getByText('电子签署完成')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('已签署').first()).toBeVisible();
  });

  test('交易进度页推进节点', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/progress');
    await expect(page.getByTestId('admin-page-title')).toHaveText('交易进度');
    const row = page.locator('.ant-table-row').first();
    await row.getByRole('button', { name: /管理进度/ }).click();
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer.getByText('交易进度', { exact: false }).first()).toBeVisible();
    await drawer.getByRole('button', { name: '更新状态' }).first().click();
    const modal = page.locator('.ant-modal-content');
    await modal.locator('.ant-select').click();
    const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await dropdown.locator('.ant-select-item-option').last().click();
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('进度已更新')).toBeVisible({ timeout: 15000 });
  });
});

test.describe.serial('C 端预约与合同', () => {
  test('买方在房源详情预约看房', async ({ page }) => {
    await login(page, '13800000040');
    await page.goto('/portal/listings');
    await page.locator('[data-testid^="listing-card-"]').first().click();
    await expect(page.getByTestId('listing-title')).toBeVisible();
    await page.getByTestId('btn-book-showing').click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('预约看房')).toBeVisible();
    await fillBookingTime(page, '.ant-modal-content', CUSTOMER_BOOK_DATE, '04:00');
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('预约已提交')).toBeVisible({ timeout: 15000 });  });

  test('买方个人中心查看我的预约与我的合同', async ({ page }) => {
    await login(page, '13800000040');
    await page.goto('/portal/mine');
    await expect(page.getByTestId('my-showings-table')).toBeVisible();

    await page.getByRole('tab', { name: /我的合同/ }).click();
    await expect(page.getByTestId('my-contracts-table')).toBeVisible();
    const contractRows = page.getByTestId('my-contracts-table').locator('.ant-table-row');
    expect(await contractRows.count()).toBeGreaterThan(0);
    await contractRows.first().getByRole('button', { name: '查看' }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('交易进度').first()).toBeVisible();
    await expect(modal.getByText('下载合同 PDF')).toBeVisible();
  });
});
