import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import * as dotenv from 'dotenv';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import type { StringValue } from 'ms';
import ms from 'ms';

dotenv.config();
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: (() => {
        const jwtSecret = process.env.JWT_SECRET?.toString();
        if (jwtSecret == null) {
          throw new Error('JWT_SECRET is not defined');
        }
        return jwtSecret;
      })(),
      signOptions: {
        expiresIn: (() => {
          const jwtExpiresIn = process.env.JWT_EXPIRES_IN?.toString().trim();
          if (!jwtExpiresIn) {
            throw new Error('JWT_EXPIRES_IN is not defined');
          }

          const parsed = ms(jwtExpiresIn as StringValue);
          if (typeof parsed !== 'number') {
            throw new Error('JWT_EXPIRES_IN has an invalid format');
          }

          return parsed;
        })(),
      },
    }),
    UserModule,
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
