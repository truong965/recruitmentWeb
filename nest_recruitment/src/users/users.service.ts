import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CreateUserDto, RegisterUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';

import { User as UserM, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcryptjs';
import type { SoftDeleteModel } from 'mongoose-delete';
import type { IUser } from './users.interface';
import { BaseService } from 'src/common/service/base.service';
import { Role, RoleDocument } from 'src/roles/schemas/role.schema';
import { SUPER_ADMIN, USER_ROLE, HR_ROLE } from 'src/casl/casl-ability.factory';
import { PermissionCheckService } from 'src/casl/services/permission-check.service';

@Injectable()
export class UsersService extends BaseService<UserDocument> {
  constructor(
    @InjectModel(UserM.name) private userModel: SoftDeleteModel<UserDocument>,
    @InjectModel(Role.name) private roleModel: SoftDeleteModel<RoleDocument>,
    private permissionCheckService: PermissionCheckService,
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
    const userRole = await this.roleModel.findOne({ name: USER_ROLE });
    const user = await this.userModel.create({
      name: registerUserDto.name,
      email: registerUserDto.email,
      password: hashPassword,
      age: +registerUserDto.age,
      gender: registerUserDto.gender,
      address: registerUserDto.address,
      role: userRole?._id,
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
      role: createUserDto.role || SUPER_ADMIN,
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
      .populate({ path: 'role', select: { name: 1 } });
  }
  async findOne(id: string, iUser?: IUser) {
    if (iUser?.role.name === USER_ROLE || iUser?.role.name === HR_ROLE) {
      if (!this.permissionCheckService.isOwner(iUser._id, id)) {
        throw new ForbiddenException('Cannot see other user account');
      }
    }
    return await this.userModel
      .findById(id)
      .populate({ path: 'role', select: { name: 1, _id: 1 } });
  }

  /**
   * Override findAll to add role-based filtering
   * HR: See only users in their company
   * USER: See only their own profile
   * SUPER_ADMIN: See all users
   */
  async findAll(page: number, limit: number, qs: string, iUser?: IUser) {
    // Build filter override based on user role
    let filterOverride = {};

    if (iUser?.role.name === HR_ROLE && iUser?.company?._id) {
      // HR can only see users in their company
      filterOverride = { 'company._id': iUser.company._id };
    } else if (iUser?.role.name === USER_ROLE) {
      // USER can only see their own profile
      filterOverride = { _id: iUser._id };
    }
    // SUPER_ADMIN sees all users (no filter)

    return super.findAll(page, limit, qs, filterOverride);
  }
  isValidPassword(password: string, hashPassword: string) {
    if (!hashPassword) return false;
    const result = bcrypt.compareSync(password, hashPassword);
    return result;
  }

  async updateUser(updateUserDto: UpdateUserDto, iUser: IUser) {
    // Get target user to verify permissions
    const targetUser = await this.userModel.findById(updateUserDto._id);
    if (!targetUser) {
      throw new BadRequestException('User not found');
    }

    // Check permission based on role
    if (iUser.role.name === USER_ROLE || iUser.role.name === HR_ROLE) {
      // USER and HR can only update their own profile
      if (
        !this.permissionCheckService.canUserUpdateProfile(
          iUser._id,
          updateUserDto._id,
        )
      ) {
        throw new ForbiddenException('Cannot update other user profile');
      }
    }

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
    const user = await this.userModel
      .findOne({
        refreshToken,
      })
      .populate({ path: 'role', select: { name: 1 } });
    return user;
  }

  /**
   * Delete a user account
   * USER can only delete their own account
   * SUPER_ADMIN can delete any account
   */
  async remove(id: string, iUser: IUser) {
    // Check permission
    if (iUser.role.name === USER_ROLE) {
      // USER can only delete their own account
      if (!this.permissionCheckService.canUserDeleteAccount(iUser._id, id)) {
        throw new ForbiddenException('Cannot delete other user account');
      }
    }

    return super.remove(id, iUser);
  }
}
