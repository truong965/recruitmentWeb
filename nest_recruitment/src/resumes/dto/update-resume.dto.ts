import { IsEnum, IsNotEmpty } from 'class-validator';

export enum ResumeStatus {
  PENDING = 'PENDING',
  REVIEWING = 'REVIEWING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class UpdateResumeDto {
  @IsNotEmpty({ message: 'Status không được để trống' })
  @IsEnum(ResumeStatus, { message: 'Status không hợp lệ' }) // Chỉ cho phép các giá trị trong Enum
  status: ResumeStatus;
}
