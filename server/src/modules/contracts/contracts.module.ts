import { Module } from '@nestjs/common';
import { ContractsController, ProgressController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  controllers: [ContractsController, ProgressController],
  providers: [ContractsService],
})
export class ContractsModule {}
