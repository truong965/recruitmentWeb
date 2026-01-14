import { Injectable } from '@nestjs/common';
import { Company, CompanyDocument } from './schemas/company.schema';
import type { SoftDeleteModel } from 'mongoose-delete';
import { InjectModel } from '@nestjs/mongoose';
import { BaseService } from 'src/common/service/base.service';

@Injectable()
export class CompaniesService extends BaseService<CompanyDocument> {
  constructor(
    @InjectModel(Company.name)
    private companyModel: SoftDeleteModel<CompanyDocument>,
  ) {
    super(companyModel);
  }
}
