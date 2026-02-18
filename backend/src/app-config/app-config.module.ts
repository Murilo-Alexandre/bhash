import { Module } from '@nestjs/common';
import { AppConfigController } from './app-config.controller';
import { AdminAppConfigController } from './admin-app-config.controller';
import { AppConfigService } from './app-config.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AppConfigController, AdminAppConfigController],
  providers: [AppConfigService, PrismaService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
