import { BadRequestException } from '@nestjs/common';

const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CHECK = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

/** 18 位身份证：格式 + GB 11643 校验位（演示环境仅做合法性与脱敏，不做真实核验） */
export function isValidIdCard(id: string): boolean {
  if (!/^\d{17}[\dXx]$/.test(id)) return false;
  const upper = id.toUpperCase();
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(upper[i]) * ID_WEIGHTS[i];
  return ID_CHECK[sum % 11] === upper[17];
}

export function maskIdCard(id: string): string {
  const upper = id.toUpperCase();
  return `${upper.slice(0, 6)}********${upper.slice(14)}`;
}

export function assertValidIdCard(id: string): void {
  if (!isValidIdCard(id)) {
    throw new BadRequestException({ code: 40001, message: '身份证号格式或校验位不正确' });
  }
}
