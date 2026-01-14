import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job, JobDocument } from './schemas/job.schema';
import type { SoftDeleteModel } from 'mongoose-delete';
import { BaseService } from 'src/common/service/base.service';
import type { IUser } from 'src/users/users.interface';
import mongoose from 'mongoose';

@Injectable()
export class JobsService extends BaseService<JobDocument> {
  constructor(
    @InjectModel(Job.name)
    private jobModel: SoftDeleteModel<JobDocument>,
  ) {
    super(jobModel);
  }
  async remove(id: string, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'not found';
    await this.jobModel.updateOne({ _id: id }, { isActive: false });
    return this.jobModel.delete(
      { _id: id },
      {
        _id: user._id,
        email: user.email,
      },
    );
  }
}
