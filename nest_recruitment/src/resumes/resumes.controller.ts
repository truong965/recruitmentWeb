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
import { ResumesService } from './resumes.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { ResponseMessage, User } from 'src/auth/decorator/customize';
import type { IUser } from 'src/users/users.interface';
import { ApiTags } from '@nestjs/swagger';
import {
  CanCreate,
  CanRead,
  CanUpdate,
  CanDelete,
} from 'src/casl/decorators/check-ability.decorator';
import { PermissionCheckService } from 'src/casl/services/permission-check.service';
import { Resume, ResumeDocument } from './schemas/resume.schema';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import { Job, JobDocument } from 'src/jobs/schemas/job.schema';
import { HR_ROLE, USER_ROLE } from 'src/casl/casl-ability.factory';

@ApiTags('resumes')
@Controller('resumes')
export class ResumesController {
  constructor(
    private readonly resumesService: ResumesService,
    @InjectModel(Resume.name)
    private readonly resumeModel: SoftDeleteModel<ResumeDocument>,
    @InjectModel(Job.name)
    private readonly jobModel: SoftDeleteModel<JobDocument>,
    private readonly permissionCheckService: PermissionCheckService,
  ) {}

  @Post()
  @CanCreate('Resume')
  @ResponseMessage('create resume')
  create(@Body() createResumeDto: CreateResumeDto, @User() user: IUser) {
    return this.resumesService.create(createResumeDto, user);
  }

  @Get()
  @CanRead('Resume')
  @ResponseMessage('fetch resumes with pagination')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
    @User() user?: IUser,
  ) {
    // HR: Get resumes from jobs in their company
    // USER: Only get their own resumes
    return this.resumesService.findAll(+currentPage, +limit, qs, user);
  }

  @Get(':id')
  @CanRead('Resume')
  @ResponseMessage('fetch resume by id')
  async findOne(@Param('id') id: string, @User() user?: IUser) {
    const resume = await this.resumesService.findOneWithPermission(id, user);
    if (!resume) {
      throw new ForbiddenException(
        'Resume not found or you do not have access',
      );
    }
    return resume;
  }

  /**
   * Update resume - handles both HR status update and USER data update
   * HR can update status (PENDING → REVIEWING → APPROVED/REJECTED)
   * USER can update data (email, url) only if status is PENDING
   */
  @Patch(':id')
  @CanUpdate('Resume')
  @ResponseMessage('update resume')
  async update(
    @Param('id') id: string,
    @Body() updateResumeDto: UpdateResumeDto,
    @User() user: IUser,
  ) {
    const resume = (await this.resumesService.findOne(id)) as Resume;
    if (!resume) {
      throw new ForbiddenException('Resume not found');
    }

    // HR: Can update status
    if (user.role.name === HR_ROLE) {
      if (updateResumeDto.status) {
        // HR updating status - get job to verify company
        const job = (await this.jobModel.findById(resume.jobId)) as JobDocument;
        if (
          !this.permissionCheckService.canHRUpdateResumeStatus(
            user as any,
            job?.company?._id,
          )
        ) {
          throw new ForbiddenException(
            'Can only update resumes for jobs in your company',
          );
        }
        return this.resumesService.updateStatus(
          id,
          updateResumeDto.status,
          user,
        );
      }
    }

    // USER: Can only update data if owner and status is PENDING
    if (user.role.name === USER_ROLE) {
      if (
        !this.permissionCheckService.canUserUpdateResumeData(
          user._id,
          resume.userId,
          resume.status,
        )
      ) {
        throw new ForbiddenException(
          'Can only update own resume data and only when status is PENDING',
        );
      }
      return this.resumesService.updateResumeData(id, updateResumeDto, user);
    }

    // Generic update fallback
    return this.resumesService.update(id, updateResumeDto, user);
  }

  /**
   * Delete resume - only USER can delete and only if status is PENDING
   */
  @Delete(':id')
  @CanDelete('Resume')
  @ResponseMessage('delete resume')
  async remove(@Param('id') id: string, @User() user: IUser) {
    const resume = (await this.resumesService.findOne(id)) as Resume;
    if (!resume) {
      throw new ForbiddenException('Resume not found');
    }

    // USER: Check ownership and status
    if (
      !this.permissionCheckService.canUserDeleteResume(
        user._id,
        resume.userId,
        resume.status,
      )
    ) {
      throw new ForbiddenException(
        'Can only delete own resume and only when status is PENDING',
      );
    }

    return this.resumesService.remove(id, user);
  }

  @Post('by-user')
  fetchByUser(@User() user: IUser) {
    return this.resumesService.fetchByUser(user);
  }
}
