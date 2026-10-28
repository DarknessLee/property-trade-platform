import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { ERROR_CODES } from './constants';

/** 统一异常：{ code, message, data: null }，业务码见 constants.ERROR_CODES */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: number = ERROR_CODES.INTERNAL;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const detail = payload as { code?: number; message?: string | string[]; error?: string };
        code = typeof detail.code === 'number' ? detail.code : this.httpStatusToCode(status);
        message = Array.isArray(detail.message) ? detail.message.join('；') : detail.message ?? detail.error ?? message;
      } else {
        code = this.httpStatusToCode(status);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = ERROR_CODES.CONFLICT;
        message = '数据已存在，请勿重复提交';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = ERROR_CODES.NOT_FOUND;
        message = '数据不存在或已被删除';
      } else {
        message = `数据操作失败（${exception.code}）`;
      }
      this.logger.error(`${exception.code}: ${exception.message}`);
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({ code, message, data: null });
  }

  private httpStatusToCode(status: number): number {
    switch (status) {
      case 400:
        return ERROR_CODES.BAD_REQUEST;
      case 401:
        return ERROR_CODES.UNAUTHORIZED;
      case 403:
        return ERROR_CODES.FORBIDDEN;
      case 404:
        return ERROR_CODES.NOT_FOUND;
      case 409:
        return ERROR_CODES.CONFLICT;
      case 422:
        return ERROR_CODES.BUSINESS_RULE;
      default:
        return ERROR_CODES.INTERNAL;
    }
  }
}
