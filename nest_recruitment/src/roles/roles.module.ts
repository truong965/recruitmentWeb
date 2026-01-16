import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Role, RoleSchema } from './schemas/role.schema';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Role.name, schema: RoleSchema }]),
    PermissionsModule,
  ],
  controllers: [RolesController],
  providers: [RolesService],

  exports: [RolesService],
})
export class RolesModule {}
