import { Module } from '@nestjs/common';
import { CvService } from './cv.service';
import { CvController } from './cv.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cv } from './entities/cv.entity';
import { StorageModule } from '../storage/storage.module';
import { Skill } from '../skill/entities/skill.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cv, Skill]), StorageModule],
  controllers: [CvController],
  providers: [CvService],
})
export class CvModule {}
