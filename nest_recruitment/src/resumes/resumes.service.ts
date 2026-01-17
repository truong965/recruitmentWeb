import { Injectable } from '@nestjs/common';
import { CreateResumeDto } from './dto/create-resume.dto';
import { ResumeStatus, UpdateResumeDto } from './dto/update-resume.dto';
import { Resume, ResumeDocument } from './schemas/resume.schema';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import type { IUser } from 'src/users/users.interface';
import { BaseService } from 'src/common/service/base.service';
import { Job, JobDocument } from 'src/jobs/schemas/job.schema';
import { FilterQuery, UpdateQuery } from 'mongoose';
import aqp from 'api-query-params';
import { HR_ROLE, USER_ROLE } from 'src/casl/casl-ability.factory';

@Injectable()
export class ResumesService extends BaseService<ResumeDocument> {
  constructor(
    @InjectModel(Resume.name)
    private resumeModel: SoftDeleteModel<ResumeDocument>,
    @InjectModel(Job.name)
    private jobModel: SoftDeleteModel<JobDocument>,
  ) {
    super(resumeModel);
  }
  async create(createResumeDto: CreateResumeDto, user: IUser) {
    const res = await this.resumeModel.create({
      ...createResumeDto,
      email: user.email,
      userId: user._id,
      status: ResumeStatus.PENDING,
      history: [
        {
          status: ResumeStatus.PENDING,
          updatedAt: new Date(),
          updatedBy: {
            _id: user._id,
            email: user.email,
          },
        },
      ],
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });
    return { _id: res._id, createdAt: res.createdAt };
  }
  /**
   * Update resume - handles both HR status update and USER data update
   * This is a generic update that controller will use for both cases
   */
  async update(id: string, updateResumeDto: UpdateResumeDto, user: IUser) {
    const resume = await this.resumeModel.findById(id);
    if (!resume) return 'not found';

    const updateData: UpdateQuery<ResumeDocument> = {
      updatedBy: {
        _id: user._id,
        email: user.email,
      },
    };

    // If status is being updated, push to history
    if (
      updateResumeDto.status &&
      updateResumeDto.status.toString() !== resume.status
    ) {
      updateData.status = updateResumeDto.status;
      updateData.$push = {
        history: {
          status: updateResumeDto.status,
          updatedAt: new Date(),
          updatedBy: {
            _id: user._id,
            email: user.email,
          },
        },
      };
    } else {
      // If updating data fields (email, url), don't touch status
      if (updateResumeDto.email) updateData.email = updateResumeDto.email;
      if (updateResumeDto.url) updateData.url = updateResumeDto.url;
    }

    return await this.resumeModel.updateOne({ _id: id }, updateData);
  }

  /**
   * Specific method for HR to update resume status
   * Status: PENDING → REVIEWING → APPROVED/REJECTED
   */
  async updateStatus(id: string, newStatus: string, user: IUser) {
    const resume = await this.resumeModel.findById(id);
    if (!resume) return 'not found';

    return await this.resumeModel.updateOne(
      { _id: id },
      {
        $set: {
          status: newStatus,
          updatedBy: {
            _id: user._id,
            email: user.email,
          },
        },
        $push: {
          history: {
            status: newStatus,
            updatedAt: new Date(),
            updatedBy: {
              _id: user._id,
              email: user.email,
            },
          },
        },
      },
    );
  }

  /**
   * Specific method for USER to update resume data
   * Only email and url can be updated, and only if status is PENDING
   */
  async updateResumeData(
    id: string,
    updateResumeDto: UpdateResumeDto,
    user: IUser,
  ) {
    const resume = await this.resumeModel.findById(id);
    if (!resume) return 'not found';

    const updateData: UpdateQuery<ResumeDocument> = {
      updatedBy: {
        _id: user._id,
        email: user.email,
      },
    };

    if (updateResumeDto.email) updateData.email = updateResumeDto.email;
    if (updateResumeDto.url) updateData.url = updateResumeDto.url;

    return await this.resumeModel.updateOne({ _id: id }, updateData);
  }
  async fetchByUser(user: IUser) {
    return await this.resumeModel
      .find({ userId: user._id })
      .sort('-createdAt')
      .populate([
        {
          path: 'companyId',
          select: { name: 1 },
        },
        {
          path: 'jobId',
          select: { name: 1 },
        },
      ]);
  }

  /**
   * Find all resumes with filtering
   * HR: Get resumes from jobs in their company
   * USER: Get only their own resumes
   */
  async findAll(currentPage: number, limit: number, qs: string, user?: IUser) {
    const { filter, sort, projection } = aqp(qs);

    delete filter.current;
    delete filter.pageSize;

    let filterOverride: FilterQuery<ResumeDocument> = {};

    // If HR: filter by jobs in their company
    if (user?.role?.name === HR_ROLE && user?.company?._id) {
      // Get all jobs from HR's company
      const jobs = await this.jobModel.find(
        { 'company._id': user.company._id },
        { _id: 1 },
      );
      const jobIds = jobs.map((job) => job._id);
      filterOverride = { jobId: { $in: jobIds } };
    }
    // If USER: filter by their own resumes
    else if (user?.role?.name === USER_ROLE) {
      filterOverride = { userId: user._id };
    }

    const combinedFilter = { ...filter, ...filterOverride };
    const defaultLimit = +limit ? +limit : 10;
    const offset = (currentPage - 1) * defaultLimit;

    const totalItems = (await this.resumeModel.find(combinedFilter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.resumeModel
      .find(combinedFilter)
      .limit(defaultLimit)
      .skip(offset)
      .sort(sort as any)
      .populate([
        {
          path: 'companyId',
          select: { name: 1 },
        },
        {
          path: 'jobId',
          select: { name: 1 },
        },
      ])
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
   * Find one resume with filtering and full populate
   * HR: Can view resumes from jobs in their company
   * USER: Can only view their own resumes
   */
  async findOneWithPermission(id: string, user?: IUser) {
    const resume = await this.resumeModel.findById(id).populate([
      {
        path: 'companyId',
        select: { name: 1, address: 1, logo: 1, description: 1 },
      },
      {
        path: 'jobId',
        select: {
          name: 1,
          skills: 1,
          salary: 1,
          location: 1,
          level: 1,
          company: 1,
        },
      },
    ]);

    if (!resume) return null;

    // Permission check
    if (user?.role?.name === HR_ROLE && user?.company?._id) {
      // Get job to verify it belongs to HR's company
      const job = await this.jobModel.findById(resume.jobId);
      if (!job || job.company._id.toString() !== user.company._id.toString()) {
        return null; // HR cannot access this resume
      }
    } else if (user?.role?.name === USER_ROLE) {
      // USER can only view their own
      if (resume.userId.toString() !== user._id.toString()) {
        return null;
      }
    }

    return resume;
  }
}
