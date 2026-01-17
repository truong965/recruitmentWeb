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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserAdminDto } from './dto/update-user.dto';
import type { IUser } from './users.interface';
import { ResponseMessage, User } from 'src/auth/decorator/customize';
import { ApiTags } from '@nestjs/swagger';
import {
  CanCreate,
  CanRead,
  CanUpdate,
  CanDelete,
} from 'src/casl/decorators/check-ability.decorator';
import { SUPER_ADMIN } from 'src/casl/casl-ability.factory';
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // // SUPER_ADMIN Can create users
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
    @User() user: IUser,
  ) {
    return this.usersService.findAll(+currentPage, +limit, qs, user);
  }

  @ResponseMessage('fetch user by id')
  @Get(':id')
  async findOne(@Param('id') id: string, @User() user: IUser) {
    return this.usersService.findOne(id, user);
  }

  @Patch('admin-update')
  @CanUpdate('User')
  @ResponseMessage('Update User by Admin')
  updateByAdmin(@Body() body: UpdateUserAdminDto, @User() user: IUser) {
    // Chỉ Admin mới gọi được API này
    if (user.role.name !== SUPER_ADMIN) {
      throw new ForbiddenException(
        'Chỉ Admin mới có quyền truy cập endpoint này',
      );
    }
    return this.usersService.updateUser(body, user);
  }

  @Patch()
  @CanUpdate('User')
  @ResponseMessage('Update a User')
  update(@Body() body: UpdateUserDto, @User() user: IUser) {
    return this.usersService.updateUser(body, user);
  }

  @Delete(':id')
  @CanDelete('User')
  @ResponseMessage('Delete a User')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.usersService.remove(id, user);
  }
}
