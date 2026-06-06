import { Module } from '@nestjs/common';
import { CvService } from './cv.service';
import { CvController } from './cv.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cv } from './entities/cv.entity';
import { StorageModule } from '../storage/storage.module';
import { SkillModule } from '../skill/skill.module';
import { UserModule } from '../user/user.module';
import { RoleGuard } from '../auth/role.guard';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cv]),
    StorageModule,
    SkillModule,
    UserModule,
    WebhooksModule,
  ],
  controllers: [CvController],
  providers: [CvService, RoleGuard],
  exports: [CvService],
})
export class CvModule {}
