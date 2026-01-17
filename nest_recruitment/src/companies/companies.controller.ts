import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Public, ResponseMessage, User } from 'src/auth/decorator/customize';
import type { IUser } from 'src/users/users.interface';
import {
  CanCreate,
  CanDelete,
  CanUpdate,
} from 'src/casl/decorators/check-ability.decorator';
import { SecurityService } from 'src/common/service/security.service';
import { Company, CompanyDocument } from './schemas/company.schema';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('companies')
@Controller('companies')
// @UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompaniesController {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: SoftDeleteModel<CompanyDocument>,
    private readonly companiesService: CompaniesService,
    private readonly securityService: SecurityService,
  ) {}

  @Post()
  @CanCreate('Company')
  create(@Body() createCompanyDto: CreateCompanyDto, @User() user: IUser) {
    return this.companiesService.create(createCompanyDto, user);
  }

  @Public()
  @Get()
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
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  @CanUpdate('Company')
  async update(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @User() user: IUser,
  ) {
    // Check ownership trước khi update
    await this.securityService.verifyOwnership(
      this.companyModel,
      id,
      user,
      'update', // action
    );
    // Nếu qua được bước trên nghĩa là User Hợp lệ + Data Tồn tại
    return this.companiesService.update(id, updateCompanyDto, user);
  }

  @Delete(':id')
  @CanDelete('Company')
  async remove(@Param('id') id: string, @User() user: IUser) {
    await this.securityService.verifyOwnership(
      this.companyModel,
      id,
      user,
      'delete',
    );
    return this.companiesService.remove(id, user);
  }
}
