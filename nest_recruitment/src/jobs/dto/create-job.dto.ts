import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import mongoose from 'mongoose';

import sanitizeHtml from 'sanitize-html';
export class Company {
  @IsNotEmpty()
  _id: mongoose.Types.ObjectId;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  logo: string;
}
export class CreateJobDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsArray({ message: 'Skills phải là định dạng mảng' })
  @IsString({ each: true, message: 'Skill phải là chuỗi' })
  skills: string[];

  @IsOptional()
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
