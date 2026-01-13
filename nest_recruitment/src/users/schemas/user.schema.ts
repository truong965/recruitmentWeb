import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User extends BaseSchema {
  @Prop({ required: true }) email: string;
  @Prop({ required: true }) password: string;
  @Prop() name: string;
  @Prop() phone: string;
  @Prop() age: number;
  @Prop() address: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
