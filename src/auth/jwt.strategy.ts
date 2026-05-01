import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AuthUser } from '../interfaces/auth-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import * as dotenv from 'dotenv';
import { RoleEnum } from '../enums/role.enum';

dotenv.config();
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const jwtSecret = process.env.JWT_SECRET?.toString();
        if (jwtSecret == null) {
          throw new Error('JWT_SECRET is not defined');
        }
        return jwtSecret;
      })(),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  }
}
