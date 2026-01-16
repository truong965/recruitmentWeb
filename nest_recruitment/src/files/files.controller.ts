import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResponseMessage } from 'src/auth/decorator/customize';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @ResponseMessage('upload file')
  @Post('/upload')
  @UseInterceptors(FileInterceptor('fileUpload')) //tên field sử dụng trong form-data
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    return { fileName: file.filename };
  }
}
