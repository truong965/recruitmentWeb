import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { Company } from 'src/companies/schemas/company.schema';
import { Job } from 'src/jobs/schemas/job.schema';

export type ResumeDocument = HydratedDocument<Resume>;

@Schema({ timestamps: true })
export class Resume extends BaseSchema {
  @Prop() email: string;
  @Prop({ required: true }) userId: mongoose.Types.ObjectId;
  @Prop() url: string; // duong dan chua file cv
  @Prop() status: string; //PENDING REVIEWING APPROVED REJECTED
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Company.name,
    required: true,
  })
  companyId: mongoose.Types.ObjectId;
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Job.name,
    required: true,
  })
  jobId: mongoose.Types.ObjectId;

  @Prop({
    type: [Object],
    default: [],
    index: true, //query theo mảng
  })
  history: [
    {
      status: string;
      updatedAt: Date;
      updatedBy: {
        _id: mongoose.Types.ObjectId;
        email: string;
      };
    },
  ];
}

export const ResumeSchema = SchemaFactory.createForClass(Resume);
