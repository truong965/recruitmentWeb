import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MulterModuleOptions,
  MulterOptionsFactory,
} from '@nestjs/platform-express';
import fs from 'fs';
import { diskStorage } from 'multer';
import path, { join } from 'path';

@Injectable()
export class MulterConfigService implements MulterOptionsFactory {
  getRootPath = () => {
    return process.cwd();
  };

  ensureExists(targetDirectory: string) {
    // mkdirSync sẽ dừng code lại cho đến khi thư mục được tạo xong
    fs.mkdirSync(targetDirectory, { recursive: true });
  }
  createMulterOptions(): MulterModuleOptions {
    return {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const folderHeader = req?.headers?.folder_type ?? 'default';
          const folder = Array.isArray(folderHeader)
            ? folderHeader[0]
            : folderHeader;
          const fullPath = join(this.getRootPath(), `public/images/${folder}`);
          this.ensureExists(fullPath);
          cb(null, fullPath);
        },
        filename: (req, file, cb) => {
          //get image extension
          const extName = path.extname(file.originalname);
          //get image's name (without extension)
          const baseName = path.basename(file.originalname, extName);
          const finalName = `${baseName}-${Date.now()}${extName}`;
          cb(null, finalName);
        },
      }),
      // Validate trước khi lưu file
      fileFilter: (req, file, cb) => {
        // Regex cho phép: Ảnh, Text, PDF, Word
        const allowedTypes =
          /.(jpg|jpeg|png|gif|plain|pdf|msword|wordprocessingml)/i;

        // Kiểm tra MimeType
        if (file.mimetype.match(allowedTypes)) {
          cb(null, true); // Cho phép
        } else {
          // Từ chối và báo lỗi custom
          cb(
            new BadRequestException(
              `Không hỗ trợ định dạng file: ${file.mimetype}`,
            ),
            false,
          );
        }
      },

      // Giới hạn dung lượng
      limits: {
        fileSize: 1024 * 1024, // 1MB
      },
    };
  }
}
