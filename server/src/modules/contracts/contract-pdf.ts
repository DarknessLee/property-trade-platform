import { existsSync, readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const FONT_CANDIDATES = [
  process.env.CONTRACT_FONT_PATH,
  'C:\\Windows\\Fonts\\simhei.ttf',
  'C:\\Windows\\Fonts\\simsunb.ttf',
].filter((item): item is string => Boolean(item));

let cachedFont: Uint8Array | null | undefined;

function loadChineseFont(): Uint8Array | null {
  if (cachedFont !== undefined) return cachedFont;
  for (const path of FONT_CANDIDATES) {
    try {
      if (existsSync(path)) {
        cachedFont = readFileSync(path);
        return cachedFont;
      }
    } catch {
      // 继续尝试下一个字体
    }
  }
  cachedFont = null;
  return null;
}

export interface ContractPdfData {
  code: string;
  title: string;
  signedAt?: Date | null;
  esignNo?: string | null;
  content: string;
  listingTitle: string;
  amount: number;
  commissionAmount: number;
  buyerName: string;
  sellerName: string;
  agentName: string;
  agencyName: string;
}

/** 生成演示用合同 PDF（中文优先使用系统黑体，缺失时降级为英文摘要） */
export async function buildContractPdf(data: ContractPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = loadChineseFont();
  const font = fontBytes ? await pdf.embedFont(fontBytes, { subset: true }) : await pdf.embedFont(StandardFonts.Helvetica);
  const hasChinese = Boolean(fontBytes);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 56;
  const fontSize = 11;
  const lineHeight = 18;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  const write = (text: string, size = fontSize, color = rgb(0.12, 0.12, 0.12), indent = 0): void => {
    if (cursorY < margin + 60) {
      page = pdf.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - margin;
    }
    page.drawText(text, { x: margin + indent, y: cursorY, size, font, color });
    cursorY -= size + 7;
  };

  const wrap = (text: string, maxChars = hasChinese ? 34 : 80): string[] => {
    const result: string[] = [];
    for (const rawLine of text.split('\n')) {
      if (!rawLine.trim()) {
        result.push('');
        continue;
      }
      let rest = rawLine.trim();
      while (rest.length > maxChars) {
        result.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      result.push(rest);
    }
    return result;
  };

  if (hasChinese) {
    write('江州市存量房屋买卖合同（演示存证）', 18, rgb(0.05, 0.25, 0.55));
    cursorY -= 6;
    write(`合同编号：${data.code}    第三方电子签编号：${data.esignNo ?? '—'}`, 10, rgb(0.4, 0.4, 0.4));
    write(`签署时间：${data.signedAt ? data.signedAt.toLocaleString('zh-CN', { hour12: false }) : '未签署'}`, 10, rgb(0.4, 0.4, 0.4));
    write(`房源：${data.listingTitle}    成交金额：${data.amount.toLocaleString()} 元    佣金：${data.commissionAmount.toLocaleString()} 元`, 10, rgb(0.4, 0.4, 0.4));
    write(`出卖人：${data.sellerName}    买受人：${data.buyerName}    居间方：${data.agencyName}（经纪人 ${data.agentName}）`, 10, rgb(0.4, 0.4, 0.4));
    cursorY -= 8;
    page.drawLine({ start: { x: margin, y: cursorY }, end: { x: pageWidth - margin, y: cursorY }, thickness: 0.8, color: rgb(0.85, 0.87, 0.9) });
    cursorY -= 20;

    for (const line of wrap(data.content)) {
      if (!line) {
        cursorY -= 6;
        continue;
      }
      if (line.startsWith('#')) {
        write(line.replace(/^#+\s*/, ''), 13, rgb(0.05, 0.25, 0.55));
      } else {
        write(line, fontSize);
      }
    }

    cursorY -= 24;
    write('（本文件由演示系统自动生成，电子签章与存证均为 Mock，不具法律效力。）', 9, rgb(0.55, 0.55, 0.55));
  } else {
    write('DEMO HOUSE SALE CONTRACT', 18, rgb(0.05, 0.25, 0.55));
    write(`Contract No: ${data.code}`, 10);
    write(`Esign No: ${data.esignNo ?? '-'}`, 10);
    write(`Listing: ${data.listingTitle}`, 10);
    write(`Amount: CNY ${data.amount}    Commission: CNY ${data.commissionAmount}`, 10);
    write(`Buyer: ${data.buyerName}    Seller: ${data.sellerName}`, 10);
    write(`Agency: ${data.agencyName}    Agent: ${data.agentName}`, 10);
    write('This PDF is generated for demo purposes only; no legal effect.', 9, rgb(0.55, 0.55, 0.55));
  }

  return pdf.save();
}
