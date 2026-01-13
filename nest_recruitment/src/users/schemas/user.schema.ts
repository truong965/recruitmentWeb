import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User extends BaseSchema {
  @Prop({ required: true }) email: string;
  @Prop({ required: true, select: false }) password: string;
  @Prop() name: string;
  @Prop() phone: string;
  @Prop() age: number;
  @Prop() gender: string;
  @Prop() address: string;
  @Prop({ type: Object }) company: {
    _id: mongoose.Types.ObjectId;
    name: string;
  };
  @Prop() role: string;
  @Prop() refreshToken: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
