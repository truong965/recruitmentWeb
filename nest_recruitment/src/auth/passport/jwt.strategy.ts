// src/auth/passport/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IUser } from 'src/users/users.interface';
import { RolesService } from 'src/roles/roles.service';
import mongoose from 'mongoose';

export interface CachedPermission {
  _id: string | mongoose.Types.ObjectId;
  name: string;
  apiPath: string;
  method: string;
  module: string;
}
interface CacheEntry {
  permissions: CachedPermission[];
  timestamp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private permissionsCache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private configService: ConfigService,
    private roleService: RolesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_TOKEN_SECRET')!,
    });
  }

  async validate(payload: IUser) {
    const { _id, name, email, role } = payload;

    // Type-safe casting
    const userRole = role as unknown as { _id: string; name: string };

    if (!userRole?._id) {
      return {
        _id,
        name,
        email,
        role,
        permissions: [],
      };
    }

    // Check cache first
    const cached = this.getFromCache(userRole._id);
    if (cached) {
      return {
        _id,
        name,
        email,
        role,
        permissions: cached,
      };
    }

    // Query DB nếu cache miss
    try {
      const roleDoc = await this.roleService.findOne(userRole._id);
      const permissions = (roleDoc?.permissions ??
        []) as unknown as CachedPermission[];
      // Save to cache
      this.saveToCache(userRole._id, permissions);

      return {
        _id,
        name,
        email,
        role,
        permissions,
      };
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return {
        _id,
        name,
        email,
        role,
        permissions: [],
      };
    }
  }

  private getFromCache(roleId: string): CachedPermission[] | null {
    const entry = this.permissionsCache.get(roleId);

    if (!entry) return null;

    // Check if cache expired
    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL) {
      this.permissionsCache.delete(roleId);
      return null;
    }

    return entry.permissions;
  }

  private saveToCache(roleId: string, permissions: CachedPermission[]): void {
    this.permissionsCache.set(roleId, {
      permissions,
      timestamp: Date.now(),
    });

    // Cleanup old entries (simple LRU)
    if (this.permissionsCache.size > 100) {
      const firstKey = this.permissionsCache.keys().next().value as string;
      this.permissionsCache.delete(firstKey);
    }
  }

  // Method để clear cache khi cần (VD: sau khi update permissions)
  clearCache(roleId?: string): void {
    if (roleId) {
      this.permissionsCache.delete(roleId);
    } else {
      this.permissionsCache.clear();
    }
  }
}
