import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, ResponseMessage, User } from './decorator/customize';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { IUser } from 'src/users/users.interface';
import { RegisterUserDto } from 'src/users/dto/create-user.dto';
import type { Response, Request } from 'express';
import { RolesService } from 'src/roles/roles.service';
import mongoose from 'mongoose';
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private roleService: RolesService,
  ) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @ResponseMessage('login')
  @Post('/login')
  handleLogin(
    @User() user: IUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.login(user, response);
  }

  @Public()
  @ResponseMessage('Register a new user')
  @Post('/register')
  handleRegister(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.register(registerUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @ResponseMessage('profile')
  @Post('/profile')
  getProfile(@Req() req: Request) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @ResponseMessage('get account')
  @Get('/account')
  async getAccount(@User() user: IUser) {
    const temp = await this.roleService.findOne(user.role._id);

    // Định nghĩa kiểu dữ liệu thực tế mà temp.permissions đang chứa (sau khi populate)
    type PopulatedPermission = {
      _id: mongoose.Types.ObjectId;
      name: string;
      apiPath: string;
      module: string;
    };

    //  Ép kiểu an toàn: ObjectId[] -> unknown -> PopulatedPermission[]
    // Dùng 'unknown' là cách chuẩn để bypass ESLint thay vì 'any'
    const populatedPermissions =
      temp?.permissions as unknown as PopulatedPermission[];

    // Map dữ liệu để khớp với IUser (chuyển ObjectId thành string)
    if (populatedPermissions) {
      user.permissions = populatedPermissions.map((perm) => ({
        _id: perm._id.toString(), //Convert ObjectId -> String
        name: perm.name,
        apiPath: perm.apiPath,
        module: perm.module,
      }));
    }
    return { user };
  }

  @Public()
  @ResponseMessage('get user by refresh token')
  @Post('/refresh')
  handleRefreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refresh_token = request.cookies['refresh_token'] as string;
    return this.authService.processNewToken(refresh_token, response);
  }
  @Public()
  @ResponseMessage('logout')
  @Post('/logout')
  handleLogout(
    @User() user: IUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.handleLogout(response, user);
  }
}
