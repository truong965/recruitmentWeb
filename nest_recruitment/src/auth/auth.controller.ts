import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, User } from './decorator/customize';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { IUser } from 'src/users/users.interface';

@Controller()
export class AuthController {
  constructor(
    private authService: AuthService,
    // eslint-disable-next-line prettier/prettier
  ) { }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('/login')
  handleLogin(@User() user: IUser) {
    return this.authService.login(user);
  }
  @UseGuards(JwtAuthGuard)
  @Post('/profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
