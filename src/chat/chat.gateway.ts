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

// Type of the connected chat user stored in the socket.
type ChatUser = {
  id: number;
  username: string;
  role: string;
};

// Type of the JWT payload after decoding the token.
type JwtChatPayload = {
  sub: number;
  username: string;
  role: string;
};

// Type used to safely store the connected user inside socket data.
type SocketData = {
  user?: ChatUser;
};

// Declares this class as a WebSocket gateway and allows frontend connections.
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection {
  // Gives access to the Socket.IO server for broadcasting events.
  @WebSocketServer()
  server!: Server;

  // Injects ChatService for database logic and JwtService for token verification.
  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  // Runs automatically when a client connects to the WebSocket server.
  async handleConnection(client: Socket) {
    try {
      // Extracts the JWT token from the socket connection.
      const token = this.extractToken(client);

      // Disconnects the client if no token was provided.
      if (!token) {
        client.disconnect();
        return;
      }

      // Verifies the JWT token and reads its payload.
      const payload = await this.jwtService.verifyAsync<JwtChatPayload>(token);

      // Creates the authenticated user object from the token payload.
      const user: ChatUser = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
      };

      // Stores the authenticated user inside the socket.
      this.setClientUser(client, user);

      // Sends confirmation to the frontend that the socket is connected.
      client.emit('connected', {
        message: 'Connected to chat',
        user,
      });
    } catch {
      // Disconnects the client if the token is invalid.
      client.disconnect();
    }
  }

  // Handles the event where a user joins a private conversation.
  @SubscribeMessage('joinConversation')
  async joinConversation(
    @MessageBody() data: { receiverId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Gets the authenticated user from the socket.
      const user = this.getClientUser(client);

      // Converts the receiver id to a number.
      const receiverId = Number(data.receiverId);

      // Creates the room name for these two users.
      const roomName = this.chatService.getRoomName(user.id, receiverId);

      // Makes the socket join the private chat room.
      await client.join(roomName);

      // Loads the old messages between the two users.
      const messages = await this.chatService.findConversation(
        user.id,
        receiverId,
      );

      // Sends the conversation history to the connected client.
      client.emit(
        'conversationHistory',
        messages.map((message) => this.chatService.formatMessage(message)),
      );

      // Notifies the other user in the room that this user joined.
      client.to(roomName).emit('userJoined', {
        userId: user.id,
        username: user.username,
      });
    } catch (error: unknown) {
      // Sends an error message to the frontend if joining fails.
      client.emit('chatError', {
        message: this.getErrorMessage(error, 'Cannot join conversation'),
      });
    }
  }

  // Handles the event where a user sends a message.
  @SubscribeMessage('sendMessage')
  async sendMessage(
    @MessageBody()
    data: {
      receiverId: number;
      content: string;
      replyToId?: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Gets the authenticated user from the socket.
      const user = this.getClientUser(client);

      // Converts the receiver id to a number.
      const receiverId = Number(data.receiverId);

      // Saves the new message in the database.
      const message = await this.chatService.createMessage(
        user.id,
        receiverId,
        data.content,
        data.replyToId ? Number(data.replyToId) : undefined,
      );

      // Gets the room name for this conversation.
      const roomName = this.chatService.getRoomName(user.id, receiverId);

      // Sends the new message to everyone inside the room.
      this.server.to(roomName).emit('newMessage', {
        message: this.chatService.formatMessage(message),
      });
    } catch (error: unknown) {
      // Sends an error message to the frontend if sending fails.
      client.emit('chatError', {
        message: this.getErrorMessage(error, 'Cannot send message'),
      });
    }
  }

  // Handles the event where a user reacts to a message with an emoji.
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
      // Gets the authenticated user from the socket.
      const user = this.getClientUser(client);

      // Adds or removes the emoji reaction from the message.
      const result = await this.chatService.toggleReaction(
        user.id,
        Number(data.messageId),
        data.emoji,
      );

      // Gets the room name using the sender and receiver of the message.
      const roomName = this.chatService.getRoomName(
        result.message.senderId,
        result.message.receiverId,
      );

      // Sends the updated reactions to everyone inside the room.
      this.server.to(roomName).emit('messageReactionUpdated', {
        messageId: Number(data.messageId),
        reactions: result.reactions,
      });
    } catch (error: unknown) {
      // Sends an error message to the frontend if reacting fails.
      client.emit('chatError', {
        message: this.getErrorMessage(error, 'Cannot react to message'),
      });
    }
  }

  // Handles the typing event sent by the frontend.
  @SubscribeMessage('typing')
  typing(
    @MessageBody() data: { receiverId: number },
    @ConnectedSocket() client: Socket,
  ) {
    // Gets the authenticated user from the socket.
    const user = this.getClientUser(client);

    // Converts the receiver id to a number.
    const receiverId = Number(data.receiverId);

    // Gets the room name for this conversation.
    const roomName = this.chatService.getRoomName(user.id, receiverId);

    // Sends typing notification to the other user in the room.
    client.to(roomName).emit('userTyping', {
      userId: user.id,
      username: user.username,
    });
  }

  // Extracts the JWT token from socket auth or authorization header.
  private extractToken(client: Socket): string | null {
    // Reads the auth object sent by the frontend socket.
    const auth = client.handshake.auth as Record<string, unknown>;

    // Gets the token from socket auth.
    const authToken = auth.token;

    // Gets the token from the Authorization header if present.
    const authorizationHeader: unknown = client.handshake.headers.authorization;

    // Stores the final token value.
    let token: string | undefined;

    // Uses the token from socket auth if it is a string.
    if (typeof authToken === 'string') {
      token = authToken;
    } else if (typeof authorizationHeader === 'string') {
      // Uses the Authorization header if it is a string.
      token = authorizationHeader;
    } else if (this.isStringArray(authorizationHeader)) {
      // Uses the first value if the Authorization header is an array.
      token = authorizationHeader[0];
    }

    // Returns null if no token was found.
    if (!token) {
      return null;
    }

    // Removes "Bearer " from the token if it exists.
    if (token.startsWith('Bearer ')) {
      return token.slice(7);
    }

    // Returns the clean token.
    return token;
  }

  // Checks if a value is an array of strings.
  private isStringArray(value: unknown): value is string[] {
    return (
      Array.isArray(value) && value.every((item) => typeof item === 'string')
    );
  }

  // Saves the authenticated user inside the socket data.
  private setClientUser(client: Socket, user: ChatUser) {
    const data = client.data as SocketData;
    data.user = user;
  }

  // Gets the authenticated user from the socket data.
  private getClientUser(client: Socket): ChatUser {
    const data = client.data as SocketData;

    // Throws an error if the socket has no authenticated user.
    if (!data.user) {
      throw new Error('Unauthorized');
    }

    // Returns the authenticated user.
    return data.user;
  }

  // Converts an unknown error into a safe error message.
  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message;
    }

    return fallback;
  }
}
