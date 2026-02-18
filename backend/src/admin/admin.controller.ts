import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../admin-auth/admin-jwt-auth.guard';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminController {
  @Get('ping')
  ping() {
    return { ok: true, scope: 'admin' };
  }
}
