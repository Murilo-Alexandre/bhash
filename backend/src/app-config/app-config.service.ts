import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AppConfigShape = {
  id: string;
  primaryColor: string;
  logoUrl: string | null;
};

@Injectable()
export class AppConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicConfig(): Promise<Pick<AppConfigShape, 'primaryColor' | 'logoUrl'>> {
    const cfg = await this.prisma.appConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' }, // usa defaults do schema
      select: { primaryColor: true, logoUrl: true },
    });

    return cfg;
  }

  async updateConfig(input: { primaryColor?: string; logoUrl?: string | null }) {
    const data: any = {};
    if (typeof input.primaryColor === 'string' && input.primaryColor.trim()) {
      data.primaryColor = input.primaryColor.trim();
    }
    if (input.logoUrl !== undefined) {
      data.logoUrl = input.logoUrl;
    }

    const cfg = await this.prisma.appConfig.upsert({
      where: { id: 'default' },
      update: data,
      create: {
        id: 'default',
        ...(data.primaryColor ? { primaryColor: data.primaryColor } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      },
      select: { id: true, primaryColor: true, logoUrl: true },
    });

    return cfg;
  }

  async setLogoUrl(url: string) {
    return this.updateConfig({ logoUrl: url });
  }
}
