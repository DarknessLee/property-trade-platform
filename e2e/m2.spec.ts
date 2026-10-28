import { expect, test, type Page } from '@playwright/test';

/**
 * M2 E2E：B 端房源录入 → 上传委托协议 → 提交验真 → 管理员审核 → 上架；
 * C 端地图找房、税费估算、同小区价格参考。
 */

const PASSWORD = '123456';
const LISTING_TITLE = `E2E 验收房源 ${Date.now() % 100000} 3室2厅 南北精装`;

async function login(page: Page, phone: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-phone').fill(phone);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('btn-login').click();
  await page.waitForURL(/\/(portal|admin)/);
}

async function pickSelect(page: Page, testId: string, optionText: string): Promise<void> {
  await page.getByTestId(testId).click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  await dropdown.locator('.ant-select-item-option').filter({ hasText: optionText }).first().click();
  await page.waitForTimeout(300);
}

test.describe.serial('B 端房源全流程', () => {
  test('经纪人录入房源并提交验真', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/listings');
    await expect(page.getByTestId('listings-table')).toBeVisible();

    await page.getByTestId('btn-create-listing').click();
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer.getByText('录入房源')).toBeVisible();

    await pickSelect(page, 'form-community', '锦绣华庭');
    await pickSelect(page, 'form-owner', '高强');

    await page.getByTestId('form-title').fill(LISTING_TITLE);
    await page.getByTestId('form-area').fill('96.5');
    await page.getByTestId('form-unit-price').fill('32000');
    await page.getByTestId('btn-save-listing').click();

    await expect(page.getByText('房源已创建')).toBeVisible({ timeout: 15000 });

    // 搜索并打开详情
    await page.getByTestId('listings-search').fill(LISTING_TITLE);
    await page.getByTestId('listings-search').press('Enter');
    const row = page.locator('tr').filter({ hasText: LISTING_TITLE }).first();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: '详情' }).click();

    // 上传委托协议
    await page.getByTestId('btn-upload-agreement').click();
    await page.locator('.ant-drawer-content input[type=file]').last().setInputFiles({
      name: '房屋出售委托协议.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 demo agreement'),
    });
    await expect(page.getByText('委托协议已上传')).toBeVisible({ timeout: 15000 });

    // 提交验真
    await page.locator('.ant-drawer-content').getByRole('button', { name: '提交验真' }).click();
    await expect(page.getByText('已提交验真')).toBeVisible({ timeout: 15000 });
  });

  test('管理员验真通过', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/audit');
    await expect(page.getByText('房源验真审核')).toBeVisible();

    const row = page.locator('tr').filter({ hasText: LISTING_TITLE }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: '审核' }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal.getByText('房源验真审核')).toBeVisible();
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.getByText('验真通过')).toBeVisible({ timeout: 15000 });
  });

  test('经纪人上架并在 C 端可见', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/listings');
    await page.getByTestId('listings-search').fill(LISTING_TITLE);
    await page.getByTestId('listings-search').press('Enter');

    const row = page.locator('tr').filter({ hasText: LISTING_TITLE }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: '上架' }).click();
    await expect(page.getByText('房源已上架')).toBeVisible({ timeout: 15000 });
    await expect(row.getByText('在售')).toBeVisible();

    // C 端搜索可见
    await page.goto('/portal/listings');
    await page.getByTestId('filter-keyword').fill(LISTING_TITLE);
    await page.getByTestId('filter-keyword').press('Enter');
    await expect(page.locator('[data-testid^="listing-card-"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(LISTING_TITLE)).toBeVisible();
  });
});

test.describe('C 端地图与价格能力', () => {
  test('地图找房展示点位并可进入详情', async ({ page }) => {
    await page.goto('/portal/map');
    await expect(page.getByTestId('map-canvas')).toBeVisible();
    const points = page.locator('[data-testid^="map-point-"]');
    await expect(points.first()).toBeVisible();
    expect(await points.count()).toBeGreaterThanOrEqual(30);

    await points.first().click();
    await expect(page.getByTestId('listing-title')).toBeVisible();
  });

  test('地图按区域筛选后点位减少', async ({ page }) => {
    await page.goto('/portal/map');
    const points = page.locator('[data-testid^="map-point-"]');
    await expect(points.first()).toBeVisible();
    const before = await points.count();
    await page.getByTestId('map-district').click();
    const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await dropdown.locator('.ant-select-item-option').filter({ hasText: '城东区' }).first().click();
    await expect(page.getByText(/共 \d+ 套在售房源/)).toBeVisible();
    const after = await page.locator('[data-testid^="map-point-"]').count();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  test('详情页展示税费估算与同小区价格参考', async ({ page }) => {
    await page.goto('/portal/listings');
    await page.locator('[data-testid^="listing-card-"]').first().click();
    await expect(page.getByTestId('listing-title')).toBeVisible();
    await expect(page.getByTestId('tax-card')).toBeVisible();
    await expect(page.getByText('合计估算')).toBeVisible();
    await expect(page.getByTestId('price-context-card')).toBeVisible();
    await expect(page.getByTestId('price-chart')).toBeVisible();

    // 切换「满五唯一」后个税免征
    await page.getByTestId('tax-only-five').click();
    await expect(page.getByText('个人所得税免征').first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('C 端筛选增强', () => {
  test('按面积区间与朝向筛选', async ({ page }) => {
    await page.goto('/portal/listings');
    await page.getByTestId('filter-area').click();
    let dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await dropdown.locator('.ant-select-item-option').filter({ hasText: '90-120㎡' }).first().click();
    await expect(page).toHaveURL(/area=/);
    await expect(page.locator('[data-testid^="listing-card-"]').first()).toBeVisible();

    await page.getByTestId('filter-orientation').click();
    dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await dropdown.locator('.ant-select-item-option').filter({ hasText: '南北' }).first().click();
    await expect(page).toHaveURL(/orientation=/);
  });
});
