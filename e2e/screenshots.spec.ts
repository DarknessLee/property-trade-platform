import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 按角色/端批量截图（最终 UI + 最终种子）。
 * 输出：docs/screenshots/，文件名 `序号-端-角色-页面.png`；每次覆盖，避免旧图混入。
 * 运行：npm run screenshots（需先 db:reset 与 build）。
 */

const OUT_DIR = join(process.cwd(), 'docs', 'screenshots');
mkdirSync(OUT_DIR, { recursive: true });

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: true });
}

async function login(page: Page, phone: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-phone').fill(phone);
  await page.getByTestId('login-password').fill('123456');
  await page.getByTestId('btn-login').click();
  await page.waitForURL(/\/(portal|admin)/);
  // 等待 AntD 成功提示自动消失，避免截图出现 toast
  await page.waitForTimeout(3200);
}

test.describe('角色截图', () => {
  test('01-登录页', async ({ page }) => {
    await page.goto('/login');
    await shot(page, '01-登录页');
  });

  test('02-C端-未登录-门户首页', async ({ page }) => {
    await page.goto('/portal');
    await shot(page, '02-C端-游客-门户首页');
  });

  test('03-C端-游客-房源列表', async ({ page }) => {
    await page.goto('/portal/listings');
    await shot(page, '03-C端-游客-房源列表');
  });

  test('04-C端-游客-房源详情', async ({ page }) => {
    await page.goto('/portal/listings');
    await page.locator('[data-testid^="listing-card-"]').first().click();
    await page.getByTestId('listing-title').waitFor();
    await shot(page, '04-C端-游客-房源详情');
  });

  test('05-C端-买方-个人中心', async ({ page }) => {
    await login(page, '13800000040');
    await page.goto('/portal/mine');
    await shot(page, '05-C端-买方-个人中心');
  });

  test('06-B端-经纪人-工作台', async ({ page }) => {
    await login(page, '13800000020');
    await shot(page, '06-B端-经纪人-工作台');
  });

  test('07-B端-店长-工作台', async ({ page }) => {
    await login(page, '13800000003');
    await shot(page, '07-B端-店长-工作台');
  });

  test('08-B端-管理员-工作台', async ({ page }) => {
    await login(page, '13800000001');
    await shot(page, '08-B端-管理员-工作台');
  });

  test('09-B端-财务-工作台', async ({ page }) => {
    await login(page, '13800000002');
    await shot(page, '09-B端-财务-工作台');
  });

  test('10-B端-经纪人-房源管理', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/listings');
    await page.locator('[data-testid="listings-table"] .ant-table-row').first().waitFor();
    await shot(page, '10-B端-经纪人-房源管理');
  });

  test('11-B端-经纪人-录入房源', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/listings');
    await page.getByTestId('btn-create-listing').click();
    await page.locator('.ant-drawer-content').waitFor();
    await page.waitForTimeout(500);
    await shot(page, '11-B端-经纪人-录入房源');
  });

  test('12-B端-管理员-验真审核', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/audit');
    await page.waitForTimeout(600);
    await shot(page, '12-B端-管理员-验真审核');
  });

  test('13-B端-管理员-小区字典', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/communities');
    await page.waitForTimeout(800);
    await shot(page, '13-B端-管理员-小区字典');
  });

  test('14-C端-游客-地图找房', async ({ page }) => {
    await page.goto('/portal/map');
    await page.locator('[data-testid^="map-point-"]').first().waitFor();
    await shot(page, '14-C端-游客-地图找房');
  });

  test('15-B端-经纪人-客户管理', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/customers');
    await page.locator('.ant-table-row').first().waitFor();
    await shot(page, '15-B端-经纪人-客户管理');
  });

  test('16-B端-经纪人-带看日程', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/showings');
    await page.getByTestId('showing-calendar').waitFor();
    await shot(page, '16-B端-经纪人-带看日程');
  });

  test('17-B端-经纪人-合同签约', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/contracts');
    await page.locator('.ant-table-row').first().waitFor();
    await shot(page, '17-B端-经纪人-合同签约');
  });

  test('18-B端-经纪人-交易进度', async ({ page }) => {
    await login(page, '13800000020');
    await page.goto('/admin/progress');
    await page.locator('.ant-table-row').first().waitFor();
    await shot(page, '18-B端-经纪人-交易进度');
  });

  test('19-C端-买方-我的合同', async ({ page }) => {
    await login(page, '13800000040');
    await page.goto('/portal/mine');
    await page.getByRole('tab', { name: /我的合同/ }).click();
    await page.locator('[data-testid="my-contracts-table"] .ant-table-row').first().waitFor();
    await shot(page, '19-C端-买方-我的合同');
  });

  test('20-B端-店长-门店与经纪人', async ({ page }) => {
    await login(page, '13800000003');
    await page.goto('/admin/agencies');
    await page.locator('.ant-table-row').first().waitFor();
    await shot(page, '20-B端-店长-门店与经纪人');
  });

  test('21-B端-店长-业绩统计', async ({ page }) => {
    await login(page, '13800000003');
    await page.goto('/admin/stats');
    await page.getByTestId('trend-chart').waitFor();
    await page.waitForTimeout(600);
    await shot(page, '21-B端-店长-业绩统计');
  });

  test('22-B端-管理员-实名审核', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/audit');
    await page.getByRole('tab', { name: /实名认证/ }).click();
    await page.waitForTimeout(600);
    await shot(page, '22-B端-管理员-实名审核');
  });

  test('23-B端-管理员-操作日志', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/logs');
    await page.locator('.ant-table-row').first().waitFor();
    await shot(page, '23-B端-管理员-操作日志');
  });

  test('24-B端-财务-资金核对', async ({ page }) => {
    await login(page, '13800000002');
    await page.goto('/admin/finance');
    await page.locator('.ant-table-row').first().waitFor();
    await shot(page, '24-B端-财务-资金核对');
  });

  test('25-B端-管理员-账号权限', async ({ page }) => {
    await login(page, '13800000001');
    await page.goto('/admin/users');
    await page.locator('.ant-table-row').first().waitFor();
    await shot(page, '25-B端-管理员-账号权限');
  });
});
