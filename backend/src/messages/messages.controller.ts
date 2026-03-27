import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { ChatEventsService } from '../chat/chat-events.service';
import { normalizeUploadedFileName } from '../common/upload-filename.util';

function safeAttachmentExt(original: string) {
  const ext = path.extname(normalizeUploadedFileName(original) || '').toLowerCase();
  return ext || '';
}

function normalizeUploadMode(raw?: string | null) {
  if (raw === 'image' || raw === 'file' || raw === 'audio') return raw;
  return 'file';
}

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly events: ChatEventsService,
  ) {}

  @Get('conversations/:id/messages')
  list(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.messages.list(req.user.sub, conversationId, cursor, take);
  }

  @Get('conversations/:id/messages/around')
  around(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Query('messageId') messageId?: string,
    @Query('take') take?: string,
  ) {
    if (!messageId) throw new BadRequestException('messageId obrigatório');
    return this.messages.around(req.user.sub, conversationId, messageId, take);
  }

  @Get('conversations/:id/search')
  search(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
  ) {
    return this.messages.search(req.user.sub, conversationId, q, take);
  }

  @Get('conversations/:id/media')
  media(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Query('kind') kind?: 'image' | 'file',
    @Query('take') take?: string,
  ) {
    return this.messages.listMedia(req.user.sub, conversationId, kind, take);
  }

  @Get('conversations/:id/media-retention-policy')
  mediaRetentionPolicy(
    @Req() req: any,
    @Param('id') conversationId: string,
  ) {
    return this.messages.getVisibleMediaRetentionPolicy(req.user.sub, conversationId);
  }

  @Post('conversations/:id/messages')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(process.cwd(), 'public', 'uploads', 'chat');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = safeAttachmentExt(file.originalname);
          cb(null, `msg_${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 250 * 1024 * 1024 },
    }),
  )
  async send(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Body()
    body: {
      body?: string;
      replyToId?: string;
      uploadMode?: 'image' | 'file' | 'audio';
    },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const result = await this.messages.send({
      userId: req.user.sub,
      conversationId,
      body: body.body,
      replyToId: body.replyToId ?? null,
      file,
      uploadMode: normalizeUploadMode(body.uploadMode),
    });

    for (const delivery of result.deliveries) {
      if (delivery.emitToConversationRoom !== false) {
        this.events.emitMessageNew(delivery.conversationId, delivery.message);
      }
      const notifyUserIds = delivery.notifyUserIds?.length ? delivery.notifyUserIds : delivery.participantIds;
      const syncUserIds = delivery.syncUserIds?.length ? delivery.syncUserIds : notifyUserIds;
      for (const participantId of notifyUserIds) {
        this.events.emitUserMessageNew(participantId, delivery.message);
      }
      for (const participantId of syncUserIds) {
        this.events.emitConversationsSync(participantId, {
          conversationId: delivery.conversationId,
        });
      }
    }

    return { ok: true, message: result.message };
  }

  @Patch('messages/:id/favorite')
  async toggleFavorite(
    @Req() req: any,
    @Param('id') messageId: string,
    @Body() body: { value: boolean },
  ) {
    const result = await this.messages.toggleFavorite(req.user.sub, messageId, !!body?.value);
    this.events.emitMessageUpdated(result.conversationId, result.message);
    return { ok: true, message: result.message };
  }

  @Post('messages/:id/reaction')
  async setReaction(
    @Req() req: any,
    @Param('id') messageId: string,
    @Body() body: { emoji?: string | null },
  ) {
    const result = await this.messages.setReaction(req.user.sub, messageId, body?.emoji ?? null);
    this.events.emitMessageUpdated(result.conversationId, result.message);
    return { ok: true, message: result.message };
  }


  @Post('messages/hide-many')
  async removeMany(@Req() req: any, @Body() body: { messageIds: string[] }) {
    const result = await this.messages.removeMany(req.user.sub, body?.messageIds ?? []);
    if (result.conversationId) {
      this.events.emitMessagesHidden(result.conversationId, {
        userId: req.user.sub,
        messageIds: result.messageIds,
      });
      this.events.emitConversationsSync(req.user.sub, {
        conversationId: result.conversationId,
        force: true,
      });
    }
    return { ok: true };
  }

  @Post('conversations/:id/hide-removed-notices')
  async hideRemovedNotices(@Req() req: any, @Param('id') conversationId: string) {
    const result = await this.messages.removeRemovedAttachmentNotices(req.user.sub, conversationId);
    if (result.messageIds.length) {
      this.events.emitMessagesHidden(result.conversationId, {
        userId: req.user.sub,
        messageIds: result.messageIds,
      });
      this.events.emitConversationsSync(req.user.sub, {
        conversationId: result.conversationId,
        force: true,
      });
    }
    return { ok: true, messageIds: result.messageIds };
  }

  @Get('conversations/:id/clear-summary')
  async clearConversationSummary(@Req() req: any, @Param('id') conversationId: string) {
    const result = await this.messages.getClearConversationSummary(req.user.sub, conversationId);
    return { ok: true, ...result };
  }

  @Post('conversations/:id/clear')
  async clearConversation(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Body() body?: { keepFavorites?: boolean },
  ) {
    const result = body?.keepFavorites
      ? await this.messages.clearConversationKeepingFavorites(req.user.sub, conversationId)
      : await this.messages.clearConversation(req.user.sub, conversationId);
    if (result.keptFavorites) {
      if (result.messageIds.length) {
        this.events.emitMessagesHidden(result.conversationId, {
          userId: req.user.sub,
          messageIds: result.messageIds,
        });
      }
    } else {
      this.events.emitConversationCleared(result.conversationId, { userId: req.user.sub });
    }
    this.events.emitConversationsSync(req.user.sub, {
      conversationId: result.conversationId,
      force: true,
    });
    return { ok: true, messageIds: result.messageIds };
  }

  @Delete('messages/:id')
  async remove(@Req() req: any, @Param('id') messageId: string) {
    const result = await this.messages.remove(req.user.sub, messageId);
    this.events.emitMessageHidden(result.conversationId, {
      userId: req.user.sub,
      messageId: result.messageId,
    });
    this.events.emitConversationsSync(req.user.sub, {
      conversationId: result.conversationId,
      force: true,
    });
    return { ok: true };
  }
}

