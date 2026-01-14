import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';

export type CompanyDocument = HydratedDocument<Company>;

@Schema({ timestamps: true })
export class Company extends BaseSchema {
  @Prop() name: string;
  @Prop() address: string;
  @Prop() description: string;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
