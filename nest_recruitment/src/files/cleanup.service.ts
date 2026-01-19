import { Injectable, Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FileDocument, UploadStatus } from './schemas/file.schema';
import { S3Service } from './s3.service';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
    private s3Service: S3Service,
  ) {}

  /**
   * [CLEANUP JOB 1] Dọn dẹp các file PENDING quá hạn
   * LOGIC:
   * 1. Chạy định kỳ mỗi giờ (@Cron).
   * 2. Tìm các bản ghi trong DB có trạng thái 'PENDING' và tạo cách đây hơn 1 giờ.
   * 3. Chỉ xóa trong Database.
   *
   * MỤC ĐÍCH:
   * - Xử lý trường hợp User bấm "Upload" (lấy Presigned URL) nhưng sau đó tắt trình duyệt hoặc không bao giờ upload file lên.
   * - Không cần gọi xóa S3 vì bản chất file chưa bao giờ được upload lên đó (hoặc nếu có thì S3 Lifecycle sẽ tự lo, nhưng thường là chưa có).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredPendingFiles() {
    this.logger.log('Starting cleanup of expired PENDING files...');

    try {
      const result = await this.cleanupPendingByTTL(3600);

      if (result.deleted > 0) {
        this.logger.log(
          `Cleanup completed: ${result.deleted} PENDING files removed`,
        );
      } else {
        this.logger.debug('No expired PENDING files found');
      }

      return result;
    } catch (error) {
      this.logger.error('Cleanup job failed', error);
      throw error;
    }
  }

  /**
   * [CLEANUP JOB 2] Dọn dẹp file mồ côi (Orphaned/Failed)
   * LOGIC:
   * 1. Chạy định kỳ 2 giờ sáng mỗi ngày (giờ thấp điểm).
   * 2. Tìm các file có trạng thái 'FAILED' quá 24h.
   * 3. Kiểm tra ngược lại trên S3 (verifyFileExists) xem file rác có thực sự tồn tại không.
   * 4. Nếu có trên S3 -> Xóa S3. Sau đó xóa DB.
   *
   * MỤC ĐÍCH:
   * - Đảm bảo tính nhất quán (Consistency) giữa Database và S3.
   * - Xử lý các trường hợp lỗi hiếm gặp: Code báo lỗi nhưng file vẫn lên được S3, hoặc các file bị sót lại do lỗi mạng.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOrphanedFiles() {
    this.logger.log('Starting cleanup of orphaned files...');

    try {
      const result = await this.cleanupOrphaned();

      if (result.deleted > 0) {
        this.logger.log(
          `Orphaned cleanup completed: ${result.deleted} files removed`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Orphaned cleanup job failed', error);
      throw error;
    }
  }

  async cleanupPendingByTTL(
    ttlSeconds: number = 3600,
  ): Promise<{ deleted: number; fileIds: string[] }> {
    const expirationTime = new Date(Date.now() - ttlSeconds * 1000);

    const expiredFiles = await this.fileModel.find({
      status: UploadStatus.PENDING,
      createdAt: { $lt: expirationTime },
    });

    if (expiredFiles.length === 0) {
      return { deleted: 0, fileIds: [] };
    }

    this.logger.log(
      `Found ${expiredFiles.length} expired PENDING files (older than ${ttlSeconds}s)`,
    );

    const fileIds = expiredFiles.map((f) => f._id.toString());

    const deleteResult = await this.fileModel.deleteMany({
      _id: { $in: expiredFiles.map((f) => f._id) },
    });

    this.logger.log(
      `Deleted ${deleteResult.deletedCount} PENDING records from DB`,
    );

    return {
      deleted: deleteResult.deletedCount || 0,
      fileIds,
    };
  }

  async cleanupOrphaned(): Promise<{ deleted: number; keys: string[] }> {
    const failedFiles = await this.fileModel.find({
      status: UploadStatus.FAILED,
      createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (failedFiles.length === 0) {
      return { deleted: 0, keys: [] };
    }

    this.logger.log(`Found ${failedFiles.length} FAILED files older than 24h`);

    const s3Keys = failedFiles.map((f) => f.s3Key);

    for (const file of failedFiles) {
      try {
        const exists = await this.s3Service.verifyFileExists(file.s3Key);

        if (exists.exists) {
          await this.s3Service.deleteFile(file.s3Key);
          this.logger.debug(`Deleted orphaned S3 file: ${file.s3Key}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to delete S3 file ${file.s3Key}`, error);
      }
    }

    await this.fileModel.deleteMany({
      _id: { $in: failedFiles.map((f) => f._id) },
    });

    return {
      deleted: failedFiles.length,
      keys: s3Keys,
    };
  }

  async cleanupManual(fileId: string): Promise<void> {
    const file = await this.fileModel.findById(fileId);

    if (!file) {
      throw new Error(`File ${fileId} not found`);
    }

    if (file.status === UploadStatus.COMPLETED) {
      const exists = await this.s3Service.verifyFileExists(file.s3Key);
      if (exists.exists) {
        await this.s3Service.deleteFile(file.s3Key);
      }
    }

    await this.fileModel.deleteOne({ _id: fileId });
    this.logger.log(`Manually cleaned up file: ${fileId}`);
  }

  async getCleanupStats(): Promise<{
    pendingCount: number;
    oldestPending: Date | null;
    failedCount: number;
    completedCount: number;
  }> {
    const [pendingCount, failedCount, completedCount, oldestPending] =
      await Promise.all([
        this.fileModel.countDocuments({ status: UploadStatus.PENDING }),
        this.fileModel.countDocuments({ status: UploadStatus.FAILED }),
        this.fileModel.countDocuments({ status: UploadStatus.COMPLETED }),
        this.fileModel
          .findOne({ status: UploadStatus.PENDING })
          .sort({ createdAt: 1 })
          .select('createdAt'),
      ]);

    return {
      pendingCount,
      failedCount,
      completedCount,
      oldestPending: oldestPending?.createdAt || null,
    };
  }
}
