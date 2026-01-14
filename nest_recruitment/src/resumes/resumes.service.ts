import { Injectable } from '@nestjs/common';
import { CreateResumeDto } from './dto/create-resume.dto';
import { ResumeStatus, UpdateResumeDto } from './dto/update-resume.dto';
import { Resume, ResumeDocument } from './schemas/resume.schema';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import type { IUser } from 'src/users/users.interface';
import { BaseService } from 'src/common/service/base.service';

@Injectable()
export class ResumesService extends BaseService<ResumeDocument> {
  constructor(
    @InjectModel(Resume.name)
    private resumeModel: SoftDeleteModel<ResumeDocument>,
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
  async fetchByUser(user: IUser) {
    return await this.resumeModel.find({ userId: user._id });
  }
}
