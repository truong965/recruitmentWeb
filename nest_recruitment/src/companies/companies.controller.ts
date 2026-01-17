import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Public, ResponseMessage, User } from 'src/auth/decorator/customize';
import type { IUser } from 'src/users/users.interface';
import {
  CanCreate,
  CanDelete,
  CanRead,
  CanUpdate,
} from 'src/casl/decorators/check-ability.decorator';
import { Company, CompanyDocument } from './schemas/company.schema';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import { ApiTags } from '@nestjs/swagger';
import { HR_ROLE } from 'src/casl/casl-ability.factory';
import { PermissionCheckService } from 'src/casl/services/permission-check.service';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: SoftDeleteModel<CompanyDocument>,
    private readonly companiesService: CompaniesService,
    private readonly permissionCheckService: PermissionCheckService,
  ) {}

  @Post()
  @CanCreate('Company')
  @ResponseMessage('create companies')
  create(@Body() createCompanyDto: CreateCompanyDto, @User() user: IUser) {
    return this.companiesService.create(createCompanyDto, user);
  }

  @Public()
  @Get()
  @CanRead('Company')
  @ResponseMessage('fetch companies with pagination')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.companiesService.findAll(+currentPage, +limit, qs);
  }

  @Public()
  @Get(':id')
  @CanRead('Company')
  @ResponseMessage('fetch companies by id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  //HR can update their company
  @Patch(':id')
  @CanUpdate('Company')
  @ResponseMessage('update Company')
  async update(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @User() user: IUser,
  ) {
    // Get company before updating
    const company = (await this.companiesService.findOne(
      id,
    )) as CompanyDocument;

    // HR specific permission check - only update their own company
    if (user.role.name === HR_ROLE && company) {
      if (
        !this.permissionCheckService.canHRUpdateCompany(
          user as any,
          company._id,
        )
      ) {
        throw new ForbiddenException('Can only update your own company');
      }
    }

    return this.companiesService.update(id, updateCompanyDto, user);
  }

  @Delete(':id')
  @CanDelete('Company')
  @ResponseMessage('delete Company')
  async remove(@Param('id') id: string, @User() user: IUser) {
    return this.companiesService.remove(id, user);
  }
}
