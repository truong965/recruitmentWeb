import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ResponseMessage, User } from 'src/auth/decorator/customize';
import type { IUser } from 'src/users/users.interface';
import { ApiTags } from '@nestjs/swagger';
import {
  CanCreate,
  CanDelete,
  CanRead,
  CanUpdate,
} from 'src/casl/decorators/check-ability.decorator';
import mongoose from 'mongoose';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @CanCreate('Role')
  @ResponseMessage('create roles')
  create(@Body() createRoleDto: CreateRoleDto, @User() user: IUser) {
    return this.rolesService.create(createRoleDto, user);
  }

  @Get()
  @CanRead('Role')
  @ResponseMessage('fetch roles with pagination ')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.rolesService.findAll(+currentPage, +limit, qs);
  }

  @Get(':id')
  @CanRead('Role')
  @ResponseMessage('fetch roles by id ')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @CanUpdate('Role')
  @ResponseMessage('update roles by id ')
  update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @User() user: IUser,
  ) {
    return this.rolesService.update(id, updateRoleDto, user);
  }

  @Patch(':id/permissions')
  @CanUpdate('Role') // Tận dụng lại quyền Update Role
  @ResponseMessage('Add permissions to role')
  async addPermissions(
    @Param('id') id: string,
    @Body('permissions') permissions: string[],
    @User() user: IUser,
  ) {
    // Validate đơn giản đầu vào
    if (!permissions || !Array.isArray(permissions)) {
      throw new BadRequestException('Permissions phải là một mảng ID');
    }
    if (permissions.some((p) => !mongoose.Types.ObjectId.isValid(p))) {
      throw new BadRequestException('Tồn tại Permission ID không hợp lệ');
    }

    return this.rolesService.addPermissions(id, permissions, user);
  }

  @Delete(':id')
  @CanDelete('Role')
  @ResponseMessage('delete roles by id ')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.rolesService.remove(id, user);
  }
}
