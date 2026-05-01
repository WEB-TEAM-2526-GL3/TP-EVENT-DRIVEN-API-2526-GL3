import { RoleEnum } from '../enums/role.enum';

export interface AuthUser {
  id: number;
  username: string;
  role: string | RoleEnum;
}
