import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { S3Service } from './s3.service';
import { MongooseModule } from '@nestjs/mongoose';
import { File, FileSchema } from './schemas/file.schema';
import { SQSService } from './sqs.service';
import { S3EventProcessorService } from './s3-event-processor.service';
import { S3EventWorkerService } from './s3-event-worker.service';
import { FilesGateway } from './files.gateway';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: File.name, schema: FileSchema }]),
    // Multer config cho memory storage (không lưu local nữa)
    MulterModule.register({
      storage: memoryStorage(), // Lưu trong RAM để upload lên S3
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    S3Service,
    SQSService,
    S3EventProcessorService,
    S3EventWorkerService,
    FilesGateway,
    JwtService,
  ],
  exports: [FilesService, S3Service],
})
export class FilesModule {}
