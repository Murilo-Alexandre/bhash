import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  listMine(@Req() req: any) {
    return this.conversations.listMine(req.user.sub);
  }

  @Post('direct')
  getOrCreateDirect(@Req() req: any, @Body() body: { otherUserId: string }) {
    return this.conversations.getOrCreateDirect(req.user.sub, body.otherUserId);
  }
}
