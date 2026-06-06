import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  Sse,
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
import { SetMetadata } from '@nestjs/common';
import { RoleGuard } from '../auth/role.guard';
import { RoleEnum } from '../enums/role.enum';
import { ROLES_KEY } from '../auth/roles.decorator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEventPattern } from 'rxjs';
import { map, filter, take } from 'rxjs/operators';
import { CvEventPayload } from '../cv-history/dto/cv-event-payload.dto';

// max number of events to send for a single connection
const SSE_MAX_EVENTS = 2;

@Controller('cv')
@UseGuards(AuthGuard('jwt'), RoleGuard)
// @ApiTags('cv')
// @ApiBearerAuth()
export class CvController {
  constructor(
    private readonly cvService: CvService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  create(
    @Body() createCvDto: CreateCvDto,
    @Request() request: { user: AuthUser },
  ) {
    return this.cvService.create(createCvDto, request.user);
  }

  @Get()
  findAll(@Request() request: { user: AuthUser }) {
    return this.cvService.findAll(request.user.id);
  }

  @Get('all')
  @SetMetadata(ROLES_KEY, [RoleEnum.ADMIN]) // can be changed to : @Roles([RoleEnum.ADMIN])
  findAllForAdmin() {
    return this.cvService.findAllForAdmin();
  }

  @Sse('sse')
  sse(@Request() request: { user: AuthUser }): Observable<MessageEvent> {
    const isAdmin = (request.user.role as RoleEnum) === RoleEnum.ADMIN;

    const fep = fromEventPattern<CvEventPayload>(
      (handler) => this.eventEmitter.on('cv.changed', handler),
      (handler) => this.eventEmitter.off('cv.changed', handler),
    ).pipe(
      filter((payload: CvEventPayload) => {
        if (isAdmin) {
          return true;
        }
        const cvEntity = payload.cv || payload.after || payload.before!;
        const cvOwnerId = cvEntity.user.id;
        return cvOwnerId === request.user.id;
      }),
      map((payload: CvEventPayload) => {
        return new MessageEvent('cv-changed', { data: payload });
      }),
      take(SSE_MAX_EVENTS),
    );

    return fep;
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
    return this.cvService.remove(
      +id,
      request.user.role === RoleEnum.ADMIN.toString() ? -1 : request.user.id,
    );
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
