import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { SubscribersService } from './subscribers.service';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';
import {
  ResponseMessage,
  SkipCheckPermission,
  User,
} from 'src/auth/decorator/customize';
import type { IUser } from 'src/users/users.interface';

@Controller('subscribers')
export class SubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Post()
  @ResponseMessage('create subscribers')
  @SkipCheckPermission()
  create(
    @Body() createSubscriberDto: CreateSubscriberDto,
    @User() user: IUser,
  ) {
    return this.subscribersService.create(createSubscriberDto, user);
  }

  @Get()
  @ResponseMessage('fetch subscribers with pagination ')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.subscribersService.findAll(+currentPage, +limit, qs);
  }

  @Get(':id')
  @SkipCheckPermission()
  @ResponseMessage('fetch subscribers by id ')
  findOne(@Param('id') id: string) {
    return this.subscribersService.findOne(id);
  }

  @Patch('')
  @SkipCheckPermission()
  @ResponseMessage('update subscribers by email')
  update(
    @Body() updateSubscriberDto: UpdateSubscriberDto,
    @User() user: IUser,
  ) {
    return this.subscribersService.updateSub(updateSubscriberDto, user);
  }

  @Delete(':id')
  @SkipCheckPermission()
  @ResponseMessage('delete subscribers by id ')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.subscribersService.remove(id, user);
  }
}
