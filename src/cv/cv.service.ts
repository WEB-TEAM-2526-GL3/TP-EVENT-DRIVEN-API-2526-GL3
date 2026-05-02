import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCvDto } from './dto/create-cv.dto';
import { UpdateCvDto } from './dto/update-cv.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Cv } from './entities/cv.entity';
import { In, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { FileStorageService } from '../storage/file-storage.service';
import { Skill } from '../skill/entities/skill.entity';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WebhookEvent } from '../enums/webhook-event.enum';

@Injectable()
export class CvService {
  constructor(
    @InjectRepository(Cv)
    private readonly cvRepository: Repository<Cv>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    private readonly fileStorageService: FileStorageService,
    private readonly webhooksService: WebhooksService,
  ) {}

  async create(createCvDto: CreateCvDto, userId: number) {
    const { skills: skillIds, ...cvData } = createCvDto;
    const resolvedSkills = await this.resolveSkills(skillIds);

    const cv = this.cvRepository.create({
      ...cvData,
      user: { id: userId } as User,
      skills: resolvedSkills ?? [],
    });

    const savedCv = await this.cvRepository.save(cv);

    this.notifyWebhook(WebhookEvent.CV_CREATED, {
      cvId: savedCv.id,
      userId,
      name: savedCv.name,
      firstname: savedCv.firstname,
      lastname: savedCv.lastname,
      job: savedCv.job,
    });

    return savedCv;
    // return await this.cvRepository.save(cv);
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

  findOne(id: number, userId: number) {
    return this.cvRepository.findOne({
      where: { id, user: { id: userId } },
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
      updatedCv.skills = (await this.resolveSkills(skillIds)) ?? [];
    }

    const savedCv = await this.cvRepository.save(updatedCv);

    this.notifyWebhook(WebhookEvent.CV_UPDATED, {
      cvId: savedCv.id,
      userId,
      changes: updateCvDto,
    });

    return savedCv;
    // return this.cvRepository.save(updatedCv);
  }

  async remove(id: number, userId: number) {
    const existingCv = await this.findOne(id, userId);

    if (!existingCv) {
      throw new NotFoundException(`CV with id ${id} not found`);
    }

    await this.cvRepository.remove(existingCv);

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

  private async resolveSkills(
    skillIds?: number[],
  ): Promise<Skill[] | undefined> {
    if (skillIds === undefined) return undefined;
    if (skillIds.length === 0) return [];

    const uniqueSkillIds = Array.from(new Set(skillIds));
    const skills = await this.skillRepository.find({
      where: { id: In(uniqueSkillIds) },
    });

    if (skills.length !== uniqueSkillIds.length) {
      throw new BadRequestException('One or more skills are invalid');
    }

    return skills;
  }

  private notifyWebhook(event: WebhookEvent, data: Record<string, unknown>) {
    void this.webhooksService.dispatch(event, data).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';

      console.error(`Webhook dispatch failed for ${event}: ${message}`);
    });
  }
}
