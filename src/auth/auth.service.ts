import { Body, Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { JwtService } from '@nestjs/jwt/dist/jwt.service';
import { AuthUser } from '../interfaces/auth-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}
  async register(@Body() createUserDto: CreateUserDto) {
    return await this.userService.create(createUserDto);
  }

  async validateUser(
    usernameOrEmail: string,
    password: string,
  ): Promise<AuthUser | null> {
    return await this.userService.validateUser(usernameOrEmail, password);
  }

  async login(user: AuthUser) {
    const payload: JwtPayload = {
      username: user.username,
      sub: user.id,
      role: user.role,
    };
    const token = await this.jwtService.signAsync(payload);
    return {
      access_token: token,
    };
  }
}
