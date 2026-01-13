import { Injectable } from '@nestjs/common';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Company, CompanyDocument } from './schemas/company.schema';
import type { SoftDeleteModel } from 'mongoose-delete';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { IUser } from 'src/users/users.interface';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name)
    private companyModel: SoftDeleteModel<CompanyDocument>,
  ) {}
  async create(createCompanyDto: CreateCompanyDto, user: IUser) {
    const res = await this.companyModel.create({
      ...createCompanyDto,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });
    return res;
  }

  findAll() {
    return `This action returns all companies`;
  }

  async findOne(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'not found';
    return await this.companyModel.findById({
      _id: id,
    });
  }

  async update(updateCompanyDto: UpdateCompanyDto) {
    const company = await this.companyModel.updateOne(
      {
        _id: updateCompanyDto._id,
      },
      { ...updateCompanyDto },
    );
    return company;
  }

  remove(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'not found';

    return this.companyModel.delete({
      _id: id,
    });
  }
}
