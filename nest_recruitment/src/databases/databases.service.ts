import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  Permission,
  PermissionDocument,
} from 'src/permissions/schemas/permission.schema';
import { Role, RoleDocument } from 'src/roles/schemas/role.schema';
import { User, UserDocument } from 'src/users/schemas/user.schema';

import { UsersService } from 'src/users/users.service';
import { INIT_COMPANIES, INIT_PERMISSIONS } from './sample';
import type { SoftDeleteModel } from 'mongoose-delete';
import { Company, CompanyDocument } from 'src/companies/schemas/company.schema';
import { HR_ROLE, SUPER_ADMIN, USER_ROLE } from 'src/casl/casl-ability.factory';

@Injectable()
export class DatabasesService implements OnModuleInit {
  private readonly logger = new Logger(DatabasesService.name);
  constructor(
    @InjectModel(Role.name)
    private rolesModel: SoftDeleteModel<RoleDocument>,

    @InjectModel(User.name)
    private usersModel: SoftDeleteModel<UserDocument>,

    @InjectModel(Permission.name)
    private permissionsModel: SoftDeleteModel<PermissionDocument>,

    @InjectModel(Company.name)
    private companyModel: SoftDeleteModel<CompanyDocument>,

    private configService: ConfigService,
    private usersService: UsersService,
  ) {}
  async onModuleInit() {
    const isInit = this.configService.get<string>('SHOULD_INIT');
    if (isInit) {
      const countUser = await this.usersModel.countDocuments({});
      const countPermission = await this.permissionsModel.countDocuments({});
      const countRole = await this.rolesModel.countDocuments({});
      const countCompany = await this.companyModel.countDocuments({});
      //create permissions
      if (countPermission === 0) {
        await this.permissionsModel.insertMany(INIT_PERMISSIONS);
        //bulk create
      }

      // create role
      if (countRole === 0) {
        const allPermissions = await this.permissionsModel
          .find({})
          .select('_id name apiPath method module');
        const hrPermissions = allPermissions.filter((p) => {
          // HR full quyền với Users, Jobs, Files
          if (['USERS', 'JOBS', 'FILES'].includes(p.module)) return true;

          // HR chỉ được Xem và Update Companies (Không được Create/Delete)
          if (
            p.module === 'COMPANIES' &&
            p.method !== 'POST' &&
            p.method !== 'DELETE'
          )
            return true;

          // HR chỉ được Xem Resumes (Bao gồm cả endpoint search by-user dùng method POST)
          if (
            p.module === 'RESUMES' &&
            (p.method === 'GET' || p.apiPath.includes('by-user'))
          )
            return true;

          // HR chỉ được Xem Roles, Permissions, Subscribers (Read-only)
          if (
            ['ROLES', 'PERMISSIONS', 'SUBSCRIBERS'].includes(p.module) &&
            p.method === 'GET'
          )
            return true;

          return false;
        });
        const userPermissions = allPermissions.filter((p) => {
          // User full quyền với Resumes (CRUD của chính mình), Files
          if (['RESUMES', 'FILES'].includes(p.module)) return true;

          // User được xem và sửa bản thân (Users)
          if (
            p.module === 'USERS' &&
            (p.method === 'GET' || p.method === 'PATCH')
          )
            return true;

          // User chỉ được xem Jobs, Companies
          if (['JOBS', 'COMPANIES'].includes(p.module) && p.method === 'GET')
            return true;

          // User không có quyền với Roles, Permissions, Subscribers (API subscribers public không cần check DB permission này nếu dùng @Public)
          return false;
        });
        await this.rolesModel.insertMany([
          {
            name: SUPER_ADMIN as string,
            description: 'Admin thì full quyền :v',
            isActive: true,
            permissions: allPermissions,
          },
          {
            name: HR_ROLE as string,
            description: 'HR',
            isActive: true,
            permissions: hrPermissions, //không set quyền, chỉ cần add ROLE
          },
          {
            name: USER_ROLE as string,
            description: 'Người dùng/Ứng viên sử dụng hệ thống',
            isActive: true,
            permissions: userPermissions, //không set quyền, chỉ cần add ROLE
          },
        ]);
      }
      // create user
      if (countUser === 0) {
        const adminRole = await this.rolesModel.findOne({
          name: SUPER_ADMIN as string,
        });
        const userRole = await this.rolesModel.findOne({
          name: USER_ROLE as string,
        });
        const hrRole = await this.rolesModel.findOne({
          name: HR_ROLE as string,
        });
        await this.usersModel.insertMany([
          {
            name: "I'm admin",
            email: 'admin@gmail.com',
            password: this.usersService.getHashPassword(
              this.configService.get<string>('INIT_PASSWORD')!,
            ),
            age: 69,
            gender: 'MALE',
            address: 'VietNam',
            role: adminRole?._id,
          },
          {
            name: "I'm Hỏi Dân IT",
            email: 'hr@gmail.com',
            password: this.usersService.getHashPassword(
              this.configService.get<string>('INIT_PASSWORD')!,
            ),
            age: 96,
            gender: 'MALE',
            address: 'VietNam',
            role: hrRole?._id,
          },
          {
            name: "I'm Hỏi Dân IT",
            email: 'hr2@gmail.com',
            password: this.usersService.getHashPassword(
              this.configService.get<string>('INIT_PASSWORD')!,
            ),
            age: 96,
            gender: 'MALE',
            address: 'VietNam',
            role: hrRole?._id,
          },
          {
            name: "I'm normal user",
            email: 'user@gmail.com',
            password: this.usersService.getHashPassword(
              this.configService.get<string>('INIT_PASSWORD')!,
            ),
            age: 69,
            gender: 'MALE',
            address: 'VietNam',
            role: userRole?._id,
          },
          {
            name: "I'm normal user",
            email: 'user2@gmail.com',
            password: this.usersService.getHashPassword(
              this.configService.get<string>('INIT_PASSWORD')!,
            ),
            age: 69,
            gender: 'MALE',
            address: 'VietNam',
            role: userRole?._id,
          },
        ]);
      }
      // create companies
      if (countCompany === 0) {
        await this.companyModel.insertMany(INIT_COMPANIES);
      }
      if (
        countUser > 0 &&
        countRole > 0 &&
        countPermission > 0 &&
        countCompany > 0
      ) {
        this.logger.log('>>> ALREADY INIT SAMPLE DATA...');
      }
    }
  }
}
