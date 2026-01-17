import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsMongoId, IsNotEmpty } from 'class-validator';

// For USER/HR: Update basic info only (no role, company, password)
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'role', 'company'] as const),
) {
  @IsNotEmpty({ message: '_id không được để trống' })
  @IsMongoId({ message: '_id không hợp lệ' })
  _id: string;
}

// For ADMIN: Update any info (no password - use separate endpoint for password change)
export class UpdateUserAdminDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @IsNotEmpty({ message: '_id không được để trống' })
  @IsMongoId({ message: '_id không hợp lệ' })
  _id: string;
}
