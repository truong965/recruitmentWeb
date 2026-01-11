import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private ConfigService: ConfigService,
    // eslint-disable-next-line prettier/prettier
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
