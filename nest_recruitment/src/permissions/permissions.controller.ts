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
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { ResponseMessage, User } from 'src/auth/decorator/customize';
import type { IUser } from 'src/users/users.interface';
import { ApiTags } from '@nestjs/swagger';
import {
  CanCreate,
  CanDelete,
  CanRead,
  CanUpdate,
} from 'src/casl/decorators/check-ability.decorator';

@ApiTags('permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @CanCreate('Permission')
  @ResponseMessage('create permission')
  create(
    @Body() createPermissionDto: CreatePermissionDto,
    @User() user: IUser,
  ) {
    return this.permissionsService.create(createPermissionDto, user);
  }

  @Get()
  @CanRead('Permission')
  @ResponseMessage('fetch permissions with pagination ')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.permissionsService.findAll(+currentPage, +limit, qs);
  }

  @Get(':id')
  @CanRead('Permission')
  @ResponseMessage('fetch permissions by id ')
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }

  @Patch(':id')
  @CanUpdate('Permission')
  @ResponseMessage('update permissions by id ')
  update(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
    @User() user: IUser,
  ) {
    return this.permissionsService.update(id, updatePermissionDto, user);
  }

  @Delete(':id')
  @CanDelete('Permission')
  @ResponseMessage('delete permissions by id ')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.permissionsService.remove(id, user);
  }
}
