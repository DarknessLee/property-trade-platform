import { expect, test, type Page } from '@playwright/test';

/**
 * M1 E2E：C 端浏览、登录分流、B 端工作台骨架、权限跳转。
 * 依赖：npm run db:reset（种子数据）+ API/Web（由 playwright.config webServer 启动）。
 */

const DEMO_PASSWORD = '123456';

async function loginAs(page: Page, phone: string): Promise<void> {
  await page.goto('/login');
  await expect(page.getByTestId('login-title')).toBeVisible();
  await page.getByTestId('login-phone').fill(phone);
  await page.getByTestId('login-password').fill(DEMO_PASSWORD);
  await page.getByTestId('btn-login').click();
}

test.describe('C 端门户', () => {
  test('首页展示品牌、统计与精选房源', async ({ page }) => {
    await page.goto('/portal');
    await expect(page.getByTestId('portal-brand')).toBeVisible();
    await expect(page.getByText('在江州，找到安心好房')).toBeVisible();
    await expect(page.getByText('在售房源').first()).toBeVisible();
    await expect(page.getByText('精选房源')).toBeVisible();
    const cards = page.locator('[data-testid^="listing-card-"]');
    await expect(cards.first()).toBeVisible();
  });

  test('搜索跳转到房源列表并保留关键词', async ({ page }) => {
    await page.goto('/portal');
    await page.getByTestId('home-keyword').fill('锦绣华庭');
    await page.getByTestId('home-search').click();
    await expect(page).toHaveURL(/\/portal\/listings\?.*keyword=/);
    await expect(page.locator('[data-testid^="listing-card-"]').first()).toBeVisible();
  });

  test('房源列表按区域筛选', async ({ page }) => {
    await page.goto('/portal/listings');
    await expect(page.locator('[data-testid^="listing-card-"]').first()).toBeVisible();
    await page.getByTestId('filter-district').click();
    const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await dropdown.locator('.ant-select-item-option').filter({ hasText: '城东区' }).first().click();
    await expect(page).toHaveURL(/district=/);
    // 断言筛选生效：卡片只展示城东区房源
    await expect(page.locator('[data-testid^="listing-card-"]').first()).toContainText('城东区');
  });

  test('房源详情展示价格、小区与经纪人', async ({ page }) => {
    await page.goto('/portal/listings');
    await page.locator('[data-testid^="listing-card-"]').first().click();
    await expect(page.getByTestId('listing-title')).toBeVisible();
    await expect(page.getByTestId('listing-agent-card')).toBeVisible();
    await expect(page.getByText('小区信息')).toBeVisible();
    await expect(page.getByTestId('btn-book-showing')).toBeVisible();
  });
});

test.describe('登录与角色分流', () => {
  test('买方登录后进入 C 端门户', async ({ page }) => {
    await loginAs(page, '13800000040');
    await expect(page).toHaveURL(/\/portal/);
    await expect(page.getByTestId('portal-user')).toContainText('张伟');
    await expect(page.getByTestId('portal-user')).toContainText('买方');
  });

  test('经纪人登录后进入 B 端工作台', async ({ page }) => {
    await loginAs(page, '13800000020');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByTestId('admin-page-title')).toHaveText('工作台');
    await expect(page.getByText('房源管理').first()).toBeVisible();
    await expect(page.getByText('客户管理').first()).toBeVisible();
  });

  test('管理员登录后可见后台审核与操作日志', async ({ page }) => {
    await loginAs(page, '13800000001');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText('后台审核').first()).toBeVisible();
    await expect(page.getByText('操作日志').first()).toBeVisible();
  });

  test('未登录访问 B 端被重定向登录页', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('未登录访问个人中心被重定向登录页', async ({ page }) => {
    await page.goto('/portal/mine');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('B 端工作台骨架', () => {
  test('经纪人工作台显示快捷操作与最新消息', async ({ page }) => {
    await loginAs(page, '13800000020');
    await expect(page.getByText('快捷操作')).toBeVisible();
    await expect(page.getByText('最新消息')).toBeVisible();
    await expect(page.getByText('在售房源').first()).toBeVisible();
  });

  test('待建设模块显示交付计划', async ({ page }) => {
    await loginAs(page, '13800000020');
    await page.getByText('客户管理').first().click();
    await expect(page.getByTestId('admin-page-title')).toHaveText('客户管理');
    await expect(page.getByText('建设中')).toBeVisible();
  });
});

test.describe('个人中心与实名认证', () => {
  test('待审核用户可重新提交实名资料', async ({ page }) => {
    // 13800000044（马涛）在种子中为实名待审核状态
    await loginAs(page, '13800000044');
    await expect(page).toHaveURL(/\/portal/);
    await page.goto('/portal/mine');
    await expect(page.getByTestId('mine-name')).toContainText('马涛');
    await expect(page.getByTestId('input-idcard')).toBeVisible();
    await page.getByTestId('input-realname').fill('马涛');
    await page.getByTestId('input-idcard').fill('110101199509120020');
    await page.getByTestId('btn-submit-realname').click();
    await expect(page.getByText('实名认证资料已提交', { exact: false })).toBeVisible();
  });
});
