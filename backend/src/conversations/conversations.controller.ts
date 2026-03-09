import { Body, Controller, Get, Post, Req, UseGuards, Query, Patch, Delete, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationsService } from './conversations.service';
import { ChatEventsService } from '../chat/chat-events.service';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly events: ChatEventsService,
  ) {}

  @Get()
  listMine(@Req() req: any, @Query('q') q?: string) {
    return this.conversations.listMine(req.user.sub, q);
  }

  @Post('direct')
  getOrCreateDirect(@Req() req: any, @Body() body: { otherUserId: string }) {
    return this.conversations.getOrCreateDirect(req.user.sub, body.otherUserId);
  }

  @Patch(':id/read')
  async markAsRead(@Req() req: any, @Param('id') conversationId: string) {
    const userId = req.user.sub;
    return this.conversations.markAsRead(userId, conversationId);
  }

  @Patch(':id/pin')
  async setPinned(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Body() body: { value?: boolean },
  ) {
    const userId = req.user.sub;
    const result = await this.conversations.setPinned(userId, conversationId, !!body?.value);
    this.events.emitConversationsSync(userId, { conversationId, force: true });
    return result;
  }

  @Delete(':id')
  async hideConversation(@Req() req: any, @Param('id') conversationId: string) {
    const userId = req.user.sub;
    const result = await this.conversations.hideConversation(userId, conversationId);
    this.events.emitConversationHidden(conversationId, { userId });
    this.events.emitConversationsSync(userId, { conversationId, force: true });
    return result;
  }
}

