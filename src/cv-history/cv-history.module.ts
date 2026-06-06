import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CvHistory } from './entities/cv-history.entity';
import { CvHistoryService } from './cv-history.service';
import { CvListener } from './cv-listener';

@Module({
  imports: [TypeOrmModule.forFeature([CvHistory])],
  providers: [CvHistoryService, CvListener],
  exports: [CvHistoryService],
})
export class CvHistoryModule {}
