import { Body, Controller, Put, Req, UseGuards, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // ✅ ajuste se seu nome for diferente

function validatePassword(pw: string) {
  if (!pw || pw.length < 8) return 'Senha deve ter pelo menos 8 caracteres';
  return null;
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Put('password')
  async updateMyPassword(@Req() req: any, @Body() body: { password: string }) {
    const me = req.user;
    const userId = me?.id || me?.sub;
    if (!userId) throw new BadRequestException('Usuário inválido');

    const password = String(body?.password ?? '');
    const pwErr = validatePassword(password);
    if (pwErr) throw new BadRequestException(pwErr);

    const passwordHash = await argon2.hash(password);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false, isActive: true },
    });

    return { ok: true };
  }
}
