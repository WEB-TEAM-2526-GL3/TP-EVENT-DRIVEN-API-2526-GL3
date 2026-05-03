import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { CvModule } from '../cv/cv.module';
import { UserModule } from '../user/user.module';
import { SkillModule } from '../skill/skill.module';

@Module({
  imports: [CvModule, UserModule, SkillModule],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
