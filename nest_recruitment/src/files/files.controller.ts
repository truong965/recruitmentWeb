import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ResponseMessage,
  SkipCheckPermission,
} from 'src/auth/decorator/customize';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @SkipCheckPermission()
  @ResponseMessage('upload file')
  @Post('/upload')
  @UseInterceptors(FileInterceptor('fileUpload')) //tên field sử dụng trong form-data
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    return { fileName: file.filename };
  }

  // @ResponseMessage('upload file')
  // @Get(':id')
  // async getFile(@Param('id') id: string, @User user: IUser) {
  //   const file = await this.filesService.findOne(id);

  //   if (
  //     file.uploadedBy._id.toString() !== user._id.toString() &&
  //     user.role.name !== SUPER_ADMIN.toString()
  //   ) {
  //     throw new ForbiddenException();
  //   }

  //   return file;
  // }
}
