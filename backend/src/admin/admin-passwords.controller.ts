import { Body, Controller, ForbiddenException, Param, Put, UseGuards, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AdminJwtAuthGuard } from '../admin-auth/admin-jwt-auth.guard';

function validatePassword(pw: string) {
  if (!pw || pw.length < 8) return 'Senha deve ter pelo menos 8 caracteres';
  return null;
}

@Controller('admin/passwords')
@UseGuards(AdminJwtAuthGuard)
export class AdminPasswordsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ✅ Admin reseta senha de um USER DO CHAT
   * PUT /admin/passwords/chat/:userId
   */
  @Put('chat/:userId')
  async resetChatUserPassword(
    @Param('userId') userId: string,
    @Body() body: { newPassword: string; forceChangeOnNextLogin?: boolean },
  ) {
    const newPassword = String(body?.newPassword ?? '');
    const force = body?.forceChangeOnNextLogin !== false; // default true se não vier

    const pwErr = validatePassword(newPassword);
    if (pwErr) throw new BadRequestException(pwErr);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuário não encontrado');

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: force,
        isActive: true,
      },
    });

    return { ok: true };
  }

  /**
   * ✅ Admin reseta senha de um ADMIN (mas NUNCA do superadmin)
   * PUT /admin/passwords/admin/:adminId
   */
  @Put('admin/:adminId')
  async resetAdminPassword(
    @Param('adminId') adminId: string,
    @Body() body: { newPassword: string; forceChangeOnNextLogin?: boolean },
  ) {
    const newPassword = String(body?.newPassword ?? '');
    const force = body?.forceChangeOnNextLogin !== false;

    const pwErr = validatePassword(newPassword);
    if (pwErr) throw new BadRequestException(pwErr);

    const target = await this.prisma.adminAccount.findUnique({
      where: { id: adminId },
      select: { id: true, isSuperAdmin: true },
    });

    if (!target) throw new BadRequestException('Admin não encontrado');

    // ✅ Opção A: ninguém toca no superadmin
    if (target.isSuperAdmin) {
      throw new ForbiddenException('Não é permitido alterar senha do SuperAdmin');
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.adminAccount.update({
      where: { id: adminId },
      data: {
        passwordHash,
        mustChangePassword: force,
        isActive: true,
      },
    });

    return { ok: true };
  }
}
