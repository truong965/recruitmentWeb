import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto, RegisterUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { User as UserM, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcryptjs';
import type { SoftDeleteModel } from 'mongoose-delete';
import type { IUser } from './users.interface';
import aqp from 'api-query-params';
import { User } from 'src/auth/decorator/customize';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(UserM.name) private userModel: SoftDeleteModel<UserDocument>,
  ) {}

  getHashPassword = (password: string) => {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    return hash;
  };

  // Thêm log vào hàm create trong users.service.ts
  async register(registerUserDto: RegisterUserDto) {
    const isExist = await this.userModel.findOne({
      email: registerUserDto.email,
    });
    if (isExist) {
      throw new BadRequestException('email is exist');
    }
    const hashPassword = this.getHashPassword(registerUserDto.password);
    const user = await this.userModel.create({
      name: registerUserDto.name,
      email: registerUserDto.email,
      password: hashPassword,
      age: +registerUserDto.age,
      gender: registerUserDto.gender,
      address: registerUserDto.address,
      role: 'USER',
    });
    return { _id: user._id, createdAt: user.createdAt };
  }

  async registerByCompany(createUserDto: CreateUserDto, @User() iUser: IUser) {
    const isExist = await this.userModel.findOne({
      email: createUserDto.email,
    });
    if (isExist) {
      throw new BadRequestException('email is exist');
    }
    const hashPassword = this.getHashPassword(createUserDto.password);
    const user = await this.userModel.create({
      name: createUserDto.name,
      email: createUserDto.email,
      password: hashPassword,
      age: +createUserDto.age,
      gender: createUserDto.gender,
      address: createUserDto.address,
      role: createUserDto.role || 'ADMIN',
      company: createUserDto.company,
      createdBy: {
        _id: iUser._id,
        email: iUser.email,
      },
    });
    return { _id: user._id, createdAt: user.createdAt };
  }
  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population } = aqp(qs);

    delete filter.page;
    delete filter.limit;

    const defaultLimit = +limit ? +limit : 10;
    const offset = (currentPage - 1) * defaultLimit;

    const totalItems = (await this.userModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.userModel
      .find(filter)
      .limit(defaultLimit)
      .skip(offset)
      .sort(sort as any)
      .populate(population)
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

    return await this.userModel.findById({
      _id: id,
    });
  }

  async findOneByUserName(username: string) {
    return await this.userModel
      .findOne({
        email: username,
      })
      .select('+password');
  }

  isValidPassword(password: string, hashPassword: string) {
    if (!hashPassword) return false;
    const result = bcrypt.compareSync(password, hashPassword);
    return result;
  }

  async update(updateUserDto: UpdateUserDto, @User() iUser: IUser) {
    const user = await this.userModel.updateOne(
      {
        _id: updateUserDto._id,
      },
      {
        ...updateUserDto,
        updatedBy: {
          _id: iUser._id,
          email: iUser.email,
        },
      },
    );
    return user;
  }

  async remove(id: string, @User() user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'not found';

    return this.userModel.delete(
      {
        _id: id,
      },
      {
        _id: user._id,
        email: user.email,
      },
    );
  }
}
