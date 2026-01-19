import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { FilesService } from './files.service';
import {
  ResponseMessage,
  SkipCheckPermission,
  User,
} from 'src/auth/decorator/customize';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import type { IUser } from 'src/users/users.interface';
import { SUPER_ADMIN } from 'src/casl/casl-ability.factory';
import { RequestUploadDto } from './dto/request-upload.dto';

@ApiTags('files')
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * PHASE 1: Request upload - Lấy pre-signed URL
   */
  @Post('request-upload')
  @SkipCheckPermission()
  @ResponseMessage('Generated pre-signed upload URL')
  async requestUpload(@Body() dto: RequestUploadDto, @User() user: IUser) {
    const result = await this.filesService.requestUpload(dto, user);

    return {
      uploadUrl: result.uploadUrl,
      fileId: result.fileId,
      fileKey: result.fileKey,
      expiresIn: result.expiresIn,
      instructions: {
        method: 'PUT',
        headers: {
          'Content-Type': dto.mimeType,
        },
        note: 'Upload file binary directly to uploadUrl using PUT method',
      },
    };
  }

  /**
   * PHASE 1: Confirm upload - Client báo đã upload xong (tạm thời)
   */
  // @Post(':id/confirm')
  // @SkipCheckPermission()
  // @ResponseMessage('Upload confirmed')
  // async confirmUpload(@Param('id') id: string, @User() user: IUser) {
  //   const file = await this.filesService.confirmUpload(id, user);

  //   return {
  //     _id: file._id,
  //     fileName: file.fileName,
  //     status: file.status,
  //     size: file.size,
  //     uploadedAt: file.uploadedAt,
  //   };
  // }

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

    if (
      file.createdBy?._id.toString() !== user._id.toString() &&
      user.role?.name !== SUPER_ADMIN
    ) {
      throw new ForbiddenException('You can only access your own files');
    }

    return file;
  }

  /**
   * Get signed URL (for download private files)
   */
  @Get(':id/download-url')
  @SkipCheckPermission()
  @ResponseMessage('Get signed download URL')
  async getDownloadUrl(
    @Param('id') id: string,
    @User() user: IUser,
    @Query('expiresIn') expiresIn: string = '3600',
  ) {
    const file = await this.filesService.findOne(id);

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
