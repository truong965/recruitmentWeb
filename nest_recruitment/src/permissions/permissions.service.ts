import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Permission, PermissionDocument } from './schemas/permission.schema';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import { BaseService } from 'src/common/service/base.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import type { IUser } from 'src/users/users.interface';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class PermissionsService extends BaseService<PermissionDocument> {
  constructor(
    @InjectModel(Permission.name)
    private permissionModel: SoftDeleteModel<PermissionDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super(permissionModel);
  }

  checkPermissionWithApiPathAndMethod = async (
    apiPath: string,
    method: string,
    excludeId?: string,
  ) => {
    const isExist = await this.permissionModel.findOne({
      apiPath,
      method,
      // _id KHÁC excludeId
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });

    if (isExist) {
      throw new BadRequestException(
        `Permission with apiPath=${apiPath}, method=${method} already exists!`,
      );
    }
  };
  async create(createPermissionDto: CreatePermissionDto, user: IUser) {
    await this.checkPermissionWithApiPathAndMethod(
      createPermissionDto.apiPath,
      createPermissionDto.method,
    );

    return super.create(createPermissionDto, user);
  }
  async update(
    id: string,
    updatePermissionDto: UpdatePermissionDto,
    user: IUser,
  ) {
    // check thay doi apiPath hay method
    if (updatePermissionDto.apiPath || updatePermissionDto.method) {
      // Lấy dữ liệu hiện tại trong DB để bù vào phần thiếu
      // (Vì DTO là Partial, maybe user chỉ gửi apiPath mà ko gửi method)
      const existingPermission = await this.permissionModel.findById(id);
      if (!existingPermission)
        throw new BadRequestException('Permission not found');
      // Merge data
      const newApiPath =
        updatePermissionDto.apiPath ?? existingPermission.apiPath;
      const newMethod = updatePermissionDto.method ?? existingPermission.method;
      //Check trùng
      await this.checkPermissionWithApiPathAndMethod(newApiPath, newMethod, id);
    }
    return super.update(id, updatePermissionDto, user);
  }
  private getKey(roleId: string): string {
    return `permissions:${roleId}`;
  }

  async getPermissions(roleId: string): Promise<any[] | null | undefined> {
    return await this.cacheManager.get(this.getKey(roleId));
  }

  async setPermissions(roleId: string, permissions: any[]) {
    await this.cacheManager.set(this.getKey(roleId), permissions);
  }

  async clearCache(roleId: string) {
    await this.cacheManager.del(this.getKey(roleId));
  }
}
