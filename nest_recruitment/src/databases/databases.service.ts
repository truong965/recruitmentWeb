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
import {
  ADMIN_ROLE,
  INIT_COMPANIES,
  INIT_PERMISSIONS,
  USER_ROLE,
} from './sample';
import type { SoftDeleteModel } from 'mongoose-delete';
import { Company, CompanyDocument } from 'src/companies/schemas/company.schema';

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
        const permissions = await this.permissionsModel.find({}).select('_id');
        await this.rolesModel.insertMany([
          {
            name: ADMIN_ROLE as string,
            description: 'Admin thì full quyền :v',
            isActive: true,
            permissions: permissions,
          },
          {
            name: USER_ROLE as string,
            description: 'Người dùng/Ứng viên sử dụng hệ thống',
            isActive: true,
            permissions: [], //không set quyền, chỉ cần add ROLE
          },
        ]);
      }
      // create user
      if (countUser === 0) {
        const adminRole = await this.rolesModel.findOne({
          name: ADMIN_ROLE as string,
        });
        const userRole = await this.rolesModel.findOne({
          name: USER_ROLE as string,
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
            email: 'hoidanit@gmail.com',
            password: this.usersService.getHashPassword(
              this.configService.get<string>('INIT_PASSWORD')!,
            ),
            age: 96,
            gender: 'MALE',
            address: 'VietNam',
            role: adminRole?._id,
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
