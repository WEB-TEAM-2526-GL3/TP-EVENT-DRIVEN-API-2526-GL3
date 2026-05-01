import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CredentialsDto {
  @IsString()
  @IsNotEmpty()
  usernameOrEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}
