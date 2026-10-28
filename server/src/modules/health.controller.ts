import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators';

const VERSION = 'V1.0';
const APP_NAME = '房产交易数字化协同平台';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health(): { status: string; app: string; version: string; time: string } {
    return { status: 'ok', app: APP_NAME, version: VERSION, time: new Date().toISOString() };
  }
}
