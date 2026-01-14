import { Injectable } from '@nestjs/common';
import { CreateResumeDto } from './dto/create-resume.dto';
import { ResumeStatus, UpdateResumeDto } from './dto/update-resume.dto';
import { Resume, ResumeDocument } from './schemas/resume.schema';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import type { IUser } from 'src/users/users.interface';
import aqp from 'api-query-params';
import mongoose from 'mongoose';

@Injectable()
export class ResumesService {
  constructor(
    @InjectModel(Resume.name)
    private resumeModel: SoftDeleteModel<ResumeDocument>,
  ) {}
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

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population, projection } = aqp(qs);

    delete filter.current;
    delete filter.pageSize;

    const defaultLimit = +limit ? +limit : 10;
    const offset = (currentPage - 1) * defaultLimit;

    const totalItems = (await this.resumeModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.resumeModel
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

  async findOne(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'not found';
    return await this.resumeModel.findById({
      _id: id,
    });
  }

  async update(id: string, updateResumeDto: UpdateResumeDto, user: IUser) {
    const company = await this.resumeModel.updateOne(
      {
        _id: id,
      },
      {
        status: updateResumeDto.status,
        $push: {
          history: {
            status: updateResumeDto.status, // Lấy status từ DTO gửi lên
            updatedAt: new Date(),
            updatedBy: {
              _id: user._id,
              email: user.email,
            },
          },
        },
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
    return company;
  }

  remove(id: string, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'not found';
    return this.resumeModel.delete(
      {
        _id: id,
      },
      {
        _id: user._id,
        email: user.email,
      },
    );
  }
  async fetchByUser(user: IUser) {
    return await this.resumeModel.find({ userId: user._id });
  }
}
