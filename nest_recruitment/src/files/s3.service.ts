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
   *  Generate Pre-signed URL for PUT (client upload trực tiếp)
   */
  async generatePresignedUploadUrl(
    fileName: string,
    mimeType: string,
    folder: string = 'uploads',
    expiresIn: number = 300, // 5 phút
  ): Promise<{
    uploadUrl: string;
    key: string;
    fields?: Record<string, string>;
  }> {
    try {
      // Generate unique key
      const fileExtension = path.extname(fileName);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const key = `${folder}/${uniqueFileName}`;

      // Tạo PUT command
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: mimeType,
        // Metadata bổ sung (optional)
        Metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Generate signed URL
      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return {
        uploadUrl,
        key,
      };
    } catch (error) {
      console.error('Generate Pre-signed URL Error:', error);
      throw new BadRequestException(
        `Failed to generate upload URL: ${(error as Error).message}`,
      );
    }
  }

  /**
   *  Verify file exists trên S3 (sau khi client upload)
   */
  async verifyFileExists(key: string): Promise<{
    exists: boolean;
    size?: number;
    eTag?: string;
    versionId?: string;
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        exists: true,
        size: response.ContentLength,
        eTag: response.ETag,
        versionId: response.VersionId,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFound') {
        return { exists: false };
      }
      throw error;
    }
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

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('S3 Get Signed URL Error:', error);
      throw new BadRequestException(
        `Failed to generate signed URL: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Validate file metadata trước khi generate pre-signed URL
   */
  validateFileMetadata(
    fileName: string,
    fileSize: number,
    mimeType: string,
  ): void {
    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    if (fileSize > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${maxSize / 1024 / 1024}MB`,
      );
    }

    if (fileSize <= 0) {
      throw new BadRequestException('File size must be greater than 0');
    }

    // Validate file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'video/mp4',
      'video/mpeg',
    ];

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException(`File type ${mimeType} is not allowed`);
    }

    // Validate filename
    if (!fileName || fileName.trim() === '') {
      throw new BadRequestException('File name is required');
    }
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
