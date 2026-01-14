import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';

export type JobDocument = HydratedDocument<Job>;

@Schema({ timestamps: true })
export class Job extends BaseSchema {
  @Prop({ required: true }) name: string;
  @Prop({
    type: [String],
    default: [],
    index: true, //query theo mảng
  })
  skills: string[];
  @Prop({ type: Object }) company: {
    _id: mongoose.Types.ObjectId;
    name: string;
  };
  @Prop() location: string;
  @Prop() salary: number;
  @Prop() quantity: number;
  @Prop() level: string;
  @Prop() description: string;
  @Prop() startDate: Date;
  @Prop() endDate: Date;
  @Prop() isActive: boolean;
}

export const JobSchema = SchemaFactory.createForClass(Job);
