import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RoleGuard } from '../auth/role.guard';
import { RoleEnum } from '../enums/role.enum';
import { AuthUser } from '../interfaces/auth-user.interface';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../auth/roles.decorator';

@Controller('user')
@UseGuards(AuthGuard('jwt'), RoleGuard)
@ApiTags('user')
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @SetMetadata(ROLES_KEY, [RoleEnum.ADMIN])
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @SetMetadata(ROLES_KEY, [RoleEnum.ADMIN])
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() request: { user: AuthUser }) {
    if (!selfAccessOrAdmin(request, +id)) throw new UnauthorizedException();
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() request: { user: AuthUser },
    @Body() updateUserDto: UpdateUserDto,
  ) {
    if (!selfAccessOrAdmin(request, +id)) throw new UnauthorizedException();
    return this.userService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() request: { user: AuthUser }) {
    if (!selfAccessOrAdmin(request, +id)) throw new UnauthorizedException();
    return this.userService.remove(+id);
  }
}

function selfAccessOrAdmin(
  request: { user: AuthUser },
  objectId: number,
): boolean {
  return (
    request.user.role == RoleEnum.ADMIN.toString() ||
    request.user.id == objectId
  );
}
