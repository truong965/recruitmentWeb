// src/common/service/security.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Document } from 'mongoose';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import type { IUser } from 'src/users/users.interface';
import type { Actions } from 'src/casl/decorators/check-ability.decorator';
import { BaseSchema } from '../schemas/base.schema';

@Injectable()
export class SecurityService {
  constructor(private caslAbilityFactory: CaslAbilityFactory) {}

  /**
   * Hàm check quyền sở hữu chung cho mọi Model
   * @param model Model Mongoose (Company, Job, Resume...)
   * @param id ID của bản ghi cần check
   * @param user User đang thực hiện request
   * @param action Hành động muốn check (update, delete, read...)
   * @returns Document đã tìm thấy (để tái sử dụng)
   */
  async verifyOwnership<T extends Document>(
    model: SoftDeleteModel<T>,
    id: string,
    user: IUser,
    action: Actions = 'update',
  ): Promise<T> {
    // 1. Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    // 2. Tìm bản ghi trong DB
    const doc = await model.findById(id);
    if (!doc) {
      throw new NotFoundException('Không tìm thấy dữ liệu');
    }

    // 3. Tạo Ability cho user
    const ability = this.caslAbilityFactory.createForUser(user as any);

    // 4. Check quyền - Convert doc to plain object để CASL có thể check
    const plainDoc = doc.toObject() as unknown as BaseSchema;

    // CASL cần biết subject type, ta dùng constructor name
    const subjectType = doc.constructor.name;

    // Check với subject string thay vì document instance
    if (!ability.can(action, subjectType as any)) {
      // Nếu action không được phép trên subject type, check ownership
      if (plainDoc.createdBy?._id) {
        const createdById = plainDoc.createdBy._id.toString();
        const userId = user._id.toString();

        if (createdById !== userId) {
          throw new ForbiddenException(
            `Bạn không có quyền ${action} tài nguyên này (Ownership check)`,
          );
        }
      } else {
        throw new ForbiddenException(
          `Bạn không có quyền ${action} tài nguyên này`,
        );
      }
    }

    // 5. Trả về doc để Controller dùng tiếp
    return doc;
  }
}
