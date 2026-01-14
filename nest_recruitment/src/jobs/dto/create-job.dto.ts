import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Company } from 'src/users/dto/create-user.dto';
import sanitizeHtml from 'sanitize-html';
export class CreateJobDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsArray({ message: 'Skills phải là định dạng mảng' })
  @IsString({ each: true, message: 'Skill phải là chuỗi' })
  skills: string[];

  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => Company)
  company: Company;

  @IsNotEmpty()
  @IsString()
  location: string;

  @IsNotEmpty()
  @IsInt({ message: 'Lương phải là số nguyên (đơn vị nhỏ nhất)' })
  @IsPositive()
  @Type(() => Number)
  salary: number;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantity: number;

  @IsNotEmpty()
  @IsString()
  level: string;

  @IsString()
  @Transform(({ value }) => sanitizeHtml(value))
  description: string;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @IsNotEmpty()
  @IsBoolean()
  isActive: boolean;
}
