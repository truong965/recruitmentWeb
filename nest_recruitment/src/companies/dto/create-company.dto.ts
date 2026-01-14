import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCompanyDto {
  @IsNotEmpty()
  name!: string;
  @IsNotEmpty()
  address!: string;
  @IsNotEmpty()
  description: string;
  @IsOptional()
  @IsString()
  logo: string;
}
