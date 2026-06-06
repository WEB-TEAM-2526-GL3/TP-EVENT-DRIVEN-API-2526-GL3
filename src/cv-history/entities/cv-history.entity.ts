import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('cv_history')
export class CvHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  cvId?: number;

  @Column()
  operation!: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp!: Date;

  @Column({ nullable: true })
  actorId?: number;

  @Column({ type: 'json', nullable: true })
  details?: any;
}
