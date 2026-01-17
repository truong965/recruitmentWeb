import { Injectable } from '@nestjs/common';
import { Company, CompanyDocument } from './schemas/company.schema';
import type { SoftDeleteModel } from 'mongoose-delete';
import { InjectModel } from '@nestjs/mongoose';
import { BaseService } from 'src/common/service/base.service';
import aqp from 'api-query-params';
import { FilterQuery } from 'mongoose';
import { Job, JobDocument } from 'src/jobs/schemas/job.schema';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import type { IUser } from 'src/users/users.interface';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService extends BaseService<CompanyDocument> {
  constructor(
    @InjectModel(Company.name)
    private companyModel: SoftDeleteModel<CompanyDocument>,
    @InjectModel(Job.name)
    private jobModel: SoftDeleteModel<JobDocument>,
    @InjectModel(User.name)
    private userModel: SoftDeleteModel<UserDocument>,
  ) {
    super(companyModel);
  }
  async findAll(
    currentPage: number,
    limit: number,
    qs: string,
    filterOverride?: FilterQuery<CompanyDocument>,
  ) {
    const { filter, sort, population, projection } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    const combinedFilter = { ...filter, ...filterOverride };
    const defaultLimit = +limit ? +limit : 10;
    const offset = (currentPage - 1) * defaultLimit;

    const totalItems = (await this.companyModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.companyModel
      .find(combinedFilter)
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

  /**
   * Update company with cascade update to related documents
   * When company name/logo changes, automatically update all jobs and users in that company
   */
  async update(id: string, updateCompanyDto: UpdateCompanyDto, user: IUser) {
    // Get company before update
    const company = await this.companyModel.findById(id);
    if (!company) return 'not found';

    // Check if name or logo changed - need cascade update
    const nameChanged =
      updateCompanyDto.name && updateCompanyDto.name !== company.name;
    const logoChanged =
      updateCompanyDto.logo && updateCompanyDto.logo !== company.logo;

    // Cascade update to related documents if name or logo changed
    if (nameChanged || logoChanged) {
      // Update all jobs from this company

      await this.jobModel.updateMany(
        { 'company._id': id },
        {
          $set: {
            name: updateCompanyDto.name,
            logo: updateCompanyDto.logo,
          },
        },
      );

      // Update all users from this company
      await this.userModel.updateMany(
        { 'company._id': id },
        {
          $set: {
            'company.name': updateCompanyDto.name,
          },
        },
      );
    }
    return super.update(id, updateCompanyDto, user);
  }
  /**
   * Soft delete company
   * - Disable the company (isActive = false)
   * - Jobs/Users remain but company is marked inactive
   * - They can't create new entities for inactive company, but existing data preserved
   */
  async remove(id: string, user: IUser) {
    // Get company
    const company = await this.companyModel.findById(id);
    if (!company) return 'not found';

    // Also mark all jobs from this company as inactive
    await this.jobModel.updateMany(
      { 'company._id': id },
      {
        isActive: false,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );

    // Perform soft delete
    return super.remove(id, user);
  }
}
