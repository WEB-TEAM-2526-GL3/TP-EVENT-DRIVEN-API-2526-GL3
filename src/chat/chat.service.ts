import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatReaction } from './entities/chat-reaction.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,

    @InjectRepository(ChatReaction)
    private readonly reactionRepository: Repository<ChatReaction>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  getRoomName(userId1: number, userId2: number): string {
    const ids = [userId1, userId2].sort((a, b) => a - b);
    return `chat-${ids[0]}-${ids[1]}`;
  }

  async findConversation(userId: number, receiverId: number) {
    await this.ensureUserExists(receiverId);

    return this.messageRepository.find({
      where: [
        { senderId: userId, receiverId },
        { senderId: receiverId, receiverId: userId },
      ],
      relations: ['replyTo', 'replyTo.sender', 'reactions'],
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async createMessage(
    senderId: number,
    receiverId: number,
    content: string,
    replyToId?: number,
  ) {
    if (!content || !content.trim()) {
      throw new BadRequestException('Message cannot be empty');
    }

    if (senderId === receiverId) {
      throw new BadRequestException('You cannot chat with yourself');
    }

    await this.ensureUserExists(receiverId);

    if (replyToId) {
      const replyTo = await this.messageRepository.findOne({
        where: { id: replyToId },
      });

      if (!replyTo) {
        throw new NotFoundException('Reply message not found');
      }

      const belongsToSameConversation =
        (replyTo.senderId === senderId && replyTo.receiverId === receiverId) ||
        (replyTo.senderId === receiverId && replyTo.receiverId === senderId);

      if (!belongsToSameConversation) {
        throw new ForbiddenException(
          'You cannot reply to a message from another conversation',
        );
      }
    }

    const message = this.messageRepository.create({
      senderId,
      receiverId,
      content: content.trim(),
      replyToId,
    });

    const savedMessage = await this.messageRepository.save(message);

    return this.messageRepository.findOneOrFail({
      where: { id: savedMessage.id },
      relations: ['replyTo', 'replyTo.sender', 'reactions'],
    });
  }

  async toggleReaction(userId: number, messageId: number, emoji: string) {
    if (!emoji || !emoji.trim()) {
      throw new BadRequestException('Emoji is required');
    }

    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId && message.receiverId !== userId) {
      throw new ForbiddenException(
        'You cannot react to a message from another conversation',
      );
    }

    const existingReaction = await this.reactionRepository.findOne({
      where: {
        messageId,
        userId,
        emoji,
      },
    });

    if (existingReaction) {
      await this.reactionRepository.delete(existingReaction.id);
    } else {
      const reaction = this.reactionRepository.create({
        messageId,
        userId,
        emoji,
      });

      await this.reactionRepository.save(reaction);
    }

    const reactions = await this.reactionRepository.find({
      where: { messageId },
    });

    return {
      message,
      reactions: this.summarizeReactions(reactions),
    };
  }

  summarizeReactions(reactions: ChatReaction[] = []) {
    const summary: Record<string, number> = {};

    for (const reaction of reactions) {
      summary[reaction.emoji] = (summary[reaction.emoji] || 0) + 1;
    }

    return Object.entries(summary).map(([emoji, count]) => ({
      emoji,
      count,
    }));
  }

  formatMessage(message: ChatMessage) {
    return {
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      senderUsername: message.sender?.username,
      receiverId: message.receiverId,
      receiverUsername: message.receiver?.username,
      replyToId: message.replyToId,
      replyTo: message.replyTo
        ? {
            id: message.replyTo.id,
            content: message.replyTo.content,
            senderId: message.replyTo.senderId,
            senderUsername: message.replyTo.sender?.username,
          }
        : null,
      reactions: this.summarizeReactions(message.reactions),
      createdAt: message.createdAt,
    };
  }

  private async ensureUserExists(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return user;
  }
}
