import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { S3EventProcessorService } from './s3-event-processor.service';
import { SQSService } from './sqs.service';

interface QueueAttributes {
  ApproximateNumberOfMessages?: string;
  [key: string]: string | undefined; // Cho phép các key khác
}
interface ProcessResult {
  processed: number;
  failed: number;
  retried: number;
}
@Injectable()
export class S3EventWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(S3EventWorkerService.name);
  private isProcessing = false;

  constructor(
    private s3EventProcessor: S3EventProcessorService,
    private sqsService: SQSService,
  ) {}

  async onModuleInit() {
    this.logger.log('S3 Event Worker initialized');

    await this.processQueue();
  }

  onModuleDestroy() {
    this.logger.log('S3 Event Worker shutting down');
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processQueue() {
    if (this.isProcessing) {
      this.logger.debug('Already processing, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      const attributes =
        (await this.sqsService.getQueueAttributes()) as QueueAttributes;
      const messageCountStr = attributes?.ApproximateNumberOfMessages ?? '0';

      const messageCount = parseInt(messageCountStr, 10);

      if (messageCount > 0) {
        this.logger.log(`Queue has ${messageCount} messages`);
      }

      const result = await this.s3EventProcessor.processMessages();

      if (result.processed > 0) {
        this.logger.log(`Processed ${result.processed} messages`);
      }
    } catch (error) {
      this.logger.error('Error in worker process', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processQueueManually(): Promise<ProcessResult> {
    this.logger.log('Manual queue processing triggered');
    return await this.s3EventProcessor.processMessages();
  }
}
