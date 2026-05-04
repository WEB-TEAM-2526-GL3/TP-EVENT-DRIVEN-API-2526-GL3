import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ChatMessage } from './chat-message.entity';
import { User } from '../../user/entities/user.entity';

@Entity('chat_reactions')
@Unique(['messageId', 'userId', 'emoji'])
export class ChatReaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  emoji!: string;

  @Column()
  messageId!: number;

  @ManyToOne(() => ChatMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message!: ChatMessage;

  @Column()
  userId!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;
}
