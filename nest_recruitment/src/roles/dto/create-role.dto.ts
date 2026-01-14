import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import mongoose from 'mongoose';

export class CreateRoleDto {
  @IsNotEmpty()
  @IsString()
  name: string;
  @IsNotEmpty()
  @IsString()
  description: string;
  @IsNotEmpty()
  @IsBoolean()
  isActive: boolean;

  @IsNotEmpty()
  @IsArray({ message: 'Permissions phải là định dạng mảng' }) // Sửa lại message
  @IsMongoId({
    each: true,
    message: 'Mỗi permission phải là một MongoID hợp lệ',
  })
  permissions: mongoose.Types.ObjectId[];
}
