import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export enum FileType {
  IMAGE = 'image',
  DOCUMENT = 'document',
  VIDEO = 'video',
}

export class RequestUploadDto {
  @IsString()
  fileName: string;

  @IsNumber()
  @Min(1)
  @Max(5 * 1024 * 1024) // Max 5MB
  fileSize: number;

  @IsString()
  mimeType: string;

  @IsEnum(FileType)
  @IsOptional()
  fileType?: FileType;

  @IsString()
  @IsOptional()
  folder?: string;
}
