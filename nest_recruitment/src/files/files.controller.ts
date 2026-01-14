import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResponseMessage } from 'src/auth/decorator/customize';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @ResponseMessage('upload file')
  @Post('/upload')
  @UseInterceptors(FileInterceptor('file')) //tên field sử dụng trong form-data
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    return { fileName: file.filename };
  }
}
