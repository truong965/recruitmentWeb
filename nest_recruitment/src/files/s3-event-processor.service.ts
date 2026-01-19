import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SQSService, S3EventRecord, SQSMessage } from './sqs.service';
import { FileDocument, UploadStatus } from './schemas/file.schema';
import { FilesGateway } from './files.gateway';

@Injectable()
export class S3EventProcessorService {
  private readonly logger = new Logger(S3EventProcessorService.name);

  constructor(
    private sqsService: SQSService,
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
    private filesGateway: FilesGateway,
  ) {}

  async processMessages(): Promise<number> {
    let processedCount = 0;

    try {
      const messages = await this.sqsService.receiveMessages(10);

      if (messages.length === 0) {
        return 0;
      }

      this.logger.log(`Received ${messages.length} messages from SQS`);

      for (const message of messages) {
        try {
          await this.processMessage(message);

          await this.sqsService.deleteMessage(message.ReceiptHandle);
          processedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to process message ${message.MessageId}`,
            error,
          );
        }
      }

      this.logger.log(`Successfully processed ${processedCount} messages`);
    } catch (error) {
      this.logger.error('Error processing SQS messages', error);
    }

    return processedCount;
  }

  private async processMessage(message: SQSMessage): Promise<void> {
    if (!message.Records || message.Records.length === 0) {
      this.logger.warn(`Message ${message.MessageId} has no Records`);
      return;
    }

    for (const record of message.Records) {
      await this.processS3Event(record);
    }
  }

  private async processS3Event(record: S3EventRecord): Promise<void> {
    const eventName = record.eventName;
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    this.logger.log(`Processing S3 event: ${eventName} for key: ${s3Key}`);

    if (eventName.startsWith('ObjectCreated:')) {
      await this.handleObjectCreated(s3Key, record.s3.object);
    } else if (eventName.startsWith('ObjectRemoved:')) {
      await this.handleObjectRemoved(s3Key);
    }
  }

  private async handleObjectCreated(
    s3Key: string,
    s3Object: S3EventRecord['s3']['object'],
  ): Promise<void> {
    try {
      const file = await this.fileModel.findOne({ s3Key });

      if (!file) {
        this.logger.warn(`No database record found for S3 key: ${s3Key}`);
        return;
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
