import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
import { UserService } from '../user/user.service';
import { CvService } from '../cv/cv.service';
import { SkillService } from '../skill/skill.service';
import { CreateSkillDto } from '../skill/dto/create-skill.dto';
import { CreateCvDto } from '../cv/dto/create-cv.dto';
import { Cv } from '../cv/entities/cv.entity';

interface FullUser {
  firstName: string;
  lastName: string;
  password: string;
  username: string;
  email: string;
  role: RoleEnum;
  id?: number;
}

function randFullUser(): FullUser {
  const firstName = randFirstName({ withAccents: false });
  const lastName = randLastName({ withAccents: false });
  return {
    firstName,
    lastName,
    password: randPassword(),
    username: randUserName({
      firstName,
      lastName,
      withAccents: false,
    }),
    email: randEmail({
      provider: 'gmail',
      suffix: 'com',
      firstName,
      lastName,
    }),
    role: randNumber() % 10 === 0 ? RoleEnum.ADMIN : RoleEnum.USER,
  };
}

function randFullCv(skills: Skill[], users: FullUser[]): CreateCvDto {
  const ui = Math.floor(Math.random() * users.length);
  const randomUser = users[ui];
  const { firstName, lastName } = randomUser;
  const name = randomUser.username + '_seed_' + randNumber();

  const sNb = Math.floor(Math.random() * skills.length);
  const randomSkills: number[] = [];
  for (let j = 0; j < sNb; j++) {
    const si = Math.floor(Math.random() * skills.length);
    randomSkills.push(skills[si].id);
  }

  return {
    name: name,
    firstname: firstName,
    lastname: lastName,
    age: randNumber({ min: 18, max: 60 }),
    cin: randNumber({ min: 10000000, max: 99999999 }).toString(),
    job: randJobTitle(),
    userId: randomUser.id!,
    skills: randomSkills,
  };
}

function logUserForTesting(i: number, user: FullUser) {
  const part1 = `${user.username}`;
  const part2 = `(${user.role})`;
  const part3 = user.password;
  console.log(
    `user (${i})`,
    part1.padEnd(30, ' '),
    part2.padEnd(12, ' '),
    part3,
  );
}
function logSkillForTesting(_i: number, _skill: CreateSkillDto) {
  // console.log(`skill (${_i})`, _skill.designation);
}
function logCvForTesting(_i: number, _cv: Cv) {
  // console.log(`cv (${_i})`, _cv.name);
}

@Injectable()
export class SeedService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
    private readonly cvService: CvService,
    private readonly skillService: SkillService,
  ) {}

  async seedDatabase() {
    // dropping the database with all its tables and data
    await this.dataSource.synchronize(true);

    const nbOfSkills: number = 15;
    const nbOfUsers: number = 5;
    const nbOfCvs: number = 15;

    const skillsPromise = Promise.all(
      Array.from({ length: nbOfSkills }, async (_, _i) => {
        const skill = await this.skillService.create({
          designation: randSkill(),
        });
        logSkillForTesting(_i, skill);
        return skill;
      }),
    );
    const usersPromise = Promise.all(
      Array.from({ length: nbOfUsers }, async (_, i) => {
        const generatedUser = randFullUser();
        generatedUser.role =
          i == 0 ? RoleEnum.ADMIN : i == 1 ? RoleEnum.USER : generatedUser.role;
        const user = await this.userService.create(
          generatedUser,
          generatedUser.role,
        );

        generatedUser.id = user.id;

        logUserForTesting(i, generatedUser);

        return generatedUser;
      }),
    );

    const [skills, users] = await Promise.all([skillsPromise, usersPromise]);

    const cvsPromise = Promise.all(
      Array.from({ length: nbOfCvs }, async (_, _i) => {
        const generatedCv = randFullCv(skills, users);
        const cv = await this.cvService.seedCreate(generatedCv);
        logCvForTesting(_i, cv);
        return cv;
      }),
    );

    await cvsPromise;
  }
}
