import { Body, Controller, Put, Req, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AdminJwtAuthGuard } from '../admin-auth/admin-jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

function validatePassword(pw: string) {
  // regra simples e boa: >= 12 e mistura
  if (!pw || pw.length < 12) return 'Senha deve ter pelo menos 12 caracteres';
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNum = /[0-9]/.test(pw);
  const hasSym = /[^A-Za-z0-9]/.test(pw);
  if (!(hasUpper && hasLower && hasNum && hasSym)) {
    return 'Senha deve ter maiúscula, minúscula, número e símbolo';
  }
  return null;
}

@Controller('admin/me')
@UseGuards(AdminJwtAuthGuard)
export class AdminMeController {
  constructor(private readonly prisma: PrismaService) {}

  @Put('credentials')
  async updateMyCredentials(
    @Req() req: any,
    @Body() body: { username: string; password: string },
  ) {
    const me = req.user;
    if (!me?.id) throw new BadRequestException('Usuário inválido');

    if (!me.isSuperAdmin) {
      throw new ForbiddenException('Apenas o SuperAdmin pode alterar suas credenciais por aqui');
    }

    const username = (body?.username ?? '').trim();
    const password = String(body?.password ?? '');

    if (!username || username.length < 3) {
      throw new BadRequestException('Username inválido (mín. 3)');
    }

    const pwErr = validatePassword(password);
    if (pwErr) throw new BadRequestException(pwErr);

    // username único
    const exists = await this.prisma.adminAccount.findUnique({ where: { username } });
    if (exists && exists.id !== me.id) {
      throw new BadRequestException('Esse username já está em uso');
    }

    const passwordHash = await argon2.hash(password);

    const updated = await this.prisma.adminAccount.update({
      where: { id: me.id },
      data: {
        username,
        passwordHash,
        mustChangeCredentials: false,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        name: true,
        isSuperAdmin: true,
        mustChangeCredentials: true,
      },
    });

    return { ok: true, admin: updated };
  }
}
