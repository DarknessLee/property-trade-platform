import { expect, test, type Page } from '@playwright/test';

/**
 * 演示账号权限巡检（回归）：
 * 1. B 端：登录每个员工账号，遍历其可见菜单，任何 `/api/**` 请求不得出现 4xx（预期 0 个 403/404）；
 * 2. C 端：买家/卖家访问门户核心页面，任何接口不得出现 4xx；
 * 3. 页面上不得出现未捕获 JS 异常。
 */

const PASSWORD = '123456';

interface Account {
  phone: string;
  role: string;
}

const STAFF_ACCOUNTS: Account[] = [
  { phone: '13800000001', role: 'admin' },
  { phone: '13800000002', role: 'finance' },
  { phone: '13800000003', role: 'store_manager' },
  { phone: '13800000020', role: 'agent' },
];

const PORTAL_ACCOUNTS: Account[] = [
  { phone: '13800000040', role: 'buyer' },
  { phone: '13800000060', role: 'seller' },
];

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

interface ApiError {
  url: string;
  status: number;
}

function trackApiErrors(page: Page): ApiError[] {
  const errors: ApiError[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/') && response.status() >= 400) {
      errors.push({ url, status: response.status() });
    }
  });
  return errors;
}

test.describe.serial('演示账号权限巡检', () => {
  for (const account of STAFF_ACCOUNTS) {
    test(`B 端 ${account.role} 所有可见菜单无接口 4xx`, async ({ page }) => {
      const errors = trackApiErrors(page);
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await login(page, account.phone);
      await expect(page).toHaveURL(/\/admin/);
      await page.locator('.ant-menu-item a').first().waitFor();

      const hrefs = await page.locator('.ant-menu-item a').evaluateAll((links) =>
        Array.from(new Set(links.map((link) => (link as HTMLAnchorElement).getAttribute('href')).filter((href): href is string => Boolean(href)))),
      );
      expect(hrefs.length).toBeGreaterThan(0);

      for (const href of hrefs) {
        await page.goto(href);
        await page.waitForTimeout(700);
      }
      const summary = errors.map((item) => `${item.status} ${item.url}`).join('\n');
      expect(errors, `账号 ${account.phone} 存在接口错误：\n${summary}`).toHaveLength(0);
      expect(pageErrors, `账号 ${account.phone} 存在页面异常：\n${pageErrors.join('\n')}`).toHaveLength(0);
    });
  }

  for (const account of PORTAL_ACCOUNTS) {
    test(`C 端 ${account.role} 门户页面无接口 4xx`, async ({ page }) => {
      const errors = trackApiErrors(page);
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await login(page, account.phone);
      await expect(page).toHaveURL(/\/portal/);

      for (const path of ['/portal', '/portal/listings', '/portal/map', '/portal/mine']) {
        await page.goto(path);
        await page.waitForTimeout(700);
      }
      // 进入首个房源详情（含价格走势/咨询按钮等接口）
      await page.goto('/portal/listings');
      await page.locator('[data-testid^="listing-card-"]').first().click();
      await expect(page.getByTestId('listing-title')).toBeVisible();
      await page.waitForTimeout(700);

      const summary = errors.map((item) => `${item.status} ${item.url}`).join('\n');
      expect(errors, `账号 ${account.phone} 存在接口错误：\n${summary}`).toHaveLength(0);
      expect(pageErrors, `账号 ${account.phone} 存在页面异常：\n${pageErrors.join('\n')}`).toHaveLength(0);
    });
  }
});
