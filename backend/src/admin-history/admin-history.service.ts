// C:\dev\bhash\backend\src\admin-history\admin-history.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function toDateOrNull(v?: string) {
  const s = (v ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function norm(v?: string) {
  const s = (v ?? '').trim();
  return s ? s : '';
}

/**
 * ✅ Tipagem explícita para o retorno do listUserConversations
 * (evita o TS inferir union maluco envolvendo arrays)
 */
type AdminConvRow = {
  id: string;
  updatedAt: Date;
  userA: { id: string; username: string; name: string };
  userB: { id: string; username: string; name: string };
  messages: { id: string; createdAt: Date; body: string | null; senderId: string }[];
};

@Injectable()
export class AdminHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listContacts(input: {
    q?: string;
    companyId?: string;
    departmentId?: string;
    pageStr?: string;
    pageSizeStr?: string;
  }) {
    const page = Math.max(1, Number(input.pageStr ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(input.pageSizeStr ?? 30) || 30));
    const skip = (page - 1) * pageSize;

    const q = norm(input.q);
    const companyId = norm(input.companyId);
    const departmentId = norm(input.departmentId);

    const and: any[] = [];
    if (companyId) and.push({ companyId });
    if (departmentId) and.push({ departmentId });

    const where: any = {};
    if (and.length) where.AND = and;

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { extension: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip,
        take: pageSize,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          extension: true,
          isActive: true,
          company: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        } as any,
      }),
    ]);

    return { ok: true, page, pageSize, total, items };
  }

  async listUserConversations(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!u) throw new BadRequestException('Usuário não encontrado');

    // ✅ Força o tipo correto (resolve TS2339 no c.userA.id)
    const convs = (await this.prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        updatedAt: true,
        userA: { select: { id: true, username: true, name: true } },
        userB: { select: { id: true, username: true, name: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true, body: true, senderId: true },
        },
      } as any,
    })) as unknown as AdminConvRow[];

    const items = convs.map((c) => {
      const other = c.userA.id === userId ? c.userB : c.userA;
      const last = c.messages?.[0] ?? null;

      return {
        id: c.id,
        updatedAt: c.updatedAt,
        otherUser: other,
        lastMessage: last
          ? {
              id: last.id,
              createdAt: last.createdAt,
              bodyPreview: (last.body ?? '').slice(0, 160),
              senderId: last.senderId,
            }
          : null,
      };
    });

    return { ok: true, items };
  }

  async listConversationMessages(input: {
    conversationId: string;
    cursor?: string;
    take?: string;
    from?: string;
    to?: string;
    q?: string;
  }) {
    const pageSize = Math.min(Math.max(parseInt(input.take ?? '50', 10) || 50, 1), 200);

    const fromDate = toDateOrNull(input.from);
    const toDate = toDateOrNull(input.to);
    const q = norm(input.q);

    const where: any = { conversationId: input.conversationId };

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    if (q) {
      where.body = { contains: q, mode: 'insensitive' };
    }

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
      include: { sender: { select: { id: true, username: true, name: true } } },
    });

    const nextCursor = messages.length === pageSize ? messages[messages.length - 1].id : null;

    return { ok: true, items: messages.reverse(), nextCursor };
  }

  async globalSearch(input: {
    q?: string;
    from?: string;
    to?: string;
    companyId?: string;
    departmentId?: string;
    pageStr?: string;
    pageSizeStr?: string;
  }) {
    const q = norm(input.q);
    if (!q || q.length < 2) throw new BadRequestException('Informe uma palavra/frase (mín. 2 caracteres)');

    const page = Math.max(1, Number(input.pageStr ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(input.pageSizeStr ?? 50) || 50));
    const skip = (page - 1) * pageSize;

    const fromDate = toDateOrNull(input.from);
    const toDate = toDateOrNull(input.to);
    const companyId = norm(input.companyId);
    const departmentId = norm(input.departmentId);

    const where: any = {
      body: { contains: q, mode: 'insensitive' },
    };

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    if (companyId || departmentId) {
      where.conversation = {
        OR: [
          { userA: { ...(companyId ? { companyId } : {}), ...(departmentId ? { departmentId } : {}) } },
          { userB: { ...(companyId ? { companyId } : {}), ...(departmentId ? { departmentId } : {}) } },
        ],
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          body: true,
          conversationId: true,
          sender: { select: { id: true, username: true, name: true } },
          conversation: {
            select: {
              id: true,
              userA: { select: { id: true, username: true, name: true } },
              userB: { select: { id: true, username: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      ok: true,
      q,
      page,
      pageSize,
      total,
      items: items.map((m) => ({
        id: m.id,
        createdAt: m.createdAt,
        bodyPreview: (m.body ?? '').slice(0, 220),
        conversationId: m.conversationId,
        sender: m.sender,
        conversation: m.conversation,
      })),
    };
  }
}
