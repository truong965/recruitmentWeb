import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly s3Folder: string;

  constructor(private configService: ConfigService) {
    this.region =
      this.configService.get<string>('AWS_REGION') || 'ap-southeast-1';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME')!;
    this.s3Folder =
      this.configService.get<string>('AWS_S3_FOLDER') || 'uploads';

    // Validate config trước
    if (!this.bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME is not configured');
    }
    if (!this.configService.get<string>('AWS_ACCESS_KEY_ID')) {
      throw new Error('AWS_ACCESS_KEY_ID is not configured');
    }
    if (!this.configService.get<string>('AWS_SECRET_ACCESS_KEY')) {
      throw new Error('AWS_SECRET_ACCESS_KEY is not configured');
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        )!,
      },
      // Sử dụng forcePathStyle để tránh virtual-hosted-style issues
      forcePathStyle: true,
    });
    // Validate config
    if (!this.bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME is not configured');
    }
  }

  /**
   *Upload file lên S3
   * @param file - File từ multer
   * @param folder - Thư mục trong bucket (VD: 'resumes', 'avatars', 'companies')
   * @returns Object chứa file URL và key
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<{ url: string; key: string; size: number }> {
    try {
      // Validate file
      this.validateFile(file);

      // Generate unique file name
      const fileExtension = path.extname(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const key = `${folder}/${fileName}`;

      // Upload command
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // ACL: 'public-read', // Deprecated, dùng Bucket Policy thay thế
      });

      // Execute upload
      await this.s3Client.send(command);

      // Generate public URL
      const url = `https://s3.${this.region}.amazonaws.com/${this.bucketName}/${key}`;

      return {
        url,
        key,
        size: file.size,
      };
    } catch (error) {
      console.error('S3 Upload Error:', error);
      throw new BadRequestException(
        `Failed to upload file: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: Express.Multer.File[],
    folder: string = 'uploads',
  ): Promise<Array<{ url: string; key: string; size: number }>> {
    const uploadPromises = files.map((file) => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  /**
   * Delete file từ S3
   * @param key - S3 object key (VD: 'resumes/abc-123.pdf')
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('S3 Delete Error:', error);
      throw new BadRequestException(
        `Failed to delete file: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(keys: string[]): Promise<void> {
    const deletePromises = keys.map((key) => this.deleteFile(key));
    await Promise.all(deletePromises);
  }

  /**
   * Get signed URL (cho private files)
   * URL có thời hạn, tăng bảo mật
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('S3 Get Signed URL Error:', error);
      throw new BadRequestException(
        `Failed to generate signed URL: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Validate file trước khi upload
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${maxSize / 1024 / 1024}MB`,
      );
    }

    // Validate file type
    const allowedMimeTypes = [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`,
      );
    }
  }

  /**
   * Get public URL từ key (path-style)
   */
  getPublicUrl(key: string): string {
    return `https://s3.${this.region}.amazonaws.com/${this.bucketName}/${key}`;
  }

  /**
   * Lấy bucket name
   */
  getBucketName(): string {
    return this.bucketName;
  }

  /**
   * Lấy region
   */
  getRegion(): string {
    return this.region;
  }
}
