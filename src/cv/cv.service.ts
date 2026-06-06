import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateCvDto } from './dto/create-cv.dto';
import { UpdateCvDto } from './dto/update-cv.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Cv } from './entities/cv.entity';
import { Repository } from 'typeorm';
import { UserService } from '../user/user.service';
import { FileStorageService } from '../storage/file-storage.service';
import { SkillService } from '../skill/skill.service';
import { AuthUser } from '../interfaces/auth-user.interface';
import { RoleEnum } from '../enums/role.enum';
import {
  CvEventPayload,
  CvOperationType,
} from '../cv-history/dto/cv-event-payload.dto';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WebhookEvent } from '../enums/webhook-event.enum';

@Injectable()
export class CvService {
  constructor(
    @InjectRepository(Cv)
    private readonly cvRepository: Repository<Cv>,
    private readonly fileStorageService: FileStorageService,
    private readonly skillService: SkillService,
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2,
    private readonly webhooksService: WebhooksService,
  ) {}

  async create(createCvDto: CreateCvDto, actor: AuthUser) {
    const {
      skills: skillIds = [],
      userId: ownerIdFromBody,
      ...cvData
    } = createCvDto;
    const ownerId = ownerIdFromBody ?? actor.id;
    const isAdmin = (actor.role as RoleEnum) === RoleEnum.ADMIN;
    const resolvedSkills = await this.skillService.resolveSkills(skillIds);
    const resolvedUser = await this.userService.resolveUser(ownerId);

    if (!isAdmin && ownerId !== actor.id) {
      throw new ForbiddenException(
        'You can only create a CV for your own account',
      );
    }

    const cv = this.cvRepository.create({
      ...cvData,
      user: resolvedUser,
      skills: resolvedSkills ?? [],
    });

    const savedCv = await this.cvRepository.save(cv);

    this.notifyWebhook(WebhookEvent.CV_CREATED, {
      cvId: savedCv.id,
      userId: ownerId,
      name: savedCv.name,
      firstname: savedCv.firstname,
      lastname: savedCv.lastname,
      job: savedCv.job,
    });

    const payload: CvEventPayload = {
      operation: CvOperationType.CREATE,
      cv: savedCv,
      actorId: actor.id,
      timestamp: new Date(),
    };
    this.eventEmitter.emit('cv.changed', payload);
    return savedCv;
  }

  async seedCreate(createCvDto: CreateCvDto) {
    const { skills: skillIds = [], userId, ...cvData } = createCvDto;
    const cv = this.cvRepository.create({
      ...cvData,
      user: await this.userService.resolveUser(userId!),
      skills: await this.skillService.resolveSkills(skillIds),
    });

    const saved = await this.cvRepository.save(cv);
    return saved;
  }

  async findAll(userId: number) {
    return await this.cvRepository.find({
      where: { user: { id: userId } },
      relations: ['skills'],
    });
  }

  async findAllForAdmin() {
    return await this.cvRepository.find({
      relations: ['skills', 'user'],
    });
  }

  async findOne(id: number, userId: number) {
    return await this.cvRepository.findOne({
      where: { id, user: { id: userId } },
      relations: ['skills'],
    });
  }

  async findOneForAdmin(id: number) {
    return await this.cvRepository.findOne({
      where: { id },
      relations: ['skills'],
    });
  }

  async update(id: number, updateCvDto: UpdateCvDto, userId: number) {
    const existingCv = await this.findOne(id, userId);

    if (!existingCv) {
      throw new NotFoundException(`CV not found`);
    }

    const { skills: skillIds, ...partialData } = updateCvDto;
    const updatedCv = this.cvRepository.merge(existingCv, partialData);
    if (skillIds !== undefined) {
      updatedCv.skills =
        (await this.skillService.resolveSkills(skillIds)) ?? [];
    }

    const savedCv = await this.cvRepository.save(updatedCv);

    this.notifyWebhook(WebhookEvent.CV_UPDATED, {
      cvId: savedCv.id,
      userId,
      changes: updateCvDto,
    });

    this.eventEmitter.emit('cv.changed', {
      operation: CvOperationType.UPDATE,
      before: existingCv,
      after: savedCv,
      actorId: userId,
      timestamp: new Date(),
    });
    return savedCv;
  }

  async remove(id: number, userId: number = -1) {
    const existingCv =
      userId === -1
        ? await this.findOneForAdmin(id)
        : await this.findOne(id, userId);

    if (!existingCv) {
      throw new NotFoundException(`CV with id ${id} not found`);
    }

    await this.cvRepository.remove(existingCv);
    this.eventEmitter.emit('cv.changed', {
      operation: CvOperationType.DELETE,
      cv: existingCv,
      actorId: userId,
      timestamp: new Date(),
    });

    this.notifyWebhook(WebhookEvent.CV_DELETED, {
      cvId: id,
      userId,
      name: existingCv.name,
      firstname: existingCv.firstname,
      lastname: existingCv.lastname,
    });

    return { message: `CV with id ${id} deleted` };
  }

  async uploadCvFile(id: number, userId: number, file: Express.Multer.File) {
    const existingCv = await this.findOne(id, userId);

    if (!existingCv) {
      throw new NotFoundException(`CV not found`);
    }

    const oldPath = existingCv.path;
    const newPath = await this.fileStorageService.saveCvFile(file);

    existingCv.path = newPath;
    const savedCv = await this.cvRepository.save(existingCv);

    if (oldPath && oldPath !== newPath) {
      await this.fileStorageService.deleteFileIfExists(oldPath);
    }

    this.eventEmitter.emit('cv.changed', {
      operation: CvOperationType.UPLOAD_FILE,
      cvId: savedCv.id,
      beforePath: oldPath,
      newPath,
      actorId: userId,
      timestamp: new Date(),
    });

    this.notifyWebhook(WebhookEvent.CV_UPDATED, {
      cvId: savedCv.id,
      userId,
      action: 'cv_file_uploaded',
      path: savedCv.path,
    });

    return savedCv;
  }

  async uploadCvImage(id: number, userId: number, image: Express.Multer.File) {
    const existingCv = await this.findOne(id, userId);

    if (!existingCv) {
      throw new NotFoundException(`CV not found`);
    }

    const oldImagePath = existingCv.imagePath;
    const newImagePath = await this.fileStorageService.saveImageFile(image);

    existingCv.imagePath = newImagePath;
    const savedCv = await this.cvRepository.save(existingCv);

    if (oldImagePath && oldImagePath !== newImagePath) {
      await this.fileStorageService.deleteFileIfExists(oldImagePath);
    }

    this.notifyWebhook(WebhookEvent.CV_UPDATED, {
      cvId: savedCv.id,
      userId,
      action: 'cv_image_uploaded',
      imagePath: savedCv.imagePath,
    });

    return savedCv;
  }

  private notifyWebhook(event: WebhookEvent, data: Record<string, unknown>) {
    void this.webhooksService.dispatch(event, data).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';

      console.error(`Webhook dispatch failed for ${event}: ${message}`);
    });
  }
}
