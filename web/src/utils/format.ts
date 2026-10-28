import { toWan } from '../components/ListingCard';

export { toWan };

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('zh-CN');
}

export function formatPrice(yuan: number): string {
  return `${toWan(yuan)} 万`;
}

/** 简化的二手房税费估算（演示规则，仅参考，不代表真实税费） */
export interface TaxInput {
  totalPrice: number;
  area: number;
  firstHome: boolean;
  overTwoYears: boolean;
  onlyHomeOverFive: boolean;
}

export interface TaxResult {
  deedTax: number;
  vat: number;
  incomeTax: number;
  total: number;
  notes: string[];
}

export function estimateTax(input: TaxInput): TaxResult {
  const { totalPrice, area, firstHome, overTwoYears, onlyHomeOverFive } = input;
  const notes: string[] = [];
  let deedRate = 0.015;
  if (firstHome) {
    deedRate = area <= 90 ? 0.01 : 0.015;
    notes.push(`首套且面积${area <= 90 ? '≤' : '>'}90㎡，契税按 ${(deedRate * 100).toFixed(1)}% 估算`);
  } else {
    deedRate = area <= 90 ? 0.01 : 0.02;
    notes.push(`二套且面积${area <= 90 ? '≤' : '>'}90㎡，契税按 ${(deedRate * 100).toFixed(1)}% 估算`);
  }
  const deedTax = Math.round(totalPrice * deedRate);
  const vat = overTwoYears ? 0 : Math.round(totalPrice * 0.053);
  notes.push(overTwoYears ? '满两年，增值税免征' : '未满两年，增值税按 5.3% 估算');
  const incomeTax = onlyHomeOverFive ? 0 : Math.round(totalPrice * 0.01);
  notes.push(onlyHomeOverFive ? '满五唯一，个人所得税免征' : '个人所得税按 1% 估算');
  const total = deedTax + vat + incomeTax;
  return { deedTax, vat, incomeTax, total, notes };
}
