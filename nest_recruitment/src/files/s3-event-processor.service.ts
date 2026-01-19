import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SQSService, S3EventRecord, SQSMessage } from './sqs.service';
import { FileDocument, UploadStatus } from './schemas/file.schema';
import { FilesGateway } from './files.gateway';
// [CUSTOM ERROR] Định nghĩa lỗi có thể Retry được hay không
export class ProcessingError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean = true, //True = Thử lại, False = Bỏ qua
    public readonly context?: any,
  ) {
    super(message);
    this.name = 'ProcessingError';
  }
}

@Injectable()
export class S3EventProcessorService {
  private readonly logger = new Logger(S3EventProcessorService.name);

  constructor(
    private sqsService: SQSService,
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
    private filesGateway: FilesGateway,
  ) {}

  async processMessages(): Promise<{
    processed: number;
    failed: number;
    retried: number;
  }> {
    let processedCount = 0;
    let failedCount = 0;
    let retriedCount = 0;
    try {
      const messages = await this.sqsService.receiveMessages(10);

      if (messages.length === 0) {
        return { processed: 0, failed: 0, retried: 0 };
      }

      this.logger.log(`Received ${messages.length} messages from SQS`);

      for (const message of messages) {
        // Xử lý logic chính
        try {
          await this.processMessageWithRetry(message);
          // [SUCCESS] Xóa message khỏi hàng đợi
          // Chỉ xóa khi xử lý thành công hoàn toàn để đảm bảo "At-least-once delivery".
          await this.sqsService.deleteMessage(message.ReceiptHandle);
          processedCount++;
        } catch (error) {
          failedCount++;
          // [ERROR HANDLING STRATEGY] Phân loại lỗi
          if (error instanceof ProcessingError) {
            // Trường hợp 1: Lỗi có thể thử lại (VD: Timeout, DB connection)
            // VÀ chưa vượt quá số lần retry cho phép (shouldRetry)
            if (error.retryable && this.sqsService.shouldRetry(message)) {
              this.logger.warn(
                `Retryable error for message ${message.MessageId}: ${error.message}`,
              );
              retriedCount++;
              // KHÔNG XÓA MESSAGE: Để SQS tự động trả nó về hàng đợi sau thời gian VisibilityTimeout.
            } else {
              // Trường hợp 2: Lỗi không thể sửa (VD: Sai format, data rác)
              // HOẶC đã retry quá nhiều lần (Dead Letter Logic)
              // -> Xóa luôn message để tránh kẹt hàng đợi (Infinite Loop).
              this.logger.error(
                `Non-retryable error for message ${message.MessageId}`,
                error,
              );
              await this.sqsService.deleteMessage(message.ReceiptHandle);
            }
          } else {
            // Trường hợp 3: Lỗi không xác định (Unexpected)
            // Mặc định cho retry nếu còn quota.
            this.logger.error(
              `Unexpected error processing message ${message.MessageId}`,
              error,
            );

            if (this.sqsService.shouldRetry(message)) {
              retriedCount++;
            } else {
              await this.sqsService.deleteMessage(message.ReceiptHandle);
            }
          }
        }
      }

      this.logger.log(
        `Batch complete: ${processedCount} processed, ${failedCount} failed, ${retriedCount} retried`,
      );
    } catch (error) {
      this.logger.error('Error in batch processing', error);
    }

    return {
      processed: processedCount,
      failed: failedCount,
      retried: retriedCount,
    };
  }

  private async processMessageWithRetry(message: SQSMessage): Promise<void> {
    if (!message.Records || message.Records.length === 0) {
      throw new ProcessingError(
        `Message ${message.MessageId} has no Records`,
        false,
      );
    }

    for (const record of message.Records) {
      await this.processS3Event(record);
    }
  }

  private async processS3Event(record: S3EventRecord): Promise<void> {
    const eventName = record.eventName;
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    this.logger.log(`Processing S3 event: ${eventName} for key: ${s3Key}`);

    try {
      if (eventName.startsWith('ObjectCreated:')) {
        await this.handleObjectCreated(s3Key, record.s3.object);
      } else if (eventName.startsWith('ObjectRemoved:')) {
        await this.handleObjectRemoved(s3Key);
      }
    } catch (error) {
      // [ERROR CLASSIFICATION] Phân loại lỗi từ exception gốc
      if (error instanceof Error) {
        if (error.name === 'MongoServerError') {
          // Lỗi DB -> Có thể retry (True)
          throw new ProcessingError(`Database error: ${error.message}`, true, {
            s3Key,
          });
        }

        if (error.message.includes('timeout')) {
          throw new ProcessingError(`Timeout error: ${error.message}`, true, {
            s3Key,
          });
        }
      }
      // Lỗi logic code/format -> Không retry (False)
      throw new ProcessingError(`Failed to process S3 event: ${error}`, false, {
        s3Key,
        eventName,
      });
    }
  }

  private async handleObjectCreated(
    s3Key: string,
    s3Object: S3EventRecord['s3']['object'],
  ): Promise<void> {
    try {
      const file = await this.fileModel.findOne({ s3Key }).maxTimeMS(5000);

      if (!file) {
        this.logger.warn(`No database record found for S3 key: ${s3Key}`);
        throw new ProcessingError(
          `No database record for key: ${s3Key}`,
          false,
        );
      }

      if (file.status === UploadStatus.COMPLETED) {
        this.logger.debug(`File already marked as COMPLETED: ${s3Key}`);
        return;
      }

      file.status = UploadStatus.COMPLETED;
      file.uploadedAt = new Date();
      file.eTag = s3Object.eTag;
      file.versionId = s3Object.versionId;
      file.size = s3Object.size;

      await file.save();

      this.logger.log(`File upload completed: ${s3Key}`);

      if (!file.createdBy || !file.createdBy._id) {
        this.logger.warn(`File ${s3Key} has no createdBy information`);
        return;
      }

      const userId = file.createdBy._id.toString();

      try {
        this.filesGateway.notifyUploadComplete(userId, {
          fileId: file._id.toString(),
          fileName: file.fileName,
          originalName: file.originalName,
          s3Key: file.s3Key,
          size: file.size,
          mimeType: file.mimeType,
          status: file.status,
          uploadedAt: file.uploadedAt,
          eTag: file.eTag,
          versionId: file.versionId,
        });
        this.logger.log(`WebSocket notification sent to user ${userId}`);
      } catch (wsError) {
        this.logger.warn(
          `Failed to send WebSocket notification, but DB updated: ${wsError}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to update file status for ${s3Key}`, error);
      throw error;
    }
  }
  private async handleObjectRemoved(s3Key: string): Promise<void> {
    this.logger.log(`File removed from S3: ${s3Key}`);
    return Promise.resolve();
  }
}
