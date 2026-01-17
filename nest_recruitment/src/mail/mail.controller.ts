import { Controller, Get } from '@nestjs/common';
import { Public, ResponseMessage } from 'src/auth/decorator/customize';

import { Cron } from '@nestjs/schedule';
import { ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';
@ApiTags('mail')
@Controller('mail')
export class MailController {
  private readonly mailService: MailService;

  @Get()
  @Public()
  @ResponseMessage('Test email')
  @Cron('0 0 */10 * *') //At 12:00 AM, every 10 days
  async handleTestEmail() {
    await this.mailService.handleTestEmail();
  }
}
