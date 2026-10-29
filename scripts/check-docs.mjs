#!/usr/bin/env node
/**
 * 文档一致性检查（M5 门禁）：
 * 1. README / docs / STATUS / DECISIONS / PLAN-MATRIX 中的本地链接必须存在；
 * 2. README 必须引用全部角色截图（docs/screenshots/*.png），且无失效图片；
 * 3. 软件名称/版本在关键文档中一致；
 * 4. 阶段报告 docs/05–09 齐备。
 * 用法：npm run check:docs（不通过时退出码 1）
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const errors = [];
const checks = [];
function ok(name, condition, detail = '') {
  checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) errors.push(`${name}${detail ? `：${detail}` : ''}`);
}

function read(file) {
  return readFileSync(join(root, file), 'utf8');
}

const docFiles = [
  'README.md',
  'STATUS.md',
  'DECISIONS.md',
  'PLAN-MATRIX.md',
  ...readdirSync(join(root, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `docs/${name}`),
];

// 1. 本地链接存在性
let linkCount = 0;
for (const file of docFiles) {
  if (!existsSync(join(root, file))) continue;
  const content = read(file);
  const linkRegex = /\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const target = match[1].trim();
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const pathPart = decodeURIComponent(target.split('#')[0]);
    if (!pathPart) continue;
    linkCount += 1;
    const absolute = resolve(dirname(join(root, file)), pathPart);
    ok(`链接 ${file} → ${target}`, existsSync(absolute), absolute);
  }
}

// 2. README 截图覆盖
const shotDir = join(root, 'docs', 'screenshots');
const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((name) => name.endsWith('.png')).sort() : [];
const readme = read('README.md');
const images = [...readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((item) => decodeURIComponent(item[1].split('#')[0]));
for (const shot of shots) {
  const relative = `docs/screenshots/${shot}`;
  ok(`README 引用截图 ${shot}`, images.includes(relative), relative);
}
for (const image of images) {
  ok(`README 图片存在 ${image}`, existsSync(join(root, image)), image);
}
ok('README 截图数量', shots.length >= 20, `实际 ${shots.length} 张`);

// 3. 名称/版本一致性
const name = '房产交易数字化协同平台';
const version = 'V1.0';
for (const file of ['README.md', 'docs/00-项目方案与画像.md', 'DECISIONS.md', 'STATUS.md']) {
  const content = read(file);
  ok(`${file} 含软件名称`, content.includes(name));
  ok(`${file} 含版本号`, content.includes(version));
}

// 4. 阶段报告齐备
for (const file of [
  'docs/05-M1-验收报告.md',
  'docs/06-M2-验收报告.md',
  'docs/07-M3-验收报告.md',
  'docs/08-M4-验收报告.md',
  'docs/09-M5-验收报告.md',
]) {
  ok(`阶段报告存在 ${file}`, existsSync(join(root, file)), file);
}

// 输出
const failed = checks.filter((item) => !item.pass);
console.log(`[check:docs] 检查 ${checks.length} 项（链接 ${linkCount} 条、截图 ${shots.length} 张）`);
if (failed.length > 0) {
  for (const item of failed) console.error(`  ✗ ${item.name}${item.detail ? `：${item.detail}` : ''}`);
  console.error(`[check:docs] 失败 ${failed.length} 项`);
  process.exit(1);
}
console.log('[check:docs] 全部通过：本地链接有效、README 截图齐全、名称/版本一致、阶段报告齐备。');
