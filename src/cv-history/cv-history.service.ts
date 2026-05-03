import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CvHistory } from './entities/cv-history.entity';

@Injectable()
export class CvHistoryService {
  constructor(
    @InjectRepository(CvHistory)
    private readonly repo: Repository<CvHistory>,
  ) {}

  async createHistory(data: Partial<CvHistory>) {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }
}
