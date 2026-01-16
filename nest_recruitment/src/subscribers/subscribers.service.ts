import { BadRequestException, Injectable } from '@nestjs/common';
import { Subscriber, SubscriberDocument } from './schemas/subscriber.schema';
import { BaseService } from 'src/common/service/base.service';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { IUser } from 'src/users/users.interface';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';

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
}
