import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ChatMessage } from './entities/chat-message.entity';
import { ChatReaction } from './entities/chat-reaction.entity';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,

    @InjectRepository(ChatReaction)
    private readonly reactionRepository: Repository<ChatReaction>,

    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,

    @InjectRepository(ConversationMember)
    private readonly memberRepository: Repository<ConversationMember>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  getRoomName(conversationId: number): string {
    return `conversation:${conversationId}`;
  }

  private getDirectKey(userId1: number, userId2: number): string {
    const ids = [userId1, userId2].sort((a, b) => a - b);
    return `${ids[0]}-${ids[1]}`;
  }

  async getOrCreateDirectConversation(userId: number, receiverId: number) {
    if (userId === receiverId) {
      throw new BadRequestException('You cannot chat with yourself');
    }

    await this.ensureUserExists(receiverId);

    const directKey = this.getDirectKey(userId, receiverId);

    const existingConversation = await this.conversationRepository.findOne({
      where: {
        type: 'direct',
        directKey,
      },
      relations: ['members', 'members.user'],
    });

    if (existingConversation) {
      return existingConversation;
    }

    const newConversation = this.conversationRepository.create({
      type: 'direct',
      name: null,
      directKey,
    });

    const savedConversation =
      await this.conversationRepository.save(newConversation);

    await this.memberRepository.save([
      this.memberRepository.create({
        conversationId: savedConversation.id,
        userId,
        role: 'member',
      }),
      this.memberRepository.create({
        conversationId: savedConversation.id,
        userId: receiverId,
        role: 'member',
      }),
    ]);

    return this.conversationRepository.findOneOrFail({
      where: {
        id: savedConversation.id,
      },
      relations: ['members', 'members.user'],
    });
  }

  async getConversationForUser(userId: number, conversationId: number) {
    await this.ensureMember(userId, conversationId);

    return this.conversationRepository.findOneOrFail({
      where: {
        id: conversationId,
      },
      relations: ['members', 'members.user'],
    });
  }

  async createGroupConversation(
    creatorId: number,
    name: string,
    memberIds: number[],
  ) {
    if (!name || !name.trim()) {
      throw new BadRequestException('Group name is required');
    }

    const uniqueMemberIds = Array.from(new Set([creatorId, ...memberIds]));

    if (uniqueMemberIds.length < 3) {
      throw new BadRequestException('A group needs at least 3 members');
    }

    const users = await this.userRepository.find({
      where: {
        id: In(uniqueMemberIds),
      },
    });

    if (users.length !== uniqueMemberIds.length) {
      throw new NotFoundException('One or more users were not found');
    }

    const newConversation = this.conversationRepository.create({
      type: 'group',
      name: name.trim(),
      directKey: null,
    });

    const savedConversation =
      await this.conversationRepository.save(newConversation);

    const members = uniqueMemberIds.map((memberId) =>
      this.memberRepository.create({
        conversationId: savedConversation.id,
        userId: memberId,
        role: memberId === creatorId ? 'admin' : 'member',
      }),
    );

    await this.memberRepository.save(members);

    return this.conversationRepository.findOneOrFail({
      where: {
        id: savedConversation.id,
      },
      relations: ['members', 'members.user'],
    });
  }

  async findMessages(userId: number, conversationId: number) {
    await this.ensureMember(userId, conversationId);

    return this.messageRepository.find({
      where: {
        conversationId,
      },
      relations: ['sender', 'replyTo', 'replyTo.sender', 'reactions'],
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async createMessage(
    senderId: number,
    conversationId: number,
    content: string,
    replyToId?: number,
  ) {
    if (!content || !content.trim()) {
      throw new BadRequestException('Message cannot be empty');
    }

    await this.ensureMember(senderId, conversationId);

    if (replyToId) {
      const replyTo = await this.messageRepository.findOne({
        where: {
          id: replyToId,
        },
      });

      if (!replyTo) {
        throw new NotFoundException('Reply message not found');
      }

      if (replyTo.conversationId !== conversationId) {
        throw new ForbiddenException(
          'You cannot reply to a message from another conversation',
        );
      }
    }

    const message = this.messageRepository.create({
      senderId,
      conversationId,
      content: content.trim(),
      replyToId,
    });

    const savedMessage = await this.messageRepository.save(message);

    return this.messageRepository.findOneOrFail({
      where: {
        id: savedMessage.id,
      },
      relations: ['sender', 'replyTo', 'replyTo.sender', 'reactions'],
    });
  }

  async toggleReaction(userId: number, messageId: number, emoji: string) {
    if (!emoji || !emoji.trim()) {
      throw new BadRequestException('Emoji is required');
    }

    const message = await this.messageRepository.findOne({
      where: {
        id: messageId,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.ensureMember(userId, message.conversationId);

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
      where: {
        messageId,
      },
    });

    return {
      message,
      reactions: this.summarizeReactions(reactions),
    };
  }

  async ensureMember(userId: number, conversationId: number) {
    const member = await this.memberRepository.findOne({
      where: {
        userId,
        conversationId,
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    return member;
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

  formatConversation(conversation: Conversation) {
    return {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      members:
        conversation.members?.map((member) => ({
          id: member.userId,
          username: member.user?.username,
          role: member.role,
        })) || [],
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  formatMessage(message: ChatMessage) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      senderId: message.senderId,
      senderUsername: message.sender?.username,
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
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return user;
  }
}
