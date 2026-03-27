import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeUploadedFileName } from '../common/upload-filename.util';

type UserSummary = {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  extension?: string | null;
  avatarUrl?: string | null;
  company?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
};

type OrgSummary = {
  id: string;
  name: string;
};

type BroadcastConfigInput = {
  title?: string;
  targetUserIds?: string[];
  companyIds?: string[];
  departmentIds?: string[];
  excludedUserIds?: string[];
  includeAllUsers?: boolean;
};

type BroadcastConfigNormalized = {
  title: string;
  targetUserIds: string[];
  companyIds: string[];
  departmentIds: string[];
  excludedUserIds: string[];
  includeAllUsers: boolean;
};

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeAttachmentName(value?: string | null) {
    const normalized = normalizeUploadedFileName(value);
    return normalized || null;
  }

  private normalizePair(a: string, b: string) {
    return a < b ? [a, b] : [b, a];
  }

  private normalizeIds(values?: string[] | null) {
    return Array.from(
      new Set((values ?? []).map((value) => String(value ?? '').trim()).filter(Boolean)),
    );
  }

  private userSelect() {
    return {
      id: true,
      username: true,
      name: true,
      email: true,
      extension: true,
      avatarUrl: true,
      company: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    } as const;
  }

  private orgSelect() {
    return { id: true, name: true } as const;
  }

  private messageSelect(currentUserId: string) {
    return {
      id: true,
      createdAt: true,
      senderId: true,
      body: true,
      contentType: true,
      attachmentUrl: true,
      attachmentName: true,
      attachmentMime: true,
      attachmentSize: true,
      deletedAt: true,
      broadcastListId: true,
      broadcastListTitle: true,
      sender: { select: { id: true, username: true, name: true, avatarUrl: true } },
      favorites: {
        where: { userId: currentUserId },
        select: { id: true },
      },
      reactions: {
        select: {
          id: true,
          emoji: true,
          userId: true,
          user: { select: { id: true, name: true, username: true } },
        },
      },
    };
  }

  private currentMembershipWhere(userId: string) {
    return {
      OR: [
        { participants: { some: { userId } } },
        { userAId: userId },
        { userBId: userId },
      ],
    };
  }

  private accessibleMembershipWhere(userId: string) {
    return {
      OR: [
        this.currentMembershipWhere(userId),
        {
          kind: 'GROUP' as const,
          states: {
            some: {
              userId,
              hidden: false,
              leftAt: { not: null },
            },
          },
        },
      ],
    };
  }

  private includeConversationForUser(myId: string) {
    return {
      userA: { select: this.userSelect() },
      userB: { select: this.userSelect() },
      createdBy: { select: this.userSelect() },
      participants: {
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        select: {
          userId: true,
          user: { select: this.userSelect() },
        },
      },
      broadcastTargets: {
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        select: {
          userId: true,
          user: { select: this.userSelect() },
        },
      },
      broadcastCompanyTargets: {
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        select: {
          companyId: true,
          company: { select: this.orgSelect() },
        },
      },
      broadcastDepartmentTargets: {
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        select: {
          departmentId: true,
          department: { select: this.orgSelect() },
        },
      },
      broadcastExcludedUsers: {
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        select: {
          userId: true,
          user: { select: this.userSelect() },
        },
      },
      states: {
        where: { userId: myId },
        take: 1,
      },
    };
  }

  private rankTimestamp(conv: { updatedAt?: string | Date; createdAt?: string | Date }) {
    const updated = conv.updatedAt ? new Date(conv.updatedAt).getTime() : 0;
    const created = conv.createdAt ? new Date(conv.createdAt).getTime() : 0;
    return Number.isFinite(updated) && updated > 0 ? updated : created;
  }

  private laterDate(a?: Date | string | null, b?: Date | string | null) {
    const aTime = a ? new Date(a).getTime() : 0;
    const bTime = b ? new Date(b).getTime() : 0;
    if (!aTime && !bTime) return null;
    return new Date(Math.max(aTime || 0, bTime || 0));
  }

  private visibleMessageDateWhere(state?: { clearedAt?: Date | null; leftAt?: Date | null } | null) {
    const createdAt: Record<string, Date> = {};
    if (state?.clearedAt) createdAt.gt = state.clearedAt;
    if (state?.leftAt) createdAt.lte = state.leftAt;
    return Object.keys(createdAt).length ? { createdAt } : {};
  }

  private dedupeUsers(items: Array<UserSummary | null | undefined>) {
    const out: UserSummary[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  }

  private dedupeOrgs(items: Array<OrgSummary | null | undefined>) {
    const out: OrgSummary[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  }

  private participantUsersFromConversation(conv: any) {
    const participantUsers = Array.isArray(conv?.participants)
      ? conv.participants.map((entry: any) => entry?.user as UserSummary | undefined)
      : [];

    return this.dedupeUsers([...participantUsers, conv?.userA ?? null, conv?.userB ?? null]);
  }

  private currentParticipantIdsFromConversation(conv: any) {
    return Array.from(
      new Set(
        [
          ...(Array.isArray(conv?.participants) ? conv.participants.map((entry: any) => entry?.userId) : []),
          conv?.userAId ?? null,
          conv?.userBId ?? null,
        ].filter((value): value is string => !!value),
      ),
    );
  }

  private broadcastTargetsFromConversation(conv: any) {
    const users = Array.isArray(conv?.broadcastTargets)
      ? conv.broadcastTargets.map((entry: any) => entry?.user as UserSummary | undefined)
      : [];
    return this.dedupeUsers(users);
  }

  private broadcastCompaniesFromConversation(conv: any) {
    const items = Array.isArray(conv?.broadcastCompanyTargets)
      ? conv.broadcastCompanyTargets.map((entry: any) => entry?.company as OrgSummary | undefined)
      : [];
    return this.dedupeOrgs(items);
  }

  private broadcastDepartmentsFromConversation(conv: any) {
    const items = Array.isArray(conv?.broadcastDepartmentTargets)
      ? conv.broadcastDepartmentTargets.map((entry: any) => entry?.department as OrgSummary | undefined)
      : [];
    return this.dedupeOrgs(items);
  }

  private broadcastExcludedUsersFromConversation(conv: any) {
    const users = Array.isArray(conv?.broadcastExcludedUsers)
      ? conv.broadcastExcludedUsers.map((entry: any) => entry?.user as UserSummary | undefined)
      : [];
    return this.dedupeUsers(users);
  }

  private directOtherUser(myId: string, conv: any) {
    return this.participantUsersFromConversation(conv).find((user) => user.id !== myId) ?? null;
  }

  private isCurrentParticipant(myId: string, conv: any) {
    return this.currentParticipantIdsFromConversation(conv).includes(myId);
  }

  private resolveConversationTitle(myId: string, conv: any) {
    if (conv.kind === 'DIRECT') {
      return this.directOtherUser(myId, conv)?.name ?? 'Nova conversa';
    }

    const explicit = String(conv.title ?? '').trim();
    if (explicit) return explicit;

    const names = this.participantUsersFromConversation(conv)
      .filter((user) => user.id !== myId)
      .map((user) => user.name)
      .filter(Boolean);

    if (conv.kind === 'GROUP') {
      return names.length ? names.join(', ') : 'Novo grupo';
    }

    return 'Nova lista';
  }

  private async ensureConversationParticipants(
    conversationId: string,
    userIds: string[],
    addedById?: string | null,
  ) {
    const ids = this.normalizeIds(userIds);
    if (!ids.length) return;

    await this.prisma.conversationParticipant.createMany({
      data: ids.map((userId) => ({
        id: randomUUID(),
        conversationId,
        userId,
        addedById: addedById ?? null,
      })),
      skipDuplicates: true,
    });
  }

  private async ensureVisibleStates(
    conversationId: string,
    participantIds: string[],
    currentUserId?: string | null,
  ) {
    const uniqueIds = this.normalizeIds(participantIds);
    if (!uniqueIds.length) return;

    const now = new Date();
    await this.prisma.$transaction(
      uniqueIds.map((participantId) =>
        this.prisma.conversationUserState.upsert({
          where: {
            conversationId_userId: {
              conversationId,
              userId: participantId,
            },
          },
          update:
            participantId === currentUserId
              ? { hidden: false, leftAt: null, lastReadAt: now }
              : { hidden: false, leftAt: null },
          create:
            participantId === currentUserId
              ? {
                  conversationId,
                  userId: participantId,
                  hidden: false,
                  leftAt: null,
                  lastReadAt: now,
                }
              : {
                  conversationId,
                  userId: participantId,
                  hidden: false,
                  leftAt: null,
                },
        }),
      ),
    );
  }

  private async requireActiveUsers(userIds: string[]) {
    const ids = this.normalizeIds(userIds);
    if (!ids.length) return [] as UserSummary[];

    const items = await this.prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: this.userSelect(),
    });

    if (items.length !== ids.length) {
      throw new BadRequestException('Há usuários inválidos ou inativos na seleção');
    }

    return items;
  }

  private async requireCompanies(companyIds: string[]) {
    const ids = this.normalizeIds(companyIds);
    if (!ids.length) return [] as OrgSummary[];

    const items = await this.prisma.company.findMany({
      where: { id: { in: ids } },
      select: this.orgSelect(),
    });

    if (items.length !== ids.length) {
      throw new BadRequestException('Há empresas inválidas na lista');
    }

    return items;
  }

  private async requireDepartments(departmentIds: string[]) {
    const ids = this.normalizeIds(departmentIds);
    if (!ids.length) return [] as OrgSummary[];

    const items = await this.prisma.department.findMany({
      where: { id: { in: ids } },
      select: this.orgSelect(),
    });

    if (items.length !== ids.length) {
      throw new BadRequestException('Há setores inválidos na lista');
    }

    return items;
  }

  private async normalizeBroadcastConfig(
    myId: string,
    input: BroadcastConfigInput,
    opts?: { requireTitle?: boolean },
  ) {
    const normalized: BroadcastConfigNormalized = {
      title: String(input?.title ?? '').trim(),
      targetUserIds: this.normalizeIds(input?.targetUserIds).filter((userId) => userId !== myId),
      companyIds: this.normalizeIds(input?.companyIds),
      departmentIds: this.normalizeIds(input?.departmentIds),
      excludedUserIds: this.normalizeIds(input?.excludedUserIds).filter((userId) => userId !== myId),
      includeAllUsers: !!input?.includeAllUsers,
    };

    if (opts?.requireTitle && normalized.title.length < 2) {
      throw new BadRequestException('Informe um nome para a lista de transmissão');
    }

    await Promise.all([
      this.requireActiveUsers(normalized.targetUserIds),
      this.requireActiveUsers(normalized.excludedUserIds),
      this.requireCompanies(normalized.companyIds),
      this.requireDepartments(normalized.departmentIds),
    ]);

    const effectiveTargets = await this.resolveBroadcastAudienceUsersFromConfig(myId, normalized);
    if (!effectiveTargets.length) {
      throw new BadRequestException('Selecione pelo menos um contato válido para a lista');
    }

    return normalized;
  }

  private async resolveBroadcastAudienceUsersFromConfig(
    ownerId: string,
    config: Pick<
      BroadcastConfigNormalized,
      'targetUserIds' | 'companyIds' | 'departmentIds' | 'excludedUserIds' | 'includeAllUsers'
    >,
  ) {
    const explicitUsers = await this.requireActiveUsers(config.targetUserIds);
    const out = new Map<string, UserSummary>();

    for (const user of explicitUsers) {
      if (user.id !== ownerId) out.set(user.id, user);
    }

    if (config.includeAllUsers || config.companyIds.length || config.departmentIds.length) {
      const dynamicUsers = await this.prisma.user.findMany({
        where: {
          isActive: true,
          id: { not: ownerId },
          OR: config.includeAllUsers
            ? undefined
            : [
                ...(config.companyIds.length ? [{ companyId: { in: config.companyIds } }] : []),
                ...(config.departmentIds.length ? [{ departmentId: { in: config.departmentIds } }] : []),
              ],
        },
        select: this.userSelect(),
        orderBy: [{ name: 'asc' }, { username: 'asc' }],
      });

      for (const user of dynamicUsers) out.set(user.id, user);
    }

    for (const excludedUserId of config.excludedUserIds) {
      out.delete(excludedUserId);
    }

    return Array.from(out.values());
  }

  private async resolveEffectiveBroadcastUsersFromConversation(conv: any) {
    if (conv?.kind !== 'BROADCAST') return [] as UserSummary[];
    return this.resolveBroadcastAudienceUsersFromConfig(conv.createdById ?? '', {
      includeAllUsers: !!conv.broadcastIncludeAllUsers,
      targetUserIds: Array.isArray(conv?.broadcastTargets)
        ? conv.broadcastTargets.map((entry: any) => String(entry?.userId ?? '')).filter(Boolean)
        : [],
      companyIds: Array.isArray(conv?.broadcastCompanyTargets)
        ? conv.broadcastCompanyTargets.map((entry: any) => String(entry?.companyId ?? '')).filter(Boolean)
        : [],
      departmentIds: Array.isArray(conv?.broadcastDepartmentTargets)
        ? conv.broadcastDepartmentTargets.map((entry: any) => String(entry?.departmentId ?? '')).filter(Boolean)
        : [],
      excludedUserIds: Array.isArray(conv?.broadcastExcludedUsers)
        ? conv.broadcastExcludedUsers.map((entry: any) => String(entry?.userId ?? '')).filter(Boolean)
        : [],
    });
  }

  private async replaceBroadcastAudience(
    conversationId: string,
    config: BroadcastConfigNormalized,
    tx: any,
  ) {
    await Promise.all([
      tx.conversationBroadcastTarget.deleteMany({ where: { conversationId } }),
      tx.conversationBroadcastCompany.deleteMany({ where: { conversationId } }),
      tx.conversationBroadcastDepartment.deleteMany({ where: { conversationId } }),
      tx.conversationBroadcastExcludedUser.deleteMany({ where: { conversationId } }),
    ]);

    if (config.targetUserIds.length) {
      await tx.conversationBroadcastTarget.createMany({
        data: config.targetUserIds.map((userId) => ({
          id: randomUUID(),
          conversationId,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    if (config.companyIds.length) {
      await tx.conversationBroadcastCompany.createMany({
        data: config.companyIds.map((companyId) => ({
          id: randomUUID(),
          conversationId,
          companyId,
        })),
        skipDuplicates: true,
      });
    }

    if (config.departmentIds.length) {
      await tx.conversationBroadcastDepartment.createMany({
        data: config.departmentIds.map((departmentId) => ({
          id: randomUUID(),
          conversationId,
          departmentId,
        })),
        skipDuplicates: true,
      });
    }

    if (config.excludedUserIds.length) {
      await tx.conversationBroadcastExcludedUser.createMany({
        data: config.excludedUserIds.map((userId) => ({
          id: randomUUID(),
          conversationId,
          userId,
        })),
        skipDuplicates: true,
      });
    }
  }

  private async mapConversationListItem(
    myId: string,
    conv: any,
    opts?: { effectiveBroadcastTargets?: UserSummary[]; includeBroadcastAudienceDetails?: boolean },
  ) {
    const state = (conv.states?.[0] as any) ?? null;
    const pinned = !!state?.pinned;
    const unreadFrom = this.laterDate(state?.lastReadAt, state?.clearedAt);
    const visibleDateWhere = this.visibleMessageDateWhere(state);

    const lastMessage = await this.prisma.message.findFirst({
      where: {
        conversationId: conv.id,
        hiddenForUsers: { none: { userId: myId } },
        ...(conv.kind === 'DIRECT'
          ? {
              NOT: {
                senderId: myId,
                broadcastListId: { not: null },
              },
            }
          : {}),
        ...visibleDateWhere,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: this.messageSelect(myId),
    });

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: conv.id,
        senderId: { not: myId },
        hiddenForUsers: { none: { userId: myId } },
        ...(unreadFrom
          ? { createdAt: { gt: unreadFrom, ...(state?.leftAt ? { lte: state.leftAt } : {}) } }
          : visibleDateWhere),
      },
    });

    const participants = this.participantUsersFromConversation(conv);
    const otherUser = conv.kind === 'DIRECT' ? this.directOtherUser(myId, conv) : null;
    const explicitBroadcastTargets = this.broadcastTargetsFromConversation(conv);
    const effectiveBroadcastTargets =
      opts?.effectiveBroadcastTargets ??
      (conv.kind === 'BROADCAST' ? await this.resolveEffectiveBroadcastUsersFromConversation(conv) : []);

    return {
      id: conv.id,
      kind: conv.kind,
      title: this.resolveConversationTitle(myId, conv),
      rawTitle: conv.title ?? null,
      avatarUrl: conv.avatarUrl ?? null,
      createdAt: conv.createdAt,
      updatedAt: lastMessage?.createdAt ?? conv.updatedAt,
      createdById: conv.createdById ?? null,
      createdBy: conv.createdBy ?? null,
      otherUser,
      participants,
      participantCount: participants.length,
      broadcastTargets: explicitBroadcastTargets,
      targetCount: effectiveBroadcastTargets.length,
      pinned,
      unreadCount,
      isCurrentParticipant: this.isCurrentParticipant(myId, conv),
      leftAt: state?.leftAt ?? null,
      broadcastIncludeAllUsers: !!conv.broadcastIncludeAllUsers,
      ...(opts?.includeBroadcastAudienceDetails
        ? {
            effectiveBroadcastTargets,
            broadcastTargetCompanies: this.broadcastCompaniesFromConversation(conv),
            broadcastTargetDepartments: this.broadcastDepartmentsFromConversation(conv),
            broadcastExcludedUsers: this.broadcastExcludedUsersFromConversation(conv),
          }
        : null),
      lastMessage: lastMessage
        ? {
            ...lastMessage,
            attachmentName: this.normalizeAttachmentName(lastMessage.attachmentName),
            isFavorited: lastMessage.favorites.length > 0,
            broadcastSource:
              lastMessage.broadcastListId && lastMessage.broadcastListTitle
                ? {
                    id: lastMessage.broadcastListId,
                    title: lastMessage.broadcastListTitle,
                  }
                : null,
          }
        : null,
    };
  }

  private async findAccessibleConversationForUser(myId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        AND: [this.accessibleMembershipWhere(myId)],
      },
      include: this.includeConversationForUser(myId),
    });

    if (!conv) throw new BadRequestException('Conversa não encontrada');
    return conv;
  }

  private async findCurrentConversationForUser(myId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        AND: [this.currentMembershipWhere(myId)],
      },
      include: this.includeConversationForUser(myId),
    });

    if (!conv) throw new BadRequestException('Conversa não encontrada');
    return conv;
  }

  private async serializeConversationForUser(
    myId: string,
    conversationId: string,
    opts?: { includeBroadcastAudienceDetails?: boolean; includeAvailableBroadcastUsers?: boolean },
  ) {
    const conv = await this.findAccessibleConversationForUser(myId, conversationId);
    const effectiveBroadcastTargets =
      conv.kind === 'BROADCAST' ? await this.resolveEffectiveBroadcastUsersFromConversation(conv) : [];
    const conversation = await this.mapConversationListItem(myId, conv, {
      effectiveBroadcastTargets,
      includeBroadcastAudienceDetails: !!opts?.includeBroadcastAudienceDetails,
    });

    if (!opts?.includeBroadcastAudienceDetails || conv.kind !== 'BROADCAST') {
      return conversation;
    }

    const includedUserIds = new Set(effectiveBroadcastTargets.map((user) => user.id));
    const availableBroadcastUsers = opts?.includeAvailableBroadcastUsers
      ? await this.prisma.user.findMany({
          where: {
            isActive: true,
            id: {
              not: myId,
              notIn: Array.from(includedUserIds),
            },
          },
          orderBy: [{ name: 'asc' }, { username: 'asc' }],
          select: this.userSelect(),
        })
      : [];

    return {
      ...conversation,
      availableBroadcastUsers,
    };
  }

  async assertMember(myId: string, conversationId: string) {
    return this.findAccessibleConversationForUser(myId, conversationId);
  }

  async assertCurrentParticipant(myId: string, conversationId: string) {
    return this.findCurrentConversationForUser(myId, conversationId);
  }

  async getOrCreateDirect(myId: string, otherUserId: string) {
    if (!otherUserId || otherUserId === myId) {
      throw new BadRequestException('otherUserId inválido');
    }

    await this.requireActiveUsers([otherUserId]);

    const [userAId, userBId] = this.normalizePair(myId, otherUserId);

    const conv = await this.prisma.conversation.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: {
        kind: 'DIRECT',
        title: null,
        avatarUrl: null,
      },
      create: {
        kind: 'DIRECT',
        userAId,
        userBId,
      },
      select: { id: true },
    });

    await this.ensureConversationParticipants(conv.id, [userAId, userBId], myId);
    await this.prisma.conversationUserState.upsert({
      where: { conversationId_userId: { conversationId: conv.id, userId: myId } },
      update: { hidden: false, leftAt: null },
      create: { conversationId: conv.id, userId: myId, hidden: false, leftAt: null },
    });

    return {
      ok: true,
      conversation: await this.serializeConversationForUser(myId, conv.id),
    };
  }

  async createGroup(myId: string, title: string, memberIds: string[]) {
    const normalizedTitle = String(title ?? '').trim();
    if (normalizedTitle.length < 2) {
      throw new BadRequestException('Informe um nome para o grupo');
    }

    const uniqueMembers = this.normalizeIds(memberIds).filter((value) => value !== myId);
    if (!uniqueMembers.length) {
      throw new BadRequestException('Selecione pelo menos uma pessoa para o grupo');
    }

    await this.requireActiveUsers(uniqueMembers);
    const participantIds = [myId, ...uniqueMembers];

    const conv = await this.prisma.conversation.create({
      data: {
        id: randomUUID(),
        kind: 'GROUP',
        title: normalizedTitle,
        createdById: myId,
      },
      select: { id: true },
    });

    await this.ensureConversationParticipants(conv.id, participantIds, myId);
    await this.ensureVisibleStates(conv.id, participantIds, myId);

    return {
      ok: true,
      conversation: await this.serializeConversationForUser(myId, conv.id),
      participantIds,
    };
  }

  async createBroadcastList(myId: string, input: BroadcastConfigInput) {
    const config = await this.normalizeBroadcastConfig(myId, input, { requireTitle: true });

    const conv = await this.prisma.conversation.create({
      data: {
        id: randomUUID(),
        kind: 'BROADCAST',
        title: config.title,
        createdById: myId,
        broadcastIncludeAllUsers: config.includeAllUsers,
      },
      select: { id: true },
    });

    await this.ensureConversationParticipants(conv.id, [myId], myId);
    await this.ensureVisibleStates(conv.id, [myId], myId);
    await this.replaceBroadcastAudience(conv.id, config, this.prisma);

    return {
      ok: true,
      conversation: await this.serializeConversationForUser(myId, conv.id),
    };
  }

  async updateBroadcastList(myId: string, conversationId: string, input: BroadcastConfigInput) {
    const conv = await this.assertCurrentParticipant(myId, conversationId);
    if (conv.kind !== 'BROADCAST') {
      throw new BadRequestException('Somente listas de transmissão podem ser editadas');
    }
    if (conv.createdById !== myId) {
      throw new ForbiddenException('Somente quem criou a lista pode editá-la');
    }

    const config = await this.normalizeBroadcastConfig(myId, input, { requireTitle: true });

    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          title: config.title,
          broadcastIncludeAllUsers: config.includeAllUsers,
        },
      });

      await this.replaceBroadcastAudience(conversationId, config, tx);
    });

    return {
      ok: true,
      conversation: await this.serializeConversationForUser(myId, conversationId, {
        includeBroadcastAudienceDetails: true,
        includeAvailableBroadcastUsers: true,
      }),
    };
  }

  async getDetails(myId: string, conversationId: string) {
    const conv = await this.findAccessibleConversationForUser(myId, conversationId);
    if (conv.kind === 'BROADCAST' && conv.createdById !== myId) {
      throw new ForbiddenException('Somente quem criou a lista pode ver esses dados');
    }

    return {
      ok: true,
      conversation: await this.serializeConversationForUser(myId, conversationId, {
        includeBroadcastAudienceDetails: conv.kind === 'BROADCAST',
        includeAvailableBroadcastUsers: conv.kind === 'BROADCAST',
      }),
    };
  }

  async addGroupParticipants(myId: string, conversationId: string, userIds: string[]) {
    const conv = await this.assertCurrentParticipant(myId, conversationId);
    if (conv.kind !== 'GROUP') {
      throw new BadRequestException('Somente grupos aceitam novos participantes');
    }

    const existingIds = new Set(this.participantUsersFromConversation(conv).map((user) => user.id));
    const newIds = this.normalizeIds(userIds).filter((value) => value && !existingIds.has(value));
    if (!newIds.length) {
      return {
        ok: true,
        conversation: await this.serializeConversationForUser(myId, conversationId),
        participantIds: existingIds.size ? Array.from(existingIds) : [myId],
      };
    }

    await this.requireActiveUsers(newIds);
    const participantIds = [...existingIds, ...newIds];

    await this.ensureConversationParticipants(conversationId, newIds, myId);
    await this.ensureVisibleStates(conversationId, newIds);

    return {
      ok: true,
      conversation: await this.serializeConversationForUser(myId, conversationId),
      participantIds,
      addedUserIds: newIds,
    };
  }

  async leaveGroup(myId: string, conversationId: string) {
    const conv = await this.assertCurrentParticipant(myId, conversationId);
    if (conv.kind !== 'GROUP') {
      throw new BadRequestException('Somente grupos podem ser deixados');
    }

    const leftAt = new Date();
    await this.prisma.$transaction([
      this.prisma.conversationParticipant.deleteMany({
        where: { conversationId, userId: myId },
      }),
      this.prisma.conversationUserState.upsert({
        where: { conversationId_userId: { conversationId, userId: myId } },
        update: {
          hidden: false,
          leftAt,
          lastReadAt: leftAt,
        },
        create: {
          conversationId,
          userId: myId,
          hidden: false,
          leftAt,
          lastReadAt: leftAt,
        },
      }),
    ]);

    const remainingParticipants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    if (!remainingParticipants.length) {
      await this.prisma.conversation.delete({ where: { id: conversationId } });
      return {
        ok: true,
        conversationId,
        remainingParticipantIds: [] as string[],
      };
    }

    return {
      ok: true,
      conversationId,
      conversation: await this.serializeConversationForUser(myId, conversationId),
      remainingParticipantIds: remainingParticipants.map((item) => item.userId),
    };
  }

  async listMine(myId: string, q?: string) {
    const query = (q ?? '').trim();
    const queryFilter = query
      ? {
          OR: [
            { title: { contains: query, mode: 'insensitive' as const } },
            { userA: { name: { contains: query, mode: 'insensitive' as const } } },
            { userA: { username: { contains: query, mode: 'insensitive' as const } } },
            { userA: { email: { contains: query, mode: 'insensitive' as const } } },
            { userB: { name: { contains: query, mode: 'insensitive' as const } } },
            { userB: { username: { contains: query, mode: 'insensitive' as const } } },
            { userB: { email: { contains: query, mode: 'insensitive' as const } } },
            { participants: { some: { user: { name: { contains: query, mode: 'insensitive' as const } } } } },
            { participants: { some: { user: { username: { contains: query, mode: 'insensitive' as const } } } } },
            { participants: { some: { user: { email: { contains: query, mode: 'insensitive' as const } } } } },
            { broadcastTargets: { some: { user: { name: { contains: query, mode: 'insensitive' as const } } } } },
            { createdBy: { name: { contains: query, mode: 'insensitive' as const } } },
          ],
        }
      : null;

    const rows = await this.prisma.conversation.findMany({
      where: {
        AND: [this.accessibleMembershipWhere(myId), ...(queryFilter ? [queryFilter] : [])],
        states: { none: { userId: myId, hidden: true } },
      },
      include: this.includeConversationForUser(myId),
    });

    const items = await Promise.all(rows.map((conv) => this.mapConversationListItem(myId, conv)));

    items.sort((a, b) => {
      const pinDiff = Number(!!b.pinned) - Number(!!a.pinned);
      if (pinDiff !== 0) return pinDiff;
      return this.rankTimestamp(b) - this.rankTimestamp(a);
    });

    return { ok: true, items };
  }

  async markAsRead(myId: string, conversationId: string) {
    await this.assertMember(myId, conversationId);

    await this.prisma.conversationUserState.upsert({
      where: { conversationId_userId: { conversationId, userId: myId } },
      update: { lastReadAt: new Date(), hidden: false },
      create: { conversationId, userId: myId, lastReadAt: new Date(), hidden: false },
    });

    return { ok: true };
  }

  async hideConversation(myId: string, conversationId: string) {
    const conv = await this.assertMember(myId, conversationId);
    if (conv.kind === 'GROUP' && this.isCurrentParticipant(myId, conv)) {
      throw new BadRequestException('Saia do grupo antes de remover ele dos seus chats');
    }

    await this.markAsRead(myId, conversationId);

    await this.prisma.conversationUserState.update({
      where: { conversationId_userId: { conversationId, userId: myId } },
      data: { hidden: true },
    });

    return { ok: true };
  }

  async setPinned(myId: string, conversationId: string, value: boolean) {
    await this.assertMember(myId, conversationId);

    await this.prisma.conversationUserState.upsert({
      where: { conversationId_userId: { conversationId, userId: myId } },
      update: { pinned: !!value, hidden: false } as any,
      create: {
        conversationId,
        userId: myId,
        pinned: !!value,
        hidden: false,
      } as any,
    });

    return { ok: true, pinned: !!value };
  }

  async setConversationAvatar(myId: string, conversationId: string, avatarUrl: string | null) {
    const conv = await this.assertCurrentParticipant(myId, conversationId);
    if (conv.kind === 'DIRECT') {
      throw new BadRequestException('Conversas diretas não possuem foto própria');
    }
    if (conv.kind === 'BROADCAST' && conv.createdById !== myId) {
      throw new ForbiddenException('Somente quem criou a lista pode trocar a foto');
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        avatarUrl: avatarUrl?.trim() ? avatarUrl.trim() : null,
      },
    });

    return {
      ok: true,
      conversation: await this.serializeConversationForUser(myId, conversationId, {
        includeBroadcastAudienceDetails: conv.kind === 'BROADCAST',
        includeAvailableBroadcastUsers: conv.kind === 'BROADCAST',
      }),
    };
  }
}

