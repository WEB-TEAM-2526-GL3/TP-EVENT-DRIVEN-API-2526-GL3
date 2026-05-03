import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { SkillService } from './skill.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { AuthGuard } from '@nestjs/passport/dist/auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { RoleEnum } from '../enums/role.enum';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../auth/roles.decorator';

@Controller('skill')
@UseGuards(AuthGuard('jwt'), RoleGuard)
@ApiTags('skill')
@ApiBearerAuth()
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  @Post()
  @SetMetadata(ROLES_KEY, [RoleEnum.ADMIN])
  create(@Body() createSkillDto: CreateSkillDto) {
    return this.skillService.create(createSkillDto);
  }

  @Get()
  findAll() {
    return this.skillService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.skillService.findOne(+id);
  }

  @Patch(':id')
  @SetMetadata(ROLES_KEY, [RoleEnum.ADMIN])
  update(@Param('id') id: string, @Body() updateSkillDto: UpdateSkillDto) {
    return this.skillService.update(+id, updateSkillDto);
  }

  @Delete(':id')
  @SetMetadata(ROLES_KEY, [RoleEnum.ADMIN])
  remove(@Param('id') id: string) {
    return this.skillService.remove(+id);
  }
}
