import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/service/base.service';
import { Role, RoleDocument } from './schemas/role.schema';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import mongoose from 'mongoose';
import { IUser } from 'src/users/users.interface';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ADMIN_ROLE } from 'src/databases/sample';
import { JwtStrategy } from 'src/auth/passport/jwt.strategy';

@Injectable()
export class RolesService extends BaseService<RoleDocument> {
  constructor(
    @InjectModel(Role.name)
    private roleModel: SoftDeleteModel<RoleDocument>,
    private jwtStrategy: JwtStrategy,
  ) {
    super(roleModel);
  }

  async create(createRoleDto: CreateRoleDto, user: IUser) {
    // Check trùng name
    const isExist = await this.roleModel.findOne({ name: createRoleDto.name });
    if (isExist) {
      throw new BadRequestException(
        `Role với tên "${createRoleDto.name}" đã tồn tại!`,
      );
    }
    // Nếu chưa có thì mới tạo
    return super.create(createRoleDto, user);
  }

  async update(id: string, updateRoleDto: UpdateRoleDto, user: IUser) {
    // Check trùng name
    const isExist = await this.roleModel.findOne({
      name: updateRoleDto.name,
      _id: { $ne: id },
    });
    if (isExist) {
      throw new BadRequestException(
        `Role với tên "${updateRoleDto.name}" đã tồn tại!`,
      );
    }
    // Clear cache sau khi update permissions
    this.jwtStrategy.clearCache(id);
    // Nếu chưa có thì mới tạo
    return super.update(id, updateRoleDto, user);
  }
  async findOne(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('not found role');
    }
    return await this.roleModel.findById(id).populate({
      path: 'permissions',
      select: { _id: 1, apiPath: 1, name: 1, method: 1, module: 1 },
    });
  }
  async remove(id: string, user: IUser) {
    const role = await this.roleModel.findById(id);
    if (role?.name === ADMIN_ROLE) {
      throw new BadRequestException(`can't delete admin role`);
    }
    if (!mongoose.Types.ObjectId.isValid(id)) return 'not found';
    // Clear cache
    this.jwtStrategy.clearCache(id);

    await this.roleModel.updateOne({ _id: id }, { isActive: false });
    return this.roleModel.delete(
      { _id: id },
      {
        _id: user._id,
        email: user.email,
      },
    );
  }
}
