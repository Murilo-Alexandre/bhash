import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMember(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userAId: true, userBId: true },
    });
    if (!conv) throw new BadRequestException('Conversa não encontrada');

    const ok = conv.userAId === userId || conv.userBId === userId;
    if (!ok) throw new ForbiddenException('Você não participa dessa conversa');

    return conv;
  }

  async send(userId: string, conversationId: string, text: string) {
    const body = (text ?? '').trim();
    if (!body) throw new BadRequestException('Mensagem vazia');

    await this.assertMember(userId, conversationId);

    const msg = await this.prisma.message.create({
      data: { conversationId, senderId: userId, body },
      include: { sender: { select: { id: true, username: true, name: true } } },
    });

    // força o updatedAt da conversa atualizar
    await this.prisma.conversation.update({ where: { id: conversationId }, data: {} });

    return msg;
  }

  async list(userId: string, conversationId: string, cursor?: string, take?: string) {
    await this.assertMember(userId, conversationId);

    const pageSize = Math.min(Math.max(parseInt(take ?? '30', 10) || 30, 1), 100);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { sender: { select: { id: true, username: true, name: true } } },
    });

    const nextCursor = messages.length === pageSize ? messages[messages.length - 1].id : null;

    return { items: messages.reverse(), nextCursor };
  }
}
