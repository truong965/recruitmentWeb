// src/casl/casl-ability.factory.ts
import {
  Ability,
  AbilityBuilder,
  AbilityClass,
  ExtractSubjectType,
  InferSubjects,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { Company } from 'src/companies/schemas/company.schema';
import { User } from 'src/users/schemas/user.schema';
import mongoose from 'mongoose';
import { Job } from 'src/jobs/schemas/job.schema';
import { Resume } from 'src/resumes/schemas/resume.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Role, RoleDocument } from 'src/roles/schemas/role.schema';
import { Permission } from 'src/permissions/schemas/permission.schema';
import type { SoftDeleteModel } from 'mongoose-delete';

// Define all possible actions
type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';

// Define all subjects (resources)
type Subjects =
  | InferSubjects<typeof Company | typeof User | typeof Job | typeof Resume>
  | 'all'
  | 'User'
  | 'Role'
  | 'Permission'
  | 'Company'
  | 'Job'
  | 'Resume'
  | 'File'
  | 'Subscriber';

export type AppAbility = Ability<[Actions, Subjects]>;

// Interface cho user từ JWT - compatible với IUser
export interface CaslUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  name?: string;
  age?: number;
  gender?: string;
  address?: string;
  role: {
    _id: string;
    name: string;
  };
  company?: {
    _id: mongoose.Types.ObjectId | string;
    name?: string;
  };
  permissions?: Array<{
    _id: mongoose.Types.ObjectId | string;
    apiPath: string;
    method: string;
    module: string;
  }>;
}

export const SUPER_ADMIN = 'SUPER_ADMIN';
export const HR_ROLE = 'HR';
export const USER_ROLE = 'USER';

@Injectable()
export class CaslAbilityFactory {
  constructor(
    @InjectModel(Role.name)
    private roleModel: SoftDeleteModel<RoleDocument>,
  ) {}

  async createForUser(user: CaslUser) {
    const { can, build } = new AbilityBuilder<AppAbility>(
      Ability as AbilityClass<AppAbility>,
    );

    // SUPER ADMIN - full access to everything
    if (user.role.name === SUPER_ADMIN) {
      can('manage', 'all');
      return build({
        detectSubjectType: (item) =>
          item.constructor as ExtractSubjectType<Subjects>,
      });
    }

    // Fetch role từ database với populate permissions
    const roleFromDb = await this.roleModel
      .findOne({ name: user.role.name })
      .populate('permissions')
      .lean();

    if (!roleFromDb) {
      // Role không tồn tại trong DB, return ability rỗng
      return build({
        detectSubjectType: (item) =>
          item.constructor as ExtractSubjectType<Subjects>,
      });
    }

    // Build permissions từ database
    const permissions = (roleFromDb.permissions ||
      []) as unknown as Permission[];
    for (const permission of permissions) {
      const action = this.mapMethodToAction(permission.method);
      const subject = this.mapModuleToSubject(permission.module);

      if (action && subject) {
        const subjectType = subject as ExtractSubjectType<Subjects>;
        // Build CASL rule dựa trên apiPath - có thể thêm field-level nếu cần
        if (
          permission.module === 'USERS' &&
          permission.apiPath.includes('users/') &&
          (permission.method === 'PATCH' || permission.method === 'DELETE')
        ) {
          // For user-specific operations, add ownership check
          if (user.role.name === USER_ROLE) {
            can(action, subjectType, { _id: user._id.toString() });
          } else if (user.role.name === HR_ROLE && user.company?._id) {
            can(action, subjectType, {
              'company._id': user.company._id.toString(),
            });
          }
        } else if (
          permission.module === 'JOBS' &&
          (permission.method === 'POST' ||
            permission.method === 'PATCH' ||
            permission.method === 'DELETE')
        ) {
          // HR-specific job operations
          if (user.role.name === HR_ROLE && user.company?._id) {
            can(action, subjectType, {
              'company._id': user.company._id.toString(),
            });
          } else {
            can(action, subjectType);
          }
        } else if (
          permission.module === 'COMPANIES' &&
          (permission.method === 'PATCH' || permission.method === 'DELETE')
        ) {
          // HR can update their own company
          if (user.role.name === HR_ROLE && user.company?._id) {
            can(action, subjectType, {
              _id: user.company._id.toString(),
            });
          } else {
            can(action, subjectType);
          }
        } else if (
          permission.module === 'RESUMES' &&
          permission.method === 'PATCH'
        ) {
          // For resume updates
          can(action, subjectType);
        } else if (
          permission.module === 'FILES' &&
          (permission.method === 'DELETE' ||
            (permission.method === 'GET' &&
              permission.apiPath.includes('/:id')))
        ) {
          // File ownership check
          if (user.role.name === USER_ROLE) {
            can(action, subjectType, { userId: user._id.toString() });
          } else {
            can(action, subjectType);
          }
        } else {
          // Default: no ownership restrictions
          can(action, subjectType);
        }
      }
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }

  // Helper method to create ability for guest/unauthenticated users
  createForGuest() {
    const { can, build } = new AbilityBuilder<AppAbility>(
      Ability as AbilityClass<AppAbility>,
    );

    // Guest can read public resources
    can('read', 'Company');
    can('read', 'Job');
    can('create', 'Subscriber'); // Can subscribe
    can('delete', 'Subscriber'); // Can unsubscribe (if has email match)

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }

  // Map HTTP method sang CASL action
  private mapMethodToAction(method: string): Actions | null {
    const mapping: Record<string, Actions> = {
      GET: 'read',
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete',
    };
    return mapping[method] || null;
  }

  // Map module sang subject
  private mapModuleToSubject(module: string): Subjects | null {
    const mapping: Record<string, Subjects> = {
      USERS: 'User',
      ROLES: 'Role',
      PERMISSIONS: 'Permission',
      COMPANIES: 'Company',
      JOBS: 'Job',
      RESUMES: 'Resume',
      FILES: 'File',
      SUBSCRIBERS: 'Subscriber',
    };
    return mapping[module] || null;
  }

  private isOwnershipRequired(apiPath: string): boolean {
    const ownershipPaths = [
      '/api/v1/users/:id',
      '/api/v1/companies/:id',
      '/api/v1/jobs/:id',
      '/api/v1/resumes/:id',
      '/api/v1/files/:id',
    ];

    return ownershipPaths.some((path) => {
      const pattern = path.replace(':id', '[^/]+');
      return new RegExp(`^${pattern}$`).test(apiPath);
    });
  }
}
