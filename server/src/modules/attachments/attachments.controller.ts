import { BadRequestException, Controller, Get, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';

export const UPLOAD_ROOT = join(process.cwd(), 'uploads');
export const UPLOAD_URL_PREFIX = '/uploads';
export const BIZ_TYPES = ['listing_agreement', 'property_cert', 'listing_image', 'contract', 'avatar'];

function decodeOriginalName(name: string): string {
  try {
    // 浏览器/表单把文件名按 latin1 传入，中文需还原为 UTF-8
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return decoded.includes('\uFFFD') ? name : decoded;
  } catch {
    return name;
  }
}

function sanitizeName(name: string): string {
  const cleaned = name.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
  return cleaned.length > 80 ? cleaned.slice(-80) : cleaned || 'file';
}

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles('agent', 'store_manager', 'finance', 'admin')
  async list(
    @Query('bizType') bizType?: string,
    @Query('bizId') bizId?: string,
  ): Promise<unknown[]> {
    if (!bizType || !bizId) {
      throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '请提供 bizType 与 bizId' });
    }
    const rows = await this.prisma.attachment.findMany({
      where: { bizType, bizId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      bizType: row.bizType,
      bizId: row.bizId,
      fileName: row.fileName,
      filePath: row.filePath,
      fileSize: row.fileSize,
      mimeType: row.mimeType,
      createdAt: row.createdAt,
    }));
  }

  @Post()
  @Roles('agent', 'store_manager', 'admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          callback(new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '仅支持 PDF/JPG/PNG/WEBP 文件' }), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('bizType') bizType: string,
    @Query('bizId') bizId: string,
  ): Promise<unknown> {
    if (!file) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '请选择要上传的文件' });
    if (!BIZ_TYPES.includes(bizType)) {
      throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '附件业务类型不合法' });
    }
    if (!bizId) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '缺少业务 ID' });

    const fileName = sanitizeName(decodeOriginalName(file.originalname));
    const relativeDir = join(bizType, new Date().toISOString().slice(0, 7));
    const diskDir = join(UPLOAD_ROOT, relativeDir);
    mkdirSync(diskDir, { recursive: true });
    const storedName = `${Date.now()}-${randomUUID().slice(0, 8)}-${fileName}`;
    writeFileSync(join(diskDir, storedName), file.buffer);

    const filePath = `${UPLOAD_URL_PREFIX}/${relativeDir.replace(/\\/g, '/')}/${storedName}`;
    const attachment = await this.prisma.attachment.create({
      data: {
        bizType,
        bizId,
        fileName,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: user.id,
      },
    });
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      filePath: attachment.filePath,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
    };
  }
}
