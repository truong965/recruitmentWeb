// src/casl/guards/permissions.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from '../casl-ability.factory';
import {
  CHECK_ABILITY_KEY,
  RequiredPermission,
} from '../decorators/check-ability.decorator';
import { ADMIN_ROLE } from 'src/databases/sample';
import { IS_PUBLIC_PERMISSION } from 'src/auth/decorator/customize';
import { Request } from 'express';
import type { IUser } from 'src/users/users.interface';
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check xem có skip permission không
    const isSkipPermission = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_PERMISSION,
      [context.getHandler(), context.getClass()],
    );

    if (isSkipPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as IUser;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super Admin bypass
    if (user.role?.name === ADMIN_ROLE) {
      return true;
    }

    // Lấy required permissions từ decorator
    const requiredPermissions =
      this.reflector.get<RequiredPermission[]>(
        CHECK_ABILITY_KEY,
        context.getHandler(),
      ) || [];

    // Nếu không có required permissions, fallback về check cũ
    if (requiredPermissions.length === 0) {
      return this.legacyPermissionCheck(context, user);
    }

    // Build CASL ability
    const ability = this.caslAbilityFactory.createForUser(user as any);

    // Check tất cả required permissions
    for (const permission of requiredPermissions) {
      const canAccess = ability.can(
        permission.action,
        permission.subject,
        permission.field,
      );

      if (!canAccess) {
        throw new ForbiddenException(
          `You don't have permission to ${permission.action} ${permission.subject}`,
        );
      }
    }

    return true;
  }

  // Legacy check cho compatibility
  private legacyPermissionCheck(
    context: ExecutionContext,
    user: IUser,
  ): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const targetMethod = request.method;
    const targetEndpoint = (request.route as { path: string })?.path;

    const permissions = user?.permissions ?? [];

    const isExist = permissions.find(
      (p) => p.method === targetMethod && p.apiPath === targetEndpoint,
    );

    if (!isExist) {
      throw new ForbiddenException(
        `Bạn không có quyền truy cập endpoint: ${targetMethod} ${targetEndpoint}`,
      );
    }

    return true;
  }
}
