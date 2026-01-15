import { Type } from 'class-transformer';
import {
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import mongoose from 'mongoose';

export class Company {
  @IsNotEmpty()
  _id: mongoose.Types.ObjectId;

  @IsNotEmpty()
  name: string;
}
export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  age: number;

  @IsNotEmpty()
  @IsString()
  gender: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsMongoId()
  role: mongoose.Types.ObjectId;

  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => Company)
  company: Company;
}
export class RegisterUserDto {
  @IsString()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  age: number;

  @IsNotEmpty()
  @IsString()
  gender: string;

  @IsNotEmpty()
  @IsString()
  address: string;
}
