import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
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

  @Get('messages/:receiverId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async getMessages(
    @Param('receiverId', ParseIntPipe) receiverId: number,
    @Request() request: { user: AuthUser },
  ) {
    const messages = await this.chatService.findConversation(
      request.user.id,
      receiverId,
    );

    return messages.map((message) => this.chatService.formatMessage(message));
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
