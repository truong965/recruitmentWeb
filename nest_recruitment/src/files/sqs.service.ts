import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  ChangeMessageVisibilityCommand,
} from '@aws-sdk/client-sqs';

export interface S3EventRecord {
  eventName: string;
  eventTime: string;
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
      size: number;
      eTag: string;
      versionId?: string;
    };
  };
}

export interface SQSMessage {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
  Records?: S3EventRecord[];
  Attributes?: {
    ApproximateReceiveCount?: string;
  };
}

interface S3EventNotificationBody {
  Records?: S3EventRecord[];
}
@Injectable()
export class SQSService {
  private readonly logger = new Logger(SQSService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string;
  private readonly maxReceiveCount: number;

  constructor(private configService: ConfigService) {
    const region =
      this.configService.get<string>('AWS_REGION') || 'ap-southeast-1';

    this.sqsClient = new SQSClient({
      region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        )!,
      },
    });

    this.queueUrl = this.configService.get<string>('AWS_SQS_QUEUE_URL')!;
    this.maxReceiveCount =
      this.configService.get<number>('SQS_MAX_RECEIVE_COUNT') || 3;

    if (!this.queueUrl) {
      throw new Error('AWS_SQS_QUEUE_URL is not configured');
    }

    this.logger.log(`SQS Service initialized with queue: ${this.queueUrl}`);
    this.logger.log(`Max receive count: ${this.maxReceiveCount}`);
  }

  async receiveMessages(maxMessages: number = 10): Promise<SQSMessage[]> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 20, // [PERFORMANCE] Long Polling: Giữ kết nối 20s nếu chưa có tin nhắn -> Giảm số request rỗng, tiết kiệm chi phí.
        VisibilityTimeout: 30, // [SAFETY] Trong 30s này, message tàng hình với các worker khác để tránh xử lý trùng lặp (Double Processing).
        AttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);
      // [DEFENSIVE CODING] Xử lý parse JSON an toàn
      // Tránh crash worker nếu SQS nhận được tin nhắn rác không đúng định dạng JSON.
      if (!response.Messages || response.Messages.length === 0) {
        return [];
      }

      return response.Messages.map((msg) => {
        let parsedBody: S3EventNotificationBody;
        try {
          parsedBody = JSON.parse(msg.Body || '{}') as S3EventNotificationBody;
        } catch (error) {
          this.logger.error(`Failed to parse message body: ${msg.Body}`, error);
          parsedBody = { Records: [] }; // Fallback về mảng rỗng để không crash
        }

        return {
          MessageId: msg.MessageId!,
          ReceiptHandle: msg.ReceiptHandle!,
          Body: msg.Body!,
          Records: parsedBody.Records,
          Attributes: {
            ApproximateReceiveCount:
              msg.Attributes?.ApproximateReceiveCount || '0',
          },
        };
      });
    } catch (error) {
      this.logger.error('Failed to receive messages from SQS', error);
      throw error;
    }
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient.send(command);
      this.logger.debug(`Message deleted: ${receiptHandle}`);
    } catch (error) {
      this.logger.error(`Failed to delete message: ${receiptHandle}`, error);
      throw error;
    }
  }

  async extendVisibilityTimeout(
    receiptHandle: string,
    timeoutSeconds: number = 60,
  ): Promise<void> {
    try {
      const command = new ChangeMessageVisibilityCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: timeoutSeconds,
      });

      await this.sqsClient.send(command);
      this.logger.debug(
        `Extended visibility timeout to ${timeoutSeconds}s for message`,
      );
    } catch (error) {
      this.logger.error('Failed to extend visibility timeout', error);
      throw error;
    }
  }

  async getQueueAttributes(): Promise<any> {
    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.queueUrl,
        AttributeNames: [
          'ApproximateNumberOfMessages',
          'ApproximateNumberOfMessagesNotVisible',
        ],
      });

      const response = await this.sqsClient.send(command);
      return response.Attributes;
    } catch (error) {
      this.logger.error('Failed to get queue attributes', error);
      throw error;
    }
  }
  // [RETRY LOGIC] Kiểm tra số lần đã thử
  // Dựa vào thuộc tính ApproximateReceiveCount của SQS để biết tin nhắn này đã bị fail bao nhiêu lần.
  shouldRetry(message: SQSMessage): boolean {
    const receiveCount = parseInt(
      message.Attributes?.ApproximateReceiveCount || '0',
    );
    return receiveCount < this.maxReceiveCount;
  }
}
