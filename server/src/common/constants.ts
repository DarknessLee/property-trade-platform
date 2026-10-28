/** 角色与业务常量：前后端共享的取值规约（见 docs/02-接口契约.md） */
export const ROLES = ['buyer', 'seller', 'agent', 'store_manager', 'finance', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  buyer: '买方',
  seller: '卖方',
  agent: '经纪人',
  store_manager: '店长',
  finance: '财务',
  admin: '平台管理员',
};

/** 业务错误码：HTTP 状态 + 业务码，前端按 code 提示 */
export const ERROR_CODES = {
  OK: 0,
  BAD_REQUEST: 40001,
  UNAUTHORIZED: 40101,
  LOGIN_FAILED: 40102,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  CONFLICT: 40901,
  BUSINESS_RULE: 42201,
  INTERNAL: 50000,
} as const;

export const DEMO_PASSWORD = '123456';
export const DEMO_CITY = '江州市';
