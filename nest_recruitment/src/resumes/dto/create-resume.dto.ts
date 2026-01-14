import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';
import mongoose from 'mongoose';

export class CreateResumeDto {
  @IsNotEmpty()
  @IsString()
  url: string;

  @IsNotEmpty()
  @IsMongoId()
  companyId: mongoose.Types.ObjectId;

  @IsNotEmpty()
  @IsMongoId()
  jobId: mongoose.Types.ObjectId;
}
