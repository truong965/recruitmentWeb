import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CreateSubscriberDto {
  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsArray({ message: 'Skills phải là định dạng mảng' })
  @IsString({ each: true, message: 'Skill phải là chuỗi' })
  skills: string[];
}
