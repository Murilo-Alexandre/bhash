import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfig: AppConfigService) {}

  // ✅ público
  @Get()
  get() {
    return this.appConfig.getPublicConfig();
  }
}
