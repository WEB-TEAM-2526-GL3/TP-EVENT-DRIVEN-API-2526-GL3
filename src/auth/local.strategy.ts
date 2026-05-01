import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from './auth.service';
import { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'usernameOrEmail',
    });
  }

  async validate(usernameOrEmail: string, password: string) {
    const user: AuthUser | null = await this.authService.validateUser(
      usernameOrEmail,
      password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
