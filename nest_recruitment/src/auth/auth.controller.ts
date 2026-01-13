import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, ResponseMessage, User } from './decorator/customize';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { IUser } from 'src/users/users.interface';
import { RegisterUserDto } from 'src/users/dto/create-user.dto';
import type { Response, Request } from 'express';
@Controller()
export class AuthController {
  constructor(
    private authService: AuthService,
    // eslint-disable-next-line prettier/prettier
  ) { }

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
  @Post('/auth/register')
  handleRegister(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.register(registerUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @ResponseMessage('profile')
  @Post('/profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @ResponseMessage('get account')
  @Post('/auth/account')
  getAccount(@User() user: IUser) {
    return { user };
  }

  @Public()
  @ResponseMessage('get user by refresh token')
  @Post('/auth/refresh')
  handleRefreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refresh_token = request.cookies['refresh_token'] as string;
    return this.authService.processNewToken(refresh_token, response);
  }
  @Public()
  @ResponseMessage('logout')
  @Post('/auth/logout')
  handleLogout(
    @User() user: IUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.handleLogout(response, user);
  }
}
