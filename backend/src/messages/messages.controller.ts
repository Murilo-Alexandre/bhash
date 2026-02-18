import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('conversations/:id/messages')
  list(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string
  ) {
    return this.messages.list(req.user.sub, conversationId, cursor, take);
  }

  @Post('conversations/:id/messages')
  send(@Req() req: any, @Param('id') conversationId: string, @Body() body: { body: string }) {
    return this.messages.send(req.user.sub, conversationId, body.body);
  }
}
