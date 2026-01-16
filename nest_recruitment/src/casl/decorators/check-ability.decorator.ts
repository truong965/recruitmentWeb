// src/casl/decorators/check-ability.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const CHECK_ABILITY_KEY = 'check_ability';

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';
export type Subjects = 'Company' | 'User' | 'Job' | 'Resume' | 'all';

export interface RequiredPermission {
  action: Actions;
  subject: Subjects;
  field?: string;
}

// Single permission
export const CheckAbility = (action: Actions, subject: Subjects) =>
  SetMetadata(CHECK_ABILITY_KEY, [{ action, subject }]);

// Multiple permissions
export const CheckAbilities = (...permissions: RequiredPermission[]) =>
  SetMetadata(CHECK_ABILITY_KEY, permissions);

// Helper decorators cho từng action
export const CanCreate = (subject: Subjects) => CheckAbility('create', subject);
export const CanRead = (subject: Subjects) => CheckAbility('read', subject);
export const CanUpdate = (subject: Subjects) => CheckAbility('update', subject);
export const CanDelete = (subject: Subjects) => CheckAbility('delete', subject);
export const CanManage = (subject: Subjects) => CheckAbility('manage', subject);
