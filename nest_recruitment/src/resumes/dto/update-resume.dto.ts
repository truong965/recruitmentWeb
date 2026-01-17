import { IsEnum, IsOptional, IsString, IsEmail } from 'class-validator';

export enum ResumeStatus {
  PENDING = 'PENDING',
  REVIEWING = 'REVIEWING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class UpdateResumeDto {
  // HR: Update status (required when HR updates)
  @IsOptional()
  @IsEnum(ResumeStatus, { message: 'Status không hợp lệ' })
  status?: ResumeStatus;

  // USER: Update email (optional)
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  // USER: Update url/cv file (optional)
  @IsOptional()
  @IsString({ message: 'URL phải là string' })
  url?: string;
}
