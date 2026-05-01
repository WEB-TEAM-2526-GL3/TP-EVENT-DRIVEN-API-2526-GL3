import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Cv } from '../cv/entities/cv.entity';
import { Skill } from '../skill/entities/skill.entity';
import {
  randUserName,
  randEmail,
  randPassword,
  randFirstName,
  randLastName,
  randNumber,
  randJobTitle,
  randSkill,
} from '@ngneat/falso';
import { RoleEnum } from '../enums/role.enum';
import * as bcrypt from 'bcrypt';
// --- deprecated ---
// import * as path from 'path';

@Injectable()
export class SeedService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Cv) private cvRepository: Repository<Cv>,
    @InjectRepository(Skill) private skillRepository: Repository<Skill>,
  ) {}

  async seedDatabase() {
    // Documentation says: "@param dropBeforeSync — If set to true then it drops the database with all its tables and data"
    await this.dataSource.synchronize(true);

    const nbOfSkills = 15;
    const nbOfUsers = 5;
    const nbOfCvs = 15;

    const skills: Skill[] = [];
    for (let i = 0; i < nbOfSkills; i++) {
      const skill = this.skillRepository.create({ designation: randSkill() });
      skills.push(await this.skillRepository.save(skill));
    }

    console.log('Users seeded:');
    const users: User[] = [];
    const names: { firstName: string; lastName: string }[] = [];
    const salt = await bcrypt.genSalt();
      const password = randPassword();
      const lastName = randLastName();
      const firstName = randFirstName();
      const username = randUserName({
        lastName: lastName,
        firstName: firstName,
      });

      const user = this.userRepository.create({
        username: username,
        email: randEmail({
          provider: 'gmail',
          suffix: 'com',
        }),
        password: await bcrypt.hash(password, salt),
        salt: salt,
        role:  RoleEnum.ADMIN,
      });

      console.log(
        `${username} (${user.role})`,
        ' '.repeat(Math.max(0, 30 - `${username} (${user.role})`.length)),
        password,
      );
      users.push(await this.userRepository.save(user));
      names.push({ firstName, lastName });
    for (let i = 0; i < nbOfUsers; i++) {
      const salt = await bcrypt.genSalt();
      const password = randPassword();
      const lastName = randLastName();
      const firstName = randFirstName();
      const username = randUserName({
        lastName: lastName,
        firstName: firstName,
      });

      const user = this.userRepository.create({
        username: username,
        email: randEmail({
          provider: 'gmail',
          suffix: 'com',
        }),
        password: await bcrypt.hash(password, salt),
        salt: salt,
        role: randNumber() % 3 === 0 ? RoleEnum.ADMIN : RoleEnum.USER,
      });

      console.log(
        `${username} (${user.role})`,
        ' '.repeat(Math.max(0, 30 - `${username} (${user.role})`.length)),
        password,
      );
      users.push(await this.userRepository.save(user));
      names.push({ firstName, lastName });
    }

    for (let i = 0; i < nbOfCvs; i++) {
      const ui = Math.floor(Math.random() * users.length);
      const randomUser = users[ui];
      const { firstName, lastName } = names[ui];
      const name = randomUser.username + '_seed_' + i;
      // --- deprecated ---
      // const fileName =
      //   [randNumber(), randomUser.username, name].join('_') + '.pdf';
      // const filePath: string = path.join('uploads', fileName);

      const sNb = Math.floor(Math.random() * skills.length);
      const randomSkills: Skill[] = [];
      for (let j = 0; j < sNb; j++) {
        const si = Math.floor(Math.random() * skills.length);
        randomSkills.push(skills[si]);
      }

      const cv = this.cvRepository.create({
        name: name,
        firstname: firstName,
        lastname: lastName,
        age: randNumber({ min: 18, max: 60 }),
        cin: randNumber({ min: 10000000, max: 99999999 }).toString(),
        job: randJobTitle(),
        // --- deprecated ---
        // path: filePath,
        user: randomUser,
        skills: randomSkills,
      });

      await this.cvRepository.save(cv);
    }
  }
}
