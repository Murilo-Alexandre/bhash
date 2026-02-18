import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const admin = await this.prisma.adminAccount.findUnique({ where: { username } });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const ok = await argon2.verify(admin.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    await this.prisma.adminAccount.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      type: 'admin',
      sub: admin.id,
      username: admin.username,
    };

    const access_token = await this.jwt.signAsync(payload);

    return {
      access_token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        isSuperAdmin: admin.isSuperAdmin,
        mustChangeCredentials: admin.mustChangeCredentials,
      },
    };
  }
}
