import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import bcrypt from 'bcryptjs';
@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  getHashPassword = (password: string) => {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    return hash;
  };

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
    return bcrypt.compareSync(password, hashPassword);
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

    return this.userModel.deleteOne({
      _id: id,
    });
  }
}
