// src/files/schemas/file.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';

export type FileDocument = HydratedDocument<File>;

@Schema({ timestamps: true })
export class File extends BaseSchema {
  @Prop({ required: true })
  originalName: string; // Tên file gốc

  @Prop({ required: true })
  fileName: string; // Tên file sau khi upload (UUID)

  @Prop({ required: true })
  mimeType: string; // image/jpeg, application/pdf, etc.

  @Prop({ required: true })
  size: number; // File size in bytes

  @Prop({ required: true })
  s3Key: string; // S3 object key (VD: 'resumes/uuid.pdf')

  @Prop({ required: true })
  s3Url: string; // Public URL

  @Prop()
  folder: string; // Folder/category (resumes, avatars, companies)
}

export const FileSchema = SchemaFactory.createForClass(File);
