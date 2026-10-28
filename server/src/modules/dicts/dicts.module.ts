import { Module } from '@nestjs/common';
import { DictsController } from './dicts.controller';

@Module({
  controllers: [DictsController],
})
export class DictsModule {}
