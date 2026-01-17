import { Injectable } from '@nestjs/common';
import { Company, CompanyDocument } from './schemas/company.schema';
import type { SoftDeleteModel } from 'mongoose-delete';
import { InjectModel } from '@nestjs/mongoose';
import { BaseService } from 'src/common/service/base.service';
import aqp from 'api-query-params';

@Injectable()
export class CompaniesService extends BaseService<CompanyDocument> {
  constructor(
    @InjectModel(Company.name)
    private companyModel: SoftDeleteModel<CompanyDocument>,
  ) {
    super(companyModel);
  }
  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population, projection } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    const defaultLimit = +limit ? +limit : 10;
    const offset = (currentPage - 1) * defaultLimit;

    const totalItems = (await this.companyModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.companyModel
      .find(filter)
      .limit(defaultLimit)
      .skip(offset)
      .sort(sort as any)
      .populate(population)
      .select(projection)
      .exec();

    return {
      meta: {
        current: currentPage,
        pageSize: defaultLimit,
        pages: totalPages,
        total: totalItems,
      },
      result,
    };
  }
}
