import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WebhookEvent } from '../../enums/webhook-event.enum';

@Entity('webhook_subscriptions')
export class WebhookSubscription {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  url!: string;

  @Column({ type: 'varchar' })
  event!: WebhookEvent;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  secret?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
