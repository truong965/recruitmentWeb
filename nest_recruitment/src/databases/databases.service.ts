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
          // USERS: can(['read', 'update']) -> GET, PATCH
          if (
            p.module === 'USERS' &&
            (p.method === 'GET' || p.method === 'PATCH')
          )
            return true;

          // ROLES & PERMISSIONS: can('read') -> GET
          if (
            (p.module === 'ROLES' || p.module === 'PERMISSIONS') &&
            p.method === 'GET'
          )
            return true;

          // COMPANIES: can('update', own), can('read', all) -> GET, PATCH
          if (
            p.module === 'COMPANIES' &&
            (p.method === 'GET' || p.method === 'PATCH')
          )
            return true;

          // JOBS: can(['create', 'read', 'update', 'delete']) -> ALL (POST, GET, PATCH, DELETE)
          if (
            p.module === 'JOBS' &&
            ['POST', 'GET', 'PATCH', 'DELETE'].includes(p.method)
          )
            return true;

          // RESUMES: can('update'), can('read') -> GET, PATCH
          if (
            p.module === 'RESUMES' &&
            (p.method === 'GET' || p.method === 'PATCH')
          )
            return true;

          // FILES: can('create'), can(['read', 'delete']) -> POST, GET, DELETE
          if (
            p.module === 'FILES' &&
            ['POST', 'GET', 'DELETE'].includes(p.method)
          )
            return true;

          return false;
        });

        // --- FILTER PERMISSIONS FOR USER (Updated based on CASL rules) ---
        const userPermissions = allPermissions.filter((p) => {
          // USERS: can(['read', 'update'], own), can('delete', own) -> GET, PATCH, DELETE
          if (
            p.module === 'USERS' &&
            ['GET', 'PATCH', 'DELETE'].includes(p.method)
          )
            return true;

          // COMPANIES: can('read') -> GET
          if (p.module === 'COMPANIES' && p.method === 'GET') return true;

          // JOBS: can('read') -> GET
          if (p.module === 'JOBS' && p.method === 'GET') return true;

          // RESUMES: can('create'), can('read', own), can('update', own), can('delete', own) -> ALL
          if (
            p.module === 'RESUMES' &&
            ['POST', 'GET', 'PATCH', 'DELETE'].includes(p.method)
          )
            return true;

          // FILES: can('create'), can(['read', 'delete']) -> POST, GET, DELETE
          if (
            p.module === 'FILES' &&
            ['POST', 'GET', 'DELETE'].includes(p.method)
          )
            return true;

          // SUBSCRIBERS: can(['create', 'delete', 'read', 'update']) -> ALL
          if (
            p.module === 'SUBSCRIBERS' &&
            ['POST', 'GET', 'PATCH', 'DELETE'].includes(p.method)
          )
            return true;

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
