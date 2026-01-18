import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { S3Service } from './s3.service';
import { MongooseModule } from '@nestjs/mongoose';
import { File, FileSchema } from './schemas/file.schema';

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
  providers: [FilesService, S3Service],
  exports: [FilesService, S3Service],
})
export class FilesModule {}
