// src/casl/casl.module.ts
import { Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { PermissionCheckService } from './services/permission-check.service';

@Module({
  providers: [CaslAbilityFactory, PermissionCheckService],
  exports: [CaslAbilityFactory, PermissionCheckService],
})
export class CaslModule {}
