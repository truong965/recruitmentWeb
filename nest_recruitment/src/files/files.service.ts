// src/files/files.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { S3Service } from './s3.service';
import type { IUser } from 'src/users/users.interface';
import { FileDocument } from './schemas/file.schema';

@Injectable()
export class FilesService {
  constructor(
    private s3Service: S3Service,
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
  ) {}

  /**
   * Upload file lên S3 và lưu metadata vào DB
   */
  async uploadFile(
    file: Express.Multer.File,
    user: IUser,
    folder?: string,
  ): Promise<FileDocument> {
    // 1. Upload lên S3
    const s3Result = await this.s3Service.uploadFile(file, folder);

    // 2. Lưu metadata vào DB
    const fileDoc = await this.fileModel.create({
      originalName: file.originalname,
      fileName: s3Result.key.split('/').pop(), // Lấy tên file từ key
      mimeType: file.mimetype,
      size: file.size,
      s3Key: s3Result.key,
      s3Url: s3Result.url,
      folder: folder || 'uploads',
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });

    return fileDoc;
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: Express.Multer.File[],
    user: IUser,
    folder?: string,
  ): Promise<FileDocument[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file, user, folder),
    );
    return Promise.all(uploadPromises);
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

    // Check ownership (đã check ở controller)

    // 1. Xóa trên S3
    await this.s3Service.deleteFile(file.s3Key);

    // 2. Xóa trong DB
    await this.fileModel.deleteOne({ _id: id });
  }

  /**
   * Get signed URL cho private file
   */
  async getSignedUrl(id: string, expiresIn: number = 3600): Promise<string> {
    const file = await this.findOne(id);
    return this.s3Service.getSignedUrl(file.s3Key, expiresIn);
  }

  /**
   * Delete files by keys (cleanup orphaned files)
   */
  async deleteByKeys(keys: string[]): Promise<void> {
    // 1. Xóa trên S3
    await this.s3Service.deleteFiles(keys);

    // 2. Xóa trong DB
    await this.fileModel.deleteMany({ s3Key: { $in: keys } });
  }
}
