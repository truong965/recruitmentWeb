import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { S3Service } from './s3.service';
import type { IUser } from 'src/users/users.interface';
import { FileDocument, UploadStatus } from './schemas/file.schema';
import { RequestUploadDto } from './dto/request-upload.dto';

@Injectable()
export class FilesService {
  constructor(
    private s3Service: S3Service,
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
  ) {}

  /**
   * 🆕 PHASE 1: Request upload - Generate pre-signed URL
   */
  async requestUpload(
    dto: RequestUploadDto,
    user: IUser,
  ): Promise<{
    uploadUrl: string;
    fileId: string;
    fileKey: string;
    expiresIn: number;
  }> {
    // 1. Validate file metadata
    this.s3Service.validateFileMetadata(
      dto.fileName,
      dto.fileSize,
      dto.mimeType,
    );

    // 2. Generate pre-signed URL
    const folder = dto.folder || 'uploads';
    const { uploadUrl, key } = await this.s3Service.generatePresignedUploadUrl(
      dto.fileName,
      dto.mimeType,
      folder,
      300, // 5 phút
    );

    // 3. Tạo bản ghi PENDING trong DB
    const fileDoc = await this.fileModel.create({
      originalName: dto.fileName,
      fileName: key.split('/').pop(),
      mimeType: dto.mimeType,
      size: dto.fileSize,
      s3Key: key,
      folder,
      status: UploadStatus.PENDING,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });

    return {
      uploadUrl,
      fileId: fileDoc._id.toString(),
      fileKey: key,
      expiresIn: 300,
    };
  }

  /**
   * 🆕 PHASE 1: Confirm upload - Client báo upload xong (tạm thời)
   * (Phase 3 sẽ thay bằng S3 Event)
   */
  async confirmUpload(fileId: string, user: IUser): Promise<FileDocument> {
    // 1. Tìm file trong DB
    const file = await this.fileModel.findById(fileId);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    // 2. Check ownership
    if (
      !file.createdBy ||
      file.createdBy._id.toString() !== user._id.toString()
    ) {
      throw new BadRequestException('You can only confirm your own uploads');
    }

    // 3. Verify file exists trên S3
    const verification = await this.s3Service.verifyFileExists(file.s3Key);

    if (!verification.exists) {
      // File không tồn tại trên S3
      file.status = UploadStatus.FAILED;
      await file.save();
      throw new BadRequestException(
        'File not found on S3. Upload may have failed.',
      );
    }

    // 4. Update status → COMPLETED
    file.status = UploadStatus.COMPLETED;
    file.uploadedAt = new Date();
    file.eTag = verification.eTag;
    file.versionId = verification.versionId;
    file.size = verification.size || file.size; // Update actual size

    await file.save();

    return file;
  }

  /**
   * Get file by ID
   */
  async findOne(id: string): Promise<FileDocument> {
    const file = await this.fileModel.findById(id);
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  /**
   * Get files by user
   */
  async findByUser(userId: string): Promise<FileDocument[]> {
    return this.fileModel.find({ 'createdBy._id': userId });
  }

  /**
   * Get all files with pagination
   */
  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [files, total] = await Promise.all([
      this.fileModel.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
      this.fileModel.countDocuments(),
    ]);

    return {
      data: files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Delete file (xóa cả S3 và DB)
   */
  async remove(id: string): Promise<void> {
    const file = await this.findOne(id);

    // 1. Xóa trên S3 (chỉ xóa nếu status = COMPLETED)
    if (file.status === UploadStatus.COMPLETED) {
      await this.s3Service.deleteFile(file.s3Key);
    }

    // 2. Xóa trong DB
    await this.fileModel.deleteOne({ _id: id });
  }

  /**
   * Get signed URL cho private file (download)
   */
  async getSignedUrl(id: string, expiresIn: number = 3600): Promise<string> {
    const file = await this.findOne(id);

    if (file.status !== UploadStatus.COMPLETED) {
      throw new BadRequestException('File upload is not completed yet');
    }

    return this.s3Service.getSignedUrl(file.s3Key, expiresIn);
  }

  /**
   * 🆕 Cleanup expired PENDING uploads (Background job)
   */
  async cleanupExpiredPending(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const expiredFiles = await this.fileModel.find({
      status: UploadStatus.PENDING,
      createdAt: { $lt: oneHourAgo },
    });

    if (expiredFiles.length === 0) {
      return 0;
    }

    // Xóa trong DB (không cần xóa S3 vì có thể chưa upload)
    await this.fileModel.deleteMany({
      _id: { $in: expiredFiles.map((f) => f._id) },
    });

    return expiredFiles.length;
  }
}
