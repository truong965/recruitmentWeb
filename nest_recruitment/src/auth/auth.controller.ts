import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, ResponseMessage, User } from './decorator/customize';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { IUser } from 'src/users/users.interface';
import { RegisterUserDto } from 'src/users/dto/create-user.dto';

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

  @Public()
  @ResponseMessage('Register a new user')
  // @UseGuards(LocalAuthGuard)
  @Post('/auth/register')
  handleRegister(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.register(registerUserDto);
  }
  @UseGuards(JwtAuthGuard)
  @Post('/profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
