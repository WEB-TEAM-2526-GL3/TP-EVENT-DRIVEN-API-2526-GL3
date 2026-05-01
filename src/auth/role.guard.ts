import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Type,
  mixin,
} from '@nestjs/common';
import { RoleEnum } from '../enums/role.enum';
import { AuthUser } from '../interfaces/auth-user.interface';

export const RoleGuard = (requiredRole: RoleEnum): Type<CanActivate> => {
  @Injectable()
  class RoleGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();

      if (!request.user) {
        return false;
      }

      return request.user.role === requiredRole;
    }
  }

  return mixin(RoleGuardMixin);
};
