// src/casl/casl.module.ts
import { Global, Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { PermissionCheckService } from './services/permission-check.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Role, RoleSchema } from 'src/roles/schemas/role.schema';
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Role.name, schema: RoleSchema }]),
  ],
  providers: [CaslAbilityFactory, PermissionCheckService],
  exports: [CaslAbilityFactory, PermissionCheckService],
})
export class CaslModule {}
