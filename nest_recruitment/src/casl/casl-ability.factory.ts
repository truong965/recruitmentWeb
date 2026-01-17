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
  createForUser(user: CaslUser) {
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

    // HR ROLE - Specific permissions per module
    if (user.role.name === HR_ROLE) {
      // USERS Module
      // HR can CRUD users in their own company (excluding password, role, company fields)
      // Note: Controller must validate that password, role, company are not updated
      can(['read', 'update'], 'User', {
        'company._id': user.company?._id?.toString(),
      });

      // ROLES & PERMISSIONS Module
      // HR can only read
      can('read', 'Role');
      can('read', 'Permission');

      // COMPANIES Module
      // HR can update their own company
      can('update', 'Company', {
        _id: user.company?._id?.toString(),
      });
      // HR cannot create or delete companies, but can read all (public)
      can('read', 'Company');

      // JOBS Module
      // HR can CRUD jobs in their own company
      can(['create', 'read', 'update', 'delete'], 'Job', {
        'company._id': user.company?._id?.toString(),
      });

      // RESUMES Module
      // HR can update resume status (PENDING → REVIEWING → APPROVED/REJECTED)
      // for resumes applied to jobs in their company
      // Note: Requires custom logic in controller to verify job belongs to HR's company
      can('update', 'Resume');
      // HR can read all resumes (will be filtered by service to only company jobs)
      can('read', 'Resume');

      // FILES Module
      // HR can upload, read, and delete own files
      can('create', 'File');
      can(['read', 'delete'], 'File', {
        userId: user._id.toString(),
      });

      return build({
        detectSubjectType: (item) =>
          item.constructor as ExtractSubjectType<Subjects>,
      });
    }

    // USER ROLE - Limited permissions
    if (user.role.name === USER_ROLE) {
      // USERS Module
      // USER can read and update only their own profile
      // Note: Controller must validate that password, role, company are not updated
      can(['read', 'update'], 'User', {
        _id: user._id.toString(),
      });
      // USER can delete their own account
      can('delete', 'User', {
        _id: user._id.toString(),
      });

      // COMPANIES Module
      // USER can read all companies (public)
      can('read', 'Company');

      // JOBS Module
      // USER can read all jobs (public)
      can('read', 'Job');

      // RESUMES Module
      // USER can create resume (apply to job)
      can('create', 'Resume');
      // USER can read own resumes
      can('read', 'Resume', {
        userId: user._id.toString(),
      });
      // USER can update own resume data (email, url) but only if status is PENDING
      // Requires custom logic in controller to check status
      can('update', 'Resume', {
        userId: user._id.toString(),
      });
      // USER can delete own resume but only if status is PENDING
      // Requires custom logic in controller to check status
      can('delete', 'Resume', {
        userId: user._id.toString(),
      });

      // FILES Module
      // USER can upload, read, delete own files
      can('create', 'File');
      can(['read', 'delete'], 'File', {
        userId: user._id.toString(),
      });

      // SUBSCRIBERS Module
      // USER can crud
      can(['create', 'delete', 'read', 'update'], 'Subscriber');

      return build({
        detectSubjectType: (item) =>
          item.constructor as ExtractSubjectType<Subjects>,
      });
    }

    // Default: no permissions for unknown roles
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
