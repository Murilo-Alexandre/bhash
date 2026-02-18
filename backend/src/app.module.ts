import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { AdminMeController } from './admin/admin-me.controller';

import { UsersModule } from './users/users.module';
import { AdminUsersController } from './admin/admin-users.controller';
import { AdminController } from './admin/admin.controller';

import { RolesGuard } from './auth/roles.guard';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { ChatModule } from './chat/chat.module';

import { AppConfigModule } from './app-config/app-config.module';

// ✅ PrismaModule global
import { PrismaModule } from './prisma/prisma.module';

// ✅ novos controllers (se você já criou)
import { AdminPasswordsController } from './admin/admin-passwords.controller';
import { AdminMePasswordController } from './admin/admin-me-password.controller';
import { MeController } from './me/me.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // ✅ Prisma global
    PrismaModule,

    // ✅ serve backend/public como /static
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/static',
    }),

    AuthModule,
    AdminAuthModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
    ChatModule,
    AppConfigModule,
  ],
  controllers: [
    AppController,
    AdminController,
    AdminUsersController,
    AdminMeController,

    // ✅ novos
    AdminPasswordsController,
    AdminMePasswordController,
    MeController,
  ],
  providers: [AppService, Reflector, RolesGuard],
})
export class AppModule {}
