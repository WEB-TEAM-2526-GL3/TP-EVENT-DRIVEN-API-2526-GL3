import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import * as dotenv from 'dotenv';

import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatReaction } from './entities/chat-reaction.entity';
import { User } from '../user/entities/user.entity';

dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, ChatReaction, User]),

    JwtModule.register({
      secret: (() => {
        const jwtSecret = process.env.JWT_SECRET?.toString();

        if (jwtSecret == null) {
          throw new Error('JWT_SECRET is not defined');
        }

        return jwtSecret;
      })(),
    }),
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
