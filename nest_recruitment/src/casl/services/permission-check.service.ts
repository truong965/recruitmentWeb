// src/casl/services/permission-check.service.ts
import { Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { CaslUser } from '../casl-ability.factory';

/**
 * Service for checking complex permission rules that require field-level validation
 * This handles cases where ownership or company-based access needs to be verified
 */
@Injectable()
export class PermissionCheckService {
  /**
   * Check if user owns the resource (by userId field)
   */
  isOwner(
    userId: mongoose.Types.ObjectId | string,
    ownerId: mongoose.Types.ObjectId | string,
  ): boolean {
    return userId.toString() === ownerId.toString();
  }

  /**
   * Check if user's company matches the resource's company
   */
  isCompanyMatch(
    userCompanyId: mongoose.Types.ObjectId | string | undefined,
    resourceCompanyId: mongoose.Types.ObjectId | string | undefined,
  ): boolean {
    if (!userCompanyId || !resourceCompanyId) return false;
    return userCompanyId.toString() === resourceCompanyId.toString();
  }

  /**
   * Check if HR can manage user (user belongs to HR's company)
   */
  canHRManageUser(
    user: CaslUser,
    targetUserCompanyId: mongoose.Types.ObjectId | string | undefined,
  ): boolean {
    if (!user.company) return false;
    return this.isCompanyMatch(user.company._id, targetUserCompanyId);
  }

  /**
   * Check if HR can manage job (job belongs to HR's company)
   */
  canHRManageJob(
    user: CaslUser,
    jobCompanyId: mongoose.Types.ObjectId | string | undefined,
  ): boolean {
    if (!user.company) return false;
    return this.isCompanyMatch(user.company._id, jobCompanyId);
  }

  /**
   * Check if HR can read resume (resume job belongs to HR's company)
   * Requires custom query to get job company info
   */
  canHRReadResume(
    user: CaslUser,
    jobCompanyId: mongoose.Types.ObjectId | string | undefined,
  ): boolean {
    if (!user.company) return false;
    return this.isCompanyMatch(user.company._id, jobCompanyId);
  }

  /**
   * Check if HR can update company (company is HR's company)
   */
  canHRUpdateCompany(
    user: CaslUser,
    companyId: mongoose.Types.ObjectId | string | undefined,
  ): boolean {
    if (!user.company) return false;
    return this.isCompanyMatch(user.company._id, companyId);
  }

  /**
   * Check if user can manage their own files
   */
  canUserManageFile(
    userId: mongoose.Types.ObjectId | string,
    fileUserId: mongoose.Types.ObjectId | string,
  ): boolean {
    return this.isOwner(userId, fileUserId);
  }

  /**
   * Check if user can manage their own resumes
   */
  canUserManageResume(
    userId: mongoose.Types.ObjectId | string,
    resumeUserId: mongoose.Types.ObjectId | string,
  ): boolean {
    return this.isOwner(userId, resumeUserId);
  }

  /**
   * Check if user can update their own profile
   */
  canUserUpdateProfile(
    userId: mongoose.Types.ObjectId | string,
    targetUserId: mongoose.Types.ObjectId | string,
  ): boolean {
    return this.isOwner(userId, targetUserId);
  }
}
