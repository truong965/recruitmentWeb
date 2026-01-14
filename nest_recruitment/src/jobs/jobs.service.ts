import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job, JobDocument } from './schemas/job.schema';
import type { SoftDeleteModel } from 'mongoose-delete';
import { BaseService } from 'src/common/service/base.service';

@Injectable()
export class JobsService extends BaseService<JobDocument> {
  constructor(
    @InjectModel(Job.name)
    private jobModel: SoftDeleteModel<JobDocument>,
  ) {
    super(jobModel);
  }
}
