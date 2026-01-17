import { Injectable } from '@nestjs/common';
import { Document, FilterQuery } from 'mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import aqp from 'api-query-params';
import mongoose from 'mongoose';
import { IUser } from 'src/users/users.interface';
import { BaseSchema } from '../schemas/base.schema';

@Injectable()
// vừa là Document, vừa có các thuộc tính của BaseSchema
export abstract class BaseService<T extends Document & BaseSchema> {
  constructor(private readonly model: SoftDeleteModel<T>) {}

  // 1. Create - Nhận DTO bất kỳ và User
  async create(createDto: Partial<T>, user: IUser) {
    const createdDoc = await this.model.create({
      ...createDto,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });
    return {
      _id: createdDoc._id,
      createdAt: createdDoc.createdAt,
    };
  }

  // 2. FindAll - Xử lý phân trang, sort, filter
  async findAll(
    currentPage: number,
    limit: number,
    qs: string,
    filterOverride?: FilterQuery<T>,
  ) {
    const { filter, sort, population, projection } = aqp(qs);

    delete filter.current;
    delete filter.pageSize;

    // [!code focus] Merge filter từ query string với filter ép buộc (ví dụ: filter theo companyId của HR)
    // filterOverride sẽ ghi đè hoặc gộp vào filter gốc
    const combinedFilter = { ...filter, ...filterOverride };

    const defaultLimit = +limit ? +limit : 10;
    const offset = (currentPage - 1) * defaultLimit;

    // [!code focus] Sử dụng combinedFilter thay vì filter
    const totalItems = (await this.model.find(combinedFilter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.model
      .find(combinedFilter) // [!code focus]
      .limit(defaultLimit)
      .skip(offset)
      .sort(sort as any)
      .populate(population)
      .select(projection)
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

  // 3. FindOne
  async findOne(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'not found';
    return await this.model.findById(id);
  }

  // 4. Update
  async update(id: string, updateDto: Partial<T>, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'not found';
    return await this.model.updateOne({ _id: id } as FilterQuery<T>, {
      ...updateDto,
      updatedBy: {
        _id: user._id,
        email: user.email,
      },
    });
  }

  // 5. Remove (Soft Delete)
  async remove(id: string, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'not found';
    return this.model.delete(
      { _id: id },
      {
        _id: user._id,
        email: user.email,
      },
    );
  }
}
