import { ConflictException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const user = this.userRepository.create(createUserDto);
    user.salt = await bcrypt.genSalt();
    user.password = await bcrypt.hash(user.password, user.salt);
    try {
      const savedUser: Partial<User> = await this.userRepository.save(user);
      delete savedUser.password;
      delete savedUser.salt;
      return savedUser;
    } catch {
      throw new ConflictException('Username or email already exists');
    }
  }

  async validateUser(
    usernameOrEmail: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.findOneByUsernameOrEmail(usernameOrEmail);
    if (!user) return null;
    const hashedPassword = await bcrypt.hash(password, user.salt);
    if (hashedPassword === user.password) {
      const cleanUser: AuthUser = {
        id: user.id,
        username: user.username,
        role: user.role,
      };
      return cleanUser;
    }
    return null;
  }

  findAll() {
    return this.userRepository.find();
  }

  findOne(id: number) {
    return this.userRepository.findOne({ where: { id } });
  }

  findOneByUsernameOrEmail(usernameOrEmail: string) {
    return this.userRepository.findOne({
      where: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
    });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return this.userRepository.update(id, updateUserDto);
  }

  remove(id: number) {
    return this.userRepository.delete(id);
  }
}
