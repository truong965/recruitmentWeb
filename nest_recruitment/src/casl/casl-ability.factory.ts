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
import { ADMIN_ROLE } from 'src/databases/sample';
import mongoose from 'mongoose';

// Define all possible actions
type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';

// Define all subjects (resources)
type Subjects =
  | InferSubjects<typeof Company | typeof User>
  | 'all'
  | 'Company'
  | 'User'
  | 'Job'
  | 'Resume';

export type AppAbility = Ability<[Actions, Subjects]>;

// Interface cho user từ JWT
export interface CaslUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  role: {
    _id: string;
    name: string;
  };
  permissions: Array<{
    _id: mongoose.Types.ObjectId;
    apiPath: string;
    method: string;
    module: string;
  }>;
}

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: CaslUser) {
    const { can, build } = new AbilityBuilder<AppAbility>(
      Ability as AbilityClass<AppAbility>,
    );
    const permissions = user.permissions ?? [];

    // SUPER ADMIN - full access
    if (user.role.name === ADMIN_ROLE) {
      can('manage', 'all');
      return build({
        detectSubjectType: (item) =>
          item.constructor as ExtractSubjectType<Subjects>,
      });
    }

    // Map permissions từ DB sang CASL abilities
    permissions.forEach((permission) => {
      const action = this.mapMethodToAction(permission.method);
      const subject = this.mapModuleToSubject(permission.module);

      if (action && subject) {
        // Nếu là resource của chính user (ownership)
        if (this.isOwnershipRequired(permission.apiPath)) {
          can(action, subject as ExtractSubjectType<Subjects>, {
            'createdBy._id': user._id.toString(),
          });
        } else {
          can(action, subject as ExtractSubjectType<Subjects>);
        }
      }
    });

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
      COMPANIES: 'Company',
      USERS: 'User',
      JOBS: 'Job',
      RESUMES: 'Resume',
    };
    return mapping[module] || null;
  }

  // Kiểm tra endpoint có cần check ownership không
  private isOwnershipRequired(apiPath: string): boolean {
    const ownershipPaths = ['/api/v1/companies/:id', '/api/v1/resumes/:id'];

    return ownershipPaths.some((path) => {
      const pattern = path.replace(':id', '[^/]+');
      return new RegExp(`^${pattern}$`).test(apiPath);
    });
  }
}
