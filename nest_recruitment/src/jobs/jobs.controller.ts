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
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Public, ResponseMessage, User } from 'src/auth/decorator/customize';
import type { IUser } from 'src/users/users.interface';
import { ApiTags } from '@nestjs/swagger';
import {
  CanCreate,
  CanRead,
  CanDelete,
  CanUpdate,
} from 'src/casl/decorators/check-ability.decorator';
import { PermissionCheckService } from 'src/casl/services/permission-check.service';
import { Job, JobDocument } from './schemas/job.schema';
import { HR_ROLE } from 'src/casl/casl-ability.factory';
import { FilterQuery } from 'mongoose';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly permissionCheckService: PermissionCheckService,
  ) {}

  // Everyone can read jobs
  // HR: automatically filtered by their company
  @Public()
  @Get()
  @CanRead('Job')
  @ResponseMessage('fetch jobs with pagination ')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
    @User() user?: IUser,
  ) {
    // If HR role, automatically filter by their company
    let filterOverride: FilterQuery<JobDocument> | undefined = undefined;
    // console.log(user);
    if (user?.role?.name === HR_ROLE && user?.company?._id) {
      filterOverride = { 'company._id': user.company._id };
      // console.log(user.company._id);
    }
    return this.jobsService.findAll(+currentPage, +limit, qs, filterOverride);
  }

  @Public()
  @Get(':id')
  @CanRead('Job')
  @ResponseMessage('fetch job by id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  // SUPER_ADMIN & HR: Can create jobs
  // HR: Only for their company
  @Post()
  @CanCreate('Job')
  @ResponseMessage('create jobs')
  create(@Body() createJobDto: CreateJobDto, @User() user: IUser) {
    // HR must create job for their company
    if (user.role.name === HR_ROLE) {
      if (!user.company) {
        throw new ForbiddenException('HR must have a company');
      }
      createJobDto.company = {
        _id: user.company._id,
        name: user.company.name!,
        logo: user.company.logo!,
      };
    }
    return this.jobsService.create(createJobDto, user);
  }

  // SUPER_ADMIN: Can update any job
  // HR: Can update only jobs in their company
  @Patch(':id')
  @CanUpdate('Job')
  @ResponseMessage('update job')
  async update(
    @Param('id') id: string,
    @Body() updateJobDto: UpdateJobDto,
    @User() user: IUser,
  ) {
    const job = (await this.jobsService.findOne(id)) as Job;
    // HR specific permission check
    if (user.role.name === HR_ROLE && job) {
      if (
        !this.permissionCheckService.canHRManageJob(
          user as any,
          job.company?._id,
        )
      ) {
        throw new ForbiddenException('Can only update jobs in your company');
      }
    }
    return this.jobsService.update(id, updateJobDto, user);
  }

  // SUPER_ADMIN & HR: Can delete jobs
  // HR: Only jobs in their company
  @Delete(':id')
  @CanDelete('Job')
  @ResponseMessage('delete job')
  async remove(@Param('id') id: string, @User() user: IUser) {
    const job = (await this.jobsService.findOne(id)) as Job;

    // HR specific permission check
    if (user.role.name === HR_ROLE) {
      if (
        !this.permissionCheckService.canHRManageJob(
          user as any,
          job.company?._id,
        )
      ) {
        throw new ForbiddenException('Can only delete jobs in your company');
      }
    }

    return this.jobsService.remove(id, user);
  }
}
