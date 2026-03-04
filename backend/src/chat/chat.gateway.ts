import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagesService } from '../messages/messages.service';

function parseOrigins(v?: string) {
  return (v ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

@WebSocketGateway({
  cors: {
    origin: parseOrigins(process.env.CORS_ORIGINS),
    credentials: true,
  },
})
export class ChatGateway {
  @WebSocketServer()
  server!: Server;

  private readonly jwtSecret: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly messages: MessagesService,
  ) {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET não definido no .env');
    this.jwtSecret = secret;
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) throw new Error('missing token');

      const payload = await this.jwt.verifyAsync(token, { secret: this.jwtSecret });

      // ✅ aceita user e admin
      const type = payload?.type;
      if (type !== 'user' && type !== 'admin') throw new Error('invalid token type');

      const sub = payload?.sub as string;
      if (!sub) throw new Error('missing sub');

      client.data.authType = type;

      if (type === 'user') {
        client.data.userId = sub;
        client.join(`user:${sub}`);
        client.emit('connected', { ok: true, type: 'user', userId: sub });
        return;
      }

      // admin
      client.data.adminId = sub;
      client.join(`admin:${sub}`);
      client.emit('connected', { ok: true, type: 'admin', adminId: sub });
    } catch (e: any) {
      client.emit('connected', { ok: false, reason: e?.message ?? 'unauthorized' });
      client.disconnect(true);
    }
  }

  // user ou admin podem entrar na sala da conversa
  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const authType = client.data.authType as string | undefined;
    if (!authType) return { ok: false, reason: 'unauthenticated' };
    if (!body?.conversationId) return { ok: false, reason: 'missing conversationId' };

    if (authType === 'user') {
      const userId = client.data.userId as string;
      // valida membership do user
      await this.messages.list(userId, body.conversationId, undefined, '1');
      client.join(`conv:${body.conversationId}`);
      return { ok: true };
    }

    // admin: entra direto (admin pode ver tudo)
    client.join(`conv:${body.conversationId}`);
    return { ok: true };
  }

  // ✅ somente user pode enviar mensagem
  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; body: string },
  ) {
    const authType = client.data.authType as string | undefined;
    if (authType !== 'user') return { ok: false, reason: 'forbidden' };

    const userId = client.data.userId as string;
    if (!userId) return { ok: false, reason: 'unauthenticated' };
    if (!data?.conversationId) return { ok: false, reason: 'missing conversationId' };

    const body = (data.body ?? '').trim();
    if (!body) return { ok: false, reason: 'empty body' };

    const msg = await this.messages.send(userId, data.conversationId, body);

    this.server.to(`conv:${data.conversationId}`).emit('message:new', msg);

    return { ok: true, id: msg.id };
  }
}
