// src/casl/casl.module.ts
import { Global, Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { PermissionCheckService } from './services/permission-check.service';
@Global()
@Module({
  providers: [CaslAbilityFactory, PermissionCheckService],
  exports: [CaslAbilityFactory, PermissionCheckService],
})
export class CaslModule {}
