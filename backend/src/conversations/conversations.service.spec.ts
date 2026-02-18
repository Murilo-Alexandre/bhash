import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePair(a: string, b: string) {
    return a < b ? [a, b] : [b, a];
  }

  async getOrCreateDirect(myId: string, otherUserId: string) {
    if (!otherUserId || otherUserId === myId) {
      throw new BadRequestException('otherUserId inválido');
    }

    const other = await this.prisma.user.findUnique({ where: { id: otherUserId } });
    if (!other || !other.isActive) throw new BadRequestException('Usuário não encontrado/inativo');

    const [userAId, userBId] = this.normalizePair(myId, otherUserId);

    return this.prisma.conversation.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: {},
      create: { userAId, userBId },
      include: {
        userA: { select: { id: true, username: true, name: true } },
        userB: { select: { id: true, username: true, name: true } },
      },
    });
  }

  async listMine(myId: string) {
    return this.prisma.conversation.findMany({
      where: { OR: [{ userAId: myId }, { userBId: myId }] },
      orderBy: { updatedAt: 'desc' },
      include: {
        userA: { select: { id: true, username: true, name: true } },
        userB: { select: { id: true, username: true, name: true } },
      },
    });
  }
}
