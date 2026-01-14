import { Injectable } from '@nestjs/common';
import { Permission, PermissionDocument } from './schemas/permission.schema';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import { BaseService } from 'src/common/service/base.service';

@Injectable()
export class PermissionsService extends BaseService<PermissionDocument> {
  constructor(
    @InjectModel(Permission.name)
    private permissionModel: SoftDeleteModel<PermissionDocument>,
  ) {
    super(permissionModel);
  }
}
