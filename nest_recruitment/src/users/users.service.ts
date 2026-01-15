import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto, RegisterUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';

import { User as UserM, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcryptjs';
import type { SoftDeleteModel } from 'mongoose-delete';
import type { IUser } from './users.interface';
import { BaseService } from 'src/common/service/base.service';
import { permission } from 'process';

@Injectable()
export class UsersService extends BaseService<UserDocument> {
  constructor(
    @InjectModel(UserM.name) private userModel: SoftDeleteModel<UserDocument>,
  ) {
    super(userModel);
  }

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

  async registerByCompany(createUserDto: CreateUserDto, iUser: IUser) {
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

  async findOneByUserName(username: string) {
    return await this.userModel
      .findOne({
        email: username,
      })
      .select('+password')
      .populate({ path: 'role', select: { name: 1, permission: 1 } });
  }
  async findOne(id: string) {
    return await this.userModel
      .findById(id)
      .populate({ path: 'role', select: { name: 1, _id: 1 } });
  }
  isValidPassword(password: string, hashPassword: string) {
    if (!hashPassword) return false;
    const result = bcrypt.compareSync(password, hashPassword);
    return result;
  }

  async updateUser(updateUserDto: UpdateUserDto, iUser: IUser) {
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
  async updateUserToken(refreshToken: string, _id: string) {
    const user = await this.userModel.updateOne(
      {
        _id,
      },
      {
        refreshToken,
      },
    );
    return user;
  }
  async findUserByToken(refreshToken: string) {
    const user = await this.userModel.findOne({
      refreshToken,
    });
    return user;
  }
}
