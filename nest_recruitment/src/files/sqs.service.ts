import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
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
}

interface S3EventNotificationBody {
  Records?: S3EventRecord[];
}
@Injectable()
export class SQSService {
  private readonly logger = new Logger(SQSService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string;

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

    if (!this.queueUrl) {
      throw new Error('AWS_SQS_QUEUE_URL is not configured');
    }

    this.logger.log(`SQS Service initialized with queue: ${this.queueUrl}`);
  }

  async receiveMessages(maxMessages: number = 10): Promise<SQSMessage[]> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 20, // Long polling
        VisibilityTimeout: 30, // Message invisible trong 30s khi đang xử lý
        AttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);

      if (!response.Messages || response.Messages.length === 0) {
        return [];
      }

      return response.Messages.map((msg) => {
        let parsedBody: S3EventNotificationBody;
        try {
          parsedBody = JSON.parse(msg.Body || '{}') as S3EventNotificationBody;
        } catch (error) {
          this.logger.error(`Failed to parse message body: ${msg.Body}`, error);
          parsedBody = { Records: [] };
        }

        return {
          MessageId: msg.MessageId!,
          ReceiptHandle: msg.ReceiptHandle!,
          Body: msg.Body!,
          Records: parsedBody.Records,
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
}
