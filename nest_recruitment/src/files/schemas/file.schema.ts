// src/files/schemas/file.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';

export type FileDocument = HydratedDocument<File>;
export enum UploadStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
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

  @Prop()
  s3Url?: string; // Public URL | Sẽ null với private files

  @Prop()
  folder: string; // Folder/category (resumes, avatars, companies)

  @Prop()
  uploadedAt?: Date; // Thời điểm S3 confirm upload thành công

  @Prop({
    type: String,
    enum: UploadStatus,
    default: UploadStatus.PENDING,
  })
  status: UploadStatus;
  @Prop()
  eTag?: string; // ETag từ S3

  @Prop()
  versionId?: string; // Nếu bucket enable versioning
}

export const FileSchema = SchemaFactory.createForClass(File);

FileSchema.index({ status: 1, createdAt: -1 });
FileSchema.index({ s3Key: 1 }, { unique: true });
