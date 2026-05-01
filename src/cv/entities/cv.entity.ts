import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Skill } from '../../skill/entities/skill.entity';

@Entity('cv')
export class Cv {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  firstname!: string;

  @Column()
  lastname!: string;

  @Column()
  age!: number;

  @Column()
  cin!: string;

  @Column()
  job!: string;

  @Column({ nullable: true })
  path?: string;

  @Column({ nullable: true })
  imagePath?: string;

  // The '*' side of the User relationship: Many CVs belong to One User
  @ManyToOne(() => User, (user) => user.cvs)
  user!: User;

  // The '*' to '*' relationship: Many CVs can have Many Skills
  @ManyToMany(() => Skill)
  @JoinTable() // This automatically creates a hidden junction table in your database!
  skills!: Skill[];
}
