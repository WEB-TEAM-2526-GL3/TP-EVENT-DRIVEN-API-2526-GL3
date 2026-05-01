import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CvService } from './cv.service';
import { CreateCvDto } from './dto/create-cv.dto';
import { UpdateCvDto } from './dto/update-cv.dto';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser } from '../interfaces/auth-user.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleGuard } from '../auth/role.guard';
import { RoleEnum } from '../enums/role.enum';

@Controller('cv')
@UseGuards(AuthGuard('jwt'))
@ApiTags('cv')
@ApiBearerAuth()
export class CvController {
  constructor(private readonly cvService: CvService) {}

  @Post()
  create(
    @Body() createCvDto: CreateCvDto,
    @Request() request: { user: AuthUser },
  ) {
    return this.cvService.create(createCvDto, request.user.id);
  }

  @Get()
  findAll(@Request() request: { user: AuthUser }) {
    return this.cvService.findAll(request.user.id);
  }

  @Get('all')
  @UseGuards(RoleGuard(RoleEnum.ADMIN))
  findAllForAdmin() {
    return this.cvService.findAllForAdmin();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() request: { user: AuthUser }) {
    return this.cvService.findOne(+id, request.user.id).then((cv) => {
      if (!cv) {
        return { message: `CV not found` };
      }
      return cv;
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCvDto: UpdateCvDto,
    @Request() request: { user: AuthUser },
  ) {
    // avoiding potential exploit: patching the "path" of the file to access other files.
    return this.cvService.update(+id, updateCvDto, request.user.id);
  }

  /**
   * Todo : change this to a soft delete
   * @param id
   * @param request
   * @returns message of success or failure
   */
  @Delete(':id')
  remove(@Param('id') id: string, @Request() request: { user: AuthUser }) {
    // won't say whether it's "not authorized" or "not found", to avoid exploits
    return this.cvService.remove(+id, request.user.id);
  }

  @Post('upload/:id')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 mega octets, bel wefi
    }),
  )
  uploadCvFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() request: { user: AuthUser },
  ) {
    return this.cvService.uploadCvFile(+id, request.user.id, file);
  }

  @Post('upload-image/:id')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 },
    }),
  )
  uploadCvImage(
    @Param('id') id: string,
    @UploadedFile() image: Express.Multer.File,
    @Request() request: { user: AuthUser },
  ) {
    return this.cvService.uploadCvImage(+id, request.user.id, image);
  }
}
