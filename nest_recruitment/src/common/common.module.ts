// src/common/common.module.ts
import { Module, Global } from '@nestjs/common';
import { SecurityService } from './service/security.service';
import { CaslModule } from 'src/casl/casl.module';

@Global() // Để không cần import ở mọi module
@Module({
  imports: [CaslModule],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class CommonModule {}
