import { Module } from '@nestjs/common';
import { AdminHistoryController } from './admin-history.controller';
import { AdminHistoryService } from './admin-history.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AdminHistoryController],
  providers: [AdminHistoryService, PrismaService],
})
export class AdminHistoryModule {}
