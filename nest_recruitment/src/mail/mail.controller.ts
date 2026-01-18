import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ResponseMessage, User } from 'src/auth/decorator/customize';

import { ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { SUPER_ADMIN } from 'src/casl/casl-ability.factory';
import type { IUser } from 'src/users/users.interface';
@ApiTags('mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get()
  @ResponseMessage('send email')
  async handleTestEmail(@User() user: IUser) {
    if (user.role.name !== SUPER_ADMIN) {
      throw new ForbiddenException(
        'Chỉ Admin mới có quyền kích hoạt tính năng này!',
      );
    }

    await this.mailService.handleSendEmail();
    return 'Email process triggered manually';
  }
}
