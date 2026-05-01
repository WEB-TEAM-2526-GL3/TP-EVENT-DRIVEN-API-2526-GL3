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

@Controller('skill')
@UseGuards(AuthGuard('jwt'))
@ApiTags('skill')
@ApiBearerAuth()
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  @Post()
  @UseGuards(RoleGuard(RoleEnum.ADMIN))
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
  @UseGuards(RoleGuard(RoleEnum.ADMIN))
  update(@Param('id') id: string, @Body() updateSkillDto: UpdateSkillDto) {
    return this.skillService.update(+id, updateSkillDto);
  }

  @Delete(':id')
  @UseGuards(RoleGuard(RoleEnum.ADMIN))
  remove(@Param('id') id: string) {
    return this.skillService.remove(+id);
  }
}
