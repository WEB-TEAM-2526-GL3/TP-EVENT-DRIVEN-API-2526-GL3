import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('skill')
export class Skill {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  designation!: string; // I fixed the "Desigantion" typo from the slide!
}
