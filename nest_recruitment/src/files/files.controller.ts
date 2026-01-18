// src/files/files.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  ForbiddenException,
  Headers,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ResponseMessage,
  SkipCheckPermission,
  User,
} from 'src/auth/decorator/customize';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import type { IUser } from 'src/users/users.interface';
import { SUPER_ADMIN } from 'src/casl/casl-ability.factory';

@ApiTags('files')
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Upload single file
   * Frontend gửi: folder_type trong headers để chọn folder
   */
  @Post('upload')
  @SkipCheckPermission()
  @ResponseMessage('Upload file successfully')
  @UseInterceptors(FileInterceptor('file')) // 'file' là field name trong FormData
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @User() user: IUser,
    @Headers('folder_type') folderType?: string,
  ) {
    const folder = folderType || 'uploads';
    const result = await this.filesService.uploadFile(file, user, folder);

    return {
      _id: result._id,
      fileName: result.fileName,
      url: result.s3Url,
      size: result.size,
    };
  }

  /**
   * Upload multiple files
   */
  @Post('upload-multiple')
  @SkipCheckPermission()
  @ResponseMessage('Upload multiple files successfully')
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @User() user: IUser,
    @Headers('folder_type') folderType?: string,
  ) {
    const folder = folderType || 'uploads';
    const results = await this.filesService.uploadFiles(files, user, folder);

    return results.map((file) => ({
      _id: file._id,
      fileName: file.fileName,
      url: file.s3Url,
      size: file.size,
    }));
  }

  /**
   * Get all files (with pagination)
   */
  @Get()
  @SkipCheckPermission()
  @ResponseMessage('Fetch files with pagination')
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @User() user: IUser,
  ) {
    // User chỉ xem files của mình
    // Admin xem tất cả
    if (user.role?.name === SUPER_ADMIN) {
      return this.filesService.findAll(+page, +limit);
    }

    return {
      data: await this.filesService.findByUser(user._id.toString()),
    };
  }

  /**
   * Get file by ID
   */
  @Get(':id')
  @SkipCheckPermission()
  @ResponseMessage('Fetch file by id')
  async findOne(@Param('id') id: string, @User() user: IUser) {
    const file = await this.filesService.findOne(id);

    // Check ownership
    if (
      file.createdBy?._id.toString() !== user._id.toString() &&
      user.role?.name !== SUPER_ADMIN
    ) {
      throw new ForbiddenException('You can only access your own files');
    }

    return file;
  }

  /**
   * Get signed URL (for private files)
   */
  @Get(':id/signed-url')
  @SkipCheckPermission()
  @ResponseMessage('Get signed URL')
  async getSignedUrl(
    @Param('id') id: string,
    @User() user: IUser,
    @Query('expiresIn') expiresIn: string = '3600',
  ) {
    const file = await this.filesService.findOne(id);

    // Check ownership
    if (
      file.createdBy?._id.toString() !== user._id.toString() &&
      user.role?.name !== SUPER_ADMIN
    ) {
      throw new ForbiddenException('You can only access your own files');
    }

    const signedUrl = await this.filesService.getSignedUrl(
      id,
      parseInt(expiresIn),
    );

    return { url: signedUrl, expiresIn: parseInt(expiresIn) };
  }

  /**
   * Delete file
   */
  @Delete(':id')
  @SkipCheckPermission()
  @ResponseMessage('Delete file successfully')
  async remove(@Param('id') id: string, @User() user: IUser) {
    const file = await this.filesService.findOne(id);

    // Check ownership
    if (
      file.createdBy?._id.toString() !== user._id.toString() &&
      user.role?.name !== SUPER_ADMIN
    ) {
      throw new ForbiddenException('You can only delete your own files');
    }

    await this.filesService.remove(id);
    return { message: 'File deleted successfully' };
  }
}

// import {
//   Controller,
//   Post,
//   UseInterceptors,
//   UploadedFile,
//   BadRequestException,
//   Headers,
// } from '@nestjs/common';
// import { FilesService } from './files.service';
// import { S3Service } from './s3.service';
// import { FileInterceptor } from '@nestjs/platform-express';
// import {
//   ResponseMessage,
//   SkipCheckPermission,
//   Public,
// } from 'src/auth/decorator/customize';
// import { ApiTags } from '@nestjs/swagger';

// @ApiTags('files')
// @Controller('files')
// export class FilesController {
//   constructor(
//     private readonly filesService: FilesService,
//     private readonly s3Service: S3Service,
//   ) {}

// @Public()
// @SkipCheckPermission()
// @ResponseMessage('Upload file to S3')
// @Post('/upload')
// @UseInterceptors(FileInterceptor('fileUpload')) // tên field sử dụng trong form-data
// async uploadFile(
//   @UploadedFile() file: Express.Multer.File,
//   @Headers('folder_type') folderType?: string,
// ) {
//   if (!file) {
//     throw new BadRequestException('No file uploaded');
//   }

//   try {
//     // Upload file lên S3
//     const result = await this.s3Service.uploadFile(
//       file,
//       folderType || 'default',
//     );

//     return {
//       fileName: result.fileName,
//       key: result.key,
//       url: result.url,
//       size: result.size,
//     };
//   } catch (error) {
//     throw new BadRequestException(
//       `File upload failed: ${(error as Error).message}`,
//     );
//   }
// }

// Nếu muốn lấy signed URL cho file riêng tư:
// @Get('/signed-url/:key')
// async getSignedUrl(@Param('key') key: string) {
//   try {
//     const url = await this.s3Service.getSignedUrl(decodeURIComponent(key));
//     return { url };
//   } catch (error) {
//     throw new BadRequestException(
//       `Failed to generate signed URL: ${(error as Error).message}`,
//     );
//   }
// }
// }
