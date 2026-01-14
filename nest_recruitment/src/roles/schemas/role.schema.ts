import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { Permission } from 'src/permissions/schemas/permission.schema';

export type RoleDocument = HydratedDocument<Role>;

@Schema({ timestamps: true })
export class Role extends BaseSchema {
  @Prop({ required: true, unique: true }) name: string;
  @Prop() description: string;
  @Prop({ default: true }) isActive: boolean;
  @Prop({
    type: [mongoose.Schema.Types.ObjectId],
    default: [],
    ref: Permission.name,
    index: true,
  })
  permissions: mongoose.Types.ObjectId[];
}

export const RoleSchema = SchemaFactory.createForClass(Role);
