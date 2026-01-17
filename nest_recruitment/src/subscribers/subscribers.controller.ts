import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { SubscribersService } from './subscribers.service';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';
import { ResponseMessage, User } from 'src/auth/decorator/customize';
import type { IUser } from 'src/users/users.interface';
import { ApiTags } from '@nestjs/swagger';
import {
  CanCreate,
  CanRead,
  CanUpdate,
  CanDelete,
} from 'src/casl/decorators/check-ability.decorator';
import { PermissionCheckService } from 'src/casl/services/permission-check.service';
import { Subscriber, SubscriberDocument } from './schemas/subscriber.schema';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';

@ApiTags('subscribers')
@Controller('subscribers')
export class SubscribersController {
  constructor(
    private readonly subscribersService: SubscribersService,
    @InjectModel(Subscriber.name)
    private readonly subscriberModel: SoftDeleteModel<SubscriberDocument>,
    private readonly permissionCheckService: PermissionCheckService,
  ) {}

  @Post()
  @CanCreate('Subscriber')
  @ResponseMessage('create subscriber')
  create(
    @Body() createSubscriberDto: CreateSubscriberDto,
    @User() user: IUser,
  ) {
    return this.subscribersService.create(createSubscriberDto, user);
  }

  @Get()
  @CanRead('Subscriber')
  @ResponseMessage('fetch subscribers with pagination')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
    @User() user?: IUser,
  ) {
    // USER: Only get their own subscribers
    return this.subscribersService.findAll(+currentPage, +limit, qs, user);
  }

  @Get(':id')
  @CanRead('Subscriber')
  @ResponseMessage('fetch subscriber by id')
  async findOne(@Param('id') id: string, @User() user?: IUser) {
    const subscriber = (await this.subscribersService.findOneWithPermission(
      id,
      user,
    )) as Subscriber;
    if (!subscriber) {
      throw new ForbiddenException(
        'Subscriber not found or you do not have access',
      );
    }
    return subscriber;
  }

  @Patch(':id')
  @CanUpdate('Subscriber')
  @ResponseMessage('update subscriber')
  async update(
    @Param('id') id: string,
    @Body() updateSubscriberDto: UpdateSubscriberDto,
    @User() user: IUser,
  ) {
    const subscriber = (await this.subscriberModel.findById(
      id,
    )) as SubscriberDocument;
    if (!subscriber) {
      throw new ForbiddenException('Subscriber not found');
    }

    // USER: Check ownership
    if (
      !this.permissionCheckService.canUserManageSubscriber(
        user.email,
        subscriber.email,
      )
    ) {
      throw new ForbiddenException('Can only update your own subscribers');
    }

    return this.subscribersService.update(id, updateSubscriberDto, user);
  }

  @Delete(':id')
  @CanDelete('Subscriber')
  @ResponseMessage('delete subscriber')
  async remove(@Param('id') id: string, @User() user: IUser) {
    const subscriber = (await this.subscriberModel.findById(
      id,
    )) as SubscriberDocument;
    if (!subscriber) {
      throw new ForbiddenException('Subscriber not found');
    }

    // USER: Check ownership
    if (
      !this.permissionCheckService.canUserManageSubscriber(
        user.email,
        subscriber.email,
      )
    ) {
      throw new ForbiddenException('Can only delete your own subscribers');
    }

    return this.subscribersService.remove(id, user);
  }
}
