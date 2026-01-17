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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { IUser } from './users.interface';
import { Public, ResponseMessage, User } from 'src/auth/decorator/customize';
import { ApiTags } from '@nestjs/swagger';
import {
  CanCreate,
  CanRead,
  CanUpdate,
} from 'src/casl/decorators/check-ability.decorator';
import { SecurityService } from 'src/common/service/security.service';
import { InjectModel } from '@nestjs/mongoose';
import type { SoftDeleteModel } from 'mongoose-delete';
import { UserDocument } from './schemas/user.schema';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    // @InjectModel(User.name)
    // private readonly userModel: SoftDeleteModel<UserDocument>,
  ) {}

  // // SUPER_ADMIN & HR: Can create users
  // USER: Cannot create
  @Post()
  @CanCreate('User')
  @ResponseMessage('Create a new user')
  create(@Body() createUserDto: CreateUserDto, @User() user: IUser) {
    return this.usersService.registerByCompany(createUserDto, user);
  }

  @Get()
  @CanRead('User')
  @ResponseMessage('fetch users with pagination')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.usersService.findAll(+currentPage, +limit, qs);
  }

  @Public()
  @ResponseMessage('fetch user by id')
  @Get(':id')
  async findOne(@Param('id') id: string, @User() user: IUser) {
    // await this.securityService.verifyOwnership(
    //   this.userModel,
    //   id,
    //   user,
    //   'read',
    // );
    return this.usersService.findOne(id);
  }

  @Patch()
  @CanUpdate('User')
  @ResponseMessage('Update a User')
  update(@Body() updateUserDto: UpdateUserDto, @User() user: IUser) {
    return this.usersService.updateUser(updateUserDto, user);
  }

  @Delete(':id')
  @ResponseMessage('Delete a User')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.usersService.remove(id, user);
  }
}
