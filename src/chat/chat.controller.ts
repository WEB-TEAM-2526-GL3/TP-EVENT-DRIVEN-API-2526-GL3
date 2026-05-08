import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { AuthUser } from '../interfaces/auth-user.interface';

@Controller('chat')
@ApiTags('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations/:conversationId/messages')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async getMessages(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Request() request: { user: AuthUser },
  ) {
    const messages = await this.chatService.findMessages(
      request.user.id,
      conversationId,
    );

    return messages.map((message) => this.chatService.formatMessage(message));
  }

  @Post('direct/:receiverId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async getOrCreateDirectConversation(
    @Param('receiverId', ParseIntPipe) receiverId: number,
    @Request() request: { user: AuthUser },
  ) {
    const conversation = await this.chatService.getOrCreateDirectConversation(
      request.user.id,
      receiverId,
    );

    return this.chatService.formatConversation(conversation);
  }

  @Post('groups')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async createGroupConversation(
    @Body() body: { name: string; memberIds: number[] },
    @Request() request: { user: AuthUser },
  ) {
    const conversation = await this.chatService.createGroupConversation(
      request.user.id,
      body.name,
      body.memberIds || [],
    );

    return this.chatService.formatConversation(conversation);
  }

  @Get('assets/chat.js')
  chatJs(@Res() res: Response) {
    return res
      .type('application/javascript')
      .sendFile(join(process.cwd(), 'public', 'chat.js'));
  }

  @Get('assets/chat.css')
  chatCss(@Res() res: Response) {
    return res
      .type('text/css')
      .sendFile(join(process.cwd(), 'public', 'chat.css'));
  }

  @Get(':receiverId')
  chatPage(
    @Param('receiverId', ParseIntPipe) receiverId: number,
    @Res() res: Response,
  ) {
    void receiverId;

    return res.sendFile(join(process.cwd(), 'public', 'chat.html'));
  }
}
