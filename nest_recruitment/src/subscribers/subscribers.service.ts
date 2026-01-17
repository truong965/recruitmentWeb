import { BadRequestException, Injectable } from '@nestjs/common';
import { Subscriber, SubscriberDocument } from './schemas/subscriber.schema';
import { BaseService } from 'src/common/service/base.service';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { IUser } from 'src/users/users.interface';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';
import { FilterQuery } from 'mongoose';
import aqp from 'api-query-params';
import { USER_ROLE } from 'src/casl/casl-ability.factory';

@Injectable()
export class SubscribersService extends BaseService<SubscriberDocument> {
  constructor(
    @InjectModel(Subscriber.name)
    private subscriberModel: SoftDeleteModel<SubscriberDocument>,
  ) {
    super(subscriberModel);
  }
  async create(createSubscriberDto: CreateSubscriberDto, user: IUser) {
    // Check trùng email
    const isExist = await this.subscriberModel.findOne({
      email: createSubscriberDto.email,
    });
    if (isExist) {
      throw new BadRequestException(
        `Email = "${createSubscriberDto.email}" đã tồn tại!`,
      );
    }
    // Nếu chưa có thì mới tạo
    return super.create(createSubscriberDto, user);
  }

  async updateSub(updateSubscriberDto: UpdateSubscriberDto, user: IUser) {
    const sub = await this.subscriberModel.updateOne(
      {
        email: user.email,
      },
      {
        ...updateSubscriberDto,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
      { upsert: true },
    );
    return sub;
  }

  /**
   * Find all subscribers with filtering
   * USER: Only get their own subscribers
   */
  async findAll(currentPage: number, limit: number, qs: string, user?: IUser) {
    const { filter, sort, projection } = aqp(qs);

    delete filter.current;
    delete filter.pageSize;

    let filterOverride: FilterQuery<SubscriberDocument> = {};

    // If USER: filter by their own subscribers
    if (user?.role?.name === 'USER') {
      filterOverride = { userId: user._id };
    }

    const combinedFilter = { ...filter, ...filterOverride };
    const defaultLimit = +limit ? +limit : 10;
    const offset = (currentPage - 1) * defaultLimit;

    const totalItems = (await this.subscriberModel.find(combinedFilter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.subscriberModel
      .find(combinedFilter)
      .limit(defaultLimit)
      .skip(offset)
      .sort(sort as any)
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

  /**
   * Find one subscriber with permission check
   * USER: Can only view their own subscribers
   */
  async findOneWithPermission(id: string, user?: IUser) {
    const subscriber = await this.subscriberModel.findById(id);

    if (!subscriber) return null;

    // Permission check
    if (user?.role?.name === USER_ROLE) {
      // USER can only view their own
      if (subscriber.email !== user.email) {
        return null;
      }
    }

    return subscriber;
  }
}
