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

  // Autentica na conexão: cliente envia token em handshake.auth.token
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) throw new Error('missing token');

      const payload = await this.jwt.verifyAsync(token, { secret: this.jwtSecret });

      // ✅ só aceita token de USER (chat). Admin não conecta no WS.
      if (payload?.type !== 'user') throw new Error('invalid token type');

      const userId = payload.sub as string;
      if (!userId) throw new Error('missing sub');

      client.data.userId = userId;

      // sala do usuário (útil pra notificações diretas no futuro)
      client.join(`user:${userId}`);

      client.emit('connected', { ok: true, userId });
    } catch (e: any) {
      client.emit('connected', { ok: false, reason: e?.message ?? 'unauthorized' });
      client.disconnect(true);
    }
  }

  // cliente chama: socket.emit('conversation:join', { conversationId })
  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    if (!userId) return { ok: false, reason: 'unauthenticated' };
    if (!body?.conversationId) return { ok: false, reason: 'missing conversationId' };

    // valida membership: tenta listar 1 msg
    await this.messages.list(userId, body.conversationId, undefined, '1');

    client.join(`conv:${body.conversationId}`);
    return { ok: true };
  }

  // cliente chama: socket.emit('message:send', { conversationId, body })
  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; body: string },
  ) {
    const userId = client.data.userId as string;
    if (!userId) return { ok: false, reason: 'unauthenticated' };
    if (!data?.conversationId) return { ok: false, reason: 'missing conversationId' };

    const body = (data.body ?? '').trim();
    if (!body) return { ok: false, reason: 'empty body' };

    const msg = await this.messages.send(userId, data.conversationId, body);

    // envia pros membros conectados na conversa
    this.server.to(`conv:${data.conversationId}`).emit('message:new', msg);

    return { ok: true, id: msg.id };
  }
}
