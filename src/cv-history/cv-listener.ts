import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CvHistoryService } from './cv-history.service';
import type { CvEventPayload } from './dto/cv-event-payload.dto';

@Injectable()
export class CvListener {
  constructor(private readonly history: CvHistoryService) {}

  @OnEvent('cv.changed', { async: true })
  async onCvChanged(payload: CvEventPayload) {
    let cvId: number | undefined;

    // Determine cvId based on operation
    if (payload.cv?.id) {
      cvId = payload.cv.id;
    } else if (payload.after?.id) {
      cvId = payload.after.id;
    } else if (payload.cvId) {
      cvId = payload.cvId as number;
    }

    await this.history.createHistory({
      cvId,
      operation: payload.operation,
      actorId: payload.actorId as number | undefined,
      timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      details: payload,
    });
  }
}
