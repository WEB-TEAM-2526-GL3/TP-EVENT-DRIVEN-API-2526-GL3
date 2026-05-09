import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

type ChatUser = {
  id: number;
  username: string;
  role: string;
};

type JwtChatPayload = {
  sub: number;
  username: string;
  role: string;
};

type SocketData = {
  user?: ChatUser;
};

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtChatPayload>(token);

      const user: ChatUser = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
      };

      this.setClientUser(client, user);

      client.emit('connected', {
        message: 'Connected to chat',
        user,
      });
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('openDirectConversation')
  async openDirectConversation(
    @MessageBody() data: { receiverId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = this.getClientUser(client);
      const receiverId = Number(data.receiverId);

      const conversation = await this.chatService.getOrCreateDirectConversation(
        user.id,
        receiverId,
      );

      const roomName = this.chatService.getRoomName(conversation.id);

      await client.join(roomName);

      const messages = await this.chatService.findMessages(
        user.id,
        conversation.id,
      );

      client.emit('conversationReady', {
        conversation: this.chatService.formatConversation(conversation),
        messages: messages.map((message) =>
          this.chatService.formatMessage(message),
        ),
      });

      client.to(roomName).emit('userJoined', {
        conversationId: conversation.id,
        userId: user.id,
        username: user.username,
      });
    } catch (error: unknown) {
      client.emit('chatError', {
        message: this.getErrorMessage(error, 'Cannot open conversation'),
      });
    }
  }

  @SubscribeMessage('joinConversation')
  async joinConversation(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = this.getClientUser(client);
      const conversationId = Number(data.conversationId);

      const conversation = await this.chatService.getConversationForUser(
        user.id,
        conversationId,
      );

      const roomName = this.chatService.getRoomName(conversationId);

      await client.join(roomName);

      const messages = await this.chatService.findMessages(
        user.id,
        conversationId,
      );

      client.emit('conversationReady', {
        conversation: this.chatService.formatConversation(conversation),
        messages: messages.map((message) =>
          this.chatService.formatMessage(message),
        ),
      });

      client.to(roomName).emit('userJoined', {
        conversationId,
        userId: user.id,
        username: user.username,
      });
    } catch (error: unknown) {
      client.emit('chatError', {
        message: this.getErrorMessage(error, 'Cannot join conversation'),
      });
    }
  }

  @SubscribeMessage('createGroupConversation')
  async createGroupConversation(
    @MessageBody() data: { name: string; memberIds: number[] },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = this.getClientUser(client);

      const conversation = await this.chatService.createGroupConversation(
        user.id,
        data.name,
        data.memberIds || [],
      );

      const roomName = this.chatService.getRoomName(conversation.id);

      await client.join(roomName);

      client.emit('conversationReady', {
        conversation: this.chatService.formatConversation(conversation),
        messages: [],
      });
    } catch (error: unknown) {
      client.emit('chatError', {
        message: this.getErrorMessage(error, 'Cannot create group'),
      });
    }
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(
    @MessageBody()
    data: {
      conversationId: number;
      content: string;
      replyToId?: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = this.getClientUser(client);
      const conversationId = Number(data.conversationId);

      const message = await this.chatService.createMessage(
        user.id,
        conversationId,
        data.content,
        data.replyToId ? Number(data.replyToId) : undefined,
      );

      const roomName = this.chatService.getRoomName(conversationId);

      this.server.to(roomName).emit('newMessage', {
        message: this.chatService.formatMessage(message),
      });
    } catch (error: unknown) {
      client.emit('chatError', {
        message: this.getErrorMessage(error, 'Cannot send message'),
      });
    }
  }

  @SubscribeMessage('reactToMessage')
  async reactToMessage(
    @MessageBody()
    data: {
      messageId: number;
      emoji: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = this.getClientUser(client);

      const result = await this.chatService.toggleReaction(
        user.id,
        Number(data.messageId),
        data.emoji,
      );

      const roomName = this.chatService.getRoomName(
        result.message.conversationId,
      );

      this.server.to(roomName).emit('messageReactionUpdated', {
        messageId: Number(data.messageId),
        reactions: result.reactions,
      });
    } catch (error: unknown) {
      client.emit('chatError', {
        message: this.getErrorMessage(error, 'Cannot react to message'),
      });
    }
  }

  @SubscribeMessage('typing')
  async typing(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = this.getClientUser(client);
      const conversationId = Number(data.conversationId);

      await this.chatService.ensureMember(user.id, conversationId);

      const roomName = this.chatService.getRoomName(conversationId);

      client.to(roomName).emit('userTyping', {
        conversationId,
        userId: user.id,
        username: user.username,
      });
    } catch {
      // Do not spam the frontend with typing errors.
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown>;

    const authToken = auth.token;
    const authorizationHeader: unknown = client.handshake.headers.authorization;

    let token: string | undefined;

    if (typeof authToken === 'string') {
      token = authToken;
    } else if (typeof authorizationHeader === 'string') {
      token = authorizationHeader;
    } else if (this.isStringArray(authorizationHeader)) {
      token = authorizationHeader[0];
    }

    if (!token) {
      return null;
    }

    if (token.startsWith('Bearer ')) {
      return token.slice(7);
    }

    return token;
  }

  private isStringArray(value: unknown): value is string[] {
    return (
      Array.isArray(value) && value.every((item) => typeof item === 'string')
    );
  }

  private setClientUser(client: Socket, user: ChatUser) {
    const data = client.data as SocketData;
    data.user = user;
  }

  private getClientUser(client: Socket): ChatUser {
    const data = client.data as SocketData;

    if (!data.user) {
      throw new Error('Unauthorized');
    }

    return data.user;
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message;
    }

    return fallback;
  }
}
