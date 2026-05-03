import { Cv } from '../../cv/entities/cv.entity';

export enum CvOperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  UPLOAD_FILE = 'UPLOAD_FILE',
}

export interface CvEventPayload {
  operation: CvOperationType;
  cv?: Cv;
  before?: Cv;
  after?: Cv;
  cvId?: string | number;
  file?: {
    filename: string;
    path: string;
    size: number;
    [key: string]: any;
  };
  beforePath?: string;
  newPath?: string;
  actorId?: string | number;
  timestamp?: string | number | Date;
}
