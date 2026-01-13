import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcryptjs';
import type { SoftDeleteModel } from 'mongoose-delete';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: SoftDeleteModel<UserDocument>,
  ) {}

  getHashPassword = (password: string) => {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    return hash;
  };

  // Thêm log vào hàm create trong users.service.ts
  async create(createUserDto: CreateUserDto) {
    const hashPassword = this.getHashPassword(createUserDto.password);
    const user = await this.userModel.create({
      email: createUserDto.email,
      password: hashPassword,
      name: createUserDto.name,
    });
    return user;
  }

  findAll() {
    return 'a';
  }

  async findOne(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'not found';

    return await this.userModel.findById({
      _id: id,
    });
  }

  async findOneByUserName(username: string) {
    return await this.userModel.findOne({
      email: username,
    });
  }

  isValidPassword(password: string, hashPassword: string) {
    if (!hashPassword) return false;
    const result = bcrypt.compareSync(password, hashPassword);
    return result;
  }

  async update(updateUserDto: UpdateUserDto) {
    const user = await this.userModel.updateOne(
      {
        _id: updateUserDto._id,
      },
      { ...updateUserDto },
    );
    return user;
  }

  async remove(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'not found';

    return this.userModel.delete({
      _id: id,
    });
  }
}
