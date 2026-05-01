import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Cv } from '../../cv/entities/cv.entity';
import { RoleEnum } from '../../enums/role.enum';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column({
    enum: RoleEnum,
    default: RoleEnum.USER,
  })
  role!: RoleEnum;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column()
  salt!: string;

  // The '1' side of the relationship: One User has Many CVs
  @OneToMany(() => Cv, (cv) => cv.user)
  cvs!: Cv[];
}
